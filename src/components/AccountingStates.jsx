import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import Sidebar from './Sidebar'

export default function AccountingStates({ user, setCurrentView }) {
  const [entries, setEntries] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // La función de cerrar sesión ahora se pasa al Sidebar
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (err) {
      console.error('Error al cerrar sesión:', err.message)
    }
  }

  useEffect(() => {
    loadAccountingData()
  }, [user])

  const loadAccountingData = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('entradas_contables')
        .select('*')
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false })

      if (fetchError) throw fetchError

      const grouped = {}
      if (data) {
        data.forEach(entry => {
          if (!grouped[entry.fecha]) {
            grouped[entry.fecha] = []
          }
          grouped[entry.fecha].push(entry)
        })
      }

      setEntries(grouped)
    } catch (err) {
      console.error('Error al cargar los datos contables:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        currentView="accounting"
        setCurrentView={setCurrentView}
        user={user}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-semibold text-gray-800">Estados Contables</h2>
        </header>
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md shadow-sm">
              <p className="font-semibold mb-1">Error al cargar los datos</p>
              <p className="text-sm">Por favor, inténtalo de nuevo. Detalles: <span className="font-mono text-red-800">{error}</span></p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Registros Diarios</h3>
                <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150">
                  Nuevo Día
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registros</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.keys(entries).length > 0 ? (
                      Object.keys(entries).map(fecha => (
                        <tr key={fecha}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{fecha}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{entries[fecha].length} registros</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-indigo-600 hover:text-indigo-800 mr-4 transition-colors duration-150">
                              Ver
                            </button>
                            <button className="text-red-600 hover:text-red-800 transition-colors duration-150">
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="px-6 py-4 text-center text-gray-500">
                          No hay estados contables registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
