import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays, CheckSquare2, ShoppingCart, Refrigerator, BookOpen, CookingPot,
  Sparkles, Target, Plus, Trash2, Check, RefreshCw, Pencil, X
} from 'lucide-react'
import {
  createHousehold, deleteHousehold, completeHousehold, listHousehold,
  purchaseHousehold, updateHousehold,
} from '../../services/hogar'
import type { EntryInput, HouseholdEntry, Section } from '../../services/hogar'

const MODULES = [
  { id: 'agenda', label: 'Agenda', icon: CalendarDays, hint: 'Turnos y compromisos' },
  { id: 'tareas', label: 'Tareas', icon: CheckSquare2, hint: 'Pendientes compartidos' },
  { id: 'compras', label: 'Compras', icon: ShoppingCart, hint: 'Lista del supermercado' },
  { id: 'despensa', label: 'Despensa', icon: Refrigerator, hint: 'Alimentos disponibles' },
  { id: 'recetas', label: 'Recetas', icon: BookOpen, hint: 'Ingredientes y preparación' },
  { id: 'menu', label: 'Menú', icon: CookingPot, hint: 'Comidas planificadas' },
  { id: 'limpieza', label: 'Limpieza', icon: Sparkles, hint: 'Rutinas de la casa' },
  { id: 'objetivos', label: 'Objetivos', icon: Target, hint: 'Metas y avances' },
] as const

const EMPTY = (section: Section): EntryInput => ({
  section, title: '', notes: null, details: null, due_on: null, assignee: 'Ambos',
  quantity: null, unit: null, status: 'pendiente', repeat_days: null, progress: null, target: null,
})

const dateLabel = (value: string | null) => value
  ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  : ''

export function Hogar({ initialSection = 'agenda', onNavigate }: {
  initialSection?: Section
  onNavigate?: (tab: string) => void
}) {
  const [section, setSection] = useState<Section>(initialSection)
  const [items, setItems] = useState<HouseholdEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EntryInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setItems(await listHousehold(section)) }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar el módulo') }
    finally { setLoading(false) }
  }, [section])

  useEffect(() => { void load() }, [load])

  const startEdit = (entry?: HouseholdEntry) => {
    setEditingId(entry?.id || null)
    setForm(entry ? {
      section: entry.section, title: entry.title, notes: entry.notes, details: entry.details,
      due_on: entry.due_on, assignee: entry.assignee, quantity: entry.quantity, unit: entry.unit,
      status: entry.status, repeat_days: entry.repeat_days, progress: entry.progress, target: entry.target,
    } : EMPTY(section))
  }
  const change = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) =>
    setForm(prev => prev ? { ...prev, [key]: value } : prev)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form?.title.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      if (editingId) await updateHousehold(editingId, form)
      else await createHousehold(form)
      setForm(null)
      setEditingId(null)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al guardar') }
    finally { setSaving(false) }
  }

  const action = async (run: () => Promise<unknown>) => {
    setSaving(true)
    setError('')
    try { await run(); await load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Error al actualizar') }
    finally { setSaving(false) }
  }

  const label = MODULES.find(m => m.id === section)?.label || 'Hogar'
  const withQuantity = section === 'compras' || section === 'despensa'
  const withDate = section === 'agenda' || section === 'tareas' || section === 'menu' || section === 'limpieza'
  const withOwner = section === 'agenda' || section === 'tareas' || section === 'limpieza' || section === 'objetivos'

  return <div className="w-full space-y-5 pb-24">
    <header className="space-y-1">
      <p className="text-xs font-bold tracking-widest uppercase text-primary">Hogar M&M</p>
      <h1 className="text-2xl font-bold">Organización familiar</h1>
      <p className="text-sm text-muted-foreground">Agenda, compras, comidas, limpieza y metas en un mismo lugar.</p>
    </header>
    <div className="grid grid-cols-2 gap-2">
      {MODULES.map(m => <button key={m.id} type="button"
        onClick={() => { setSection(m.id); setForm(null) }}
        className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${section === m.id ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
        <m.icon size={18} className={section === m.id ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
        <span className="min-w-0"><span className="block text-sm font-semibold">{m.label}</span><span className="text-[10px] text-muted-foreground">{m.hint}</span></span>
      </button>)}
    </div>
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{label}</h2>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Actualizar" title="Actualizar" onClick={() => void load()} className="rounded-xl border border-border p-2"><RefreshCw size={17}/></button>
        <button type="button" onClick={() => startEdit()} className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus size={16}/> Agregar</button>
      </div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    {form && <form onSubmit={event => void submit(event)} className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between"><h3 className="font-semibold">{editingId ? 'Editar elemento' : 'Nuevo elemento'}</h3><button type="button" onClick={() => setForm(null)} aria-label="Cerrar"><X size={18}/></button></div>
      <label className="block text-xs font-semibold">Nombre o título
        <input required maxLength={120} value={form.title} onChange={e => change('title', e.target.value)} placeholder={section === 'compras' ? 'Ej.: Arroz' : '¿Qué querés organizar?'} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"/>
      </label>
      {withDate && <label className="block text-xs font-semibold">Fecha
        <input type="date" value={form.due_on || ''} onChange={e => change('due_on', e.target.value || null)} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"/>
      </label>}
      {withOwner && <label className="block text-xs font-semibold">Responsable
        <select value={form.assignee || 'Ambos'} onChange={e => change('assignee', e.target.value as EntryInput['assignee'])} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm">
          <option>Ambos</option><option>Martín</option><option>Micaela</option>
        </select>
      </label>}
      {withQuantity && <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold">Cantidad<input type="number" min="0" step="0.01" value={form.quantity ?? ''} onChange={e => change('quantity', e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"/></label>
        <label className="text-xs font-semibold">Unidad<input value={form.unit || ''} maxLength={30} onChange={e => change('unit', e.target.value || null)} placeholder="unid., kg, litros" className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"/></label>
      </div>}
      {section === 'limpieza' && <label className="block text-xs font-semibold">Repetir cada (días)
        <input type="number" min="1" max="365" value={form.repeat_days ?? ''} onChange={e => change('repeat_days', e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"/>
      </label>}
      {section === 'objetivos' && <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold">Avance<input type="number" min="0" step="0.01" value={form.progress ?? ''} onChange={e => change('progress', e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"/></label>
        <label className="text-xs font-semibold">Meta<input type="number" min="0.01" step="0.01" value={form.target ?? ''} onChange={e => change('target', e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"/></label>
      </div>}
      {(section === 'recetas' || section === 'menu') && <label className="block text-xs font-semibold">Ingredientes o detalles
        <textarea value={form.details || ''} onChange={e => change('details', e.target.value || null)} rows={3} placeholder="Ingredientes, pasos, porciones..." className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"/>
      </label>}
      <label className="block text-xs font-semibold">Notas
        <textarea value={form.notes || ''} onChange={e => change('notes', e.target.value || null)} rows={2} placeholder="Información adicional" className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"/>
      </label>
      <button type="submit" disabled={saving || !form.title.trim()} className="w-full rounded-xl bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
    </form>}
    {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando información…</p> : items.length === 0
      ? <div className="rounded-2xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">Todavía no hay registros en {label.toLowerCase()}. Tocá Agregar para empezar.</div>
      : <div className="space-y-2">{items.map(entry => <article key={entry.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold break-words ${entry.status === 'hecho' ? 'line-through text-muted-foreground' : ''}`}>{entry.title}</h3>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {entry.due_on && <span>{dateLabel(entry.due_on)}</span>}
              {entry.assignee && <span>{entry.assignee}</span>}
              {entry.quantity !== null && <span>{entry.quantity} {entry.unit || 'unid.'}</span>}
              {entry.repeat_days && <span>Cada {entry.repeat_days} días</span>}
            </div>
          </div>
          <button type="button" aria-label={`Editar ${entry.title}`} onClick={() => startEdit(entry)} className="self-start rounded-lg p-1.5 text-muted-foreground"><Pencil size={16}/></button>
          <button type="button" aria-label={`Eliminar ${entry.title}`} disabled={saving} onClick={() => { setConfirmDelete(entry.id) }} className="self-start rounded-lg p-1.5 text-destructive"><Trash2 size={16}/></button>
        </div>
        {entry.details && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{entry.details}</p>}
        {entry.notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{entry.notes}</p>}
        {entry.target && <div className="space-y-1"><div className="flex justify-between text-xs text-muted-foreground"><span>Progreso</span><span>{entry.progress || 0} / {entry.target}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (entry.progress || 0) / entry.target * 100)}%` }}/></div></div>}
        {confirmDelete === entry.id && <div className="flex items-center justify-between gap-2 rounded-xl bg-destructive/10 p-3 text-xs"><span>¿Eliminar este elemento?</span><button type="button" disabled={saving} onClick={() => { setConfirmDelete(null); void action(() => deleteHousehold(entry.id)) }} className="font-semibold text-destructive">Eliminar</button><button type="button" onClick={() => setConfirmDelete(null)} className="font-semibold">Cancelar</button></div>}
        <div className="flex flex-wrap items-center gap-2">
          {section === 'compras' && entry.status !== 'hecho'
            ? <button type="button" disabled={saving} onClick={() => void action(() => purchaseHousehold(entry.id))} className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"><Check size={15}/> Comprado → Despensa</button>
            : <button type="button" disabled={saving || section === 'compras'} onClick={() => void action(() => completeHousehold(entry.id, entry.status !== 'hecho'))} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold">
              <Check size={15}/>{entry.status === 'hecho' ? 'Reabrir' : section === 'limpieza' && entry.repeat_days ? 'Realizada / Próxima fecha' : 'Completar'}
            </button>}
          {section === 'compras' && entry.status === 'hecho' && <span className="text-xs text-muted-foreground">Agregado a la despensa</span>}
        </div>
      </article>)}</div>}
    {onNavigate && <button type="button" onClick={() => onNavigate('finanzas')} className="w-full rounded-xl border border-border p-3 text-sm font-semibold">Ver finanzas</button>}
  </div>
}
