import { useState, useEffect } from 'react'
import { getAccounts, getTransactions, getUsdRate } from '../../services/api'
import type { Account, Transaction } from '../../types/database'
import { TrendingUp, TrendingDown, PiggyBank, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface DashboardProps {
  onNavigateToTab: (tab: string) => void
}

export function Dashboard({ onNavigateToTab }: DashboardProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('Usuario')

  useEffect(() => {
    // Obtener nombre de usuario de la sesión
    const savedUser = localStorage.getItem('auth_user')
    if (savedUser) {
      const user = JSON.parse(savedUser)
      setUserName(user.name)
    }

    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [accs, txs] = await Promise.all([getAccounts(), getTransactions()])
      setAccounts(accs)
      setTransactions(txs)
    } catch (err) {
      console.error('Error al cargar datos del dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  // 1. Calcular saldos por moneda
  const balanceARS = accounts
    .filter(a => a.currency === 'ARS')
    .reduce((sum, a) => sum + Number(a.current_balance), 0)

  const balanceUSD = accounts
    .filter(a => a.currency === 'USD')
    .reduce((sum, a) => sum + Number(a.current_balance), 0)

  // Balance total unificado en ARS
  const usdRate = getUsdRate()
  const totalBalanceARS = balanceARS + (balanceUSD * usdRate)
  // Balance total unificado en USD
  const totalBalanceUSD = balanceUSD + (balanceARS / usdRate)

  // 2. Calcular Ingresos y Gastos del mes actual
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  const currentMonthTxs = transactions.filter(t => {
    const txDate = new Date(t.transaction_date)
    return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear
  })

  // Excluir reservas del resumen mensual (se muestran por separado)
  const monthlyIncomeARS = currentMonthTxs
    .filter(t => t.type === 'ingreso' && t.category?.type !== 'reserva')
    .reduce((sum, t) => sum + (t.currency === 'USD' ? Number(t.amount) * usdRate : Number(t.amount)), 0)

  const monthlyExpenseARS = currentMonthTxs
    .filter(t => t.type === 'gasto' && t.category?.type !== 'reserva')
    .reduce((sum, t) => sum + (t.currency === 'USD' ? Number(t.amount) * usdRate : Number(t.amount)), 0)

  const savingsARS = monthlyIncomeARS - monthlyExpenseARS

  // 3. Fondos y reservas — agrupar por categoría
  const reserveMap = new Map<string, { name: string; color: string; balance: number }>()
  transactions
    .filter(t => t.category?.type === 'reserva')
    .forEach(t => {
      const id = t.category_id
      const existing = reserveMap.get(id) || { name: t.category?.name || 'Reserva', color: t.category?.color || '#7c3aed', balance: 0 }
      const delta = t.type === 'gasto' ? Number(t.amount) : -Number(t.amount)
      reserveMap.set(id, { ...existing, balance: existing.balance + delta })
    })
  const reserveBuckets = Array.from(reserveMap.values())
  const totalReserves = reserveBuckets.reduce((sum, b) => sum + b.balance, 0)

  // 4. Últimos 3 movimientos (excluyendo reservas)
  const recentTransactions = transactions.filter(t => t.category?.type !== 'reserva').slice(0, 3)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-2 w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
        <p className="text-sm text-muted-foreground">Actualizando saldos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500 w-full">
      <header className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Hola, {userName} 👋</h1>
          <p className="text-muted-foreground text-sm">Este es tu resumen financiero de este mes.</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="p-2 hover:bg-secondary rounded-full active:scale-95 transition-all"
          title="Actualizar datos"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </header>

      {/* Tarjeta de Saldo Principal */}
      <div className="bg-primary text-primary-foreground p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-wider">Saldo Estimado Total</p>
          <h2 className="text-4xl font-bold tracking-tight mt-1">
            ${totalBalanceARS.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className="flex items-center mt-3 space-x-2">
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-bold">
              {totalBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
          </div>
        </div>
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
      </div>

      {/* Grid de Resumen de Cuentas */}
      <div className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground px-1">Saldos por Cuenta</h3>
        <div className="grid grid-cols-2 gap-3">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-card p-3 rounded-2xl border border-border flex flex-col justify-between space-y-1">
              <span className="text-muted-foreground text-[10px] uppercase font-bold truncate">{acc.name}</span>
              <span className="font-bold text-sm">
                ${Number(acc.current_balance).toLocaleString('es-AR')} <span className="text-[10px] text-muted-foreground">{acc.currency}</span>
              </span>
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="col-span-2 text-center text-xs text-muted-foreground p-4 bg-muted/30 rounded-2xl">
              Sin cuentas creadas.
            </div>
          )}
        </div>
      </div>

      {/* Grid de Resumen Mensual (Ingresos vs Gastos) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-border space-y-2">
          <div className="w-9 h-9 rounded-xl bg-brand-green/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-brand-green" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Ingresos de este mes</p>
            <p className="font-bold text-brand-green">+${monthlyIncomeARS.toLocaleString('es-AR')}</p>
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-2xl border border-border space-y-2">
          <div className="w-9 h-9 rounded-xl bg-brand-coral/10 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-brand-coral" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Gastos de este mes</p>
            <p className="font-bold text-brand-coral">-${monthlyExpenseARS.toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      {/* Balance neto del mes */}
      <div className="bg-brand-green/10 border border-brand-green/20 p-4 rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-brand-green flex items-center justify-center shadow-lg shadow-brand-green/20">
            <PiggyBank className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-brand-green/80 font-medium">Balance Neto del Mes</p>
            <p className={`font-bold ${savingsARS >= 0 ? 'text-brand-green' : 'text-brand-coral'}`}>
              {savingsARS >= 0 ? '+' : ''}${savingsARS.toLocaleString('es-AR')}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ahorro Estimado</p>
          <p className="text-xs font-semibold text-muted-foreground">Excedente</p>
        </div>
      </div>

      {/* Fondos y Reservas */}
      {reserveBuckets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground px-1">Fondos y Reservas</h3>
            <span className="text-xs font-bold text-primary">
              Total: ${totalReserves.toLocaleString('es-AR')}
            </span>
          </div>
          <div className="space-y-2">
            {reserveBuckets.map((bucket, i) => (
              <div key={i} className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bucket.color }} />
                  <span className="text-sm font-semibold">{bucket.name}</span>
                </div>
                <span className={`font-bold text-sm ${bucket.balance >= 0 ? 'text-primary' : 'text-brand-coral'}`}>
                  ${bucket.balance.toLocaleString('es-AR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección de Últimos Movimientos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">Movimientos Recientes</h3>
          <button
            onClick={() => onNavigateToTab('movimientos')}
            className="text-xs text-primary font-semibold hover:underline active:opacity-70 transition-opacity"
          >
            Ver todos →
          </button>
        </div>
        
        <div className="space-y-2">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs"
                  style={{ backgroundColor: tx.category?.color || '#3498DB' }}
                >
                  {tx.category?.name.charAt(0) || 'T'}
                </div>
                <div>
                  <p className="font-semibold text-xs">{tx.description || tx.category?.name || 'Movimiento'}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {format(new Date(tx.transaction_date), "d 'de' MMMM", { locale: es })}
                  </p>
                </div>
              </div>
              <p className={`font-bold text-xs ${tx.type === 'ingreso' ? 'text-brand-green' : 'text-brand-coral'}`}>
                {tx.type === 'ingreso' ? '+' : '-'}${Number(tx.amount).toLocaleString('es-AR')}
              </p>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground bg-muted/10 rounded-2xl">
              Aún no hay movimientos registrados.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
