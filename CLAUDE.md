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
│   ├── MetaMes.tsx         — Configurar meta mensual, días laborados e indicadores de referencia
│   ├── MetasDiarias.tsx    — Tabla Lun-Dom con UPT/Txn/Uds + calendario visual del mes
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
│                              metasPorDia: { "0"–"6": { upt, txn, uds } }, actualizadoEn }
└── ventasMes/{mes_uid}     — { mes, asesorId, totalVentas, totalUnidades, totalTransacciones,
                               registros: [{ monto, unidades, transacciones, fecha, creadoEn }] }
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
- Ranking en tiempo real ordenado por `totalVentas` descendente
- Medallas 🥇🥈🥉 para los primeros 3
- Tarjetas con: progreso mensual (barra de color con marcadores), vendido, falta para meta, 5 indicadores de gestión, sección Hoy
- Barra de progreso con rango 0–120%, marcadores en 100%, 110%, 120% (puntos de color sobre la barra + etiquetas)
- Colores de barra y marcadores: rojo → naranja → ámbar → teal → **verde (100%)** → **azul (110%)** → **celeste (120%)**
- Premios por nivel: 📌 Pin al 100% · 🎁 Bono corral al 110% · 🏖️ Día libre al 120%
- Badge motivacional: "¡Empieza hoy!" → "¡Buen ritmo!" → "¡Meta cumplida!" → "¡Por encima!" → "¡Top absoluto!"
- 5 indicadores de gestión: PPTO s/IVA, AVT, UPT, Transacciones, Unidades
- Txn y Unidades: targets per-asesor (distribuidos proporcionalmente desde el total del mes)
- UPT y targets diarios: usa `metasPorDia[hoy.getDay()]` si el líder configuró la tabla por día de semana; sino usa el promedio mensual/días
- **Sin metas diarias auto-calculadas**: se eliminaron "Promedio diario requerido" y "Meta ajustada". Los valores mensuales son solo referencia; los targets diarios son manuales (tabla por día de semana)
- Tarjeta dividida en dos secciones: **Meta mensual** (barra 0-120%, PPTO/AVT/UPT/Txn/Unidades, beneficios) y **Hoy** (grid 4 celdas: Txn/UPT/Uds/Importe del día actual vs target del día; verde si cumplido). La sección Hoy usa `registros[].fecha === hoy` para calcular los totales del día; aparece si hay metas del día configuradas o si ya hay ventas hoy
- Clic en tarjeta → PinModal → VentasModal (registra venta con `increment()` + `arrayUnion()`)
- **Ranking de hoy** (sección debajo del ranking mensual): aparece solo si hay `metasPorDia` configurada para el día actual; tarjetas ordenadas por `progresoHoy()` (% Txn vs meta del día); muestra barra de progreso de Txn + grid 4 celdas (Txn/UPT/Uds/Importe); badge de % en color (verde ≥100%, azul ≥75%, ámbar ≥50%, naranja <50%). Las tarjetas de ranking de hoy no son clickeables (no registran venta). La función `progresoHoy()` prioriza Txn; si txn=0 usa Uds. El mapa `ventaHoyMap` se calcula una vez fuera del render para ambas secciones.

### Panel líder (`/lider`) — 3 tabs
- **Asesores**: registrar asesores (foto, nombre, cargo) y asignar PINs
- **Meta del mes** (`MetaMes.tsx`): monto total + días laborados + UPT/Txn/Unidades mensuales de referencia distribuidos por asesor; "Mismo para todos" para días laborados
- **Metas diarias** (`MetasDiarias.tsx`): tabla Lun–Dom × UPT/Txn/Unidades + calendario visual del mes con targets proyectados por tipo de día; guarda en `metas/{mes}.metasPorDia` con `{ merge: true }` para no pisar campos de Meta del mes

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

## Variables de entorno requeridas (`.env.local` — nunca commitear)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Instrucción permanente — Registro de cambios

**IMPORTANTE:** Al finalizar cualquier sesión de trabajo, actualizar este `CLAUDE.md` con los cambios realizados:
- Nuevas funcionalidades → añadir en la sección correspondiente de "Funcionalidades implementadas"
- Cambios de lógica o comportamiento existente → actualizar la descripción afectada
- Nuevos componentes o archivos → añadir en "Estructura de archivos clave"
- Nuevas convenciones → añadir en "Convenciones de código"

El objetivo es que `CLAUDE.md` siempre refleje el estado actual real del proyecto, para que cualquier conversación nueva arranque con contexto completo sin tener que re-explorar el código.
