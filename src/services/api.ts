import type { Account, Category, Transaction, User } from '../types/database'

export const DEFAULT_USD_RATE = 1000

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export type AuthSession = {
  token: string
  user: User
}

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

function authHeaders(includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {}

  if (includeJson) {
    headers['Content-Type'] = 'application/json'
  }

  const token = getAuthToken()
  if (token) {
    headers['X-Finanzas-Token'] = token
  }

  return headers
}


function clearInvalidSession(): never {
  localStorage.removeItem('auth_user')
  localStorage.removeItem('auth_token')
  window.location.reload()
  throw new Error('Sesión vencida. Volvé a iniciar sesión.')
}

function handleUnauthorized(response: Response): void {
  if (response.status === 401) {
    clearInvalidSession()
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'same-origin',
    headers: authHeaders(),
  })

  if (!response.ok) {
    handleUnauthorized(response)
    throw new Error(`Error al consultar API Finanzas MM: ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    handleUnauthorized(response)
    const detail = await response.text().catch(() => '')
    throw new Error(`Error al guardar en API Finanzas MM: ${response.status}${detail ? ` - ${detail}` : ''}`)
  }

  return response.json() as Promise<T>
}

async function apiPostPublic<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Error de autenticación: ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: authHeaders(),
  })

  if (!response.ok) {
    handleUnauthorized(response)
    const detail = await response.text().catch(() => '')
    throw new Error(`Error al borrar en API Finanzas MM: ${response.status}${detail ? ` - ${detail}` : ''}`)
  }
}

function throwReadOnlyError(): never {
  throw new Error(
    'Esta operación todavía no está habilitada en PostgreSQL. Primero se habilitan movimientos y después cuentas/categorías.'
  )
}

export async function loginUser(name: 'Martín' | 'Micaela', pin: string): Promise<AuthSession> {
  return apiPostPublic<AuthSession>('/api/auth/login', { name, pin })
}

export async function getUsers(): Promise<User[]> {
  return apiGet<User[]>('/api/users')
}

export async function getAccounts(): Promise<Account[]> {
  return apiGet<Account[]>('/api/accounts')
}

export async function getCategories(): Promise<Category[]> {
  return apiGet<Category[]>('/api/categories')
}

export async function getTransactions(): Promise<Transaction[]> {
  return apiGet<Transaction[]>('/api/transactions')
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
  return apiPost<Transaction>('/api/transactions', tx)
}

export async function deleteTransaction(id: string): Promise<void> {
  return apiDelete(`/api/transactions/${encodeURIComponent(id)}`)
}

export async function createAccount(_acc: {
  name: string
  type: string
  currency: 'ARS' | 'USD'
  owner_user_id: string
  current_balance: number
}): Promise<Account> {
  throwReadOnlyError()
}

export async function updateAccount(_id: string, _data: { name: string; type: string }): Promise<void> {
  throwReadOnlyError()
}

export async function deleteAccount(_id: string): Promise<void> {
  throwReadOnlyError()
}

export async function createCategory(_cat: {
  name: string
  type: 'gasto' | 'ingreso'
  color: string
  icon: string
}): Promise<Category> {
  throwReadOnlyError()
}

export async function updateCategory(
  _id: string,
  _data: { name: string; type: 'gasto' | 'ingreso' | 'reserva'; color: string; icon: string }
): Promise<void> {
  throwReadOnlyError()
}

export async function deleteCategory(_id: string): Promise<void> {
  throwReadOnlyError()
}

const USD_RATE_KEY = 'usd_rate'
const USD_RATE_TS_KEY = 'usd_rate_updated_at'
const USD_PREV_RATE_KEY = 'usd_rate_prev'
const USD_PREV_DATE_KEY = 'usd_rate_prev_date'
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000 // 6 horas

export function getUsdRate(): number {
  const stored = localStorage.getItem(USD_RATE_KEY)
  if (stored) {
    const parsed = parseFloat(stored)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_USD_RATE
}

export function getUsdRateUpdatedAt(): Date | null {
  const ts = localStorage.getItem(USD_RATE_TS_KEY)
  return ts ? new Date(parseInt(ts)) : null
}

export function getUsdPreviousRate(): { rate: number | null; date: string | null } {
  const rate = localStorage.getItem(USD_PREV_RATE_KEY)
  const date = localStorage.getItem(USD_PREV_DATE_KEY)
  return {
    rate: rate ? parseFloat(rate) : null,
    date: date || null,
  }
}

export async function fetchUsdRate(force = false): Promise<number> {
  const stored = localStorage.getItem(USD_RATE_KEY)
  const timestamp = localStorage.getItem(USD_RATE_TS_KEY)

  if (!force && stored && timestamp) {
    const age = Date.now() - parseInt(timestamp)
    if (age < CACHE_DURATION_MS) return parseFloat(stored)
  }

  try {
    const desde = new Date()
    desde.setDate(desde.getDate() - 10)
    const desdeStr = desde.toISOString().split('T')[0]

    const res = await fetch(`https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial?desde=${desdeStr}`)
    const data = await res.json()

    if (Array.isArray(data) && data.length >= 1) {
      const sorted = [...data].sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
      const current = sorted[sorted.length - 1]
      const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null

      localStorage.setItem(USD_RATE_KEY, current.venta.toString())
      localStorage.setItem(USD_RATE_TS_KEY, Date.now().toString())
      if (previous) {
        localStorage.setItem(USD_PREV_RATE_KEY, previous.venta.toString())
        localStorage.setItem(USD_PREV_DATE_KEY, previous.fecha)
      }
      return current.venta
    }

    const res2 = await fetch('https://dolarapi.com/v1/dolares/oficial')
    const data2 = await res2.json()
    const rate: number = data2.venta
    localStorage.setItem(USD_RATE_KEY, rate.toString())
    localStorage.setItem(USD_RATE_TS_KEY, Date.now().toString())
    return rate
  } catch {
    return stored ? parseFloat(stored) : DEFAULT_USD_RATE
  }
}
