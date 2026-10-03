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
│   └── lider/page.tsx      — Panel líder (protegido por sessionStorage)
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
│   ├── SpiderDrop.tsx      — Araña que baja por un hilo con cartel "label · asesor" al detectar una nueva entrada (tema Halloween)
│   └── FloatingHalloween.tsx — Capa decorativa fija de murciélagos/calabazas/fantasmas/telarañas + destellos (tema Halloween), posiciones fijas (no random, evita mismatch de hidratación en static export)
├── context/
│   ├── AuthContext.tsx     — Estado Firebase Auth + cookie auth-session
│   └── StoreContext.tsx    — Provee storeId (uid del líder) a componentes
├── lib/
│   ├── firebase.ts         — Init Firebase (auth, db, googleProvider)
│   ├── leaderAuth.ts       — Crear/verificar contraseña de líder
│   ├── hash.ts             — SHA-256 con Web Crypto API
│   └── calcularMetas.ts    — calcularMetas() y distribuirIndicador() para distribución proporcional
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
└── ventasMes/{mes_uid}     — { mes, asesorId, totalVentas, totalUnidades, totalTransacciones,
                               registros: [{ monto, unidades, transacciones, fecha, creadoEn }],
                               acumuladoMes?: { monto, unidades, transacciones } }
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
- Ranking en tiempo real; **ranking mensual ordenado por `totalVentas + acumuladoMes.monto`** (el total real visible)
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
- **Estructura del dashboard — dos secciones, solo mes actual (desde 2026-08):**
  - **"Ranking de hoy"** (sección superior, clickeable): se muestra SOLO cuando el líder configuró `asesoresIds` para ese día. Muestra únicamente los asesores seleccionados, ordenados por `pctCombinadoHoy()` (promedio de %Txn + %Uds + %Monto — misma fórmula que el badge "General" visible en cada tarjeta). Tarjetas: barra "General" combinada + bloque unificado `IndicatorBar` para Txn/Uds/Monto/UPT/AVT.
  - **"Ranking mensual"** (sección central, siempre visible, clickeable): muestra TODOS los asesores sin excepción, ordenados por total real. Incluye barra 0-120% + bloque `IndicatorBar` (Monto/AVT/UPT/Txn/Uds) + beneficios + tabla de comisiones. Sección "Hoy" al fondo solo cuando NO hay ranking de hoy activo.
  - **El dashboard YA NO muestra "Mes anterior".** Esa sección se movió al panel líder → tab "Historial" (ver abajo) para reducir el ruido visual en la vista principal. Decisión del usuario (2026-08-31): "se ve muy saturado, quiero mostrar solo datos del mes actual".
- **Tabla de comisiones por asesor** (`TablaComisionesAsesor` + `calcularComision` en `page.tsx`): visible en cada tarjeta del ranking mensual cuando hay meta asignada. Lógica: Amarillo 90–99.99% → 0.65%, Verde 100–109.99% → 1.10%, Azul 110–119.99% → 1.20%, Celeste ≥120% → 1.30%. Destaca el nivel activo con borde izquierdo de color. Muestra comisión estimada en dinero (vendido × %) y montos faltantes para llegar a 90%, 100% y 120%.
- `asesoresHoy`: array vacío si no hay `asesoresIds` configurados. `showDailySection = asesoresHoy.length > 0`.
- Clic en tarjeta **ranking de hoy** → PIN → VentasModal (registra venta del día con `increment()` + `arrayUnion()`)
- Clic en tarjeta **ranking mensual** → PIN → `HistorialAcumuladoModal` con dos tabs:
  - **"Ventas diarias"** (tab activo por defecto): muestra todos los `registros[]` del mes actual agrupados por fecha, más reciente primero. Cada entrada tiene editar y eliminar; ajusta `totalVentas/totalUnidades/totalTransacciones` con `increment(delta)`. Resuelve la pérdida de acceso a los registros del día anterior tras cerrar el ranking de hoy.
  - **"Acumulado del mes"**: entradas manuales de `acumuladoMes` con agregar/editar/eliminar (comportamiento anterior).
  - Ambos tabs leen del mismo `onSnapshot` sobre `ventasMes/{mes}_{asesorId}` — un solo listener. Los datos son del mes actual exclusivamente (cada mes tiene su propio documento).
- `acumuladoMes` se suma al total mensual visible pero NO aparece en `registros[]`, por lo que no afecta `ventaHoyMap` ni el ranking de hoy
- `pctCombinadoHoy(asesorId)`: función que calcula el promedio de los porcentajes disponibles (Txn, Uds, Monto) para ordenar el ranking de hoy. Es la misma lógica que el badge "General" en las tarjetas — garantiza que el orden visual coincida con los números mostrados. El mapa `ventaHoyMap` se calcula una vez fuera del render.
- **Retención de datos: indefinida (desde 2026-08-31).** Se eliminó el borrado automático de `ventasMes`/`metas` de hace 2 meses que existía antes. Ahora todo el historial se conserva en Firestore sin límite de tiempo, para que el tab "Historial" del panel líder pueda mostrarlo. Decisión explícita del usuario tras evaluar el trade-off (más lecturas/almacenamiento con el tiempo, pero volumen bajo para este caso de uso — pocos asesores, un doc por mes).

### Panel líder (`/lider`) — 6 tabs
- **Asesores**: registrar asesores (foto, nombre, cargo) y asignar PINs
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
- **Firestore**: `tiendas/{uid}/dinamicas/{id}` — `{ nombre, meta, fecha, activa, asesoresIds[], progreso: { [asesorId]: number }, registros?: { [asesorId]: [{cantidad, creadoEn}][] }, creadoEn }`
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
- **Colores de barras de progreso:** SIN CAMBIOS (requerimiento del cliente) — `barColor()`, `indicatorBarFill()`, `pctColor()`, `motivacion()` en `page.tsx` nunca se tocan, son semánticos (rojo→ámbar→verde→azul→celeste)
- **Logo:** SIN CAMBIOS (requerimiento del cliente) — el cuadrado negro con el ícono SVG en el header nunca se modifica

### Tema estacional "Halloween" (aplicado 2026-10-03, temporal/reversible — reemplazó a "Amor y Amistad")
Reskin visual sobre la base editorial, sin tocar lógica ni elementos protegidos (colores semánticos de barras de progreso y logo intactos). Paleta: naranja/ámbar/púrpura.
- **Header (dashboard y panel líder):** barra de acento superior `from-orange-500 via-amber-500 to-purple-600`. "Ranking Ventas 🎃" en dashboard. **Guirnalda colgante** (clase `.halloween-garland` en `globals.css`): banderines naranja/púrpura + murciélago + calavera colgando bajo el borde inferior; un módulo SVG de 384×24px (8 piezas) repetido en X, sin JS, `pointer-events-none`. Dashboard: `<div className="halloween-garland">` dentro del `<header>` sticky (cuelga y acompaña al hacer scroll). Panel líder: va **debajo de las tabs** en un wrapper `relative h-0`, porque el contenedor de tabs tiene `overflow-x-auto` y la recortaría (y colgando del header taparía las tabs). Las clases de `globals.css` no están en `@layer`, así que ganan a las utilidades de Tailwind: no intentar sobreescribir `top` con utilidades.
- **Hero banner** (solo dashboard, `page.tsx`, `<section aria-label="Temporada de Halloween">`): superficie blanca con borde neutro `#eaeaea` (sin gradientes ni blobs), ilustración SVG única luna+murciélago tenue en esquina superior derecha, ícono 🎃 en cuadrado sólido `#241733`, etiqueta "Temporada de Halloween" en `text-orange-700` con punto naranja (sentence case, no píldora), título **sólido** `text-gray-900` (sin gradient text — Impeccable lo marca como anti-patrón) con `text-wrap: balance`, subtítulo "Ventas de miedo, resultados de otro mundo", frase limitada a `max-w-[65ch]`. **Decoración (2026-10-03):** clase `halloween-card` (telaraña + calavera en esquina superior izquierda, la misma de las tarjetas), resplandor de luna `bg-orange-100/70 blur-2xl` detrás de la luna, y silueta SVG inline al pie (`absolute bottom-0 right-0`, viewBox 300×40): suelo con degradado que se desvanece a la izquierda, cerca, lápida con cruz, calabazas naranjas, calavera y lápida pequeña. Opacidad aplicada al `<g>` (no `fillOpacity` por forma) para que las superposiciones no se oscurezcan. `pb-11` deja espacio a la silueta; el texto (`relative`) pinta encima.
- **`.bg-dot-grid`** (`globals.css`): fondo `#0d0a10` (casi negro con tinte ciruela) con puntos `rgba(255,255,255,0.06)`.
- **Top 3** (`RANK_COLORS`, versión oscura): 1º `border-orange-500/60` + gradiente `#2a1a14→#1c1520` + `ring-orange-500/40`; 2º borde púrpura `#241a30→#1c1520`; 3º borde ámbar `#28200f→#1c1520`. 1er lugar: `Top1Badge` "🎃 Top ventas" en `bg-[#241733]` + `text-[#fed7aa]`, anillo `ring-orange-400` en avatar, `animate-spooky-glow`.
- **`animate-spooky-glow`:** el brillo vive en un `::after` con `box-shadow` fijo y solo se anima `opacity` (animar `box-shadow` repinta cada frame). Requiere que la tarjeta sea `relative` (lo es).
- **`FloatingHalloween.tsx`:** 7 emojis (🦇🎃👻🕸️) flotando con `animate-spooky-float`; 3 de ellos `hidden sm:block` → 4 en móvil. Sin destellos.
- **`<main>` del dashboard lleva `isolate`:** necesario para que la capa `fixed -z-10` quede entre el fondo de `main` y el contenido. Sin `isolate` la capa queda detrás del fondo y no se ve (bug que tenía el tema anterior).
- **`prefers-reduced-motion`:** detiene flotantes (opacidad fija 0.16) y el pulso del glow (opacidad fija 0.8).
- **Login:** blobs naranja/púrpura/ámbar.
- **Animaciones en `globals.css`:** `spookyFloat`, `spookyGlowPulse`, `spiderDrop`, `spiderSway`, `spiderFade` (`.animate-spooky-float`, `.animate-spooky-glow`, `.animate-spider-drop`, `.animate-spider-sway`).
- **Araña al registrar entradas (`SpiderDrop.tsx`):** baja por un hilo desde arriba a la derecha (`fixed z-[60]`, sobre modales, `pointer-events-none`), se balancea y sube; 3.2s, cartel `#241733`/`text-orange-200` con label + nombre del asesor. Se dispara en **todas las pantallas** con el dashboard abierto, por detección en los `onSnapshot` existentes de `page.tsx` (sin tocar lógica de guardado):
  - `ventasMes`: crece `registros[]` → "Nueva venta"; crece `acumulados[]` → "Acumulado del mes" (`prevVentasRef`).
  - `dinamicas` del día: sube `progreso[asesorId]` → label = nombre de la dinámica (`prevDinamicasRef`).
  - El primer snapshot solo fija la línea base (no dispara al cargar); dinámicas nuevas o reactivadas también arrancan como línea base.
  - Animación CSS: `spiderDrop` (un solo `translateY` mueve hilo+araña; el hilo mide 400px y se extiende fuera del viewport), `spiderSway` (péndulo con `transform-origin: 50% -400px`). Reduced motion: posición fija + `spiderFade`. Anuncio `role="status"` para lectores de pantalla. Remontaje por `key={spiderEvent.id}`; `onAnimationEnd` filtra `e.target === e.currentTarget` (la animación hija también burbujea).
- **Telarañas y calaveras en tarjetas y modales** (clases compartidas en `globals.css`, sin SVG repetido en componentes):
  - `.halloween-card` → tarjetas del ranking de hoy y mensual (`page.tsx`): telaraña naranja en esquina superior izquierda (64px) + calavera diminuta (13px) dentro de esa esquina (zona de padding, no tapa datos; la esquina derecha la ocupa el `Top1Badge`).
  - `.halloween-modal` → paneles de `PinModal`, `HistorialVentasDiaModal`, `HistorialAcumuladoModal`, `DinamicaProgressModal`, `LeaderModal`, `AsignarPinModal`, `EditAsesorModal`, `TutorialModal`: franja superior 3px naranja→ámbar→púrpura, telaraña púrpura arriba-derecha (80px), telaraña naranja abajo-izquierda (56px) con calavera (16px) en la esquina.
  - Técnica: `::before` con `background-image` (data URI SVG) y `z-index:-1` dentro de `isolation: isolate` → queda sobre el fondo del elemento pero detrás del contenido; **no se usa `background-image` directo** porque pisaría los gradientes de `RANK_COLORS`, y no se usa `::after` porque lo ocupa `animate-spooky-glow`. `.halloween-modal` añade `position: relative` (los `absolute` internos de los modales tienen su propio contenedor `relative`).
  - `.halloween-panel` → mismo marco que `.halloween-modal` (mismas reglas CSS) para paneles/formularios que no son modales: `NotificacionesPanel` (drawer), `AsesorForm`, formulario "Nueva dinámica" de `DinamicasTab`, formulario de `MetaMes` y vista de edición de `MetasDiarias`. Estos dos últimos no tenían contenedor: ahora son tarjeta `bg-white border border-[#eaeaea] rounded-2xl p-6` para que la decoración no quede detrás de los inputs.
  - `NotificacionesPanel`: "Todo al día" en `text-orange-700` con 👻; estado vacío con ícono campana `text-orange-300` en cuadro `#241733`; resaltado de notificación nueva en `bg-orange-50/70` + punto `bg-orange-500` (antes azul).
  - Sin animación (se ven todo el tiempo sobre datos). Para quitar el tema basta con borrar las clases de `globals.css` (las clases en el markup quedan inertes) o quitarlas de los componentes.
- El detector de Impeccable reporta 5 `ai-color-palette` en `page.tsx` (gradientes índigo/violeta): son los colores **semánticos fijos por indicador** (AVT/Txn) — falso positivo en contexto, no se tocan.
- **Tokens de color del tema** (`:root` de `globals.css`, expuestos en `@theme inline`):
  - `--accent: #c2410c` / `--accent-hover: #9a3412` (naranja Halloween oscuro) → `bg-accent`, `hover:bg-accent-hover`. **Todos los botones primarios** (antes `bg-black`/`bg-gray-900`), celda "hoy" del calendario, progreso del tutorial. Blanco sobre `#c2410c` = 5.2:1.
  - `--accent-text: #fb923c` → `text-accent-text`: el acento usado como **texto** sobre fondo oscuro (7.9:1; `#c2410c` como texto solo da 3.4). Pestaña activa del panel líder (`border-orange-400 text-accent-text`) y botón "Líder" del header.
  - `--heading: #ece6f1` → `text-heading`: **todos los títulos `h1–h3`** y nombres del header ("Ranking Ventas 🎃", "Dashboard Líder"). (El usuario probó títulos naranja y no le gustaron.)
  - `--accent-muted: #b9a8c9` (ciruela apagado claro) → `text-accent-muted`: **subtítulos** (el `<p>` bajo cada título).
  - `--surface: #1c1520` → `bg-surface`: tarjetas, modales, paneles, header (`bg-surface/95`). Reemplazó a todos los `bg-white`.
  - **Para el próximo tema basta con cambiar estos tokens.** No se tocaron: logo negro (protegido), celda "hoy" del calendario de `MetasDiarias`, barra de `VentasModal`, maquetas del tutorial.
- **Tema oscuro — opción B "oscuro + acentos naranja" (elegida por el usuario 2026-10-03 tras comparar con "naranja sólido"):**
  - Clase **`.theme-dark`** en el `<main>` de `page.tsx` y `lider/page.tsx` (el login ya era oscuro con estilo propio y NO la lleva). Todos los modales/paneles se renderizan dentro de esos `<main>` (no hay portals), así que heredan el tema.
  - En vez de reescribir cientos de clases, `.theme-dark` **reasigna variables de la paleta de Tailwind v4** dentro del scope: grises invertidos con tinte ciruela (`--color-gray-50: #231a29` … `--color-gray-900: #f3eef7`) y, para cada color (red, rose, orange, amber, yellow, green, emerald, teal, cyan, sky, blue, indigo, violet, purple), los tonos **50/100/200 → tintes oscuros** (`color-mix` del 500 con `--surface`) y **600/700/800/900 → versiones claras** (400/300). Los **300/400/500 no cambian** → las barras semánticas (`barColor`, `indicatorBarFill`, gradientes 400/500) quedan idénticas, y las funciones protegidas (`barColor`, `indicatorBarFill`, `pctColor`, `motivacion`) **no se modificaron en el código**: solo se adapta cómo se pintan sus pastel/textos sobre oscuro, conservando el mismo orden de color.
  - Codemod aplicado (excepto login): `bg-white→bg-surface`, `border-[#eaeaea]→border-gray-200`, `border-[#f2f2f2]→border-gray-100`, `text-[#8f8f8f]→text-gray-400`, `bg-[#fafafa]→bg-gray-50`, `bg-[#f2f2f2]→bg-gray-100`, `focus:border-black→focus:border-orange-400`, `focus:ring-black/10→focus:ring-orange-400/20`.
  - `color-scheme: dark` en `.theme-dark` (inputs, selects y scrollbars nativos oscuros). `.theme-dark [class*="ring-offset"]` fija `--tw-ring-offset-color: var(--surface)` (si no, el hueco del ring-offset sale blanco).
  - SVG de telarañas/calaveras/guirnalda/siluetas/araña: el púrpura oscuro `#241733` de rellenos y trazos pasó a lavanda claro `#ead9f5` (si no, desaparecían sobre negro). Tiles `bg-[#241733]` (ícono del hero, estado vacío de notificaciones, chip de la araña) llevan `ring-1 ring-orange-400/30–40` para separarse del fondo.
  - **Al escribir componentes nuevos dentro del tema:** usar `bg-surface`, la escala `gray-*` y tonos de color normales (se adaptan solos). **Ojo:** un texto que deba ser claro a propósito con tono 50/100/200 (p. ej. `text-orange-200`) se oscurecería por la reasignación → usar hex fijo (`text-[#fed7aa]`, `text-[#ffedd5]`). Igual para fondos que deban quedar oscuros con 600–900: usar hex (ej. botones de borrado de `HistorialTab`: `bg-[#be123c] hover:bg-[#9f1239]`).
  - Logo (cuadrado negro, protegido) sin cambios: sobre el header oscuro se lee por su ícono blanco.
- Los `rose-*` que quedan en el código son semánticos (barras <80%, "¡Empieza hoy!", zona de borrado en Historial, punto del tutorial) — no son del tema.
- Para cambiar de tema: los puntos a tocar son exactamente los de esta lista (header accent ×2, hero, `.bg-dot-grid`, `RANK_COLORS`, `Top1Badge`, ring del avatar top 1, capa flotante, blobs del login, keyframes del tema). Flujo de trabajo de diseño: Taste (dirección) → Emil (animación) → Impeccable (auditoría), skills en `.claude/skills/`.

## Instrucción permanente — Registro de cambios

**IMPORTANTE:** Al finalizar cualquier sesión de trabajo, actualizar este `CLAUDE.md` con los cambios realizados:
- Nuevas funcionalidades → añadir en la sección correspondiente de "Funcionalidades implementadas"
- Cambios de lógica o comportamiento existente → actualizar la descripción afectada
- Nuevos componentes o archivos → añadir en "Estructura de archivos clave"
- Nuevas convenciones → añadir en "Convenciones de código"

El objetivo es que `CLAUDE.md` siempre refleje el estado actual real del proyecto, para que cualquier conversación nueva arranque con contexto completo sin tener que re-explorar el código.
