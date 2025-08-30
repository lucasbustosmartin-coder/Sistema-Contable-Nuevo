import { useState, useEffect } from 'react'
import { supabase } from './services/supabase'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import EstadosFinancierosManager from './components/EstadosFinancierosManager'
import TipoCambioManager from './components/TipoCambioManager'
import RubrosManager from './components/RubrosManager'
import ConceptosContablesManager from './components/ConceptosContablesManager'
import EntradasContablesManager from './components/EntradasContablesManager'
import CreateNewDayManager from './components/CreateNewDayManager'
import ExcelExporterManager from './components/ExcelExporterManager'

export default function App() {
  const [user, setUser] = useState(null)
  const [currentView, setCurrentView] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null)
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg flex items-center shadow-md">
          <div className="animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent mr-3"></div>
          Cargando...
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={() => {}} />
  }

  switch (currentView) {
    case 'dashboard':
      return <Dashboard user={user} setCurrentView={setCurrentView} />
    case 'estados-financieros': // ✅ Conectado al Sidebar
      return <EstadosFinancierosManager user={user} setCurrentView={setCurrentView} />
    case 'tipo-cambio':
      return <TipoCambioManager user={user} setCurrentView={setCurrentView} />
    case 'rubros':
      return <RubrosManager user={user} setCurrentView={setCurrentView} />
    case 'conceptos':
      return <ConceptosContablesManager user={user} setCurrentView={setCurrentView} />
    case 'entradas-contables':
      return <EntradasContablesManager user={user} setCurrentView={setCurrentView} />
    case 'crear-nuevo-dia':
      return <CreateNewDayManager user={user} setCurrentView={setCurrentView} />
    case 'exportar-excel':
      return <ExcelExporterManager user={user} setCurrentView={setCurrentView} />
    default:
      return <Dashboard user={user} setCurrentView={setCurrentView} />
  }
}
