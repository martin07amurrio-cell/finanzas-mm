import { useEffect, useState } from 'react'
import { CalendarDays, CheckSquare2, ShoppingCart, CookingPot, Sparkles, Target, Wallet, ChevronRight } from 'lucide-react'
import { listHousehold } from '../../services/hogar'
import type { HouseholdEntry } from '../../services/hogar'
type Props = { onNavigate: (tab: string) => void }
export function InicioHogar({ onNavigate }: Props) {
  const [items, setItems] = useState<HouseholdEntry[]>([])
  const [error, setError] = useState('')
  const saved = localStorage.getItem('auth_user')
  let name = 'familia'
  try { name = JSON.parse(saved || '{}').name || 'familia' } catch { /* session will be checked on API access */ }
  useEffect(() => {
    listHousehold().then(setItems).catch(e => setError(e instanceof Error ? e.message : 'Error al cargar'))
  }, [])
  const today = new Date().toISOString().slice(0,10)
  const pending = items.filter(i => i.status === 'pendiente')
  const upcoming = pending.filter(i => ['agenda','tareas','limpieza','menu'].includes(i.section))
    .sort((a,b) => (a.due_on || '9999').localeCompare(b.due_on || '9999')).slice(0,5)
  const tiles = [
    { icon: CalendarDays, label: 'Agenda', subtitle: 'Próximas actividades' },
    { icon: CheckSquare2, label: 'Tareas', subtitle: 'Pendientes del hogar' },
    { icon: ShoppingCart, label: 'Compras', subtitle: `${pending.filter(i => i.section === 'compras').length} por comprar` },
    { icon: CookingPot, label: 'Comidas', subtitle: 'Despensa, recetas y menú' },
    { icon: Sparkles, label: 'Limpieza', subtitle: 'Rutinas compartidas' },
    { icon: Target, label: 'Objetivos', subtitle: 'Metas en progreso' },
  ]
  return <div className="w-full space-y-5 pb-24">
    <header className="space-y-1"><p className="text-xs font-bold uppercase tracking-widest text-primary">Hogar M&M</p><h1 className="text-2xl font-bold">Hola, {name}</h1><p className="text-sm text-muted-foreground">Todo lo importante de la casa, en un lugar.</p></header>
    {error && <div role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
    <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
      <p className="text-xs opacity-80">Resumen familiar</p>
      <h2 className="text-2xl font-bold mt-1">{pending.length} pendientes</h2>
      <p className="text-xs mt-2 opacity-90">{pending.filter(i => i.due_on && i.due_on < today).length} vencidos · {pending.filter(i => i.due_on === today).length} para hoy</p>
    </section>
    <section className="space-y-2"><h2 className="font-bold">Próximas actividades</h2>
      {upcoming.length ? upcoming.map(item => <div key={item.id} className="rounded-xl border border-border bg-card p-3 flex justify-between gap-2"><span className="text-sm font-medium">{item.title}</span><span className="text-xs text-muted-foreground shrink-0">{item.due_on ? new Date(item.due_on + 'T12:00:00').toLocaleDateString('es-AR') : 'Sin fecha'}</span></div>)
        : <p className="rounded-xl bg-card border border-border p-4 text-xs text-muted-foreground">Todavía no hay actividades. Agregalas desde Hogar.</p>}
    </section>
    <section className="grid grid-cols-2 gap-3">{tiles.map(t => <button type="button" key={t.label} onClick={() => onNavigate('hogar')} className="rounded-2xl bg-card border border-border p-4 text-left space-y-2">
      <t.icon size={22} className="text-primary"/><h3 className="text-sm font-semibold">{t.label}</h3><p className="text-xs text-muted-foreground">{t.subtitle}</p>
    </button>)}</section>
    <button type="button" onClick={() => onNavigate('finanzas')} className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4"><span className="flex items-center gap-2 text-sm font-semibold"><Wallet size={19} className="text-primary"/> Finanzas e ingresos/gastos</span><ChevronRight size={17}/></button>
  </div>
}
