import { HouseHeart, UserRound } from 'lucide-react'

interface UserSelectionProps {
  onSelect: (user: 'Martín' | 'Micaela') => void
}

export function UserSelection({ onSelect }: UserSelectionProps) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8 animate-in fade-in duration-500">
      <header className="relative w-full overflow-hidden rounded-[2rem] bg-brand-ink px-6 py-9 text-center text-white shadow-xl shadow-brand-violet/15">
        <span aria-hidden="true" className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-brand-rose/30 blur-3xl" />
        <span aria-hidden="true" className="absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-brand-lilac/30 blur-3xl" />
        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
          <HouseHeart className="h-9 w-9 text-brand-rose" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <h1 className="relative text-4xl font-extrabold tracking-tight">Hogarchito</h1>
        <p className="relative mx-auto mt-3 max-w-xs text-sm leading-relaxed text-white/80">
          Nuestra casa, nuestras cuentas y nuestros planes. Todo en un lugar.
        </p>
      </header>

      <div className="w-full space-y-4">
        <p className="text-center text-sm font-semibold text-foreground">¿Quién está ingresando hoy?</p>
        <div className="grid w-full grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelect('Martín')}
            className="group flex flex-col items-center gap-3 rounded-3xl border border-border bg-card px-3 py-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-violet hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-violet active:scale-95"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-violet/10 transition-colors group-hover:bg-brand-violet/20">
              <UserRound className="h-10 w-10 text-brand-violet" strokeWidth={1.7} aria-hidden="true" />
            </div>
            <span className="text-lg font-bold">Martín</span>
          </button>
          <button
            type="button"
            onClick={() => onSelect('Micaela')}
            className="group flex flex-col items-center gap-3 rounded-3xl border border-border bg-card px-3 py-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-pink hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-pink active:scale-95"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-pink/10 transition-colors group-hover:bg-brand-pink/20">
              <UserRound className="h-10 w-10 text-brand-pink" strokeWidth={1.7} aria-hidden="true" />
            </div>
            <span className="text-lg font-bold">Micaela</span>
          </button>
        </div>
      </div>
    </div>
  )
}
