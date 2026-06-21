import { useState, useEffect } from 'react'
import { getTransactions, deleteTransaction } from '../../services/api'
import type { Transaction } from '../../types/database'
import { Trash2, ListFilter, Calendar, User } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'

export function Movimientos() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTxs, setFilteredTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filtros
  const [filterUser, setFilterUser] = useState<'todos' | 'Martín' | 'Micaela'>('todos')
  const [filterType, setFilterType] = useState<'todos' | 'ingreso' | 'gasto'>('todos')

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    let result = [...transactions]

    if (filterUser !== 'todos') {
      result = result.filter(t => t.user?.name === filterUser)
    }

    if (filterType !== 'todos') {
      result = result.filter(t => t.type === filterType)
    }

    setFilteredTxs(result)
  }, [transactions, filterUser, filterType])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const data = await getTransactions()
      setTransactions(data)
    } catch (err: any) {
      console.error(err)
      setError('Error al cargar movimientos.')
    } finally {
      setLoading(false)
    }
  }

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

  // Agrupar transacciones por fecha
  const groupTransactionsByDate = (txs: Transaction[]) => {
    const groups: { [key: string]: Transaction[] } = {}
    txs.forEach(tx => {
      const date = new Date(tx.transaction_date)
      let dateString = ''
      if (isToday(date)) {
        dateString = 'Hoy'
      } else if (isYesterday(date)) {
        dateString = 'Ayer'
      } else {
        dateString = format(date, "EEEE d 'de' MMMM", { locale: es })
        // Capitalize first letter
        dateString = dateString.charAt(0).toUpperCase() + dateString.slice(1)
      }

      if (!groups[dateString]) {
        groups[dateString] = []
      }
      groups[dateString].push(tx)
    })
    return groups
  }

  const groupedTransactions = groupTransactionsByDate(filteredTxs)

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Movimientos</h1>
          <p className="text-muted-foreground text-sm">Historial de gastos e ingresos</p>
        </div>
      </header>

      {/* Controles de Filtros */}
      <div className="bg-card p-4 rounded-2xl border border-border space-y-3 shadow-sm">
        <div className="flex items-center space-x-2 text-muted-foreground text-sm font-semibold">
          <ListFilter className="w-4 h-4 text-primary" />
          <span>Filtrar por:</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Filtro Usuario */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Usuario</label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value as any)}
              className="bg-secondary text-sm p-2 rounded-xl border border-border focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="todos">Todos</option>
              <option value="Martín">Martín</option>
              <option value="Micaela">Micaela</option>
            </select>
          </div>

          {/* Filtro Tipo */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-secondary text-sm p-2 rounded-xl border border-border focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="todos">Todos</option>
              <option value="gasto">Gastos</option>
              <option value="ingreso">Ingresos</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Cargando transacciones...</p>
        </div>
      ) : error ? (
        <div className="text-center p-6 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive">
          {error}
        </div>
      ) : Object.keys(groupedTransactions).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-2 bg-card rounded-3xl border border-border border-dashed p-6">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="font-semibold text-sm">No se encontraron movimientos</p>
          <p className="text-xs">¡Usa el botón de Cargar para agregar uno nuevo!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTransactions).map(([date, txs]) => (
            <div key={date} className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground px-1">{date}</h3>
              
              <div className="space-y-2">
                {txs.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
                  >
                    {/* Fila principal */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
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
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
