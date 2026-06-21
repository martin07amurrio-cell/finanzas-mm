# Finanzas M&M — Contexto del proyecto

App de finanzas personales para uso interno de 2 usuarios: **Martín** y **Micaela**. PIN de ambos: `1234`.

## Stack

- React 18 + TypeScript + Tailwind CSS v4 + Vite
- Firebase Firestore como base de datos (proyecto: `app-finanzas-mm`)
- Firebase Hosting para deploy (URL: https://app-finanzas-mm.web.app)
- SPA mobile-first, sin backend — todo desde el cliente

## Estructura

```
src/
  App.tsx              # Auth, routing por tab, carga usuarios al inicio
  lib/firebase.ts      # Inicialización Firebase
  services/api.ts      # Todas las operaciones Firestore
  types/database.ts    # Tipos: User, Account, Category, Transaction
  components/
    auth/              # UserSelection, PinEntry
    layout/            # Navbar (bottom nav, 5 tabs)
  pages/
    dashboard/         # Resumen, últimos movimientos
    movimientos/       # Listado con filtros y eliminación inline
    cargar/            # Formulario nuevo movimiento
    reportes/          # Gráficos y estadísticas
    mas/               # Cuentas, categorías, USD rate, parse WhatsApp
```

## Colecciones Firestore

- `users` — id, name, pin_hash, role
- `accounts` — id, name, owner_user_id, type, currency, current_balance
- `categories` — id, name, type (gasto|ingreso), color, icon
- `transactions` — id, type, amount, currency, description, category_id, account_id, user_id, transaction_date

## Decisiones importantes

- Auth por PIN comparado localmente (usuarios cacheados al iniciar la app)
- Sin `window.confirm`/`alert` — todo inline con estado React
- USD rate guardado en `localStorage`
- `getTransactions()` usa `Promise.all` + Maps JS para joins (Firestore no tiene JOIN)
- No hay git en este proyecto

## Convenciones

- Sin comentarios salvo que el WHY no sea obvio
- Español en UI, inglés en código
- Mobile-first: botones grandes, sin hover-only interactions
