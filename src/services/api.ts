import { db } from '../lib/firebase'
import {
  collection, getDocs, addDoc, doc, getDoc,
  updateDoc, deleteDoc, query, orderBy
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

  const currentBalance = Number(accSnap.data().current_balance)
  if (tx.type === 'gasto' && currentBalance < tx.amount) {
    throw new Error(`Saldo insuficiente. La cuenta tiene $${currentBalance.toLocaleString('es-AR')} y el movimiento es por $${tx.amount.toLocaleString('es-AR')}.`)
  }

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

export async function updateAccount(id: string, data: { name: string; type: string }): Promise<void> {
  await updateDoc(doc(db, 'accounts', id), data)
}

export async function deleteAccount(id: string): Promise<void> {
  await deleteDoc(doc(db, 'accounts', id))
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

export async function updateCategory(id: string, data: { name: string; type: 'gasto' | 'ingreso' | 'reserva'; color: string; icon: string }): Promise<void> {
  await updateDoc(doc(db, 'categories', id), data)
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, 'categories', id))
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

    // fallback a dolarapi si argentinadatos no responde bien
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
