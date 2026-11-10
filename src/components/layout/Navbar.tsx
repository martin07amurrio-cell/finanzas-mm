import { Home, List, PlusCircle, BarChart2, MoreHorizontal, House, Wallet } from 'lucide-react'

interface NavbarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Navbar({ activeTab, onTabChange }: NavbarProps) {
  const tabs = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'hogar', label: 'Hogar', icon: House },
    { id: 'finanzas', label: 'Finanzas', icon: Wallet },
    { id: 'movimientos', label: 'Movs', icon: List },
    { id: 'cargar', label: 'Cargar', icon: PlusCircle, primary: true },
    { id: 'reportes', label: 'Reportes', icon: BarChart2 },
    { id: 'mas', label: 'Más', icon: MoreHorizontal },
  ]

  return (
    <nav aria-label="Navegación principal" className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-1 border-t border-white/10 bg-brand-ink px-3 pb-7 pt-3 shadow-[0_-8px_35px_-18px_rgba(23,18,28,0.65)]">
      {tabs.map((tab) => {
        const selected = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            onClick={() => onTabChange(tab.id)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1 text-center transition-all focus-visible:outline-2 focus-visible:outline-brand-rose ${selected ? 'text-brand-rose' : 'text-white/70 hover:text-white'}`}
          >
            {tab.primary ? (
              <span className="mb-1 -mt-9 rounded-full border-4 border-brand-ink bg-primary p-3 text-white shadow-lg shadow-primary/25 transition-transform active:scale-95">
                <tab.icon className="h-6 w-6" aria-hidden="true" />
              </span>
            ) : (
              <tab.icon className="h-5 w-5" aria-hidden="true" />
            )}
            <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
