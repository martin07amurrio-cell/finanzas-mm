# Migración Supabase → Firebase Firestore — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar Supabase por Firebase Firestore como backend, preservando todas las firmas de función de `api.ts` para que los componentes React no necesiten cambios.

**Architecture:** Se crea `src/lib/firebase.ts` que exporta la instancia de Firestore, se reescribe `src/services/api.ts` con el SDK de Firebase (mismas firmas), se actualiza `App.tsx` para usar `getUsers()` en lugar de supabase directo, y se corre un script de migración one-shot que copia los datos de Supabase a Firestore preservando IDs.

**Tech Stack:** Firebase JS SDK v10 (`firebase`), Firebase Admin SDK (`firebase-admin`) para el script de migración, Node.js 18+ (fetch nativo + `--env-file`)

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `src/lib/firebase.ts` | Crear — inicializa Firebase app, exporta `db` |
| `src/lib/supabase.ts` | Eliminar |
| `src/services/api.ts` | Reescribir completamente |
| `src/App.tsx` | Modificar — reemplazar import de supabase por `getUsers` |
| `.env` | Reemplazar vars de Supabase por vars de Firebase |
| `.env.example` | Ídem |
| `.gitignore` | Agregar `firebase-service-account.json` |
| `scripts/migrate-supabase-to-firebase.mjs` | Crear |
| `package.json` | Swap de dependencia |

---

### Task 1: Firebase project + SDK setup

**Files:**
- Create: `src/lib/firebase.ts`
- Delete: `src/lib/supabase.ts`
- Modify: `package.json`, `.env`, `.env.example`, `.gitignore`

- [ ] **Step 1: Crear el proyecto Firebase (manual — hacerlo antes de continuar)**

  1. Ir a [https://console.firebase.google.com](https://console.firebase.google.com)
  2. Click **"Add project"** → nombre: `app-finanzas-mm` → deshabilitar Google Analytics → **Create project**
  3. En el proyecto, ir a **Build → Firestore Database → Create database**
  4. Elegir **"Start in production mode"** → seleccionar región `us-east1` → **Done**
  5. En el sidebar, click el ícono `</>` (Web) para registrar la app web → nombre: `finanzas-mm` → **Register app**
  6. Copiar el objeto `firebaseConfig` que aparece — lo necesitás en el próximo paso

- [ ] **Step 2: Actualizar `.env` con las vars de Firebase**

  Reemplazar el contenido completo de `.env`:

  ```env
  VITE_FIREBASE_API_KEY=<tu apiKey>
  VITE_FIREBASE_AUTH_DOMAIN=<tu authDomain>
  VITE_FIREBASE_PROJECT_ID=<tu projectId>
  VITE_FIREBASE_STORAGE_BUCKET=<tu storageBucket>
  VITE_FIREBASE_MESSAGING_SENDER_ID=<tu messagingSenderId>
  VITE_FIREBASE_APP_ID=<tu appId>
  ```

  Los valores vienen del objeto `firebaseConfig` copiado en el Step 1.

- [ ] **Step 3: Actualizar `.env.example`**

  ```env
  VITE_FIREBASE_API_KEY=your-api-key
  VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=your-project-id
  VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
  VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
  VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
  ```

- [ ] **Step 4: Agregar `firebase-service-account.json` a `.gitignore`**

  Leer el `.gitignore` actual y agregar al final:

  ```
  # Firebase service account (solo para script de migración — nunca commitear)
  firebase-service-account.json
  ```

- [ ] **Step 5: Swap de dependencias**

  ```bash
  cd "c:\Users\Martin\Desktop\ANTIGRAVITY\APP FINANZAS MM"
  npm remove @supabase/supabase-js
  npm install firebase
  npm install --save-dev firebase-admin
  ```

  Verificar que `package.json` ya no menciona `@supabase/supabase-js` y sí incluye `firebase` en dependencies y `firebase-admin` en devDependencies.

- [ ] **Step 6: Crear `src/lib/firebase.ts`**

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

- [ ] **Step 7: Eliminar `src/lib/supabase.ts`**

  Borrar el archivo. Si hay errores de TypeScript en este momento es esperado — se resuelven en Task 2.

---

### Task 2: Reescribir `src/services/api.ts` con Firestore

**Files:**
- Rewrite: `src/services/api.ts`

- [ ] **Step 1: Reemplazar el contenido completo de `src/services/api.ts`**

  ```ts
  import { db } from '../lib/firebase'
  import {
    collection, getDocs, addDoc, doc, getDoc,
    updateDoc, deleteDoc, query, orderBy, setDoc
  } from 'firebase/firestore'
  import type { Account, Category, Transaction, User } from '../types/database'

  export const DEFAULT_USD_RATE = 1000

  export async function getUsers(): Promise<User[]> {
    const snap = await getDocs(collection(db, 'users'))
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as User))
  }

  export async function getAccounts(): Promise<Account[]> {
    const snap = await getDocs(query(collection(db, 'accounts'), orderBy('name')))
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Account))
  }

  export async function getCategories(): Promise<Category[]> {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('name')))
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Category))
  }

  export async function getTransactions(): Promise<Transaction[]> {
    const [txSnap, catSnap, accSnap, userSnap] = await Promise.all([
      getDocs(query(collection(db, 'transactions'), orderBy('transaction_date', 'desc'))),
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'accounts')),
      getDocs(collection(db, 'users')),
    ])

    const catMap = new Map(catSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Category]))
    const accMap = new Map(accSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Account]))
    const userMap = new Map(userSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as User]))

    return txSnap.docs.map(d => {
      const tx = { id: d.id, ...d.data() } as Transaction
      tx.category = catMap.get(tx.category_id)
      tx.account = accMap.get(tx.account_id)
      tx.user = userMap.get(tx.user_id)
      return tx
    })
  }

  export async function createTransaction(tx: {
    type: 'gasto' | 'ingreso'
    amount: number
    currency: 'ARS' | 'USD'
    description: string | null
    category_id: string
    account_id: string
    user_id: string
    transaction_date?: string
  }): Promise<Transaction> {
    const accRef = doc(db, 'accounts', tx.account_id)
    const accSnap = await getDoc(accRef)
    if (!accSnap.exists()) throw new Error('No se pudo encontrar la cuenta especificada.')

    const txRef = await addDoc(collection(db, 'transactions'), {
      type: tx.type,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description || null,
      category_id: tx.category_id,
      account_id: tx.account_id,
      user_id: tx.user_id,
      transaction_date: tx.transaction_date || new Date().toISOString(),
    })

    const amountChange = tx.type === 'ingreso' ? tx.amount : -tx.amount
    await updateDoc(accRef, {
      current_balance: Number(accSnap.data().current_balance) + amountChange
    })

    const newSnap = await getDoc(txRef)
    return { id: newSnap.id, ...newSnap.data() } as Transaction
  }

  export async function deleteTransaction(id: string): Promise<void> {
    const txRef = doc(db, 'transactions', id)
    const txSnap = await getDoc(txRef)
    if (!txSnap.exists()) throw new Error('No se pudo encontrar la transacción para eliminar.')
    const tx = txSnap.data()

    const accRef = doc(db, 'accounts', tx.account_id)
    const accSnap = await getDoc(accRef)
    if (!accSnap.exists()) throw new Error('No se pudo encontrar la cuenta asociada.')

    const amountChange = tx.type === 'ingreso' ? -tx.amount : tx.amount
    await updateDoc(accRef, {
      current_balance: Number(accSnap.data().current_balance) + amountChange
    })
    await deleteDoc(txRef)
  }

  export async function createAccount(acc: {
    name: string
    type: string
    currency: 'ARS' | 'USD'
    owner_user_id: string
    current_balance: number
  }): Promise<Account> {
    const ref = await addDoc(collection(db, 'accounts'), acc)
    return { id: ref.id, created_at: new Date().toISOString(), ...acc }
  }

  export async function createCategory(cat: {
    name: string
    type: 'gasto' | 'ingreso'
    color: string
    icon: string
  }): Promise<Category> {
    const ref = await addDoc(collection(db, 'categories'), cat)
    return { id: ref.id, created_at: new Date().toISOString(), ...cat }
  }

  export function getUsdRate(): number {
    const stored = localStorage.getItem('usd_rate')
    if (stored) {
      const parsed = parseFloat(stored)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
    return DEFAULT_USD_RATE
  }

  export function setUsdRate(rate: number): void {
    localStorage.setItem('usd_rate', rate.toString())
  }

  export function parseWhatsAppMessage(message: string, categories: Category[]): {
    amount: number
    type: 'gasto' | 'ingreso'
    categoryName: string
    description: string
  } | null {
    try {
      const text = message.toLowerCase()
      const amountMatch = text.match(/\d+(\.\d+)?/)
      if (!amountMatch) return null
      const amount = parseFloat(amountMatch[0])

      let type: 'gasto' | 'ingreso' = 'gasto'
      if (text.includes('recibi') || text.includes('ingreso') || text.includes('sueldo') || text.includes('pago')) {
        type = 'ingreso'
      }

      let matchedCategory = categories[0]
      for (const cat of categories) {
        if (text.includes(cat.name.toLowerCase())) {
          matchedCategory = cat
          break
        }
      }

      const description = message.replace(amountMatch[0], '').trim() || `Importado: ${matchedCategory.name}`
      return { amount, type, categoryName: matchedCategory.name, description }
    } catch {
      return null
    }
  }
  ```

- [ ] **Step 2: Verificar que TypeScript no reporta errores**

  ```bash
  cd "c:\Users\Martin\Desktop\ANTIGRAVITY\APP FINANZAS MM"
  npx tsc --noEmit
  ```

  Esperado: sin errores. Si hay errores sobre `supabase`, significa que algún archivo todavía lo importa — identificar cuál en el siguiente task.

---

### Task 3: Actualizar `App.tsx` — reemplazar import de supabase

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Reemplazar el import de supabase y el uso directo**

  En `src/App.tsx`, el `useEffect` inicial hace `supabase.from('users').select('*')`. Reemplazarlo usando `getUsers()` de `api.ts`:

  ```tsx
  // ANTES (líneas ~10-11 y ~31-33):
  import { supabase } from './lib/supabase'
  // ...
  supabase.from('users').select('*').then(({ data }) => {
    if (data) setUsers(data)
  })

  // DESPUÉS:
  import { getUsers } from './services/api'
  // ...
  getUsers().then(data => setUsers(data)).catch(() => {})
  ```

  El import de `type { User }` de `./types/database` ya debe estar presente del cambio anterior — verificar que sigue ahí.

- [ ] **Step 2: Verificar TypeScript limpio**

  ```bash
  npx tsc --noEmit
  ```

  Esperado: 0 errores. Si hay errores de `supabase` en otro archivo, leerlo y reemplazar el import.

---

### Task 4: Script de migración de datos

**Files:**
- Create: `scripts/migrate-supabase-to-firebase.mjs`

**Prerequisito:** Descargar el service account de Firebase:
1. Firebase Console → Project Settings (ícono ⚙️) → **Service accounts**
2. Click **"Generate new private key"** → confirmar → se descarga un JSON
3. Mover ese archivo a la raíz del proyecto y renombrarlo: `firebase-service-account.json`
4. Verificar que está en `.gitignore` (Task 1, Step 4)

- [ ] **Step 1: Crear `scripts/migrate-supabase-to-firebase.mjs`**

  ```js
  import { initializeApp, cert } from 'firebase-admin/app'
  import { getFirestore } from 'firebase-admin/firestore'
  import { readFileSync } from 'fs'
  import { fileURLToPath } from 'url'
  import { dirname, join } from 'path'

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '..', 'firebase-service-account.json'), 'utf8')
  )

  initializeApp({ credential: cert(serviceAccount) })
  const db = getFirestore()

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno.')
    process.exit(1)
  }

  async function fetchTable(table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      }
    })
    if (!res.ok) throw new Error(`Error fetching "${table}": HTTP ${res.status}`)
    return res.json()
  }

  async function migrateTable(tableName) {
    console.log(`  Leyendo "${tableName}" de Supabase...`)
    const rows = await fetchTable(tableName)

    if (rows.length === 0) {
      console.log(`  ⚠️  "${tableName}" está vacío — sin cambios.`)
      return
    }

    // Firestore batch tiene límite de 500 ops — dividir en chunks si hace falta
    const BATCH_SIZE = 400
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE)
      const batch = db.batch()
      for (const row of chunk) {
        const { id, ...data } = row
        batch.set(db.collection(tableName).doc(String(id)), data)
      }
      await batch.commit()
    }

    console.log(`  ✓ ${rows.length} registros migrados a Firestore.`)
  }

  async function main() {
    console.log('🚀 Iniciando migración Supabase → Firebase Firestore...\n')
    for (const table of ['users', 'accounts', 'categories', 'transactions']) {
      console.log(`\n[${table}]`)
      await migrateTable(table)
    }
    console.log('\n✅ Migración completa. Verificá los datos en Firebase Console.')
  }

  main().catch(err => {
    console.error('\n❌ Error durante la migración:', err.message)
    process.exit(1)
  })
  ```

- [ ] **Step 2: Correr el script de migración**

  Asegurarse de que `firebase-service-account.json` está en la raíz del proyecto. Luego:

  ```bash
  cd "c:\Users\Martin\Desktop\ANTIGRAVITY\APP FINANZAS MM"
  node --env-file=.env scripts/migrate-supabase-to-firebase.mjs
  ```

  Salida esperada:
  ```
  🚀 Iniciando migración Supabase → Firebase Firestore...

  [users]
    Leyendo "users" de Supabase...
    ✓ 2 registros migrados a Firestore.

  [accounts]
    Leyendo "accounts" de Supabase...
    ✓ N registros migrados a Firestore.

  [categories]
    Leyendo "categories" de Supabase...
    ✓ N registros migrados a Firestore.

  [transactions]
    Leyendo "transactions" de Supabase...
    ✓ N registros migrados a Firestore.

  ✅ Migración completa. Verificá los datos en Firebase Console.
  ```

  Si hay error de conexión a Supabase, verificar que el `.env` aún tiene las vars `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (las necesitamos solo para el script — las borramos después).

- [ ] **Step 3: Verificar datos en Firebase Console**

  1. Ir a Firebase Console → **Firestore Database**
  2. Verificar que existen las 4 colecciones: `users`, `accounts`, `categories`, `transactions`
  3. Click en `users` → verificar que aparecen Martín y Micaela con sus `pin_hash`
  4. Click en `transactions` → verificar que los documentos tienen `category_id`, `account_id`, `user_id`

---

### Task 5: Configurar reglas de Firestore y verificar la app

**Files:** Sin cambios de código — solo configuración en Firebase Console y prueba manual.

- [ ] **Step 1: Publicar reglas de Firestore**

  En Firebase Console → **Firestore Database → Rules**, reemplazar el contenido con:

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

  Click **Publish**.

- [ ] **Step 2: Levantar la app y verificar login**

  ```bash
  cd "c:\Users\Martin\Desktop\ANTIGRAVITY\APP FINANZAS MM"
  npm run dev
  ```

  Abrir `http://localhost:5173`. Verificar:
  - [ ] Pantalla de selección de usuario carga
  - [ ] Seleccionar Martín → ingresar PIN → debe entrar al Dashboard (los usuarios se cargan de Firestore)
  - [ ] Dashboard muestra saldos de cuentas
  - [ ] Movimientos lista todas las transacciones con categoría, cuenta y usuario

- [ ] **Step 3: Verificar operaciones de escritura**

  - [ ] Ir a **Cargar** → registrar un gasto → verificar que aparece en Firebase Console
  - [ ] Ir a **Movimientos** → eliminar un movimiento → verificar que desaparece de Firebase Console y el saldo de la cuenta se actualizó
  - [ ] Ir a **Más** → crear una nueva cuenta → verificar que aparece en la lista

- [ ] **Step 4: Verificar Reportes**

  - [ ] Ir a **Reportes** → verificar que los gráficos muestran datos correctos para el mes actual

- [ ] **Step 5: Limpiar — borrar vars de Supabase del `.env`**

  Una vez que todo funciona, eliminar del `.env`:
  ```
  VITE_SUPABASE_URL=...
  VITE_SUPABASE_ANON_KEY=...
  ```

  El `.env` debe quedar solo con las 6 vars de Firebase.

---

## Resumen de lo que cambia

| Componente | Antes | Después |
|---|---|---|
| Backend | Supabase REST + Realtime | Firebase Firestore |
| Cliente | `@supabase/supabase-js` | `firebase` SDK v10 |
| Inicialización | `src/lib/supabase.ts` | `src/lib/firebase.ts` |
| API layer | `api.ts` con supabase queries | `api.ts` con getDocs/addDoc/etc. |
| Joins | Supabase SELECT con JOIN | Promise.all + Map en JS |
| Auth | Supabase query on login | Firebase query on login (igual) |
| Componentes | Sin cambios | Sin cambios |
