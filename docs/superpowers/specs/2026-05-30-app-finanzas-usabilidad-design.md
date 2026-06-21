# Spec: App Finanzas MM — Bugs y UX Esencial

**Fecha:** 2026-05-30  
**Alcance:** Corrección de bugs funcionales + mejoras de usabilidad sin nuevas dependencias ni cambios de DB

---

## Contexto

App interna de finanzas personales para dos usuarios (Martín y Micaela). Stack: React + TypeScript + Tailwind + Supabase. Mobile-first, sin router (navegación por estado).

---

## Problemas a resolver

### Bug 1 — Filtro de usuario en Movimientos nunca funciona
`getTransactions()` en `api.ts` no incluye join con `users`. El campo `t.user` siempre es `undefined`, por lo que el filtro `t.user?.name === 'Martín'` nunca matchea.

**Fix:** Agregar `user:users(*)` al select de Supabase en `getTransactions()`.

### Bug 2 — PIN no se resetea al recibir error
Tras un PIN incorrecto, los 4 puntos permanecen llenos. El usuario debe borrar manualmente antes de reintentar.

**Fix:** En `PinEntry.tsx`, `useEffect` que observa el prop `error` — cuando cambia a un string no-vacío, ejecuta `setPin('')`.

### Bug 3 — Fecha no resetea al reusar formulario de Cargar
Al presionar "Cargar otro movimiento" en la pantalla de éxito, `setSuccess(false)` no resetea la fecha. Si el usuario cargó un movimiento de ayer, el próximo también vendrá con esa fecha.

**Fix:** En el handler `onClick` del botón, también ejecutar `setDate(new Date().toISOString().split('T')[0])`.

### UX 1 — `window.confirm()` y `alert()` en mobile
`Movimientos.tsx` usa `window.confirm` para confirmar borrado y `alert` para el error. `Mas.tsx` usa `alert` para errores de formulario. Ambos rompen la experiencia mobile (dialogs nativos del sistema operativo).

**Fix Movimientos:** State `deletingId: string | null`. Al tocar 🗑️ se setea al `id` de esa transacción. El item expande mostrando `[Cancelar] [Eliminar]`. Si confirma, llama `handleDelete(id)` y resetea a `null`.

**Fix Mas:** Tres states de error independientes (`accError`, `catError`, `waError` — este último ya existe). Mostrar como `<p className="text-destructive text-xs">` dentro de cada formulario.

### UX 2 — Sin navegación Dashboard → Movimientos
El header "Movimientos Recientes" no tiene un "Ver todos →" que lleve a la tab de movimientos.

**Fix:** `Dashboard` recibe prop `onNavigateToTab: (tab: string) => void` (mismo patrón que `Cargar`). El header del bloque de movimientos recientes incluye un `<button onClick={() => onNavigateToTab('movimientos')}>Ver todos →</button>`.

Se actualiza `App.tsx` para pasar el prop.

### UX 3 — Tasa USD hardcodeada
`DEFAULT_USD_RATE = 1000` en `api.ts` no refleja la realidad. No hay forma de actualizarla desde la UI.

**Fix:**
- `getUsdRate()`: lee `localStorage('usd_rate')`, fallback a `1000`.
- `setUsdRate(rate: number)`: escribe en `localStorage`.
- En `Mas.tsx`: campo numérico editable en nueva sección "Configuración". Se guarda `onBlur`.
- `Dashboard.tsx` y `Reportes.tsx` reemplazan `DEFAULT_USD_RATE` por `getUsdRate()`.

---

## Arquitectura de cambios

| Archivo | Cambios |
|---|---|
| `src/services/api.ts` | Join `user:users(*)` en `getTransactions`; agregar `getUsdRate()` y `setUsdRate()` |
| `src/components/auth/PinEntry.tsx` | `useEffect` que resetea pin cuando `error` cambia |
| `src/pages/cargar/Cargar.tsx` | Resetear fecha al reusar formulario |
| `src/pages/dashboard/Dashboard.tsx` | Prop `onNavigateToTab`; botón "Ver todos →" |
| `src/pages/movimientos/Movimientos.tsx` | State `deletingId`; confirmación inline |
| `src/pages/mas/Mas.tsx` | Errores inline; sección de configuración USD rate |
| `src/App.tsx` | Pasar `onNavigateToTab` a `<Dashboard>` |

---

## Restricciones

- Sin nuevas dependencias npm
- Sin cambios en schema de Supabase
- Sin cambios en el sistema de autenticación
- Sin paginación (queda para una iteración futura)
- Sin edición de transacciones (fuera de alcance)

---

## Criterios de éxito

1. El filtro por usuario en Movimientos muestra resultados correctos
2. El PIN se borra automáticamente después de un error
3. La fecha en Cargar siempre dice "hoy" al reusar el form
4. No aparece ningún `window.confirm` ni `alert` nativo
5. "Ver todos →" en Dashboard lleva a Movimientos
6. La tasa USD se puede cambiar desde Ajustes y persiste al recargar
