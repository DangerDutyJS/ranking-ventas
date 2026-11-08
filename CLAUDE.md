# ranking_ventas

## Descripción
Plataforma de ranking de ventas en tiempo real para tiendas. Cada líder gestiona su propio equipo de asesores. Los asesores registran ventas diarias con un PIN personal y ven su posición en el ranking. Publicada en https://ranking-ventas.web.app

## Stack tecnológico
- **Framework:** Next.js 16.2.6 (App Router, Turbopack)
- **Base de datos:** Firebase Firestore (tiempo real con `onSnapshot`)
- **Autenticación:** Firebase Auth — solo Google Sign-In
- **Estilos:** Tailwind CSS v4 — diseño editorial con dot-grid, glassmorphism en login, acento de gradiente en headers
- **Deploy:** Firebase Hosting — static export (`output: 'export'`)

## Estructura de archivos clave

```
src/
├── app/
│   ├── layout.tsx          — AuthProvider global, fuente Geist
│   ├── page.tsx            — Dashboard principal: ranking en tiempo real
│   ├── login/page.tsx      — Login con Google
│   ├── lider/page.tsx      — Panel líder (protegido por sessionStorage)
│   └── tv/page.tsx         — Modo TV: pantalla completa rotativa para la tienda (solo lectura)
├── components/
│   ├── LeaderModal.tsx     — Modal crear/verificar contraseña de líder
│   ├── AsesorForm.tsx      — Formulario registro de asesor con foto
│   ├── AsesorList.tsx      — Lista asesores + botón asignar PIN
│   ├── AsignarPinModal.tsx — Modal asignar/cambiar PIN (4 dígitos)
│   ├── PinModal.tsx        — Modal ingresar PIN para registrar venta
│   ├── VentasModal.tsx     — Modal registrar monto + unidades + transacciones del día
│   ├── AcumuladoMesModal.tsx — Modal ingresar acumulado del mes (ventas no registradas por día); NO afecta ranking de hoy
│   ├── MetaMes.tsx         — Configurar meta mensual, días laborados e indicadores de referencia (sin ajuste proporcional visible)
│   ├── MetasDiarias.tsx    — Meta del día actual: Txn/Uds + presupuesto diario con selección de asesores + calendario visual del mes
│   ├── DinamicasTab.tsx    — Tab "Dinámicas" del panel líder: form + lista + progreso por asesor
│   ├── DinamicaProgressModal.tsx — Modal para que el asesor registre su total en una dinámica (post-PIN)
│   ├── TutorialModal.tsx   — Tutorial de onboarding (primer ingreso)
│   ├── EditorVentasMes.tsx — Editor masivo del ranking mensual (panel líder, tab "Ventas del mes")
│   ├── HistorialTab.tsx    — Historial de todos los meses (panel líder, tab "Historial"): filtros + eliminar por rango de fechas
│   ├── CelebracionVenta.tsx — Aviso flotante con trofeo "label · asesor" al detectar una nueva entrada (tema Motivación de ventas)
│   ├── ChipsMotivacion.tsx — Fila de chips de logros (🔥 racha, 📈 récord, 🚀 mayor progreso, insignias) — dashboard y modo TV
│   ├── ReconocimientosTab.tsx — Tab "Reconocimientos" del panel líder: enviar/eliminar aplausos
│   ├── PlacaReconocimiento.tsx — Placa animada post-venta (dorada + confeti)
│   ├── PuntajeRanking.tsx  — Desglose del puntaje ponderado en tarjetas del ranking mensual
│   └── ConfigRankingPanel.tsx — Parámetros del puntaje (topes y umbral) en "Meta del mes"
├── context/
│   ├── AuthContext.tsx     — Estado Firebase Auth + cookie auth-session
│   └── StoreContext.tsx    — Provee storeId (uid del líder) a componentes
├── lib/
│   ├── firebase.ts         — Init Firebase (auth, db, googleProvider)
│   ├── leaderAuth.ts       — Crear/verificar contraseña de líder
│   ├── hash.ts             — SHA-256 con Web Crypto API
│   ├── calcularMetas.ts    — calcularMetas() y distribuirIndicador() para distribución proporcional
│   ├── reglas.ts           — REGLAS CONGELADAS: totalReal, barColor, calcularComision, SIGUIENTE_NIVEL + puntaje ponderado (calcularScoreRanking, compararRanking, calcularComisionPorPuntaje, ConfigRanking)
│   ├── ranking.ts          — calcularScores, ordenarPorScore, useConfigRanking (config/ranking en Firestore)
│   └── motivacion.ts       — Capa de motivación de solo lectura: rachas, récord, ritmo, consejos, insignias, mayor progreso, hitos, retos relámpago
└── proxy.ts                — Protección de rutas (reemplaza middleware.ts en Next.js 16)
```

## Arquitectura multi-tenant (IMPORTANTE)
Cada líder tiene sus datos aislados bajo `tiendas/{uid}/` en Firestore. El `uid` del usuario autenticado es el identificador de la tienda.

```
tiendas/{uid}/
├── config/leader           — { passwordHash }
├── asesores/{asesorId}     — { nombre, apellido, cargo, fotoBase64, pinHash, creadoEn }
├── metas/{mes}             — { montoTotal, asesores: { [id]: { diasLaborados } },
│                              metaTransacciones?, metaUnidades?,
│                              metasPorDia: { "0"–"6": { upt, avt?, txn, uds, monto?, asesoresIds? } },
│                              actualizadoEn }
│                              (upt/avt en metasPorDia son calculados: UPT=metaUnidades/metaTransacciones,
│                               AVT=montoTotal/metaTransacciones — no se ingresan manualmente)
├── ventasMes/{mes_uid}     — { mes, asesorId, totalVentas, totalUnidades, totalTransacciones,
                               registros: [{ monto, unidades, transacciones, fecha, creadoEn }],
│                              acumuladoMes?: { monto, unidades, transacciones } }
├── aplausos/{id}           — { asesorId, mensaje (≤120), fecha 'YYYY-MM-DD', creadoEn } — reconocimientos de la líder
└── config/ranking          — { pesoVenta, pesoUPT, pesoAVT, topeUPT, topeAVT, umbralRescate, actualizadoEn } — parámetros del puntaje
```

`StoreContext` provee `storeId` a todos los componentes:
```tsx
// En page.tsx y lider/page.tsx:
<StoreProvider storeId={user.uid}>...</StoreProvider>

// En cualquier componente hijo:
const storeId = useStoreId();
const ref = doc(db, 'tiendas', storeId, 'asesores', asesorId);
```

## Reglas de Firestore
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tiendas/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Flujo de autenticación y acceso
1. Google Sign-In → Firebase Auth → cookie `auth-session` → `proxy.ts` protege rutas
2. `page.tsx` redirige a `/login` si no hay `user`
3. Botón "Líder" en header → `LeaderModal` → contraseña hasheada → `sessionStorage('leader-access')`
4. `/lider` verifica `sessionStorage` — si no existe redirige a `/`
5. La sesión de líder se limpia al cerrar el navegador (sessionStorage)

## Seguridad
- Contraseña de líder: SHA-256 guardada en `tiendas/{uid}/config/leader`
- PIN de asesor: SHA-256 guardado en el documento del asesor (`pinHash`)
- Hash con Web Crypto API (`src/lib/hash.ts`) — nunca se guarda texto plano
- `autoComplete="off"` en todos los forms, `autoComplete="new-password"` en campos de contraseña/PIN
- Fotos de asesores: base64 en Firestore (Canvas 150×150px, JPEG 0.75) — sin Firebase Storage

## Funcionalidades implementadas

### Dashboard principal (`/`)
- Ranking en tiempo real; **ranking mensual ordenado por PUNTAJE PONDERADO** (desde 2026-11-08, ver "Puntaje ponderado del ranking mensual"); desempate por dinero real `totalVentas + acumuladoMes.monto`
- Medallas 🥇🥈🥉 para los primeros 3
- Barra de progreso mensual con rango 0–120%, marcadores en 100%, 110%, 120% (puntos de color sobre la barra + etiquetas)
- Colores de barra y marcadores: rojo → naranja → ámbar → teal → **verde (100%)** → **azul (110%)** → **celeste (120%)**
- Premios por nivel: 📌 Pin al 100% · 🎁 Bono corral al 110% · 🏖️ Día libre al 120%
- **Mini-barra "siguiente nivel"** en tarjetas del ranking mensual: cuando el asesor está entre 100–109% aparece una mini-barra azul/índigo "Siguiente: 🎁 Bono corral" con progreso de 100% a 110% y etiqueta "+X% más"; entre 110–119% aparece mini-barra sky "Siguiente: 🏖️ Día libre" hacia 120%. Desaparece al llegar a 120%.
- Badge motivacional: "¡Empieza hoy!" → "¡Buen ritmo!" → "¡Meta cumplida!" → "¡Por encima!" → "¡Top absoluto!"
- **Indicadores de gestión con barras de progreso** (`IndicatorBar`): cada indicador muestra valor actual / meta + barra de color + % semántico (verde ≥100%, ámbar ≥80%, rojo <80%). Colores fijos por tipo:
  - Monto → esmeralda/verde · AVT → azul/índigo · UPT → teal/cyan · Txn → violeta/púrpura · Uds → naranja/ámbar
- Txn y Unidades: targets per-asesor distribuidos proporcionalmente por días laborados; si el asesor no está en `meta.asesores`, usa división igual (`total / n`) como fallback
- UPT y AVT: targets derivados automáticamente — `AVT = montoTotal / metaTransacciones`, `UPT = metaUnidades / metaTransacciones`. No se ingresan manualmente. El ranking diario usa `metasPorDia[hoy.getDay()].upt/.avt` (escritos al guardar metas diarias con los mismos valores derivados). El ranking mensual los recalcula en render desde `meta`. Si no hay `metaTransacciones`, no se muestran barras de UPT/AVT.
- Txn, Uds y Monto siguen siendo targets manuales (configurados por el líder).
- **Resumen del mes** (`resumenMes` en `page.tsx`, arriba del ranking mensual): "Acumulado del mes · todos los asesores" = fila TOTAL de la hoja (meta total, venta real y % de la meta, comisiones del mes con `calcularComisionPorPuntaje`, asesores en comisión). El rótulo "Acumulado ingresado" de la tarjeta pasó a "Cargado por la líder (incluido en el importe)" con `title` explicativo.
- **Pestañas "Ranking de hoy" / "Ranking mensual"** (pedido del usuario 2026-11-08): control segmentado bajo el encabezado del mes, **fijo al hacer scroll** (`sticky top-[65px]`, `role=tablist`, flechas ←/→). Abre en **Hoy** si la líder configuró `asesoresIds` para hoy; si no, en **Mensual** (estado `vistaRanking`: null = automático). Solo se renderiza el panel activo (`#panel-hoy` / `#panel-mensual`). Al cambiar estando más abajo, `elegirVista` sube hasta las pestañas (smooth salvo reduced motion). Sin asesores de hoy, la pestaña Hoy explica que se eligen en Panel líder → Metas diarias. Hero, avance del equipo y reconocimientos quedan arriba, fuera de las pestañas.
- **Estructura del dashboard — dos secciones, solo mes actual (desde 2026-08):** (hoy se muestran como pestañas, ver arriba)
  - **"Ranking de hoy"** (sección superior, clickeable): se muestra SOLO cuando el líder configuró `asesoresIds` para ese día. Muestra únicamente los asesores seleccionados, ordenados por `pctCombinadoHoy()` (promedio de %Txn + %Uds + %Monto — misma fórmula que el badge "General" visible en cada tarjeta). Tarjetas: barra "General" combinada + bloque unificado `IndicatorBar` para Txn/Uds/Monto/UPT/AVT.
  - **"Ranking mensual"** (sección central, siempre visible, clickeable): muestra TODOS los asesores sin excepción, ordenados por total real. Incluye barra 0-120% + bloque `IndicatorBar` (Monto/AVT/UPT/Txn/Uds) + beneficios + tabla de comisiones. Sección "Hoy" al fondo solo cuando NO hay ranking de hoy activo.
  - **El dashboard YA NO muestra "Mes anterior".** Esa sección se movió al panel líder → tab "Historial" (ver abajo) para reducir el ruido visual en la vista principal. Decisión del usuario (2026-08-31): "se ve muy saturado, quiero mostrar solo datos del mes actual".
- **Tabla de comisiones por asesor** (`TablaComisionesAsesor` + `calcularComision` en `page.tsx`): visible en cada tarjeta del ranking mensual cuando hay meta asignada. Lógica: Amarillo 90–99.99% → 0.65%, Verde 100–109.99% → 1.10%, Azul 110–119.99% → 1.20%, Celeste ≥120% → 1.30%. Destaca el nivel activo con borde izquierdo de color. Muestra comisión estimada en dinero (vendido × %) y montos faltantes para llegar a 90%, 100% y 120%.
- **Aviso motivador por tarjeta** (`AvisoMotivador` en `page.tsx`, ranking mensual, agregado 2026-11-04): un solo mensaje bajo el encabezado de la tarjeta, nunca en el 1º.
  - **2º a 4º — "persigue al de arriba":** "🎯 Te faltan $X para pasar a [nombre] · unas N ventas de tu ticket promedio" (`N = ceil(gap / AVT propio)`; sin AVT se omite la parte de ventas). Con empate: "🔥 ¡Empatado con [nombre]! Una venta más y pasas al Nº lugar". Compara con el puesto **inmediato superior**, no con el 1º (más alcanzable).
  - **5º en adelante — comisión:** "💰 Te faltan $X para la comisión [Amarilla/Verde/Azul/Celeste] (tasa%) · tu comisión sería $Y" usando `SIGUIENTE_NIVEL` (90/100/110/120% → 0.65/1.10/1.20/1.30%, mismos tramos que `calcularComision`); `Y = monto del umbral × tasa`. También es el fallback del 2º–4º si no hubiera asesor arriba. Sin meta o ≥120% no se muestra.
  - Regla de tono: nunca mensajes negativos ("vas último"), y nunca la distancia al 1º para puestos bajos.
- **Aviso de adelantamiento:** el `onSnapshot` de `ventasMes` calcula posiciones por `totalReal()` (`prevPosicionesRef`); si un asesor mejora su puesto, `CelebracionVenta` muestra "¡Subió al Nº lugar!" en lugar de "Nueva venta". Primer snapshot = línea base. `totalReal(vm)` = `totalVentas + acumuladoMes.monto`, compartido con el sort del ranking mensual.
- **Aviso post-venta** (`AvisoPostVenta` en `HistorialVentasDiaModal.tsx`, agregado 2026-11-04): al registrar una venta del día, sobre el botón "+ Registrar venta" aparece "Venta guardada." + mensaje según la posición mensual **ya con la venta sumada** (`calcularResultado`, se calcula al instante con el prop `rankingMes` que pasa `page.tsx` — `{id, nombre, total: totalReal()}` de todos los asesores — sin esperar al snapshot):
  - 1º: "¡Llegaste al / Sigues en el 1º lugar! Le llevas $X a [2º]".
  - 2º–4º: "¡Subiste al Nº lugar! / Vas en el Nº lugar. Ahora estás a $X de [el de arriba]".
  - 5º+: "(¡Subiste al Nº lugar!) Llevas $X este mes" — sin distancia (regla de tono).
  - Posición = asesores con total estrictamente mayor + 1 (empates comparten puesto). Ícono 🏆 si subió o es 1º, ✅ si no. Se oculta al abrir de nuevo el formulario. `role="status"`.
- `asesoresHoy`: array vacío si no hay `asesoresIds` configurados. `showDailySection = asesoresHoy.length > 0`.
- Clic en tarjeta **ranking de hoy** → PIN → `HistorialVentasDiaModal` (registra venta del día con `increment()` + `arrayUnion()`). **Dos vistas separadas** (pedido del usuario 2026-11-08, estado `vista`): **Registrar** (por defecto: formulario, aviso/placa post-venta, dinámicas; SIN línea de texto "ver historial", solo el ícono) e **Historial** (total del día + lista con editar/eliminar + botón fijo "+ Registrar venta"). El ícono de reloj del encabezado alterna entre vistas (`aria-pressed`). **Su contador dorado muestra solo ventas NUEVAS** (no vistas): registros con `creadoEn` posterior al último visto, guardado en `localStorage('historial-visto:{storeId}:{asesorId}:{fecha}')` (por dispositivo, asesor y día; try/catch). Se marcan vistas al entrar/salir del historial (`cambiarVista`) y al cerrar estando en él (`cerrar`); no se usa efecto. **Alto:** `max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh]` (en celular `vh` ignora la barra del navegador y escondía la parte de arriba); encabezado, total y botón con `shrink-0`; solo la lista hace scroll (`overscroll-contain`).
- Clic en tarjeta **ranking mensual** → PIN → `HistorialAcumuladoModal` con dos tabs:
  - **"Ventas diarias"** (tab activo por defecto): muestra todos los `registros[]` del mes actual agrupados por fecha, más reciente primero. Cada entrada tiene editar y eliminar; ajusta `totalVentas/totalUnidades/totalTransacciones` con `increment(delta)`. Resuelve la pérdida de acceso a los registros del día anterior tras cerrar el ranking de hoy.
  - **"Acumulado del mes"**: entradas manuales de `acumuladoMes` con agregar/editar/eliminar (comportamiento anterior).
  - Ambos tabs leen del mismo `onSnapshot` sobre `ventasMes/{mes}_{asesorId}` — un solo listener. Los datos son del mes actual exclusivamente (cada mes tiene su propio documento).
- `acumuladoMes` se suma al total mensual visible pero NO aparece en `registros[]`, por lo que no afecta `ventaHoyMap` ni el ranking de hoy
- `pctCombinadoHoy(asesorId)`: función que calcula el promedio de los porcentajes disponibles (Txn, Uds, Monto) para ordenar el ranking de hoy. Es la misma lógica que el badge "General" en las tarjetas — garantiza que el orden visual coincida con los números mostrados. El mapa `ventaHoyMap` se calcula una vez fuera del render.
- **Retención de datos: indefinida (desde 2026-08-31).** Se eliminó el borrado automático de `ventasMes`/`metas` de hace 2 meses que existía antes. Ahora todo el historial se conserva en Firestore sin límite de tiempo, para que el tab "Historial" del panel líder pueda mostrarlo. Decisión explícita del usuario tras evaluar el trade-off (más lecturas/almacenamiento con el tiempo, pero volumen bajo para este caso de uso — pocos asesores, un doc por mes).

### Puntaje ponderado del ranking mensual (2026-11-08, autorizado por el usuario)
Reemplaza el orden por dinero del ranking **mensual** (dashboard, modo TV, avisos de puesto, aviso/placa post-venta, `AvisoMotivador`, Historial). El **ranking de hoy NO cambia** (`pctCombinadoHoy`).
- **Fórmula** (`calcularScoreRanking` en `src/lib/reglas.ts`): `score = %Venta·0.80 + %UPT·0.10 + %AVT·0.10`. %Venta = venta real (incl. acumulado) / meta mensual del asesor (`calcularMetas`); UPT = uds/txn y AVT = venta/txn del asesor vs meta de la tienda (`metasUptAvt`: manual `metaUPT/metaAVT` si existe, si no derivada).
- **Tope y umbral — por defecto DESACTIVADOS, igual que la hoja de la empresa** (decisión del usuario 2026-11-08 tras comparar con la hoja real de noviembre): `topeUPT = topeAVT = 0` (sin tope: un AVT de 135% cuenta completo) y `umbralRescate = 0` (UPT/AVT > 100% suman aunque la venta sea baja). Siguen como parámetros opcionales en el panel: tope > 0 (100–1000) limita el % que cuenta; umbral > 0 exige ese % de venta para pasar de 100%. "Rescate" = puntos de UPT/AVT por encima de su 100%.
- **Piso:** si %Venta ≥ 100, UPT/AVT cuentan mínimo 100% (no le quitan el 100% a quien trajo la plata). Bajo 100% de venta, un UPT/AVT bajo SÍ resta (premia calidad de venta).
- **Mínimo de ventas** (`minTxnIndicadores`, 10 por defecto, decisión del usuario 2026-11-08): con menos transacciones en el mes, UPT/AVT aportan 0 (`limitadoPor: 'minimo'`, tarjeta: "aún no suma" + "UPT y AVT suman desde 10 ventas en el mes (llevas N)"); evita que una venta suelta regale ~20 pts (caso real: 3% de venta daba 22 pts → ahora 2). Si %Venta ≥ 100 aplica solo el piso (exactamente 100%, sin extra). `ScoreRanking` expone `indicadoresActivos` y `transacciones`.
- Sin meta UPT/AVT → su peso pasa a la venta. Sin meta de venta → `score` null (va al final, ordenado por dinero). Sin transacciones → UPT/AVT aportan 0.
- **Orden:** `compararRanking` (score desc → dinero desc → sin meta al final); `ordenarPorScore` + `calcularScores` en `src/lib/ranking.ts`.
- **Comisiones y premios por CUMPLIMIENTO TOTAL (= puntaje), como la hoja** (decisión del usuario 2026-11-08): `calcularComisionPorPuntaje(meta, venta, score, pesoVenta)` decide el tramo con el PUNTAJE (Amarillo ≥90 → 0,65% · Verde ≥100 → 1,10% · Azul ≥110 → 1,20% · Celeste ≥120 → 1,30%; reutiliza `calcularComision(100, score)`, que no se modificó) y **paga sobre la venta real completa (sin ×0,81 "sin IVA")**. Los "Para 90/100/110/120% ≈ $X" son el dinero aproximado que falta vender (1 pt = meta/(100·pesoVenta)). En la tarjeta la barra principal se llama **"Cumplimiento total"** y usa el puntaje (barra 0–120, marcadores, badge `motivacion`, premios Pin/Bono corral/Día libre y mini-barra "Siguiente"); "Importe / Falta para meta / Promedio por día" y la barra Monto siguen en dinero. Modo TV: barra = cumplimiento total. Aviso del 5º+ y ritmo post-venta: siguiente tramo por puntaje (`ritmoSiguienteNivel(score, meta, pesoVenta, dias)`). Placa: tramo nuevo por puntaje. **Verificado contra la hoja real**: Ramírez Camilo (87% venta, 93,55) → $770.528,93; Tamayo (95%, 102,75) → $1.426.700,46; Tobón 72,15 / Bustamante 66,06 / Zapata 62,00 sin comisión. Pendiente: las **cajeras** (indicador SLA, ej. 161/164) no se modelan en la app.
- **Config:** `tiendas/{uid}/config/ranking` `{ pesoVenta, pesoUPT, pesoAVT, topeUPT, topeAVT, umbralRescate }`, leída con `useConfigRanking` y validada con `normalizarConfigRanking` (fuera de rango → default; pesos que no suman 1 → 0.8/0.1/0.1). Se edita en `ConfigRankingPanel.tsx` (dentro de `MetaMes`, vista y formulario): topes 100–300, umbral 50–100, mínimo de ventas 0–500; pesos solo lectura. Muestra desde qué % de venta es posible el rescate. El Historial aplica la config ACTUAL a todos los meses.
- **UI:** `PuntajeRanking.tsx` en cada tarjeta mensual (score + Venta/UPT/AVT con % → pts y nota "llegó al tope" / "cuenta máx. 100%" / "protegido en 100%", chips dorados "🛟 Rescate +X pts" y "📌 100% alcanzado por rescate", aviso de umbral). `AvisoMotivador` 2º–4º: "Te faltan X pts para pasar a [nombre] · ≈ $Y en ventas" (Y = pts · metaMensual / (100·pesoVenta)). `AvisoPostVenta` usa pts (o $ si empatan en puntos). Placa: título "¡Tu UPT y AVT te llevaron al 100%! 🛟" (`rescate100Nuevo`). Ritmo post-venta y comisión del 5º+ saltan el Verde si ya está desbloqueado por rescate. TV: "N pts · 🛟 +X rescate". Historial: columna "Puntaje" y orden "Puntaje ranking".
- `onSnapshot` de ventas (dashboard y TV) calcula posiciones por puntaje con `posicionesPorScore` usando `scoreCtxRef` (asesores/meta/config actuales, sincronizado con `useEffect`). **La línea base (`prevPosicionesRef` / `prevRef.pos`) se recalcula en un `useEffect` cuando cambian asesores/meta/config** (con `ultimoMapRef`): si no, el primer snapshot (antes de cargar la meta) ordenaba por dinero y la siguiente venta mostraba un "¡Subió al Nº lugar!" falso a quien había bajado (bug encontrado en prueba real 2026-11-08).
- `MetaMes`: vaciar la meta manual de UPT/AVT ahora borra el campo con `deleteField()` (antes `merge` conservaba el valor viejo).
- **Pruebas:** `tests/reglas.test.ts` (20 casos: **filas reales de la hoja** (Camilo, Tamayo, Tobón/Bustamante/Zapata), sin tope/umbral por defecto, tope y umbral opcionales, piso, mínimo de ventas, pesos sin meta, orden, comisión por puntaje, regla congelada `calcularComision`, config, metas UPT/AVT). Correr `npm test` (`node --test`, sin dependencias; Node ≥ 23.6 ejecuta TS). `tests/` está excluido del `tsconfig`.

### Capa de motivación (agregada 2026-11-08) — NO altera ranking ni beneficios
Pedido del usuario: premiar la **constancia** (que los asesores quieran registrar sus ventas) con mensajes emotivos según rendimiento y consejos de venta cuando hagan falta. **Regla dura del usuario: el orden del ranking y los topes que dan beneficios (comisiones 90/100/110/120% y premios 📌🎁🏖️) no pueden cambiar.**
- **Garantía:** las reglas viven en `src/lib/reglas.ts` (movidas verbatim desde `page.tsx`, verificado con diff). Todo lo nuevo está en `src/lib/motivacion.ts` (funciones puras, sin escrituras) y solo importa de `reglas.ts` — nunca copiar umbrales. Lo que necesita guardar datos usa una colección nueva (`aplausos`), nunca `ventasMes`/`metas`.
- **🔥 Racha** (`calcularRacha`): días seguidos registrando al menos una venta (opción "constancia" elegida por el usuario). Solo cuentan los días con actividad en la tienda (si nadie registró, no rompe); no rompe los días que la líder no le asignó al asesor en `metasPorDia[dow].asesoresIds` (solo mes actual); hoy no rompe mientras no termine. Cruza meses (usa todos los docs de `ventasMes`, que el listener del dashboard ya leía). Chip "🔥 N días · ¡registra hoy!" cuando aún no registró hoy.
- **📈 Récord personal** (`mejorMesAnterior(docs, id, mes, minimoRecord(metaMensual))`): solo cuentan meses **representativos** (≥ 50% de la meta mensual actual del asesor; sin meta no hay récord). Chip "+X%" y desde +100% "📈 Más del doble de tu mejor mes" — **nunca un porcentaje exagerado** (requisito del usuario tras ver "+3900%" por un mes de $5.000). Aplica también a la placa/aviso post-venta y al modo TV.
- **🎖️ Insignias** (`calcularInsignias`, al vuelo): ☀️ Primera venta del día · 💎 Venta más alta del mes · 🛍️ Más unidades en una venta (≥2).
- **🚀 Mayor progreso de la semana** (`mayorProgresoSemana`): últimos 7 días vs 7 anteriores en % relativo (gana quien más mejoró respecto a sí mismo, no quien más vende).
- Chips (`ChipsMotivacion`) en tarjetas del ranking de hoy y mensual, debajo del encabezado. En tarjetas se limita a `max={3}` (los demás como chip "+N" con `title` y texto `sr-only`) para no saturar; en modo TV se muestran todos. Auditado con Impeccable (2026-11-08): sin hallazgos nuevos; aviso post-venta usa `text-[#d1fae5]` (no gris sobre verde).
- **Mensaje post-venta** (`MotivacionPostVenta` dentro de `AvisoPostVenta`, `HistorialVentasDiaModal.tsx`): debajo del mensaje de posición: 🔥 mensaje de racha (`mensajeRacha`, hitos 3/5/7/10/15/20/25/30) · 📈 récord o ⭐ mensaje por rendimiento (`mensajeRendimiento`, tono siempre positivo) · ⏱️ ritmo por día hacia la siguiente comisión (`ritmoSiguienteNivel`, usa `SIGUIENTE_NIVEL`) · 💡 consejo de venta (ropa y tenis) para el indicador más rezagado <100% (`indicadorMasBajo` + `tipVentas`; Txn se compara contra lo esperado a esta altura del mes). Si todo está ≥100% no hay consejo. `page.tsx` pasa el prop `contexto` (`ContextoMotivacion`) con `contextoMotivacion(id)`.
- **🏅 Placa de reconocimiento** (`PlacaReconocimiento.tsx`, agregada 2026-11-08, estilo elegido por el usuario: "placa dorada + confeti"): al guardar una venta en `HistorialVentasDiaModal` aparece encima (z-70) una placa con banda azul marino "RECONOCIMIENTO", foto del asesor en medalla dorada con 🏆, **título del logro más importante** (`armarPlaca`, prioridad: nuevo récord > día libre 120% > bono corral 110% > meta cumplida 100% > llegó al 1º > subió de puesto > hito de racha > primera venta del día > "¡Vas muy bien!"/variantes), monto con contador (ease-out 800ms, rAF), chips 🔥 racha · % de meta · puesto, frase de `mensajeRendimiento` y botón "¡A seguir vendiendo!". Se cierra sola a los 6s (barra dorada de tiempo), con Esc, clic fuera o el botón. **Se renderiza con `createPortal` a `<body>` envuelta en `.theme-light`**: el modal tiene `transform` (animate-modal) y encerraba el `position: fixed`, así que la placa no cubría la pantalla. Los topes 100/110/120 solo se LEEN (`nivelNuevo` en `calcularMotivacion`). Animaciones en `globals.css` (`placa-in`, `medalla-pop`, `confeti` ×24 deterministas, `placa-texto` en cascada, `placa-brillo`, `placa-timer`), solo transform/opacity; con reduced motion: fundido sin confeti. El aviso de texto (`AvisoPostVenta`) sigue debajo con ritmo y consejo.
- **🎉 Hitos del equipo** (`hitoEquipoCruzado`): al cruzar 50/75/100% de `meta.montoTotal`, `CelebracionVenta` muestra "¡El equipo llegó al N%!" con nombre "Todo el equipo" (estado `celebracion.nombre` opcional). `metaTotalRef` evita closures viejas en el `onSnapshot`.
- **👏 Reconocimientos**: sección en el dashboard bajo el hero (últimos 3 de 7 días, query `where('fecha','>=', hace6)`) + celebración en vivo al llegar uno nuevo.
- **⚡ Retos relámpago**: `dinamicas.horaLimite?` "HH:MM" opcional (form en `DinamicasTab`). Cuenta regresiva en la tarjeta del ranking de hoy (`useAhora(30s)`), y en `HistorialVentasDiaModal` el botón Guardar se deshabilita al terminar.
- **📺 Modo TV** (`/tv`, botón "Modo TV" en el header del panel líder): rota cada 15s entre Ranking mensual (top 8, mismo orden `totalReal`), Constancia y logros, Reconocimientos; columna fija con meta del equipo, retos relámpago activos y mayor progreso. Celebración grande al registrar venta, subir puesto, aplauso o hito. Pantalla completa + Wake Lock (mantiene la pantalla encendida). Tiene sus propios listeners (meta con `onSnapshot`, para reflejar cambios de la líder).

### Panel líder (`/lider`) — 7 tabs
- **Asesores**: registrar asesores (foto, nombre, cargo) y asignar PINs
- **Reconocimientos** (`ReconocimientosTab.tsx`, entre Dinámicas y Ventas del mes): elegir asesor + mensaje (sugerencias o texto libre, máx. 120) → `aplausos`; lista de los 20 últimos con eliminar (confirmación Sí/No). El header del panel tiene el botón **Modo TV** → `/tv`.
- **Meta del mes** (`MetaMes.tsx`): monto total + días laborados + **2 indicadores manuales**: Transacciones y Unidades. UPT y AVT **no tienen campo de entrada** — se derivan y muestran en tiempo real mientras se escribe (`AVT = montoTotal / metaTransacciones`, `UPT = metaUnidades / metaTransacciones`) en un bloque "Indicadores calculados" dentro del formulario. Vista guardada muestra por asesor: meta mensual proporcional + Txn/Uds distribuidas + UPT y AVT derivados. Historial de meses anteriores también muestra UPT/AVT derivados.
- **Metas diarias** (`MetasDiarias.tsx`): muestra y edita **solo el día actual** (no tabla Lun–Dom completa). Secciones:
  - Tabla: Transacciones día + Unidades día con contador restante vs meta mensual
  - **Presupuesto del día**: monto total + checkboxes para seleccionar asesores → muestra reparto individual de **Txn, Uds y Monto** (`valor / N`) en tiempo real por cada asesor marcado
  - **UPT y AVT diarios**: calculados automáticamente como `UPT = metaUnidades / metaTransacciones` y `AVT = montoTotal / metaTransacciones`. Se muestran como solo lectura (no hay campos de entrada). Al guardar, se escriben los valores derivados en `metasPorDia[dow].upt` y `.avt`.
  - En la vista guardada: grid de tarjetas (Txn/Uds/UPT/AVT) + sección "Distribución por asesor" con columnas Txn/Uds/Monto
  - Calendario visual del mes (targets por tipo de día)
  - Guarda en `metas/{mes}.metasPorDia[dow]` con `{ merge: true }`. `upt` ahora guarda el valor real (antes siempre era 0); `avt` es campo nuevo

### Editor masivo de ventas del mes (`EditorVentasMes`)
- Tab **"Ventas del mes"** en el panel líder — permite editar los totales mensuales de **todos los asesores a la vez** sin entrar uno por uno al historial
- Muestra cada asesor con tres campos editables: **Monto total, Txn, Uds** (pre-llenados con el gran total actual: `totalVentas + acumuladoMes`)
- Sub-etiqueta "PIN acum." muestra el componente de ventas diarias registradas con PIN (`totalVentas/Txn/Uds`) — solo lectura, no se modifica
- Al guardar: calcula `acumuladoMes = totalEntrado - totalVentas` y reemplaza `acumulados[]` con una entrada única de ajuste. Los `registros[]`, `totalVentas`, `totalTransacciones`, `totalUnidades` **no se tocan** — el historial de hoy queda intacto
- Detección de cambios (`isDirty`): resalta filas modificadas en índigo y muestra conteo en el botón "Guardar (N)"
- Botón "Restablecer" por asesor para deshacer cambios individuales
- Inicialización lazy: los rows solo se inicializan una vez por asesor (no sobreescribe ediciones en curso si llega un onSnapshot)

### Historial (`HistorialTab.tsx`) — tab "Historial" en panel líder (agregado 2026-08-31)
- **Exportar Excel / PDF con el formato de la hoja de la empresa** (agregado 2026-11-08): barra "Exportar {mes}" con botones **Excel** y **PDF**; exporta el mes filtrado (con "Todos los meses", el mes en curso). Datos: `construirReporte(mes, asesores, ventasDelMes, meta, cfg)` en `src/lib/reporte.ts` (mismas reglas que el dashboard; filas en orden del ranking). Columnas = encabezados de la hoja: CÓD. SAP · COLABORADOR · NOMBRE DE POSICIÓN EN TIENDAS · HORAS DE TRABAJO · DÍAS (días laborados de Meta del mes) · META/REAL/% /PUNTOS UPT · UNIDADES ACC/DPT META · CANTIDAD ACC/DPT REAL · % y PUNTOS ACC/DPT (**= ticket promedio AVT**, supuesto confirmado con los números de la hoja; si la empresa usa otro dato ahí, cambiarlo aquí) · TOTALES $$ · REAL VENTAS · % y PUNTOS VENTAS · CUMP. FINAL (verde ≥100 / amarillo 90–99,99 / rojo <90) · PAGO COMISIONES MENSUAL. Fila TOTAL: horas (suma), ACC/DPT meta y real (promedio), meta y venta (suma), comisiones (suma). Generación en `src/lib/exportarReporte.ts` con **exceljs** (estilos, números reales, paneles congelados) y **jspdf + jspdf-autotable** (legal horizontal), ambas por `import()` dinámico (no pesan en la carga inicial). Verificado con los datos reales de noviembre: Tamayo $1.426.700,46 y Ramírez $770.528,93; promedio ACC/DPT real $458.783,20 igual a la hoja.
- Campos nuevos del asesor (`AsesorForm`, `EditAsesorModal`): `codigoSap?` (opcional) y `horasTrabajo?` (48 por defecto) para el reporte.
- Reemplaza la sección "Mes anterior" que antes vivía en el dashboard
- Lee TODOS los docs de `ventasMes` y `metas` de la tienda (sin filtrar por mes) vía `onSnapshot` — depende de la retención indefinida (ver arriba)
- **Filtros**: Mes (select con todos los meses detectados en los datos, "Todos los meses" por defecto), Asesor (select, "Todos" por defecto), Indicador (Monto/Transacciones/Unidades/UPT/AVT/% Cumplimiento — determina el orden descendente de la tabla dentro de cada mes)
- Tabla con columnas Mes/Asesor/Monto/Txn/Uds/UPT/AVT/Meta/% Cumpl. + fila de totales del resultado filtrado
- Meta mensual por asesor se recalcula por mes con `calcularMetas(metaMes.montoTotal, asesorIds, metaMes.asesores)` usando la lista de asesores actual (mismo criterio que usaba antes la sección "Mes anterior")
- **Eliminar historial por fechas** (autoridad de la administradora/líder, pedido explícito del usuario): selects "Desde"/"Hasta" con los meses disponibles (excluye el mes en curso — no se puede borrar desde aquí), botón que muestra el conteo de meses/registros afectados, luego confirmación inline estilo Sí/No (mismo patrón que `AsesorList.tsx`) antes de borrar. Borra los docs `ventasMes/{mes}_{asesorId}` y `metas/{mes}` de los meses en el rango.

### Dinámicas comerciales
- **Panel líder**: tab "Dinámicas" (4to tab en `lider/page.tsx`) con `DinamicasTab.tsx`
  - Formulario: nombre, meta por asesor (número), fecha (default hoy), selección de asesores con checkboxes
  - Lista agrupada en "Hoy" y "Anteriores", cada dinámica muestra barra de progreso global + toggle activa/inactiva + eliminar
  - "Ver por asesor" desplegable con barra individual por cada participante
- **Dashboard**: sección "Dinámicas del día" (entre Ranking de hoy y Ranking mensual) visible cuando hay dinámicas activas para hoy
  - Cada dinámica: card con progreso global + filas por asesor (foto, nombre, cantidad/meta, %, barra)
  - Clic en fila de asesor → PIN → `DinamicaProgressModal` (modo **incremento**: input vacío, agrega cantidad al acumulado con `increment(v)` + `arrayUnion({cantidad, creadoEn})`; muestra historial del día ordenado más reciente primero + barra preview gris/color)
- **`HistorialVentasDiaModal`** — sección "Dinámicas del día" al pie del modal: input arranca **vacío** (placeholder = valor actual acumulado), barra preview (gris = acumulado actual, color = preview con nuevo valor), "Acumulado: X / meta" como referencia debajo si ya hay progreso; botón "Guardar" deshabilitado hasta que se escriba algo; modo **set** (reemplaza `progreso[asesorId]` directamente)
- **Firestore**: `tiendas/{uid}/dinamicas/{id}` — `{ nombre, meta, fecha, activa, asesoresIds[], progreso: { [asesorId]: number }, registros?: { [asesorId]: [{cantidad, creadoEn}][] }, horaLimite?: 'HH:MM', creadoEn }`
- **Nota:** la sección "Dinámicas del día" independiente ya no existe en el dashboard; las dinámicas se ven dentro de cada tarjeta del ranking de hoy y se registran desde `HistorialVentasDiaModal`.
- Query en dashboard: `where('fecha', '==', hoy)` + filtro `activa` client-side (evita índice compuesto)
- `pinMode` extendido a `'diario' | 'acumulado' | 'dinamica'`; nuevo estado `pinDinamicaRef` + `dinamicaProgressData`

### Tutorial de onboarding (`TutorialModal`)
- Aparece automáticamente en el primer ingreso del líder
- 6 pasos con mockups visuales que señalan exactamente qué tocar (punto rojo pulsante)
- Se omite con "Omitir" o completa con "¡Empezar!"
- Guardado en `localStorage('tutorial-visto')` — no vuelve a aparecer
- Para mostrarlo de nuevo: borrar `tutorial-visto` de localStorage

## Convenciones de código
- Todos los componentes son `'use client'`
- No usar Firebase Storage (requiere Blaze/billing) — fotos como base64 en Firestore
- Formato de moneda: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })`
- Mes actual: `YYYY-MM` (ej. `2026-05`)
- ID de documento ventasMes: `${mes}_${asesorId}` (ej. `2026-05_abc123`)
- Sin comentarios salvo que el WHY no sea obvio
- Sin Firebase Storage — imágenes comprimidas a base64 con Canvas API
- **Reglas de negocio congeladas en `src/lib/reglas.ts`**: no modificarlas al agregar funciones; importarlas (nunca duplicar umbrales). Motivación nueva → `src/lib/motivacion.ts`, solo lectura.
- Botones de solo ícono: siempre con `aria-label`; color en reposo mínimo `text-gray-500` (4.8:1 sobre blanco, `gray-400` no cumple el 3:1 de WCAG para controles). Eliminar: `hover:text-red-600 hover:bg-red-500/10` (no `hover:bg-red-50`: el detector de Impeccable lo empareja con el gris de reposo como falso positivo `gray-on-color`).

## Deploy
- **URL de producción:** https://ranking-ventas.web.app
- **Build:** `npm run build` (genera carpeta `out/`)
- **Ojo con `next dev` + `npm run build` a la vez:** comparten `.next/`; tras un build el dev server (Turbopack) sigue sirviendo CSS viejo aunque se reinicie. Solución: detener dev, borrar `.next/` (caché regenerable) y volver a levantarlo.
- **Deploy:** `firebase deploy --only hosting`
- **Dominio autorizado en Firebase Auth:** `ranking-ventas.web.app`
- Next.js configurado con `output: 'export'` e `images: { unoptimized: true }`
- El `proxy.ts` (middleware) no aplica en static export — la protección es client-side
- **Cache headers (`firebase.json`):** HTML → `no-cache, no-store, must-revalidate` (siempre fresco); `_next/static/**` → `public, max-age=31536000, immutable` (cache permanente con hash). Esto garantiza que los usuarios vean cambios sin limpiar caché manualmente

## Variables de entorno requeridas (`.env.local` — nunca commitear)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Bugs corregidos relevantes

- **`lider/page.tsx` race condition**: el `useEffect` de protección ahora hace `if (loading) return` como primera línea. La versión anterior ejecutaba el check de `sessionStorage` mientras `loading=true`, causando redirect prematuro a `/` antes de que Firebase Auth resolviera el usuario.
- **`LeaderModal.tsx` error silencioso**: `handleVerify` ahora tiene `try/catch`. Sin él, un error de Firestore dejaba el botón en "Verificando..." indefinidamente sin mensaje de error.
- **`fechaHoy()` zona horaria**: corregido en `page.tsx` y `DinamicasTab.tsx` usando `toLocaleDateString('fr-CA')` (hora local). La versión anterior con `toISOString().slice(0,10)` (UTC) causaba que el ranking de hoy mostrara ceros después de las 7pm en Colombia (UTC-5).
- **Ranking mensual sort incorrecto**: el sort usaba `ventasMap[id].totalVentas` (sin acumuladoMes), pero las tarjetas mostraban `totalVentas + acumuladoMes.monto`. Corregido: el sort ahora usa el mismo total real que se muestra.
- **`metaTxnAsesor`/`metaUdsAsesor` siempre null**: si un asesor no estaba en `meta.asesores` (p.ej. agregado después de configurar la meta), `distribuirIndicador` le asignaba 0 y `pctTxn`/`pctUds` quedaba null. Corregido con fallback a división igual (`metaTransacciones / n`).
- **`NotificacionesPanel` lista invisible**: `h-full` en el panel no resolvía correctamente la altura cuando el padre usa `fixed inset-0` (altura implícita, no propiedad `height` explícita). `flex-1` del área de contenido colapsaba a 0px y `overflow-y-auto` ocultaba todo. Corregido con `h-screen` en el panel y `min-h-0` en el contenedor del listado.
- **Sort ranking de hoy incorrecto**: el sort usaba `progresoHoy()` (solo `transacciones / metaTxn`), pero las tarjetas mostraban `pctCombined` (promedio de %Txn + %Uds + %Monto). El orden visual no coincidía con los badges. Corregido: sort ahora usa `pctCombinadoHoy()` — misma fórmula que el badge "General".
- **UPT/AVT mes anterior leían campos legacy**: la sección "Mes anterior" usaba `metaAnterior?.metaAVT` y `metaAnterior?.metaUPT` (campos ya no escritos en Firestore). Corregido: ahora calcula `derivedMetaAVT_ant` y `derivedMetaUPT_ant` con la fórmula estándar.

## Diseño visual (frontend-design skill aplicado)
- **Login (`/login`):** fondo oscuro `#080808` con blobs de luz ambiental y dot-grid overlay; card con glassmorphism (`bg-white/4`, `backdrop-blur-xl`, borde `white/8`); logo en cuadrado blanco con sombra dramática; tipografía `text-2xl font-bold`
- **Header global:** línea de acento de 2px en borde superior con gradiente; funciona igual en dashboard y panel líder
- **Fondo de páginas:** clase `.bg-dot-grid` (definida en `globals.css`) en lugar de blanco plano
- **Tarjetas del ranking:** `rounded-xl` (antes `rounded-lg`), sombra base sutil `shadow-[0_1px_3px_...]` + hover shadow más pronunciada `shadow-[0_6px_20px_...]`
- **Live dot "Ranking de hoy":** `h-2.5 w-2.5` con `shadow` glow esmeralda en lugar de ring
- **Títulos de sección:** `text-2xl font-bold` (antes `text-xl`)
- **PinModal:** `rounded-2xl` + sombra más profunda
- **Colores de barras de progreso:** protegidos (requerimiento del cliente) — `barColor()` (`lib/reglas.ts`), `indicatorBarFill()`, `pctColor()`, `motivacion()` (`page.tsx`) no se tocan sin autorización, son semánticos (naranja→ámbar→verde→azul→celeste).
  - **Excepción autorizada por el usuario (2026-11-08), "paleta de motivación"**: se eliminó el rojo de alarma en rendimiento bajo. Base: Elliot et al. 2007 (el rojo en contextos de evaluación activa la evitación del fracaso). Cambios: `barColor` <25% → `from-orange-500 to-orange-400`; "¡Empieza hoy!" → naranja; `indicatorBarFill`/`pctColor`/texto de `IndicatorBar` <80% → naranja; barra/badge "General" del ranking de hoy <50% → naranja; progreso de dinámicas <80% → naranja (`DinamicasTab`, `DinamicaProgressModal`, `HistorialVentasDiaModal`); "Falta para meta" → `text-amber-600`. Umbrales y orden de colores intactos.
  - **Todo logro = dorado** (señal de recompensa única, condicionamiento cue→reward): chips de `ChipsMotivacion` (racha, récord, progreso, insignias) en `bg-amber-50 text-[#fde68a] border-amber-400/40`; en modo TV la racha y "Mayor progreso" también dorados. **Consejo 💡** post-venta en azul suave (`bg-sky-50 border-sky-200/70`, título `text-sky-700`) = "ayuda", no corrección.
  - El rojo queda solo para lo destructivo y los errores (botones eliminar, mensajes de error, zona de borrado del Historial).
- **Logo:** SIN CAMBIOS (requerimiento del cliente) — el cuadrado negro con el ícono SVG en el header nunca se modifica

### Paleta principal "Azul marino + dorado" (integrada 2026-11-08 — VIGENTE)
Paleta entregada por el usuario como principal de la app. **Tema claro** en dashboard y panel líder; **azul marino** en login y modo TV (decisiones del usuario). Reemplaza al tema oscuro esmeralda; lo de "Motivación de ventas" y "Tema oscuro" de abajo queda como referencia histórica salvo lo que se indica.
- **Primario = DORADO** (decisión del usuario 2026-11-08, tras ver el azul marino como primario: chocaba con los azules/índigo/violeta semánticos de barras e indicadores). `--accent #C79F4B` (botones `bg-accent text-on-accent`, pestaña activa, foco), `--accent-hover #AD8736`, `--on-accent #00203D` (texto sobre dorado 6.7:1; **nunca `text-white` sobre `bg-accent`**, 2.5:1), `--accent-text #8A6A24` (dorado como texto). Azul marino = `--primary #003B6D` / `--primary-hover #00284B` (`text-primary`, `bg-primary-light`): header, consejos/info, ícono de notificaciones vacío, login y TV. Títulos `--heading #2B2B2B`. Lo que sigue en esta lista sobre `--accent #003B6D`/`--heading #003B6D` quedó reemplazado por esto.
- **Tokens** (`:root` de `globals.css`, expuestos en `@theme inline`): `--background #F2F1ED` · `--surface #FFFFFF` · `--foreground #2B2B2B` · `--accent #003B6D` / `--accent-hover #00284B` (botones `bg-accent`, foco `focus:border-accent focus:ring-accent/20`, pestaña activa `border-accent`) · `--accent-text #003B6D` · `--primary-light #E6EEF4` (`bg-primary-light`: info, consejos, hover) · `--gold #C79F4B` / `--gold-hover #AD8736` / `--gold-light #F9F4E8` · `--gold-text #8A6A24` · `--heading #003B6D` · `--accent-muted #4A4A48` · `--border #DFDDD6`.
- **Regla de contraste:** `#C79F4B` da 2.5:1 sobre blanco → **nunca como texto**; solo rellenos/bordes/íconos (`bg-gold`, `border-gold/50`, `ring-gold`). Texto dorado = `text-gold-text` (#8A6A24, 5:1). Texto azul marino sobre dorado = 4.6:1.
- **Logros = dorado** (`bg-gold-light text-gold-text border-gold/50`): chips de `ChipsMotivacion`, badge "Top ventas", anillo del avatar top 1, hero ("Vamos por la meta", tile del 🏆), reconocimientos, notificación nueva.
- **`.theme-light`** (en `<main>` de `page.tsx` y `lider/page.tsx`): solo reasigna los grises de Tailwind a una escala cálida (`gray-50 #F8F7F4` … `gray-200 #DFDDD6` … `gray-400 #77756F` (4.6:1) … `gray-900 #2B2B2B`). El resto de colores de Tailwind se usan con sus valores normales de modo claro.
- **`.theme-dark`** ahora solo en `/tv`: redefine tokens dentro del scope (`--surface #00335F`, fondo `#00284B` vía `.theme-dark.bg-dot-grid`, `--heading #FFF`, `--gold-text`/`--accent-text #E3C27E`, `--gold-light`/`--primary-light` como mezclas sobre azul marino) + grises azul marino; mantiene la reasignación de pastel/600-900 de cada color.
- `RANK_COLORS`: 1º `border-gold/70 from-[#F9F4E8] via-white to-white ring-gold/40`; 2º plata `border-[#C3CAD3] from-[#F1F3F6]`; 3º bronce `border-[#D9B48C] from-[#FBF1E6]`.
- Header y franja de modales/paneles (`.theme-modal/.theme-panel ::before`): degradado `#003B6D → #C79F4B`. Glow del top 1: sombra dorada + azul marino.
- `CelebracionVenta`: tarjeta `bg-[#003B6D]`, ícono degradado dorado con trazo `#00284B`, label `#E3C27E`.
- Aviso post-venta: `bg-emerald-50 border-emerald-200 text-emerald-950` (éxito, semántico); consejo 💡 en `bg-primary-light` con título `text-accent`.
- Login: fondo `#00284B`, blobs azul marino, card `bg-white/5 border-[#C79F4B]/25`, subtítulo `#B9C9DA`. `themeColor` del layout `#003B6D`.
- **Sin cambios (protegidos/semánticos):** barras de progreso y colores de nivel, verde de "meta cumplida", colores fijos por indicador (AVT índigo, Txn violeta, UPT teal, Uds naranja, Monto esmeralda), logo, punto "en vivo" esmeralda del ranking de hoy, rojo de borrado/errores.

### Tema "Motivación de ventas" (aplicado 2026-11-04 — HISTÓRICO, reemplazado por la paleta azul marino + dorado)
Reskin visual sobre el tema oscuro, sin tocar lógica ni elementos protegidos. Paleta: esmeralda (crecimiento) + dorado (logro) sobre negro con tinte verde.
- **Header (dashboard y panel líder):** barra de acento superior `from-emerald-500 via-teal-400 to-amber-400`. "Ranking Ventas 🏆" en dashboard. Sin guirnalda.
- **Hero banner** (solo dashboard, `<section aria-label="Motivación del equipo">`): etiqueta "Vamos por la meta" (`text-emerald-700`), título "Ranking de Ventas", subtítulo `fraseDelDia` (array `FRASES` de 7 frases, rota por día del mes), ilustración SVG de barras ascendentes + flecha dorada en la esquina superior derecha (opacidad baja), resplandor `bg-emerald-500/10`. **Avance del equipo** (solo si hay meta): `totalEquipo` = Σ(`totalVentas + acumuladoMes.monto`) de todos los asesores vs `meta.montoTotal`, barra con `barColor(pctEquipo)` (se usa, no se modifica), y línea "Faltan X · N días · Y por día" (`faltaEquipo / diasRestantes`); al cumplir muestra "¡Meta del equipo cumplida! Vamos por el 120%". Sin lecturas extra a Firestore.
- **`.bg-dot-grid`:** fondo `#0a0f0d` con puntos `rgba(255,255,255,0.055)`.
- **Top 3** (`RANK_COLORS`): 1º oro `border-amber-400/60` + gradiente `#2a2410→#121a17` + `ring-amber-400/40`; 2º plata `border-slate-300/40` `#1f2826`; 3º bronce `border-orange-400/40` `#2a1d12`. `Top1Badge` "🏆 Top ventas" en `bg-[#1d1a0c]` + `text-[#fde68a]`; avatar top 1 con `ring-amber-400`; `animate-top-glow` (brillo dorado/esmeralda en `::after`, solo anima `opacity`).
- **`CelebracionVenta.tsx`** (reemplaza a `SpiderDrop`): tarjeta `fixed top-20` (centrada en móvil, a la derecha en ≥sm, `z-[60]`, `pointer-events-none`) con ícono de trofeo dorado que hace "pop" + label + nombre del asesor; 3.2s (`celebracionIn`: entra desde arriba con `cubic-bezier(0.23,1,0.32,1)`, se sostiene, sale). Misma detección en `onSnapshot` de `page.tsx` (estado `celebracion` / `setCelebracion`): crece `registros[]` → "Nueva venta", crece `acumulados[]` → "Acumulado del mes", sube `progreso` de una dinámica → nombre de la dinámica. Primer snapshot = línea base. Reduced motion: `fadeHold` sin movimiento. `role="status"` para lectores de pantalla. Remontaje por `key`; `onAnimationEnd` filtra `e.target === e.currentTarget`.
- **Sin capa flotante** (se eliminó `FloatingHalloween`). `<main>` sigue con `isolate` por si un tema futuro vuelve a usar una capa `fixed -z-10`.
- **Clases de marco genéricas** (renombradas desde `halloween-*`, para reusar en próximos temas):
  - `.theme-card` → tarjetas del ranking de hoy y mensual. En este tema solo aporta `isolation: isolate` (sin decoración).
  - `.theme-modal` → paneles de todos los modales; `.theme-panel` → `NotificacionesPanel`, `AsesorForm`, form "Nueva dinámica", `MetaMes`, `MetasDiarias` (edición). Ambas: `::before` con franja superior 3px esmeralda→teal→dorado + leve resplandor radial esmeralda arriba-derecha. Técnica: `::before` con `z-index:-1` dentro de `isolation: isolate` (no pisa gradientes de `RANK_COLORS` ni el `::after` del glow).
- `NotificacionesPanel`: "✅ Todo al día" en `text-emerald-700`; estado vacío con campana `text-emerald-300` en cuadro `#14261e`; notificación nueva `bg-emerald-50/70` + punto `bg-emerald-500`.
- Focus de inputs: `focus:border-emerald-400 focus:ring-emerald-400/20`. Pestaña activa del panel líder: `border-emerald-400 text-accent-text`. Botón "Líder": borde `emerald-400/40`.
- Calendario de `MetasDiarias`: textos de la celda "hoy" en `text-[#d1fae5]` sobre `bg-accent`.
- **Login:** blobs esmeralda/teal/ámbar.
- El detector de Impeccable reporta 5 `ai-color-palette` en `page.tsx` (gradientes índigo/violeta): son los colores **semánticos fijos por indicador** (AVT/Txn) — falso positivo en contexto, no se tocan.
- **Tokens de color del tema** (`:root` de `globals.css`, expuestos en `@theme inline`):
  - `--accent: #047857` / `--accent-hover: #065f46` (esmeralda oscuro) → `bg-accent`, `hover:bg-accent-hover`: todos los botones primarios, celda "hoy" del calendario, progreso del tutorial. Blanco sobre `#047857` ≈ 5.5:1.
  - `--accent-text: #34d399` → `text-accent-text`: el acento como **texto** sobre fondo oscuro.
  - `--gold: #fbbf24` → `text-gold`/`bg-gold`: logro (disponible para trofeos/top 1).
  - `--heading: #e8efea` → `text-heading`: todos los títulos `h1–h3`.
  - `--accent-muted: #9fb7aa` → `text-accent-muted`: subtítulos.
  - `--surface: #121a17` → `bg-surface`: tarjetas, modales, paneles, header. **Si cambia `--surface`, actualizar también los hex `via-[#121a17] to-[#121a17]` de `RANK_COLORS`.**
  - **Para el próximo tema basta con cambiar estos tokens** + los puntos de esta lista.
- **Tema oscuro** (HISTÓRICO: base 2026-10-03 → 2026-11-08; hoy `.theme-dark` solo se usa en `/tv` con azul marino, ver arriba):
  - Clase **`.theme-dark`** en el `<main>` de `page.tsx` y `lider/page.tsx` (el login ya era oscuro con estilo propio y NO la lleva). Todos los modales/paneles se renderizan dentro de esos `<main>` (no hay portals), así que heredan el tema.
  - En vez de reescribir cientos de clases, `.theme-dark` **reasigna variables de la paleta de Tailwind v4** dentro del scope: grises invertidos con tinte verde (`--color-gray-50: #18211d` … `--color-gray-900: #f1f6f3`) y, para cada color (red, rose, orange, amber, yellow, green, emerald, teal, cyan, sky, blue, indigo, violet, purple), los tonos **50/100/200 → tintes oscuros** (`color-mix` del 500 con `--surface`) y **600/700/800/900 → versiones claras** (400/300). Los **300/400/500 no cambian** → las barras semánticas (`barColor`, `indicatorBarFill`, gradientes 400/500) quedan idénticas, y las funciones protegidas (`barColor`, `indicatorBarFill`, `pctColor`, `motivacion`) **no se modificaron en el código**: solo se adapta cómo se pintan sus pastel/textos sobre oscuro, conservando el mismo orden de color.
  - Codemod aplicado (excepto login): `bg-white→bg-surface`, `border-[#eaeaea]→border-gray-200`, `border-[#f2f2f2]→border-gray-100`, `text-[#8f8f8f]→text-gray-400`, `bg-[#fafafa]→bg-gray-50`, `bg-[#f2f2f2]→bg-gray-100`, `focus:border-black→focus:border-emerald-400`, `focus:ring-black/10→focus:ring-emerald-400/20`.
  - `color-scheme: dark` en `.theme-dark` (inputs, selects y scrollbars nativos oscuros). `.theme-dark [class*="ring-offset"]` fija `--tw-ring-offset-color: var(--surface)` (si no, el hueco del ring-offset sale blanco).
  - Tiles oscuros a propósito (`bg-[#14261e]`: ícono del hero, estado vacío de notificaciones) llevan `ring-1 ring-emerald-400/30` para separarse del fondo.
  - **Al escribir componentes nuevos dentro del tema:** usar `bg-surface`, la escala `gray-*` y tonos de color normales (se adaptan solos). **Ojo:** un texto que deba ser claro a propósito con tono 50/100/200 (p. ej. `text-amber-200`) se oscurecería por la reasignación → usar hex fijo (`text-[#fde68a]`, `text-[#d1fae5]`). Igual para fondos que deban quedar oscuros con 600–900: usar hex (ej. botones de borrado de `HistorialTab`: `bg-[#be123c] hover:bg-[#9f1239]`).
  - Logo (cuadrado negro, protegido) sin cambios: sobre el header oscuro se lee por su ícono blanco.
- Los `rose-*`/`red-*` que quedan en el código son semánticos de error/destrucción (zona de borrado en Historial, eliminar, errores) y el punto del tutorial — no son de rendimiento ni del tema.
- Para cambiar de tema: los puntos a tocar son exactamente los de esta lista (tokens `:root`, grises de `.theme-dark`, header accent ×2, hero, `.bg-dot-grid`, `RANK_COLORS`, `Top1Badge`, ring del avatar top 1, `.theme-modal/.theme-panel`, `CelebracionVenta`, focus de inputs, `NotificacionesPanel`, blobs del login, keyframes del tema). Flujo de trabajo de diseño: Taste (dirección) → Emil (animación) → Impeccable (auditoría), skills en `.claude/skills/`.

## Instrucción permanente — Registro de cambios

**IMPORTANTE:** Al finalizar cualquier sesión de trabajo, actualizar este `CLAUDE.md` con los cambios realizados:
- Nuevas funcionalidades → añadir en la sección correspondiente de "Funcionalidades implementadas"
- Cambios de lógica o comportamiento existente → actualizar la descripción afectada
- Nuevos componentes o archivos → añadir en "Estructura de archivos clave"
- Nuevas convenciones → añadir en "Convenciones de código"

El objetivo es que `CLAUDE.md` siempre refleje el estado actual real del proyecto, para que cualquier conversación nueva arranque con contexto completo sin tener que re-explorar el código.
