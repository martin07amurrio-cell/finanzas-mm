export type User = {
  id: string
  name: string
  pin_hash: string
  role: string
  created_at: string
}

export type Account = {
  id: string
  name: string
  owner_user_id: string
  type: string // 'cash' | 'bank' | 'fintech' | 'savings'
  currency: 'ARS' | 'USD'
  current_balance: number
  created_at: string
}

export type Category = {
  id: string
  name: string
  type: 'gasto' | 'ingreso' | 'reserva'
  color: string | null
  icon: string | null
  created_at: string
}

export type Transaction = {
  id: string
  type: 'gasto' | 'ingreso'
  amount: number
  currency: 'ARS' | 'USD'
  description: string | null
  category_id: string
  account_id: string
  user_id: string
  transaction_date: string
  category?: Category
  account?: Account
  user?: User
}
