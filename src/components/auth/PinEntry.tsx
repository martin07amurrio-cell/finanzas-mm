import { useState, useEffect } from 'react'
import { Delete, Lock } from 'lucide-react'

interface PinEntryProps {
  userName: string
  onBack: () => void
  onComplete: (pin: string) => void
  error?: string | null
}

export function PinEntry({ userName, onBack, onComplete, error }: PinEntryProps) {
  const [pin, setPin] = useState('')

  const handleNumber = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num)
    }
  }

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1))
  }

  useEffect(() => {
    if (pin.length === 4) {
      onComplete(pin)
    }
  }, [pin, onComplete])

  useEffect(() => {
    if (error) {
      setPin('')
    }
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center space-y-10 animate-in slide-in-from-right duration-300">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Hola, {userName}</h2>
        <p className="text-muted-foreground">Ingresa tu PIN personal</p>
      </div>

      <div className="flex space-x-4">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              pin.length > i ? 'bg-primary border-primary scale-125' : 'border-muted-foreground/30'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}

      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handleNumber(num.toString())}
            className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-semibold bg-secondary hover:bg-secondary/80 active:scale-90 transition-all shadow-sm"
          >
            {num}
          </button>
        ))}
        <button
          onClick={onBack}
          className="h-16 w-16 rounded-full flex items-center justify-center text-sm font-medium hover:text-primary transition-colors"
        >
          Atrás
        </button>
        <button
          onClick={() => handleNumber('0')}
          className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-semibold bg-secondary hover:bg-secondary/80 active:scale-90 transition-all shadow-sm"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="h-16 w-16 rounded-full flex items-center justify-center hover:text-destructive transition-colors"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}
