import type { Account, Category, Transaction, User } from '../types/database'

export const DEFAULT_USD_RATE = 1000

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(`Error al consultar API Finanzas MM: ${response.status}`)
  }

  return response.json() as Promise<T>
}

function throwReadOnlyError(): never {
  throw new Error(
    'El backend PostgreSQL está en modo solo lectura. Las operaciones de alta, edición y borrado se habilitarán después de validar el frontend.'
  )
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

export async function createTransaction(_tx: {
  type: 'gasto' | 'ingreso'
  amount: number
  currency: 'ARS' | 'USD'
  description: string | null
  category_id: string
  account_id: string
  user_id: string
  transaction_date?: string
}): Promise<Transaction> {
  throwReadOnlyError()
}

export async function deleteTransaction(_id: string): Promise<void> {
  throwReadOnlyError()
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
