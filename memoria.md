# Memoria del proyecto — Finanzas M&M

## Contexto general
App de finanzas personales interna para 2 usuarios: **Martín** y **Micaela**. PIN de ambos: `1234` (guardado como texto plano en `pin_hash` en Firestore). No hay registro público, no hay backend propio.

## Firebase
- Proyecto: `app-finanzas-mm`
- URL deploy: https://app-finanzas-mm.web.app
- Firestore rules: `allow read, write: if true` (sin autenticación Firebase, intencional)
- Variables en `.env` (VITE_FIREBASE_*)
- `firebase-service-account.json` está en `.gitignore` — no subir nunca
- No hay git en el proyecto

## Auth
- Usuarios cargados desde Firestore **una sola vez al iniciar** (`App.tsx` useEffect)
- PIN comparado localmente (sin red) — `users.find(u => u.name === selectedUser && u.pin_hash === pin)`
- Sesión persistida en `localStorage` como `auth_user` (objeto User serializado)

## Estado de despliegue
- `firebase-tools` instalado globalmente (`npm install -g firebase-tools`)
- **Pendiente:** `firebase login` → `firebase init hosting` → `npm run build` → `firebase deploy`
- La app aún NO está desplegada en Firebase Hosting

## Decisiones de diseño
- Sin `window.confirm` / `window.alert` — todo con estado React inline
- USD rate guardado en `localStorage` (`usd_rate`), configurable desde pestaña "Más"
- `getTransactions()` hace `Promise.all` de 4 colecciones + Maps JS para joins (Firestore no tiene JOIN)
- `deleteTransaction()` revierte el balance de la cuenta automáticamente
- `createTransaction()` actualiza el balance de la cuenta automáticamente
- No usar `DEFAULT_USD_RATE` hardcodeado en UI — siempre llamar `getUsdRate()`

## Colecciones Firestore
| Colección | Campos clave |
|---|---|
| `users` | name, pin_hash, role |
| `accounts` | name, owner_user_id, type, currency, current_balance |
| `categories` | name, type (gasto\|ingreso), color, icon |
| `transactions` | type, amount, currency, description, category_id, account_id, user_id, transaction_date |

## Bugs resueltos (no reintroducir)
- El filtro de usuario en Movimientos fallaba porque `getTransactions` no hacía join con users → solucionado con userMap en JS
- PIN tardaba mucho → era una llamada a red por intento → solucionado cacheando usuarios al inicio
- `window.confirm` no funciona en mobile Safari → solucionado con confirmación inline con estado React
- Fecha no se reseteaba al cargar otro movimiento → solucionado en `Cargar.tsx`
- PIN no se borraba tras error → solucionado con useEffect en `PinEntry.tsx`

## Historial de migración
- App migrada de **Supabase** a **Firebase Firestore** (2026-05-30)
- Datos migrados: 2 usuarios, 1 cuenta, 3 categorías, 0 transacciones
- Script de migración: `scripts/migrate-supabase-to-firebase.mjs` (ya no se necesita)

## Stack
- React 18 + TypeScript + Tailwind CSS v4 + Vite
- Firebase JS SDK v9+ (modular)
- Mobile-first SPA, max-width 512px, bottom nav de 5 tabs
- Tabs: Inicio, Movimientos, Cargar, Reportes, Más
