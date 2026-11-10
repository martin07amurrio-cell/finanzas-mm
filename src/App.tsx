import { useState, useEffect } from 'react'
import { UserSelection } from './components/auth/UserSelection'
import { PinEntry } from './components/auth/PinEntry'
import { Dashboard } from './pages/dashboard/Dashboard'
import { Movimientos } from './pages/movimientos/Movimientos'
import { Cargar } from './pages/cargar/Cargar'
import { Reportes } from './pages/reportes/Reportes'
import { Mas } from './pages/mas/Mas'
import { Navbar } from './components/layout/Navbar'
import { Hogar } from './pages/hogar/Hogar'
import { InicioHogar } from './pages/hogar/InicioHogar'
import { loginUser, fetchUsdRate } from './services/api'

type AppState = 'user-selection' | 'pin-entry' | 'dashboard'
type AppUserName = 'Martín' | 'Micaela'

function isAppUserName(value: unknown): value is AppUserName {
  return value === 'Martín' || value === 'Micaela'
}

function App() {
  const [state, setState] = useState<AppState>('user-selection')
  const [activeTab, setActiveTab] = useState('inicio')
  const [selectedUser, setSelectedUser] = useState<AppUserName | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user')
    const savedToken = localStorage.getItem('auth_token')

    if (savedUser && savedToken) {
      try {
        const user = JSON.parse(savedUser)
        if (isAppUserName(user.name)) {
          setSelectedUser(user.name)
          setState('dashboard')
        }
      } catch {
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_token')
      }
    }

    fetchUsdRate().catch(() => {})
  }, [])

  const handleUserSelect = (user: AppUserName) => {
    setSelectedUser(user)
    setState('pin-entry')
    setError(null)
  }

  const handlePinComplete = async (pin: string) => {
    if (!selectedUser) return

    try {
      setError(null)
      const session = await loginUser(selectedUser, pin)
      localStorage.setItem('auth_user', JSON.stringify(session.user))
      localStorage.setItem('auth_token', session.token)
      setState('dashboard')
    } catch (error) {
      localStorage.removeItem('auth_user')
      localStorage.removeItem('auth_token')
      setError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_token')
    setSelectedUser(null)
    setActiveTab('inicio')
    setState('user-selection')
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
            {activeTab === 'inicio' && <InicioHogar onNavigate={setActiveTab} />}
            {(activeTab === 'hogar' || activeTab.startsWith('hogar:')) && <Hogar key={activeTab} initialSection={activeTab.startsWith('hogar:') ? activeTab.slice(6) as import('./services/hogar').Section : 'agenda'} onNavigate={setActiveTab} />}
            {activeTab === 'finanzas' && <Dashboard onNavigateToTab={setActiveTab} />}
            {activeTab === 'movimientos' && <Movimientos />}
            {activeTab === 'cargar' && <Cargar onNavigateToTab={setActiveTab} />}
            {activeTab === 'reportes' && <Reportes />}
            {activeTab === 'mas' && (
              <Mas onLogout={handleLogout} />
            )}
          </div>
        )}
      </main>

      {state === 'dashboard' && (
        <Navbar activeTab={activeTab.startsWith('hogar:') ? 'hogar' : activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  )
}

export default App
