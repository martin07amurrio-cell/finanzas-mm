import { useState, useEffect } from 'react'
import { getAccounts, getCategories, createAccount, updateAccount, deleteAccount, createCategory, updateCategory, deleteCategory, getUsdRate, getUsdRateUpdatedAt, getUsdPreviousRate, fetchUsdRate } from '../../services/api'
import type { Account, Category } from '../../types/database'
import { Wallet, Settings, LogOut, Plus, RefreshCw, Pencil, Trash2, Check, X } from 'lucide-react'

interface MasProps {
  onLogout: () => void
}

export function Mas({ onLogout }: MasProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  
  // Nuevo formulario de cuenta
  const [newAccName, setNewAccName] = useState('')
  const [newAccType, setNewAccType] = useState('cash')
  const [newAccCurrency, setNewAccCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [newAccBalance, setNewAccBalance] = useState('')
  const [showAccForm, setShowAccForm] = useState(false)

  // Nuevo formulario de categoría
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState<'gasto' | 'ingreso'>('gasto')
  const [newCatColor, setNewCatColor] = useState('#3498DB')
  const [newCatIcon, setNewCatIcon] = useState('Tag')
  const [showCatForm, setShowCatForm] = useState(false)

  const [accError, setAccError] = useState<string | null>(null)
  const [catError, setCatError] = useState<string | null>(null)

  // Edición y eliminación de cuentas
  const [editingAccId, setEditingAccId] = useState<string | null>(null)
  const [deletingAccId, setDeletingAccId] = useState<string | null>(null)
  const [editAccName, setEditAccName] = useState('')
  const [editAccType, setEditAccType] = useState('')

  // Edición y eliminación de categorías
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatType, setEditCatType] = useState<'gasto' | 'ingreso' | 'reserva'>('gasto')
  const [editCatColor, setEditCatColor] = useState('#3498DB')
  const [editCatIcon, setEditCatIcon] = useState('Tag')
  const [usdRate, setUsdRateState] = useState<number>(getUsdRate())
  const [usdUpdatedAt, setUsdUpdatedAt] = useState<Date | null>(getUsdRateUpdatedAt())
  const [usdPrev, setUsdPrev] = useState(getUsdPreviousRate())
  const [usdRefreshing, setUsdRefreshing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [accs, cats] = await Promise.all([getAccounts(), getCategories()])
      setAccounts(accs)
      setCategories(cats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccError(null)
    if (!newAccName.trim()) return

    const savedUser = localStorage.getItem('auth_user')
    if (!savedUser) return
    const user = JSON.parse(savedUser)

    try {
      const newAcc = await createAccount({
        name: newAccName.trim(),
        type: newAccType,
        currency: newAccCurrency,
        owner_user_id: user.id,
        current_balance: parseFloat(newAccBalance) || 0
      })
      setAccounts(prev => [...prev, newAcc])
      setNewAccName('')
      setNewAccBalance('')
      setShowAccForm(false)
      setAccError(null)
    } catch (err) {
      setAccError('Error al crear la cuenta. Intenta de nuevo.')
    }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setCatError(null)
    if (!newCatName.trim()) return

    try {
      const newCat = await createCategory({
        name: newCatName.trim(),
        type: newCatType,
        color: newCatColor,
        icon: newCatIcon
      })
      setCategories(prev => [...prev, newCat])
      setNewCatName('')
      setShowCatForm(false)
      setCatError(null)
    } catch (err) {
      setCatError('Error al crear la categoría. Intenta de nuevo.')
    }
  }

  const startEditAcc = (acc: Account) => {
    setEditingAccId(acc.id)
    setEditAccName(acc.name)
    setEditAccType(acc.type)
    setDeletingAccId(null)
  }

  const handleUpdateAcc = async (id: string) => {
    if (!editAccName.trim()) return
    try {
      await updateAccount(id, { name: editAccName.trim(), type: editAccType })
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, name: editAccName.trim(), type: editAccType } : a))
      setEditingAccId(null)
    } catch {
      setAccError('Error al guardar los cambios.')
    }
  }

  const handleDeleteAcc = async (id: string) => {
    try {
      await deleteAccount(id)
      setAccounts(prev => prev.filter(a => a.id !== id))
      setDeletingAccId(null)
    } catch {
      setAccError('Error al eliminar la cuenta.')
    }
  }

  const startEditCat = (cat: Category) => {
    setEditingCatId(cat.id)
    setEditCatName(cat.name)
    setEditCatType(cat.type)
    setEditCatColor(cat.color || '#3498DB')
    setEditCatIcon(cat.icon || 'Tag')
    setDeletingCatId(null)
  }

  const handleUpdateCat = async (id: string) => {
    if (!editCatName.trim()) return
    try {
      await updateCategory(id, { name: editCatName.trim(), type: editCatType, color: editCatColor, icon: editCatIcon })
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editCatName.trim(), type: editCatType, color: editCatColor, icon: editCatIcon } : c))
      setEditingCatId(null)
    } catch {
      setCatError('Error al guardar los cambios.')
    }
  }

  const handleDeleteCat = async (id: string) => {
    try {
      await deleteCategory(id)
      setCategories(prev => prev.filter(c => c.id !== id))
      setDeletingCatId(null)
    } catch {
      setCatError('Error al eliminar la categoría.')
    }
  }

  const handleRefreshUsdRate = async () => {
    setUsdRefreshing(true)
    try {
      const rate = await fetchUsdRate(true)
      setUsdRateState(rate)
      setUsdUpdatedAt(getUsdRateUpdatedAt())
      setUsdPrev(getUsdPreviousRate())
    } finally {
      setUsdRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-2">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
        <p className="text-sm text-muted-foreground">Cargando configuraciones...</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-24 animate-in fade-in duration-300">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Ajustes y Gestión</h1>
          <p className="text-muted-foreground text-sm">Cuentas, categorías e importaciones</p>
        </div>
        <button
          onClick={onLogout}
          className="p-3 bg-destructive/10 text-destructive rounded-full hover:bg-destructive/20 active:scale-95 transition-all"
          title="Cerrar Sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Gestión de Cuentas */}
      <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-primary" />
            <span>Mis Cuentas</span>
          </h3>
          <button
            onClick={() => setShowAccForm(!showAccForm)}
            className="p-1.5 bg-primary/10 text-primary rounded-lg active:scale-90 transition-transform"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {showAccForm && (
          <form onSubmit={handleCreateAccount} className="bg-secondary p-4 rounded-2xl border border-border space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Nombre de Cuenta</label>
              <input
                type="text"
                placeholder="Ej. Galicia Sueldo, Mercado Pago"
                value={newAccName}
                onChange={e => setNewAccName(e.target.value)}
                required
                className="w-full p-2.5 bg-card text-xs rounded-xl border border-border focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Tipo</label>
                <select
                  value={newAccType}
                  onChange={e => setNewAccType(e.target.value)}
                  className="p-2 bg-card text-xs rounded-xl border border-border"
                >
                  <option value="cash">Efectivo</option>
                  <option value="bank">Banco</option>
                  <option value="fintech">Fintech</option>
                  <option value="savings">Ahorro</option>
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Moneda</label>
                <select
                  value={newAccCurrency}
                  onChange={e => setNewAccCurrency(e.target.value as any)}
                  className="p-2 bg-card text-xs rounded-xl border border-border"
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Saldo Inicial</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newAccBalance}
                  onChange={e => setNewAccBalance(e.target.value)}
                  className="p-2 bg-card text-xs rounded-xl border border-border focus:outline-none"
                />
              </div>
            </div>
            {accError && (
              <p className="text-destructive text-xs font-semibold">{accError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
            >
              Guardar Cuenta
            </button>
          </form>
        )}

        <div className="space-y-2">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-secondary rounded-2xl border border-border/50 overflow-hidden">
              {editingAccId === acc.id ? (
                <div className="p-3 space-y-2">
                  <input
                    type="text"
                    value={editAccName}
                    onChange={e => setEditAccName(e.target.value)}
                    className="w-full p-2 bg-card text-xs rounded-xl border border-border focus:outline-none"
                  />
                  <select
                    value={editAccType}
                    onChange={e => setEditAccType(e.target.value)}
                    className="w-full p-2 bg-card text-xs rounded-xl border border-border"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="bank">Banco</option>
                    <option value="fintech">Fintech</option>
                    <option value="savings">Ahorro</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateAcc(acc.id)} className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                      <Check className="w-3 h-3" /> Guardar
                    </button>
                    <button onClick={() => setEditingAccId(null)} className="flex-1 flex items-center justify-center gap-1 bg-card text-muted-foreground py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform border border-border">
                      <X className="w-3 h-3" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : deletingAccId === acc.id ? (
                <div className="p-3 space-y-2">
                  <p className="text-xs text-destructive font-semibold">¿Eliminar "{acc.name}"?</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDeleteAcc(acc.id)} className="flex-1 bg-destructive text-white py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                      Eliminar
                    </button>
                    <button onClick={() => setDeletingAccId(null)} className="flex-1 bg-card text-muted-foreground py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform border border-border">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-semibold">{acc.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{acc.type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">
                      ${Number(acc.current_balance).toLocaleString('es-AR')} {acc.currency}
                    </span>
                    <button onClick={() => startEditAcc(acc)} className="p-1.5 text-muted-foreground hover:text-primary active:scale-90 transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setDeletingAccId(acc.id); setEditingAccId(null) }} className="p-1.5 text-muted-foreground hover:text-destructive active:scale-90 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gestión de Categorías */}
      <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold flex items-center space-x-2">
            <Settings className="w-5 h-5 text-primary" />
            <span>Categorías</span>
          </h3>
          <button
            onClick={() => setShowCatForm(!showCatForm)}
            className="p-1.5 bg-primary/10 text-primary rounded-lg active:scale-90 transition-transform"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {showCatForm && (
          <form onSubmit={handleCreateCategory} className="bg-secondary p-4 rounded-2xl border border-border space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej. Regalos, Salud"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  required
                  className="w-full p-2.5 bg-card text-xs rounded-xl border border-border focus:outline-none"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Tipo</label>
                <select
                  value={newCatType}
                  onChange={e => setNewCatType(e.target.value as any)}
                  className="p-2.5 bg-card text-xs rounded-xl border border-border"
                >
                  <option value="gasto">Gasto</option>
                  <option value="ingreso">Ingreso</option>
                  <option value="reserva">Reserva</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Color</label>
                <input
                  type="color"
                  value={newCatColor}
                  onChange={e => setNewCatColor(e.target.value)}
                  className="w-full h-8 bg-card rounded-xl border border-border p-1 focus:outline-none cursor-pointer"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Icono</label>
                <select
                  value={newCatIcon}
                  onChange={e => setNewCatIcon(e.target.value)}
                  className="p-2 h-8 bg-card text-xs rounded-xl border border-border"
                >
                  <option value="Tag">Etiqueta</option>
                  <option value="Utensils">Comida</option>
                  <option value="Home">Alquiler</option>
                  <option value="Car">Vehículo</option>
                  <option value="DollarSign">Dinero</option>
                </select>
              </div>
            </div>
            {catError && (
              <p className="text-destructive text-xs font-semibold">{catError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
            >
              Guardar Categoría
            </button>
          </form>
        )}

        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="bg-secondary rounded-2xl border border-border/50 overflow-hidden">
              {editingCatId === cat.id ? (
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editCatName}
                      onChange={e => setEditCatName(e.target.value)}
                      className="p-2 bg-card text-xs rounded-xl border border-border focus:outline-none"
                    />
                    <select
                      value={editCatType}
                      onChange={e => setEditCatType(e.target.value as any)}
                      className="p-2 bg-card text-xs rounded-xl border border-border"
                    >
                      <option value="gasto">Gasto</option>
                      <option value="ingreso">Ingreso</option>
                      <option value="reserva">Reserva</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase">Color</label>
                      <input type="color" value={editCatColor} onChange={e => setEditCatColor(e.target.value)} className="w-full h-8 bg-card rounded-xl border border-border p-1 cursor-pointer" />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase">Icono</label>
                      <select value={editCatIcon} onChange={e => setEditCatIcon(e.target.value)} className="p-2 h-8 bg-card text-xs rounded-xl border border-border">
                        <option value="Tag">Etiqueta</option>
                        <option value="Utensils">Comida</option>
                        <option value="Home">Alquiler</option>
                        <option value="Car">Vehículo</option>
                        <option value="DollarSign">Dinero</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateCat(cat.id)} className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                      <Check className="w-3 h-3" /> Guardar
                    </button>
                    <button onClick={() => setEditingCatId(null)} className="flex-1 flex items-center justify-center gap-1 bg-card text-muted-foreground py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform border border-border">
                      <X className="w-3 h-3" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : deletingCatId === cat.id ? (
                <div className="p-3 space-y-2">
                  <p className="text-xs text-destructive font-semibold">¿Eliminar "{cat.name}"?</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDeleteCat(cat.id)} className="flex-1 bg-destructive text-white py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                      Eliminar
                    </button>
                    <button onClick={() => setDeletingCatId(null)} className="flex-1 bg-card text-muted-foreground py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform border border-border">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#95A5A6' }} />
                    <span className="text-sm font-semibold">{cat.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{cat.type === 'gasto' ? 'Gasto' : 'Ingreso'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEditCat(cat)} className="p-1.5 text-muted-foreground hover:text-primary active:scale-90 transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setDeletingCatId(cat.id); setEditingCatId(null) }} className="p-1.5 text-muted-foreground hover:text-destructive active:scale-90 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Configuración — Tasa de Cambio USD */}
      <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-4">
        <h3 className="font-bold flex items-center space-x-2">
          <Settings className="w-5 h-5 text-primary" />
          <span>Configuración</span>
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">
              Dólar Oficial (Banco Nación)
            </label>
            <button
              onClick={handleRefreshUsdRate}
              disabled={usdRefreshing}
              className="p-2 bg-primary/10 text-primary rounded-full active:scale-90 transition-transform disabled:opacity-50"
              title="Actualizar cotización"
            >
              <RefreshCw className={`w-4 h-4 ${usdRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Hoy */}
          <div className="bg-secondary rounded-2xl border border-border p-4">
            <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Hoy</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold">
                ${usdRate.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-sm font-normal text-muted-foreground ml-1">ARS</span>
              </p>
              {usdPrev.rate && (
                <p className={`text-sm font-bold ${usdRate > usdPrev.rate ? 'text-destructive' : 'text-green-500'}`}>
                  {usdRate > usdPrev.rate ? '▲' : '▼'} {Math.abs(((usdRate - usdPrev.rate) / usdPrev.rate) * 100).toFixed(2)}%
                </p>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {usdUpdatedAt
                ? `Actualizado: ${usdUpdatedAt.toLocaleDateString('es-AR')} ${usdUpdatedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Sin datos aún'}
            </p>
          </div>

          {/* Día hábil anterior */}
          {usdPrev.rate && (
            <div className="bg-secondary rounded-2xl border border-border p-4">
              <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Día hábil anterior</p>
              <p className="text-xl font-bold">
                ${usdPrev.rate.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-sm font-normal text-muted-foreground ml-1">ARS</span>
              </p>
              {usdPrev.date && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(usdPrev.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Se actualiza automáticamente cada 6 horas. Fuente: Banco Nación Argentina.
          </p>
        </div>
      </div>
    </div>
  )
}
