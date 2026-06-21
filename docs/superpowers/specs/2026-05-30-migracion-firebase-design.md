# Spec: Migración de Supabase a Firebase Firestore

**Fecha:** 2026-05-30  
**Alcance:** Reemplazar Supabase como backend por Firebase Firestore. Los componentes React no cambian. Los datos existentes se migran preservando IDs.

---

## Contexto

App interna de finanzas para 2 usuarios (Martín y Micaela). Stack: React + TypeScript + Tailwind + Vite. Actualmente usa Supabase como base de datos con la anon key expuesta en el cliente (sin Supabase Auth). Se migra a Firebase Firestore por el plan gratuito más generoso y sin requerir tarjeta de crédito.

---

## Archivos afectados

| Archivo | Acción |
|---|---|
| `src/lib/supabase.ts` | Eliminar |
| `src/lib/firebase.ts` | Crear — inicializa Firebase app + exporta `db` (Firestore instance) |
| `src/services/api.ts` | Reescribir completamente con Firestore SDK. Mismas firmas de función. |
| `.env` | Reemplazar vars de Supabase por vars de Firebase |
| `.env.example` | Actualizar con las nuevas vars |
| `scripts/migrate-supabase-to-firebase.mjs` | Crear — script Node.js de migración one-shot |
| `package.json` | Reemplazar `@supabase/supabase-js` por `firebase` |

**Sin cambios:** todos los componentes, páginas, tipos (`database.ts`), CSS, `App.tsx`.

---

## Estructura de Firestore

Colecciones planas, sin sub-colecciones. IDs preservados (UUID) para mantener las referencias.

```
/users/{uuid}
  name: string
  pin_hash: string
  role: string
  created_at: string

/accounts/{uuid}
  name: string
  owner_user_id: string
  type: string           // 'cash' | 'bank' | 'fintech' | 'savings'
  currency: string       // 'ARS' | 'USD'
  current_balance: number

/categories/{uuid}
  name: string
  type: string           // 'gasto' | 'ingreso'
  color: string
  icon: string

/transactions/{uuid}
  type: string           // 'gasto' | 'ingreso'
  amount: number
  currency: string       // 'ARS' | 'USD'
  description: string | null
  category_id: string
  account_id: string
  user_id: string
  transaction_date: string  // ISO string
```

---

## Variables de entorno

Reemplazar en `.env`:
```
# Eliminar:
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# Agregar:
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Todas las vars se obtienen de Firebase Console → Project Settings → Web app config.

---

## `src/lib/firebase.ts`

```ts
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
```

---

## `src/services/api.ts` — funciones clave

### `getTransactions()` — join en JS
```ts
// 1. Cargar las 4 colecciones en paralelo
// 2. Crear Maps por ID para lookup O(1)
// 3. Ensamblar cada transacción con category, account, user anidados
// 4. Ordenar por transaction_date descendente
// Retorna: Transaction[] — mismo tipo que antes
```

### `createTransaction()` — actualizar saldo en la misma operación
Supabase no tenía transacciones atómicas en el cliente, Firebase tampoco las requiere aquí — el patrón existente (read → insert → update balance) se mantiene igual.

### `deleteTransaction()` — mismo patrón: leer → borrar → revertir saldo

### `getUsdRate()` / `setUsdRate()` — sin cambios (localStorage, no DB)

---

## Reglas de Firestore

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Equivalente al comportamiento actual con la anon key de Supabase (acceso público con la config del cliente).

---

## Script de migración (`scripts/migrate-supabase-to-firebase.mjs`)

Script Node.js ES module que se corre **una sola vez** localmente:

**Dependencias runtime del script:**
- `node-fetch` para leer de Supabase REST (o `fetch` nativo en Node 18+)
- `firebase-admin` para escribir en Firestore

**Entradas necesarias:**
- `SUPABASE_URL` y `SUPABASE_ANON_KEY` del `.env` actual
- Archivo `firebase-service-account.json` (descargado de Firebase Console → Settings → Service accounts → Generate new private key). Este archivo NO se commitea.

**Flujo:**
```
Para cada colección: [users, accounts, categories, transactions]
  1. GET https://{supabase_url}/rest/v1/{table}?select=*
     Headers: apikey + Authorization
  2. Para cada fila:
     db.collection(tabla).doc(fila.id).set(fila)
  3. Log: "✓ Migrados N registros de {tabla}"
```

**Ejecución:**
```bash
node scripts/migrate-supabase-to-firebase.mjs
```

---

## Criterios de éxito

1. `npm run dev` levanta sin errores de TypeScript
2. Login con PIN funciona (usuarios cargados de Firestore)
3. Dashboard muestra saldos correctos (cuentas de Firestore)
4. Cargar un movimiento persiste en Firestore y actualiza el saldo
5. Movimientos muestra todas las transacciones con categoría, cuenta y usuario correctos
6. Eliminar un movimiento revierte el saldo correctamente
7. Script de migración loguea éxito para las 4 colecciones sin errores

---

## Restricciones

- Sin cambios en componentes React
- Sin cambios en `src/types/database.ts`
- Sin cambios en `App.tsx`
- El script de migración se corre localmente, no se despliega
- `firebase-service-account.json` nunca se commitea (agregar a `.gitignore`)
