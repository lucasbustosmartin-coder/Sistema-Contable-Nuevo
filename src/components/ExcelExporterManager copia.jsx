import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Sidebar from './Sidebar';

export default function ExcelExporterManager({ user, setCurrentView }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [isXLSXLoaded, setIsXLSXLoaded] = useState(false);

  useEffect(() => {
    // Carga el script de la librería de Excel de forma dinámica
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => {
      setIsXLSXLoaded(true);
    };
    script.onerror = () => {
      console.error("Error al cargar la librería de Excel. Por favor, verifica tu conexión.");
      alert("Error al cargar la librería de Excel. Por favor, recarga la página.");
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleVer = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('entradas_contables')
        .select(`
          fecha,
          importe_ars,
          importe_usd,
          moneda,
          tipo,
          conceptos_contables (
            concepto,
            rubro_id,
            rubros (nombre)
          )
        `)
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false });
      
      if (fechaDesde && fechaHasta) {
        query = query.gte('fecha', fechaDesde).lte('fecha', fechaHasta);
      } else if (fechaDesde) {
        query = query.gte('fecha', fechaDesde);
      } else if (fechaHasta) {
        query = query.lte('fecha', fechaHasta);
      }

      const { data: entriesData, error: entriesError } = await query;
      if (entriesError) throw entriesError;
      setData(entriesData || []);

    } catch (err) {
      console.error('Error al filtrar datos:', err.message);
      setError('Error al filtrar datos. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportarVista = () => {
    if (!isXLSXLoaded) {
      alert('La librería de exportación a Excel aún no ha cargado. Por favor, espera un momento y vuelve a intentarlo.');
      return;
    }

    if (!data || data.length === 0) {
      alert('No hay datos en la tabla para exportar.');
      return;
    }

    // Preparar los datos para el Excel
    const headers = [
      'Fecha',
      'Concepto',
      'Rubro',
      'Tipo',
      'Moneda',
      'Valor ARS',
      'Valor USD'
    ];
    
    const dataToExport = data.map(entry => {
      const fechaFormatted = new Date(entry.fecha + 'T00:00:00').toLocaleDateString('es-AR');
      return [
        fechaFormatted,
        entry.conceptos_contables?.concepto,
        entry.conceptos_contables?.rubros?.nombre,
        entry.tipo,
        entry.moneda,
        entry.importe_ars,
        entry.importe_usd
      ];
    });

    const ws = window.XLSX.utils.aoa_to_sheet([headers, ...dataToExport]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Registros");
    
    const filename = `Registros_${new Date().toISOString().split('T')[0]}.xlsx`;
    window.XLSX.writeFile(wb, filename);
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        currentView="excel-export"
        setCurrentView={setCurrentView}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-semibold text-gray-800">Exportar a Excel</h2>
        </header>
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="flex items-end space-x-2">
                  <button
                    onClick={handleVer}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                  >
                    Ver
                  </button>
                  <button
                    onClick={handleExportarVista}
                    disabled={!isXLSXLoaded || data.length === 0}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${!isXLSXLoaded || data.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                  >
                    {isXLSXLoaded ? 'Exportar vista' : 'Cargando librería...'}
                  </button>
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md shadow-sm">
                <p className="font-semibold mb-1">Error al cargar los datos</p>
                <p className="text-sm">Detalles: <span className="font-mono text-red-800">{error}</span></p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rubro</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Moneda</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor ARS</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor USD</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.length > 0 ? (
                      data.map((entry, index) => (
                        <tr key={index}>
                          <td className="p-1 whitespace-nowrap text-sm font-medium text-gray-800">{new Date(entry.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                          <td className="p-1 whitespace-nowrap text-sm text-gray-600">{entry.conceptos_contables?.concepto}</td>
                          <td className="p-1 whitespace-nowrap text-sm text-gray-600">{entry.conceptos_contables?.rubros?.nombre}</td>
                          <td className="p-1 whitespace-nowrap text-sm text-gray-600">{entry.tipo}</td>
                          <td className="p-1 whitespace-nowrap text-sm text-gray-600">{entry.moneda}</td>
                          <td className="p-1 whitespace-nowrap text-sm text-gray-600 text-right">${parseFloat(entry.importe_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-1 whitespace-nowrap text-sm text-gray-600 text-right">${parseFloat(entry.importe_usd).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                          No hay entradas contables para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
