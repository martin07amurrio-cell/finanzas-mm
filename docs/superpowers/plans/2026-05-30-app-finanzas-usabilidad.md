# App Finanzas MM — Bugs y UX Esencial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir 3 bugs funcionales y 3 problemas de usabilidad en la app de finanzas interna sin agregar dependencias ni modificar la base de datos.

**Architecture:** Todos los cambios son en el frontend React. Se extienden props existentes, se agregan pequeños estados locales y se reemplaza lógica de `localStorage` para la tasa USD. No hay refactor estructural — se sigue el patrón de cada archivo existente.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Supabase JS client, Lucide React (iconos ya instalados)

---

## Mapa de archivos

| Archivo | Rol del cambio |
|---|---|
| `src/services/api.ts` | Join `user:users(*)` en `getTransactions`; `getUsdRate()` y `setUsdRate()` |
| `src/components/auth/PinEntry.tsx` | Resetear pin cuando llega un error |
| `src/pages/cargar/Cargar.tsx` | Resetear fecha al reusar formulario |
| `src/pages/dashboard/Dashboard.tsx` | Recibir y usar `onNavigateToTab` |
| `src/App.tsx` | Pasar `onNavigateToTab` a `<Dashboard>` |
| `src/pages/movimientos/Movimientos.tsx` | Confirmación inline de borrado |
| `src/pages/mas/Mas.tsx` | Errores inline + sección tasa USD |

---

### Task 1: Fix API — join de usuarios y tasa USD configurable

**Files:**
- Modify: `src/services/api.ts`

- [ ] **Step 1: Agregar join de `user` en `getTransactions`**

Reemplazar el select actual:

```ts
// ANTES (línea ~27):
const { data, error } = await supabase
  .from('transactions')
  .select(`
    *,
    category:categories(*),
    account:accounts(*)
  `)
  .order('transaction_date', { ascending: false })

// DESPUÉS:
const { data, error } = await supabase
  .from('transactions')
  .select(`
    *,
    category:categories(*),
    account:accounts(*),
    user:users(*)
  `)
  .order('transaction_date', { ascending: false })
```

- [ ] **Step 2: Agregar `getUsdRate()` y `setUsdRate()` al final del archivo**

```ts
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
```

- [ ] **Step 3: Verificar manualmente**

Abrir DevTools → Application → LocalStorage. No debe existir aún `usd_rate`. Ejecutar en consola:
```js
localStorage.setItem('usd_rate', '1200')
```
Recargar la app — el Dashboard debería usar 1200 (lo veremos en Task 4 cuando lo conectemos).

- [ ] **Step 4: Commit**

```bash
git add src/services/api.ts
git commit -m "fix: join users in getTransactions; add getUsdRate/setUsdRate helpers"
```

---

### Task 2: Fix PinEntry — resetear PIN al recibir error

**Files:**
- Modify: `src/components/auth/PinEntry.tsx`

- [ ] **Step 1: Agregar useEffect que resetea el pin cuando llega un error**

Después del `useEffect` existente (el que dispara `onComplete` cuando `pin.length === 4`), agregar:

```tsx
useEffect(() => {
  if (error) {
    setPin('')
  }
}, [error])
```

- [ ] **Step 2: Verificar manualmente**

1. Abrir la app, seleccionar un usuario
2. Ingresar 4 dígitos incorrectos
3. Verificar que los 4 puntos se vacían solos y el mensaje de error aparece
4. Volver a ingresar — debe funcionar sin necesidad de borrar manualmente

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/PinEntry.tsx
git commit -m "fix: auto-clear PIN digits when error is received"
```

---

### Task 3: Fix Cargar — resetear fecha al reusar el formulario

**Files:**
- Modify: `src/pages/cargar/Cargar.tsx`

- [ ] **Step 1: Actualizar el botón "Cargar otro movimiento"**

Buscar el botón en la pantalla de éxito (línea ~137):

```tsx
// ANTES:
<button
  onClick={() => setSuccess(false)}
  className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-semibold shadow-md active:scale-95 transition-all"
>
  Cargar otro movimiento
</button>

// DESPUÉS:
<button
  onClick={() => {
    setSuccess(false)
    setDate(new Date().toISOString().split('T')[0])
  }}
  className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-semibold shadow-md active:scale-95 transition-all"
>
  Cargar otro movimiento
</button>
```

- [ ] **Step 2: Verificar manualmente**

1. Ir a Cargar, cambiar la fecha a ayer
2. Registrar un movimiento — ver pantalla de éxito
3. Presionar "Cargar otro movimiento"
4. Verificar que el campo fecha vuelve a mostrar la fecha de hoy

- [ ] **Step 3: Commit**

```bash
git add src/pages/cargar/Cargar.tsx
git commit -m "fix: reset date to today when reusing the transaction form"
```

---

### Task 4: Dashboard — prop onNavigateToTab + botón "Ver todos" + tasa USD dinámica

**Files:**
- Modify: `src/pages/dashboard/Dashboard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Actualizar la firma del componente Dashboard**

```tsx
// ANTES (línea 8):
export function Dashboard() {

// DESPUÉS:
interface DashboardProps {
  onNavigateToTab: (tab: string) => void
}

export function Dashboard({ onNavigateToTab }: DashboardProps) {
```

- [ ] **Step 2: Reemplazar `DEFAULT_USD_RATE` por `getUsdRate()`**

Actualizar el import en la primera línea:

```tsx
// ANTES:
import { getAccounts, getTransactions, DEFAULT_USD_RATE } from '../../services/api'

// DESPUÉS:
import { getAccounts, getTransactions, getUsdRate } from '../../services/api'
```

Luego reemplazar los dos usos de `DEFAULT_USD_RATE` en los cálculos (líneas ~48-50):

```tsx
// ANTES:
const totalBalanceARS = balanceARS + (balanceUSD * DEFAULT_USD_RATE)
const totalBalanceUSD = balanceUSD + (balanceARS / DEFAULT_USD_RATE)

// DESPUÉS:
const usdRate = getUsdRate()
const totalBalanceARS = balanceARS + (balanceUSD * usdRate)
const totalBalanceUSD = balanceUSD + (balanceARS / usdRate)
```

- [ ] **Step 3: Agregar botón "Ver todos →" en el header de Movimientos Recientes**

Buscar la sección (línea ~186):

```tsx
// ANTES:
<div className="flex items-center justify-between">
  <h3 className="font-bold text-sm">Movimientos Recientes</h3>
</div>

// DESPUÉS:
<div className="flex items-center justify-between">
  <h3 className="font-bold text-sm">Movimientos Recientes</h3>
  <button
    onClick={() => onNavigateToTab('movimientos')}
    className="text-xs text-primary font-semibold hover:underline active:opacity-70 transition-opacity"
  >
    Ver todos →
  </button>
</div>
```

- [ ] **Step 4: Pasar el prop en App.tsx**

```tsx
// ANTES (línea ~79):
{activeTab === 'inicio' && <Dashboard />}

// DESPUÉS:
{activeTab === 'inicio' && <Dashboard onNavigateToTab={setActiveTab} />}
```

- [ ] **Step 5: Verificar manualmente**

1. Dashboard carga — verificar que compila sin errores de TypeScript
2. Si hay `usd_rate` en localStorage (del Task 1), verificar que el total en ARS usa ese valor
3. Tocar "Ver todos →" — debe navegar a la tab de Movimientos

- [ ] **Step 6: Commit**

```bash
git add src/pages/dashboard/Dashboard.tsx src/App.tsx
git commit -m "feat: add navigate-to-movimientos link in dashboard; use dynamic USD rate"
```

---

### Task 5: Movimientos — confirmación inline de borrado

**Files:**
- Modify: `src/pages/movimientos/Movimientos.tsx`

- [ ] **Step 1: Agregar state `deletingId`**

Después de los states existentes (línea ~16):

```tsx
const [deletingId, setDeletingId] = useState<string | null>(null)
```

- [ ] **Step 2: Actualizar `handleDelete` para que no use `window.confirm`**

```tsx
// ANTES:
const handleDelete = async (id: string) => {
  if (!window.confirm('¿Estás seguro de eliminar este movimiento? Se revertirá del saldo de tu cuenta.')) {
    return
  }

  try {
    await deleteTransaction(id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  } catch (err) {
    alert('Error al intentar eliminar la transacción.')
  }
}

// DESPUÉS:
const handleDelete = async (id: string) => {
  try {
    await deleteTransaction(id)
    setTransactions(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
  } catch (err) {
    setError('Error al intentar eliminar la transacción.')
    setDeletingId(null)
  }
}
```

- [ ] **Step 3: Reemplazar el botón de borrado con la lógica inline**

Dentro del `.map((tx) => (...))`, reemplazar el `<div>` del item completo:

```tsx
<div
  key={tx.id}
  className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
>
  {/* Fila principal */}
  <div className="p-4 flex items-center justify-between">
    <div className="flex items-center space-x-3 z-10">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0"
        style={{ backgroundColor: tx.category?.color || '#3498DB' }}
      >
        {tx.category?.name.charAt(0) || 'T'}
      </div>
      <div>
        <p className="font-semibold text-sm">
          {tx.description || tx.category?.name || 'Transacción'}
        </p>
        <div className="flex items-center space-x-2 text-[10px] text-muted-foreground font-medium">
          <span>{tx.account?.name || 'Cuenta'}</span>
          <span>•</span>
          <span className="flex items-center space-x-0.5">
            <User className="w-3 h-3 text-muted-foreground/70" />
            <span>{tx.user?.name || 'Desconocido'}</span>
          </span>
        </div>
      </div>
    </div>

    <div className="flex items-center space-x-3">
      <div className="text-right">
        <p className={`font-bold text-sm ${tx.type === 'ingreso' ? 'text-brand-green' : 'text-brand-coral'}`}>
          {tx.type === 'ingreso' ? '+' : '-'}${Number(tx.amount).toLocaleString('es-AR')}
          <span className="text-[10px] ml-0.5">{tx.currency}</span>
        </p>
      </div>
      <button
        onClick={() => setDeletingId(deletingId === tx.id ? null : tx.id)}
        className="p-2 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
        title="Eliminar movimiento"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </div>

  {/* Fila de confirmación — solo visible cuando deletingId === tx.id */}
  {deletingId === tx.id && (
    <div className="px-4 pb-3 flex items-center justify-between bg-destructive/5 border-t border-destructive/10">
      <p className="text-xs text-destructive font-medium">¿Eliminar este movimiento?</p>
      <div className="flex space-x-2">
        <button
          onClick={() => setDeletingId(null)}
          className="text-xs px-3 py-1.5 rounded-xl bg-secondary text-muted-foreground font-semibold active:scale-95 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={() => handleDelete(tx.id)}
          className="text-xs px-3 py-1.5 rounded-xl bg-destructive text-white font-semibold active:scale-95 transition-all"
        >
          Eliminar
        </button>
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 4: Verificar manualmente**

1. Ir a Movimientos — ver lista de transacciones
2. Tocar el ícono 🗑️ de cualquier movimiento — debe aparecer la fila de confirmación expandida en rojo
3. Tocar "Cancelar" — la fila debe colapsarse
4. Tocar 🗑️ de otro movimiento, luego "Eliminar" — el movimiento debe desaparecer de la lista
5. Verificar que NO aparece ningún dialog nativo del sistema

- [ ] **Step 5: Commit**

```bash
git add src/pages/movimientos/Movimientos.tsx
git commit -m "feat: replace window.confirm with inline delete confirmation in Movimientos"
```

---

### Task 6: Más — errores inline + sección de configuración USD

**Files:**
- Modify: `src/pages/mas/Mas.tsx`

- [ ] **Step 1: Agregar imports y states de error/USD**

Actualizar el import de `api.ts`:

```tsx
// ANTES:
import { getAccounts, getCategories, createAccount, createCategory, parseWhatsAppMessage, createTransaction } from '../../services/api'

// DESPUÉS:
import { getAccounts, getCategories, createAccount, createCategory, parseWhatsAppMessage, createTransaction, getUsdRate, setUsdRate } from '../../services/api'
```

Agregar states después de `const [waSuccess, setWaSuccess] = useState(false)`:

```tsx
const [accError, setAccError] = useState<string | null>(null)
const [catError, setCatError] = useState<string | null>(null)
const [usdRate, setUsdRateState] = useState<number>(getUsdRate())
```

- [ ] **Step 2: Reemplazar `alert` en `handleCreateAccount`**

```tsx
// ANTES:
} catch (err) {
  alert('Error al crear la cuenta.')
}

// DESPUÉS:
} catch (err) {
  setAccError('Error al crear la cuenta. Intenta de nuevo.')
}
```

También limpiar el error al inicio del handler:

```tsx
const handleCreateAccount = async (e: React.FormEvent) => {
  e.preventDefault()
  setAccError(null)          // <-- agregar esta línea
  if (!newAccName.trim()) return
  // ... resto igual
```

Y al cerrar el form exitosamente, limpiar el error:

```tsx
setAccounts(prev => [...prev, newAcc])
setNewAccName('')
setNewAccBalance('')
setShowAccForm(false)
setAccError(null)            // <-- agregar esta línea
```

- [ ] **Step 3: Mostrar `accError` dentro del formulario de cuenta**

Justo antes del botón "Guardar Cuenta":

```tsx
{accError && (
  <p className="text-destructive text-xs font-semibold">{accError}</p>
)}
<button
  type="submit"
  className="w-full bg-primary text-primary-foreground py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
>
  Guardar Cuenta
</button>
```

- [ ] **Step 4: Reemplazar `alert` en `handleCreateCategory`**

```tsx
// ANTES:
} catch (err) {
  alert('Error al crear la categoría.')
}

// DESPUÉS:
} catch (err) {
  setCatError('Error al crear la categoría. Intenta de nuevo.')
}
```

Limpiar al inicio del handler:

```tsx
const handleCreateCategory = async (e: React.FormEvent) => {
  e.preventDefault()
  setCatError(null)          // <-- agregar esta línea
  if (!newCatName.trim()) return
```

Y al éxito:

```tsx
setCategories(prev => [...prev, newCat])
setNewCatName('')
setShowCatForm(false)
setCatError(null)            // <-- agregar esta línea
```

- [ ] **Step 5: Mostrar `catError` dentro del formulario de categoría**

Justo antes del botón "Guardar Categoría":

```tsx
{catError && (
  <p className="text-destructive text-xs font-semibold">{catError}</p>
)}
<button
  type="submit"
  className="w-full bg-primary text-primary-foreground py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
>
  Guardar Categoría
</button>
```

- [ ] **Step 6: Agregar sección "Configuración" con campo de tasa USD**

Agregar un nuevo bloque `<div>` después del bloque del Simulador WhatsApp (antes del cierre del `return`):

```tsx
{/* Configuración — Tasa de Cambio USD */}
<div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-4">
  <h3 className="font-bold flex items-center space-x-2">
    <Settings className="w-5 h-5 text-primary" />
    <span>Configuración</span>
  </h3>

  <div className="space-y-2">
    <label className="text-[10px] font-bold text-muted-foreground uppercase">
      Tasa de Cambio USD → ARS
    </label>
    <div className="flex items-center space-x-3">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">1 USD =</span>
        <input
          type="number"
          min="1"
          step="any"
          value={usdRate}
          onChange={(e) => setUsdRateState(parseFloat(e.target.value) || getUsdRate())}
          onBlur={(e) => {
            const val = parseFloat(e.target.value)
            if (!isNaN(val) && val > 0) {
              setUsdRate(val)
              setUsdRateState(val)
            }
          }}
          className="w-full pl-16 pr-12 py-2.5 bg-secondary text-sm font-bold rounded-2xl border border-border focus:ring-2 focus:ring-primary focus:outline-none"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">ARS</span>
      </div>
    </div>
    <p className="text-[10px] text-muted-foreground">
      Se usa para calcular el saldo total estimado en el Dashboard. Se guarda automáticamente.
    </p>
  </div>
</div>
```

- [ ] **Step 7: Verificar manualmente**

1. Ir a Más → Configuración
2. Cambiar la tasa a `1350`, salir del campo (onBlur) — no debe aparecer ningún alert
3. Ir al Dashboard — el saldo total en ARS debe recalcularse con la nueva tasa
4. Recargar la app — la tasa debe seguir siendo `1350` (persiste en localStorage)
5. Volver a Más → formulario de cuenta → presionar Guardar sin nombre → debe mostrar el error inline, sin alert nativo

- [ ] **Step 8: Commit**

```bash
git add src/pages/mas/Mas.tsx
git commit -m "feat: inline form errors in Mas; add configurable USD rate setting"
```

---

### Task 7: Verificación final integral

**Files:** Sin cambios — solo verificación

- [ ] **Step 1: Verificar el filtro de usuario en Movimientos**

1. Ir a Movimientos
2. Cambiar el filtro "Usuario" a "Martín"
3. Verificar que solo aparecen movimientos donde el usuario es Martín (antes siempre mostraba todos)
4. Cambiar a "Micaela" — verificar que filtra correctamente
5. Cambiar a "Todos" — vuelven a aparecer todos

- [ ] **Step 2: Verificar flujo completo de nuevo movimiento**

1. Ir a Cargar
2. Registrar un movimiento con fecha de ayer
3. Ver pantalla de éxito
4. Presionar "Cargar otro movimiento" — verificar que la fecha es hoy
5. Presionar "Ver historial" — navega a Movimientos y aparece el movimiento recién cargado

- [ ] **Step 3: Verificar flujo de login**

1. Cerrar sesión desde Más
2. Seleccionar usuario
3. Ingresar PIN incorrecto (ej. 0000)
4. Verificar que los puntos se vacían solos + aparece mensaje de error
5. Ingresar PIN correcto — accede al Dashboard

- [ ] **Step 4: Commit final (si no hay cambios pendientes)**

```bash
git log --oneline -7
```

Verificar que aparecen los 6 commits de los tasks anteriores.

---

## Resumen de commits esperados

```
fix: join users in getTransactions; add getUsdRate/setUsdRate helpers
fix: auto-clear PIN digits when error is received
fix: reset date to today when reusing the transaction form
feat: add navigate-to-movimientos link in dashboard; use dynamic USD rate
feat: replace window.confirm with inline delete confirmation in Movimientos
feat: inline form errors in Mas; add configurable USD rate setting
```
