import { useState, useEffect } from 'react'
import { getAccounts, getCategories, createTransaction } from '../../services/api'
import type { Account, Category } from '../../types/database'
import { CheckCircle2, AlertCircle, PlusCircle } from 'lucide-react'

interface CargarProps {
  onNavigateToTab: (tab: string) => void
}

export function Cargar({ onNavigateToTab }: CargarProps) {
  const [type, setType] = useState<'gasto' | 'ingreso' | 'reserva'>('gasto')
  const [reservaAction, setReservaAction] = useState<'depositar' | 'retirar'>('depositar')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchFormData()
  }, [])

  const fetchFormData = async () => {
    try {
      setLoading(true)
      const [accs, cats] = await Promise.all([getAccounts(), getCategories()])
      
      setAccounts(accs)
      // Filtrar categorías según el tipo seleccionado
      setCategories(cats)

      if (accs.length > 0) setAccountId(accs[0].id)
    } catch (err) {
      console.error(err)
      setError('Error al obtener las cuentas o categorías. Verifica la base de datos.')
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = categories.filter(cat => cat.type === type)

  // Seleccionar la primera categoría del tipo filtrado si la actual no corresponde
  useEffect(() => {
    if (filteredCategories.length > 0) {
      const exists = filteredCategories.some(c => c.id === categoryId)
      if (!exists) {
        setCategoryId(filteredCategories[0].id)
      }
    } else {
      setCategoryId('')
    }
  }, [type, categories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Por favor, ingresa un monto válido mayor a 0.')
      return
    }
    if (!accountId) { setError('Por favor, selecciona una cuenta.'); return }
    if (!categoryId) { setError('Por favor, selecciona una categoría.'); return }
    if (type === 'reserva' && reservaAction === 'retirar' && !description.trim()) {
      setError('Indicá el motivo del retiro de la reserva.')
      return
    }

    const savedUser = localStorage.getItem('auth_user')
    if (!savedUser) { setError('No hay un usuario activo en sesión.'); return }
    const user = JSON.parse(savedUser)

    const txType: 'gasto' | 'ingreso' =
      type === 'reserva' ? (reservaAction === 'retirar' ? 'ingreso' : 'gasto') : type

    try {
      setSubmitting(true)
      await createTransaction({
        type: txType,
        amount: parsedAmount,
        currency,
        description: description.trim() || null,
        category_id: categoryId,
        account_id: accountId,
        user_id: user.id,
        transaction_date: new Date(date + 'T12:00:00').toISOString()
      })

      setSuccess(true)
      setAmount('')
      setDescription('')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Error al guardar la transacción.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-2">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
        <p className="text-sm text-muted-foreground">Cargando cuentas y categorías...</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="w-full max-w-sm mx-auto text-center space-y-6 py-12 animate-in zoom-in duration-300">
        <div className="w-20 h-20 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto text-brand-green">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">¡Movimiento Registrado!</h2>
          <p className="text-muted-foreground text-sm">
            Se ha guardado correctamente y se actualizó el saldo de la cuenta.
          </p>
        </div>
        <div className="flex flex-col space-y-3 pt-4">
          <button
            onClick={() => {
              setSuccess(false)
              setDate(new Date().toISOString().split('T')[0])
            }}
            className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-semibold shadow-md active:scale-95 transition-all"
          >
            Cargar otro movimiento
          </button>
          <button
            onClick={() => onNavigateToTab('movimientos')}
            className="w-full bg-secondary text-secondary-foreground py-3 rounded-2xl font-semibold hover:bg-secondary/80 active:scale-95 transition-all"
          >
            Ver historial
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-in slide-in-from-bottom duration-300">
      <div>
        <h1 className="text-2xl font-bold">Nuevo Movimiento</h1>
        <p className="text-muted-foreground text-sm">Registra un gasto o ingreso manual</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-2xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="text-center p-6 bg-card border border-border rounded-3xl space-y-3">
          <p className="text-sm text-muted-foreground">No tienes ninguna cuenta creada para cargar gastos.</p>
          <button
            onClick={() => onNavigateToTab('mas')}
            className="bg-primary text-white text-xs px-4 py-2 rounded-xl font-bold"
          >
            Crear cuenta ahora
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-3xl border border-border shadow-sm">
          {/* Tipo de Transacción Toggle */}
          <div className="grid grid-cols-3 p-1 bg-secondary rounded-2xl">
            <button type="button" onClick={() => setType('gasto')}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all ${type === 'gasto' ? 'bg-brand-coral text-white shadow-md' : 'text-muted-foreground'}`}>
              Gasto
            </button>
            <button type="button" onClick={() => setType('ingreso')}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all ${type === 'ingreso' ? 'bg-brand-green text-white shadow-md' : 'text-muted-foreground'}`}>
              Ingreso
            </button>
            <button type="button" onClick={() => setType('reserva')}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all ${type === 'reserva' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground'}`}>
              Reserva
            </button>
          </div>

          {/* Sub-toggle Depositar / Retirar (solo para reserva) */}
          {type === 'reserva' && (
            <div className="grid grid-cols-2 p-1 bg-secondary rounded-2xl">
              <button type="button" onClick={() => setReservaAction('depositar')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${reservaAction === 'depositar' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground'}`}>
                Depositar
              </button>
              <button type="button" onClick={() => setReservaAction('retirar')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${reservaAction === 'retirar' ? 'bg-brand-coral text-white shadow-md' : 'text-muted-foreground'}`}>
                Retirar
              </button>
            </div>
          )}

          {/* Importe y Moneda */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Monto</label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-xl font-semibold text-muted-foreground">$</span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full pl-8 pr-20 py-3 text-lg font-bold bg-secondary rounded-2xl border border-border focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <div className="absolute right-2 flex space-x-1 bg-card rounded-xl border border-border p-1">
                {(['ARS', 'USD'] as const).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrency(curr)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      currency === curr
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cuenta */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Cuenta origen/destino</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="bg-secondary p-3 rounded-2xl border border-border text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} (${Number(acc.current_balance).toLocaleString('es-AR')} {acc.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Categoría */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Categoría</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="bg-secondary p-3 rounded-2xl border border-border text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            >
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
              {filteredCategories.length === 0 && (
                <option value="">Sin categorías disponibles</option>
              )}
            </select>
          </div>

          {/* Descripción */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">
              {type === 'reserva' && reservaAction === 'retirar' ? 'Motivo del retiro *' : 'Descripción (opcional)'}
            </label>
            <input
              type="text"
              placeholder={type === 'reserva' && reservaAction === 'retirar' ? 'Ej. Pago de expensas, Emergencia...' : 'Ej. Supermercado, Almuerzo, Sueldo...'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required={type === 'reserva' && reservaAction === 'retirar'}
              className="bg-secondary p-3 rounded-2xl border border-border text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Fecha */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="bg-secondary p-3 rounded-2xl border border-border text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Botón Guardar */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-55"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-5 h-5" />
                <span>Registrar Movimiento</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
