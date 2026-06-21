import { useState, useEffect } from 'react'
import { getTransactions } from '../../services/api'
import type { Transaction } from '../../types/database'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { Calendar, BarChart3 } from 'lucide-react'
import { parseISO } from 'date-fns'

export function Reportes() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Rango de fechas: Mes actual
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const data = await getTransactions()
      setTransactions(data)
    } catch (err) {
      console.error(err)
      setError('Error al obtener movimientos para reportes.')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar transacciones del mes y año seleccionado
  const filteredTxs = transactions.filter(tx => {
    const txDate = parseISO(tx.transaction_date)
    return txDate.getMonth() === selectedMonth && txDate.getFullYear() === selectedYear
  })

  // 1. Cálculos de Ingresos y Gastos totales
  const totalIncome = filteredTxs
    .filter(t => t.type === 'ingreso')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalExpense = filteredTxs
    .filter(t => t.type === 'gasto')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const balance = totalIncome - totalExpense

  // 2. Datos para gráfico de barras Comparativa (Ingresos vs Gastos)
  const comparisonData = [
    { name: 'Ingresos', Monto: totalIncome, fill: '#2ECC71' },
    { name: 'Gastos', Monto: totalExpense, fill: '#FF4757' }
  ]

  // 3. Datos para el gráfico de torta de Gastos por Categoría
  const expenseByCategory: { [key: string]: { name: string; value: number; color: string } } = {}
  
  filteredTxs
    .filter(t => t.type === 'gasto')
    .forEach(tx => {
      const catName = tx.category?.name || 'Otros'
      const catColor = tx.category?.color || '#95A5A6'
      if (!expenseByCategory[catName]) {
        expenseByCategory[catName] = { name: catName, value: 0, color: catColor }
      }
      expenseByCategory[catName].value += Number(tx.amount)
    })

  const pieData = Object.values(expenseByCategory).sort((a, b) => b.value - a.value)

  // Lista de años disponibles para filtrar
  const years = Array.from(
    new Set([new Date().getFullYear(), ...transactions.map(t => parseISO(t.transaction_date).getFullYear())])
  ).sort((a, b) => b - a)

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-2">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
        <p className="text-sm text-muted-foreground">Procesando reportes financieros...</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <header>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-muted-foreground text-sm">Distribución y estadísticas de tu dinero</p>
      </header>

      {/* Selectores de Período */}
      <div className="bg-card p-4 rounded-3xl border border-border flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2 text-muted-foreground text-xs font-bold uppercase">
          <Calendar className="w-4 h-4 text-primary" />
          <span>Período:</span>
        </div>
        <div className="flex space-x-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-secondary text-xs p-2 rounded-xl border border-border font-semibold focus:outline-none"
          >
            {months.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-secondary text-xs p-2 rounded-xl border border-border font-semibold focus:outline-none"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="text-center p-6 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive">
          {error}
        </div>
      ) : filteredTxs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-2 bg-card rounded-3xl border border-border border-dashed p-6">
          <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="font-semibold text-sm">Sin datos para este mes</p>
          <p className="text-xs">No hay movimientos registrados en el período seleccionado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tarjetas de Resumen Rápido */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card p-3 rounded-2xl border border-border text-center space-y-1">
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Ingresos</p>
              <p className="text-brand-green font-bold text-sm">+${totalIncome.toLocaleString('es-AR')}</p>
            </div>
            <div className="bg-card p-3 rounded-2xl border border-border text-center space-y-1">
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Gastos</p>
              <p className="text-brand-coral font-bold text-sm">-${totalExpense.toLocaleString('es-AR')}</p>
            </div>
            <div className="bg-card p-3 rounded-2xl border border-border text-center space-y-1">
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Balance</p>
              <p className={`font-bold text-sm ${balance >= 0 ? 'text-brand-green' : 'text-brand-coral'}`}>
                {balance >= 0 ? '+' : ''}${balance.toLocaleString('es-AR')}
              </p>
            </div>
          </div>

          {/* Gráfico Comparativa de Barras */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-4">
            <h3 className="font-bold text-sm">Balance General</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    formatter={(value) => [`$${Number(value).toLocaleString('es-AR')}`, 'Monto']}
                  />
                  <Bar dataKey="Monto" radius={[10, 10, 0, 0]} maxBarSize={60}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico Torta Gastos por Categoría */}
          {pieData.length > 0 && (
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-4">
              <h3 className="font-bold text-sm">Distribución de Gastos</h3>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString('es-AR')}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Leyenda Personalizada */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                {pieData.map((entry) => {
                  const percentage = ((entry.value / totalExpense) * 100).toFixed(1)
                  return (
                    <div key={entry.name} className="flex items-center space-x-2 text-xs">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="truncate font-medium">{entry.name}</span>
                      <span className="text-muted-foreground text-[10px]">({percentage}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top Categorías */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-4">
            <h3 className="font-bold text-sm">Detalle de Consumos</h3>
            <div className="space-y-3">
              {pieData.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{item.name}</span>
                    <span>${item.value.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(item.value / totalExpense) * 100}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
