import { useState, useEffect } from 'react'
import { UserSelection } from './components/auth/UserSelection'
import { PinEntry } from './components/auth/PinEntry'
import { Dashboard } from './pages/dashboard/Dashboard'
import { Movimientos } from './pages/movimientos/Movimientos'
import { Cargar } from './pages/cargar/Cargar'
import { Reportes } from './pages/reportes/Reportes'
import { Mas } from './pages/mas/Mas'
import { Navbar } from './components/layout/Navbar'
import { getUsers, fetchUsdRate } from './services/api'
import type { User } from './types/database'

type AppState = 'user-selection' | 'pin-entry' | 'dashboard'

function App() {
  const [state, setState] = useState<AppState>('user-selection')
  const [activeTab, setActiveTab] = useState('inicio')
  const [selectedUser, setSelectedUser] = useState<'Martín' | 'Micaela' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])

  // Carga los usuarios una sola vez al iniciar — la verificación del PIN es local, sin red
  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user')
    if (savedUser) {
      const user = JSON.parse(savedUser)
      setSelectedUser(user.name)
      setState('dashboard')
    }

    getUsers().then(data => setUsers(data)).catch(() => {})
    fetchUsdRate().catch(() => {})
  }, [])

  const handleUserSelect = (user: 'Martín' | 'Micaela') => {
    setSelectedUser(user)
    setState('pin-entry')
    setError(null)
  }

  const handlePinComplete = (pin: string) => {
    const match = users.find(u => u.name === selectedUser && u.pin_hash === pin)
    if (match) {
      setState('dashboard')
      localStorage.setItem('auth_user', JSON.stringify(match))
    } else {
      setError('PIN incorrecto. Intenta de nuevo.')
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <main className="max-w-lg mx-auto p-6 min-h-[calc(100vh-80px)] flex flex-col items-center justify-center">
        {state === 'user-selection' && (
          <UserSelection onSelect={handleUserSelect} />
        )}

        {state === 'pin-entry' && selectedUser && (
          <PinEntry 
            userName={selectedUser} 
            onBack={() => setState('user-selection')} 
            onComplete={handlePinComplete}
            error={error}
          />
        )}

        {state === 'dashboard' && (
          <div className="w-full flex flex-col">
             {activeTab === 'inicio' && <Dashboard onNavigateToTab={setActiveTab} />}
             {activeTab === 'movimientos' && <Movimientos />}
             {activeTab === 'cargar' && <Cargar onNavigateToTab={setActiveTab} />}
             {activeTab === 'reportes' && <Reportes />}
             {activeTab === 'mas' && (
               <Mas 
                 onLogout={() => {
                   localStorage.removeItem('auth_user')
                   setState('user-selection')
                 }} 
               />
             )}
          </div>
        )}
      </main>

      {state === 'dashboard' && (
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      )}

    </div>
  )
}

export default App
