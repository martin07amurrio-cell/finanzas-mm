import { User as UserIcon } from 'lucide-react'

interface UserSelectionProps {
  onSelect: (user: 'Martín' | 'Micaela') => void
}

export function UserSelection({ onSelect }: UserSelectionProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-12 animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Finanzas M&M</h1>
        <p className="text-muted-foreground text-lg">¿Quién está ingresando hoy?</p>
      </div>

      <div className="grid grid-cols-2 gap-8 w-full max-w-sm">
        <button
          onClick={() => onSelect('Martín')}
          className="group flex flex-col items-center space-y-4 p-6 rounded-3xl bg-card border border-border shadow-sm active:scale-95 transition-all hover:border-brand-blue hover:shadow-md"
        >
          <div className="w-20 h-20 rounded-full bg-brand-blue/10 flex items-center justify-center group-hover:bg-brand-blue/20 transition-colors">
            <UserIcon className="w-10 h-10 text-brand-blue" />
          </div>
          <span className="text-xl font-semibold">Martín</span>
        </button>

        <button
          onClick={() => onSelect('Micaela')}
          className="group flex flex-col items-center space-y-4 p-6 rounded-3xl bg-card border border-border shadow-sm active:scale-95 transition-all hover:border-brand-coral hover:shadow-md"
        >
          <div className="w-20 h-20 rounded-full bg-brand-coral/10 flex items-center justify-center group-hover:bg-brand-coral/20 transition-colors">
            <UserIcon className="w-10 h-10 text-brand-coral" />
          </div>
          <span className="text-xl font-semibold">Micaela</span>
        </button>
      </div>
    </div>
  )
}
