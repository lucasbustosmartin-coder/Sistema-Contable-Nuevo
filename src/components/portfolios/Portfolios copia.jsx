import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import Sidebar from '../Sidebar'; // Importación del Sidebar
import iconImage from '../../assets/icon.png'; // Se incluye el icono para el header

export default function Portfolios({ user, setCurrentView }) {
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPortfolios();
    }
  }, [user]);

  const loadPortfolios = async () => {
    try {
      setLoading(true);

      const { data: activos, error } = await supabase
        .from('activos')
        .select('id, tipo, simbolo, nombre, moneda, ultimo_precio, ultimo_precio_ars')
        .eq('usuario_id', user.id);

      if (error) throw error;

      // Calcular valores
      const totalArs = activos
        .filter(a => a.moneda === 'ARS')
        .reduce((sum, a) => sum + (a.ultimo_precio || 0), 0);

      const totalUsd = activos
        .filter(a => a.moneda === 'USD')
        .reduce((sum, a) => sum + (a.ultimo_precio || 0), 0);

      const totalArsPesos = activos
        .filter(a => a.moneda === 'ARS')
        .reduce((sum, a) => sum + (a.ultimo_precio || 0), 0);

      const totalUsdPesos = activos
        .filter(a => a.moneda === 'USD')
        .reduce((sum, a) => sum + (a.ultimo_precio_ars || 0), 0);

      const totalPesos = totalArsPesos + totalUsdPesos;

      // Rendimiento simulado
      const rendimiento = ((totalPesos - 100000) / 100000 * 100).toFixed(2);

      setPortfolios([
        {
          id: 'default',
          nombre: 'Cartera Principal',
          valor: totalPesos,
          rendimiento: parseFloat(rendimiento),
          activos: activos.length,
        }
      ]);
    } catch (err) {
      console.error('Error al cargar portfolios:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearPortafolio = () => {
    alert('Funcionalidad de crear portafolio en desarrollo');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar
        currentView="portafolios"
        setCurrentView={setCurrentView}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-800">Portfolios</h2>
            <button
              onClick={handleCrearPortafolio}
              className="bg-black text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors duration-150"
            >
              Crear Portafolio
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {portfolios.map((pf) => (
                <div
                  key={pf.id}
                  className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setCurrentView(`portfolio-${pf.id}`)}
                >
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">{pf.nombre}</h3>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Valor Actual</p>
                      <p className="text-xl font-bold text-gray-800">${pf.valor.toLocaleString('es-AR')} ARS</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Rendimiento</p>
                      <p className={`text-lg font-semibold ${pf.rendimiento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pf.rendimiento}%
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Activos</p>
                      <p className="text-lg font-medium text-gray-700">{pf.activos}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}