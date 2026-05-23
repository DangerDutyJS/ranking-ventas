# ranking_ventas

## Descripción
Plataforma de ranking de ventas en tiempo real para tiendas. Cada líder gestiona su propio equipo de asesores. Los asesores registran ventas diarias con un PIN personal y ven su posición en el ranking. Publicada en https://ranking-ventas.web.app

## Stack tecnológico
- **Framework:** Next.js 16.2.6 (App Router, Turbopack)
- **Base de datos:** Firebase Firestore (tiempo real con `onSnapshot`)
- **Autenticación:** Firebase Auth — solo Google Sign-In
- **Estilos:** Tailwind CSS v4 — diseño minimalista neutro (blancos y grises)
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
│   └── TutorialModal.tsx   — Tutorial de onboarding (primer ingreso)
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
├── metas/{mes}             — { montoTotal, asesores: { [id]: { diasLaborados } }, metaAVT?,
│                              metaUPT?, metaTransacciones?, metaUnidades?,
│                              metasPorDia: { "0"–"6": { upt, avt?, txn, uds, monto?, asesoresIds? } },
│                              actualizadoEn }
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
- Badge motivacional: "¡Empieza hoy!" → "¡Buen ritmo!" → "¡Meta cumplida!" → "¡Por encima!" → "¡Top absoluto!"
- **Indicadores de gestión con barras de progreso** (`IndicatorBar`): cada indicador muestra valor actual / meta + barra de color + % semántico (verde ≥100%, ámbar ≥80%, rojo <80%). Colores fijos por tipo:
  - Monto → esmeralda/verde · AVT → azul/índigo · UPT → teal/cyan · Txn → violeta/púrpura · Uds → naranja/ámbar
- Txn y Unidades: targets per-asesor distribuidos proporcionalmente por días laborados; si el asesor no está en `meta.asesores`, usa división igual (`total / n`) como fallback
- UPT y AVT diarios: usa `metasPorDia[hoy.getDay()].upt` / `.avt` si el líder los configuró
- **Sin metas diarias auto-calculadas**: los targets diarios son manuales (tabla por día de semana)
- **Estructura del dashboard — dos secciones independientes:**
  - **"Ranking de hoy"** (sección superior, clickeable): se muestra SOLO cuando el líder configuró `asesoresIds` para ese día. Muestra únicamente los asesores seleccionados, ordenados por `progresoHoy()` (% Txn vs meta). Tarjetas: barra "General" combinada + bloque unificado `IndicatorBar` para Txn/Uds/Monto/UPT/AVT.
  - **"Ranking mensual"** (sección inferior, siempre visible, clickeable): muestra TODOS los asesores sin excepción, ordenados por total real. Incluye barra 0-120% + bloque `IndicatorBar` (Monto/AVT/UPT/Txn/Uds) + beneficios. Sección "Hoy" al fondo solo cuando NO hay ranking de hoy activo.
- `asesoresHoy`: array vacío si no hay `asesoresIds` configurados. `showDailySection = asesoresHoy.length > 0`.
- Clic en tarjeta **ranking de hoy** → PIN → VentasModal (registra venta del día con `increment()` + `arrayUnion()`)
- Clic en tarjeta **ranking mensual** → PIN → AcumuladoMesModal (registra acumulado del mes en campo separado `acumuladoMes`)
- `acumuladoMes` se suma al total mensual visible pero NO aparece en `registros[]`, por lo que no afecta `ventaHoyMap` ni el ranking de hoy
- La función `progresoHoy()` prioriza Txn; si txn=0 usa Uds. El mapa `ventaHoyMap` se calcula una vez fuera del render.

### Panel líder (`/lider`) — 3 tabs
- **Asesores**: registrar asesores (foto, nombre, cargo) y asignar PINs
- **Meta del mes** (`MetaMes.tsx`): monto total + días laborados + **4 indicadores mensuales de referencia**: Transacciones, Unidades, UPT y AVT. "Mismo para todos" para días laborados. Vista guardada muestra por asesor: meta mensual proporcional + Txn/Uds distribuidas + UPT y AVT como target único (mismo para todos, no se distribuye). **No muestra ajuste proporcional ni redistribución** — solo "Días laborados" y "Meta mensual" por asesor
- **Metas diarias** (`MetasDiarias.tsx`): muestra y edita **solo el día actual** (no tabla Lun–Dom completa). Secciones:
  - Tabla: Transacciones día + Unidades día con contador restante vs meta mensual
  - **Presupuesto del día**: monto total + **Meta UPT** + **Meta AVT** del día + checkboxes para seleccionar asesores → muestra reparto individual de **Txn, Uds y Monto** (`valor / N`) en tiempo real por cada asesor marcado
  - En la vista guardada: grid de tarjetas (Txn/Uds/UPT/AVT) + sección "Distribución por asesor" con columnas Txn/Uds/Monto
  - Calendario visual del mes (targets por tipo de día)
  - Guarda en `metas/{mes}.metasPorDia[dow]` con `{ merge: true }`. `upt` ahora guarda el valor real (antes siempre era 0); `avt` es campo nuevo

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

## Deploy
- **URL de producción:** https://ranking-ventas.web.app
- **Build:** `npm run build` (genera carpeta `out/`)
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
- **`fechaHoy()` zona horaria**: usa `toISOString().slice(0,10)` (UTC). En Colombia (UTC-5) puede devolver el día siguiente a partir de las 7pm. Pendiente de corregir con `toLocaleDateString('fr-CA')`.
- **Ranking mensual sort incorrecto**: el sort usaba `ventasMap[id].totalVentas` (sin acumuladoMes), pero las tarjetas mostraban `totalVentas + acumuladoMes.monto`. Corregido: el sort ahora usa el mismo total real que se muestra.
- **`metaTxnAsesor`/`metaUdsAsesor` siempre null**: si un asesor no estaba en `meta.asesores` (p.ej. agregado después de configurar la meta), `distribuirIndicador` le asignaba 0 y `pctTxn`/`pctUds` quedaba null. Corregido con fallback a división igual (`metaTransacciones / n`).
- **`NotificacionesPanel` lista invisible**: `h-full` en el panel no resolvía correctamente la altura cuando el padre usa `fixed inset-0` (altura implícita, no propiedad `height` explícita). `flex-1` del área de contenido colapsaba a 0px y `overflow-y-auto` ocultaba todo. Corregido con `h-screen` en el panel y `min-h-0` en el contenedor del listado.

## Instrucción permanente — Registro de cambios

**IMPORTANTE:** Al finalizar cualquier sesión de trabajo, actualizar este `CLAUDE.md` con los cambios realizados:
- Nuevas funcionalidades → añadir en la sección correspondiente de "Funcionalidades implementadas"
- Cambios de lógica o comportamiento existente → actualizar la descripción afectada
- Nuevos componentes o archivos → añadir en "Estructura de archivos clave"
- Nuevas convenciones → añadir en "Convenciones de código"

El objetivo es que `CLAUDE.md` siempre refleje el estado actual real del proyecto, para que cualquier conversación nueva arranque con contexto completo sin tener que re-explorar el código.
