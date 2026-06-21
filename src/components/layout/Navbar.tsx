import { Home, List, PlusCircle, BarChart2, MoreHorizontal } from 'lucide-react'

interface NavbarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Navbar({ activeTab, onTabChange }: NavbarProps) {
  const tabs = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'movimientos', label: 'Movs', icon: List },
    { id: 'cargar', label: 'Cargar', icon: PlusCircle, primary: true },
    { id: 'reportes', label: 'Reportes', icon: BarChart2 },
    { id: 'mas', label: 'Más', icon: MoreHorizontal },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 pb-8 pt-3 flex justify-between items-center z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-col items-center space-y-1 transition-all ${
            activeTab === tab.id 
              ? 'text-primary scale-110' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.primary ? (
            <div className="bg-primary text-primary-foreground p-3 rounded-full -mt-10 shadow-lg active:scale-90 transition-transform">
              <tab.icon className="w-7 h-7" />
            </div>
          ) : (
            <tab.icon className="w-6 h-6" />
          )}
          <span className="text-[10px] font-medium">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
