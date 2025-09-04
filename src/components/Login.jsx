import { useState } from 'react'
import { supabase } from '../services/supabase'
import logoImage from '../assets/favicon-256.png'; 

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSignIn = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      // ✅ MODIFICADO: Pasa el objeto de usuario a la función onLogin
      if (data?.user) {
        onLogin(data.user);
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      })

      if (error) throw error
      
      // ✅ MODIFICADO: Pasa el objeto de usuario si la creación de cuenta es exitosa
      if (data?.user) {
        onLogin(data.user);
      }

      alert('Cuenta creada. Revisa tu email para confirmar.')
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex justify-center mb-4">
          <img src={logoImage} alt="Logo de Gestión Patrimonial" className="h-20 w-20 object-contain" />
        </div>
        
        {/* ✅ CORREGIDO: Título cambiado a "Gestión Patrimonial" */}
        <h2 className="text-2xl font-bold text-center mb-6">Gestión Patrimonial</h2> 
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="********"
              required
            />
          </div>

          <div className="flex flex-col space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
            >
              {loading ? 'Cargando...' : 'Iniciar Sesión'}
            </button>

            <button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
            >
              Crear Cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}