# ranking_ventas

## Descripción
Plataforma de ranking de ventas con autenticación mediante Google.

## Stack tecnológico
- **Framework:** Next.js (App Router)
- **Base de datos:** Firebase (Firestore)
- **Autenticación:** Firebase Auth con Google Sign-In
- **Estilos:** Tailwind CSS — diseño moderno minimalista

## Convenciones
- Usar App Router de Next.js (`/app` directory)
- Componentes en `/app/components`
- Lógica de Firebase en `/lib/firebase.ts`
- Variables de entorno en `.env.local` (nunca commitear)
- TypeScript estricto

## Autenticación
- Login exclusivo mediante Google (Firebase Auth)
- Proteger rutas privadas con middleware de Next.js
- Redirigir a `/login` si no hay sesión activa

## Diseño
- Minimalista y moderno
- Paleta de colores neutra (blancos, grises, un acento de color)
- Sin elementos decorativos innecesarios
- Tipografía limpia

## Variables de entorno requeridas
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```
