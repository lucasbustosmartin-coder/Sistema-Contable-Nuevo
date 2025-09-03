import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import iconImage from '../assets/icon.png';

export default function ExcelExporterManager({ user, setCurrentView }) {
  const [data, setData] = useState([]);
  const [tiposCambio, setTiposCambio] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const formatDate = (date) => date.toISOString().split('T')[0];
  const [fechaDesde, setFechaDesde] = useState(formatDate(lastMonth));
  const [fechaHasta, setFechaHasta] = useState(formatDate(today));

  const [isXLSXLoaded, setIsXLSXLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false); // ✅ NUEVO: Estado para controlar la exportación

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => setIsXLSXLoaded(true);
    script.onerror = () => {
      console.error("Error al cargar la librería de Excel.");
      alert("Error al cargar la librería de Excel. Por favor, recarga la página.");
    };
    document.head.appendChild(script);

    return () => document.head.removeChild(script);
  }, []);

  useEffect(() => {
    handleVer();
  }, [user, fechaDesde, fechaHasta]);

  const handleVer = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Cargar tipos de cambio en el rango de fechas
      let tcQuery = supabase
        .from('tipos_cambio')
        .select('fecha, tasa')
        .eq('usuario_id', user.id);

      if (fechaDesde && fechaHasta) {
        tcQuery = tcQuery.gte('fecha', fechaDesde).lte('fecha', fechaHasta);
      } else if (fechaDesde) {
        tcQuery = tcQuery.gte('fecha', fechaDesde);
      } else if (fechaHasta) {
        tcQuery = tcQuery.lte('fecha', fechaHasta);
      }

      const { data: tiposData, error: tcError } = await tcQuery;
      if (tcError) throw tcError;

      const tiposMap = {};
      tiposData?.forEach(tc => {
        tiposMap[tc.fecha] = parseFloat(tc.tasa);
      });
      setTiposCambio(tiposMap);

      // 2. Cargar entradas contables
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

  const handleExportarVista = async () => { // ✅ MODIFICADO: Ahora es una función asíncrona
    if (!isXLSXLoaded) {
      alert('La librería de exportación a Excel aún no ha cargado.');
      return;
    }

    if (!data || data.length === 0) {
      alert('No hay datos en la tabla para exportar.');
      return;
    }

    setIsExporting(true); // ✅ Establecer isExporting a true al inicio

    try {
      const headers = [
        'Fecha',
        'Rubro',
        'Concepto',
        'Moneda',
        'Valor ARS',
        'Valor USD',
        'Tipo de Cambio (ARS/USD)'
      ];

      const dataToExport = data.map(entry => {
        const fechaFormatted = new Date(entry.fecha + 'T00:00:00').toLocaleDateString('es-AR');
        const tasa = tiposCambio[entry.fecha] ?? 'N/A';

        return [
          { v: fechaFormatted, t: 's' },
          { v: entry.conceptos_contables?.rubros?.nombre || '', t: 's' },
          { v: entry.conceptos_contables?.concepto || '', t: 's' },
          { v: entry.moneda, t: 's' },
          { v: parseFloat(entry.importe_ars), t: 'n', z: '#,##0.00' },
          { v: parseFloat(entry.importe_usd), t: 'n', z: '#,##0.00' },
          { v: typeof tasa === 'number' ? tasa : null, t: 'n', z: '#,##0.00' }
        ];
      });

      const ws = window.XLSX.utils.aoa_to_sheet([]);
      window.XLSX.utils.sheet_add_aoa(ws, [headers]);
      window.XLSX.utils.sheet_add_aoa(ws, dataToExport, { origin: 'A2' });

      ws['!cols'] = [
        { wch: 12 },
        { wch: 20 },
        { wch: 25 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 }
      ];

      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Registros");
      
      const filename = `Registros_${new Date().toISOString().split('T')[0]}.xlsx`;
      window.XLSX.writeFile(wb, filename);

    } catch (err) {
      console.error("Error al exportar a Excel:", err);
      alert("Error al exportar a Excel. Inténtalo de nuevo.");
    } finally {
      // ✅ Pequeño retraso para que el spinner sea visible
      await new Promise(resolve => setTimeout(resolve, 100)); 
      setIsExporting(false); // ✅ Restablecer isExporting a false
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
 

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-6">
          <div className="flex items-center space-x-4 mb-2">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800">Exportar a Excel</h2>
        </header>
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    disabled={!isXLSXLoaded || data.length === 0 || isExporting} // ✅ Deshabilitar durante la exportación
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center justify-center space-x-2 ${ // ✅ Ajustes para spinner
                      !isXLSXLoaded || data.length === 0 || isExporting
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isExporting ? ( // ✅ Renderizado condicional
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.962l2-2.671z"></path>
                        </svg>
                        <span>Generando Excel...</span>
                      </>
                    ) : (
                      <span>{isXLSXLoaded ? 'Exportar vista' : 'Cargando...'}</span>
                    )}
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
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rubro</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Moneda</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor ARS</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor USD</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tipo Cambio</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.length > 0 ? (
                      data.map((entry, index) => {
                        const tasa = tiposCambio[entry.fecha] ?? 'N/A';
                        return (
                          <tr key={index}>
                            <td className="p-1 whitespace-nowrap text-sm font-medium text-gray-800">
                              {new Date(entry.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                            </td>
                            <td className="p-1 whitespace-nowrap text-sm text-gray-600">{entry.conceptos_contables?.rubros?.nombre}</td>
                            <td className="p-1 whitespace-nowrap text-sm text-gray-600">{entry.conceptos_contables?.concepto}</td>
                            <td className="p-1 whitespace-nowrap text-sm text-gray-600">{entry.moneda}</td>
                            <td className="p-1 whitespace-nowrap text-sm text-gray-600 text-right">
                              ${parseFloat(entry.importe_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-1 whitespace-nowrap text-sm text-gray-600 text-right">
                              ${parseFloat(entry.importe_usd).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-1 whitespace-nowrap text-sm text-gray-600 text-right font-medium">
                              {typeof tasa === 'number' ? `$${tasa.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : 'N/A'}
                            </td>
                          </tr>
                        );
                      })
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