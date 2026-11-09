export type Section = 'agenda' | 'tareas' | 'compras' | 'despensa' | 'recetas' | 'menu' | 'limpieza' | 'objetivos'
export type HouseholdEntry = {
  id: string
  section: Section
  title: string
  notes: string | null
  details: string | null
  due_on: string | null
  assignee: 'Martín' | 'Micaela' | 'Ambos' | null
  quantity: number | null
  unit: string | null
  status: 'pendiente' | 'hecho'
  repeat_days: number | null
  progress: number | null
  target: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}
export type EntryInput = Pick<HouseholdEntry, 'section' | 'title' | 'notes' | 'details' | 'due_on' | 'assignee' | 'quantity' | 'unit' | 'status' | 'repeat_days' | 'progress' | 'target'>

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
async function request<T>(url: string, method = 'GET', data?: unknown): Promise<T> {
  const token = localStorage.getItem('auth_token')
  if (!token) throw new Error('La sesión venció. Volvé a ingresar.')
  const response = await fetch(`${BASE}/api/hogar${url}`, {
    method,
    headers: { 'X-Finanzas-Token': token, ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  if (response.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    throw new Error('Sesión vencida. Volvé a ingresar a la aplicación.')
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'No se pudo guardar el cambio')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
export const listHousehold = (section?: Section) => request<HouseholdEntry[]>(`/items${section ? `?section=${section}` : ''}`)
export const createHousehold = (entry: EntryInput) => request<HouseholdEntry>('/items', 'POST', entry)
export const updateHousehold = (id: string, entry: EntryInput) => request<HouseholdEntry>(`/items/${encodeURIComponent(id)}`, 'PUT', entry)
export const deleteHousehold = (id: string) => request<void>(`/items/${encodeURIComponent(id)}`, 'DELETE')
export const completeHousehold = (id: string, done: boolean) => request<HouseholdEntry>(`/items/${encodeURIComponent(id)}/complete`, 'POST', { done })
export const purchaseHousehold = (id: string) => request<HouseholdEntry>(`/items/${encodeURIComponent(id)}/purchase`, 'POST')
