import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import Sidebar from './Sidebar'

export default function Dashboard({ user, setCurrentView }) {
  const [patrimonioNetoByDate, setPatrimonioNetoByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async (inicio = null, fin = null) => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('entradas_contables')
        .select(`
          fecha,
          importe_ars,
          importe_usd,
          tipo,
          tipo_cambio_id,
          conceptos_contables (
            rubro_id,
            rubros (nombre)
          )
        `)
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: true });

      if (inicio) {
        query = query.gte('fecha', inicio);
      }
      if (fin) {
        query = query.lte('fecha', fin);
      }

      const { data: entriesData, error: entriesError } = await query;
      if (entriesError) throw entriesError;

      const { data: tiposCambioData, error: tcError } = await supabase
        .from('tipos_cambio')
        .select(`
          id,
          fecha,
          tasa
        `)
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: true });
      if (tcError) throw tcError;

      const tcMap = tiposCambioData.reduce((map, tc) => {
        map[tc.fecha] = tc.tasa;
        return map;
      }, {});

      const totalsByDate = entriesData.reduce((acc, entry) => {
        const date = entry.fecha;
        if (!acc[date]) {
          acc[date] = { activo: 0, pasivo: 0, patrimonioNeto: 0, activo_usd: 0, pasivo_usd: 0, patrimonioNeto_usd: 0, tipoCambio: 0 };
        }
        
        const importeArs = entry.importe_ars;
        const importeUsd = entry.importe_usd;
        const tipoCambio = tcMap[date] || 0;

        if (entry.tipo === 'Activo Corriente' || entry.tipo === 'Activo No Corriente') {
          acc[date].activo += importeArs;
          acc[date].activo_usd += importeUsd;
        } else if (entry.tipo === 'Pasivo') {
          acc[date].pasivo += importeArs;
          acc[date].pasivo_usd += importeUsd;
        }
        
        acc[date].patrimonioNeto = acc[date].activo - acc[date].pasivo;
        acc[date].patrimonioNeto_usd = acc[date].activo_usd - acc[date].pasivo_usd;
        acc[date].tipoCambio = tipoCambio;
        return acc;
      }, {});
      
      setPatrimonioNetoByDate(totalsByDate);
    } catch (err) {
      console.error('Error al cargar datos del dashboard:', err.message);
      setError('Error al cargar datos del dashboard. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    loadData(fechaInicio, fechaFin);
  };

  const calculateVariations = (sortedDates) => {
    const variations = {};

    for (let i = 0; i < sortedDates.length; i++) {
      const currentDate = sortedDates[i];
      const prevDate = sortedDates[i + 1]; 
      
      const currentPN = patrimonioNetoByDate[currentDate]?.patrimonioNeto || 0;
      const currentPNUsd = patrimonioNetoByDate[currentDate]?.patrimonioNeto_usd || 0;
      const prevPN = prevDate ? patrimonioNetoByDate[prevDate]?.patrimonioNeto : 0;
      const prevPNUsd = prevDate ? patrimonioNetoByDate[prevDate]?.patrimonioNeto_usd : 0;
      
      const variationMonto = currentPN - prevPN;
      const variationPorcentaje = prevPN !== 0 ? ((variationMonto / prevPN) * 100).toFixed(2) : 'N/A';
      
      const variationMontoUsd = currentPNUsd - prevPNUsd;
      const variationPorcentajeUsd = prevPNUsd !== 0 ? ((variationMontoUsd / prevPNUsd) * 100).toFixed(2) : 'N/A';
      
      variations[currentDate] = {
        variationMonto,
        variationPorcentaje,
        variationMontoUsd,
        variationPorcentajeUsd
      };
    }
    return variations;
  };

  const sortedDates = Object.keys(patrimonioNetoByDate).sort((a, b) => new Date(b) - new Date(a));
  const variations = calculateVariations(sortedDates);

  const initialDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
  const lastDate = sortedDates.length > 0 ? sortedDates[0] : null;
  
  const patrimonioNetoInicial = initialDate ? patrimonioNetoByDate[initialDate].patrimonioNeto : 0;
  const patrimonioNetoInicialUsd = initialDate ? patrimonioNetoByDate[initialDate].patrimonioNeto_usd : 0;
  const patrimonioNetoActual = lastDate ? patrimonioNetoByDate[lastDate].patrimonioNeto : 0;
  const patrimonioNetoActualUsd = lastDate ? patrimonioNetoByDate[lastDate].patrimonioNeto_usd : 0;
  
  const variacionArs = patrimonioNetoActual - patrimonioNetoInicial;
  const variacionPorcentajeArs = patrimonioNetoInicial !== 0 ? ((variacionArs / patrimonioNetoInicial) * 100).toFixed(2) : 'N/A';
  const variacionColorArs = variacionArs >= 0 ? 'text-green-500' : 'text-red-500';
  
  const variacionUsd = patrimonioNetoActualUsd - patrimonioNetoInicialUsd;
  const variacionPorcentajeUsd = patrimonioNetoInicialUsd !== 0 ? ((variacionUsd / patrimonioNetoInicialUsd) * 100).toFixed(2) : 'N/A';
  const variacionColorUsd = variacionUsd >= 0 ? 'text-green-500' : 'text-red-500';


  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        currentView="dashboard"
        setCurrentView={setCurrentView}
        user={user}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-semibold text-gray-800">Dashboard</h2>
        </header>
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
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
            <>
              {/* Filtro por rango de fechas */}
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Filtrar por Fecha</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleApplyFilter}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                    >
                      Aplicar Filtro
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel de Resumen */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-md p-6">
                  <p className="text-sm font-medium text-gray-500">Patrimonio Neto Inicial</p>
                  <p className="text-lg font-semibold text-gray-800 mt-1">${patrimonioNetoInicial.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS</p>
                  <p className="text-sm text-gray-600 mt-1">${patrimonioNetoInicialUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6">
                  <p className="text-sm font-medium text-gray-500">Patrimonio Neto Actual</p>
                  <p className="text-lg font-semibold text-gray-800 mt-1">${patrimonioNetoActual.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS</p>
                  <p className="text-sm text-gray-600 mt-1">${patrimonioNetoActualUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6">
                  <p className="text-sm font-medium text-gray-500">Variación ARS</p>
                  <p className={`text-lg font-semibold mt-1 ${variacionColorArs}`}>
                    ${variacionArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className={`text-sm mt-1 ${variacionColorArs}`}>
                    {variacionPorcentajeArs}%
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6">
                  <p className="text-sm font-medium text-gray-500">Variación USD</p>
                  <p className={`text-lg font-semibold mt-1 ${variacionColorUsd}`}>
                    ${variacionUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className={`text-sm mt-1 ${variacionColorUsd}`}>
                    {variacionPorcentajeUsd}%
                  </p>
                </div>
              </div>

              {/* Tabla de Resumen de Patrimonio Neto */}
              <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumen de Patrimonio Neto por Día</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Patrimonio Neto ARS</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Patrimonio Neto USD</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo de Cambio</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variación ARS (%)</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variación USD (%)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedDates.length > 0 ? (
                        sortedDates.map((date, i) => {
                          const isLastDate = i === 0;
                          const pn = patrimonioNetoByDate[date].patrimonioNeto;
                          const pnUsd = patrimonioNetoByDate[date].patrimonioNeto_usd;
                          const variation = variations[date];
                          const variationColorArs = variation.variationMonto >= 0 ? 'text-green-600' : 'text-red-600';
                          const variationColorUsd = variation.variationMontoUsd >= 0 ? 'text-green-600' : 'text-red-600';
                          
                          return (
                            <tr key={date} className={isLastDate ? 'font-bold' : ''}>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${isLastDate ? 'text-base text-gray-800' : 'text-gray-800'}`}>{new Date(date + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">${pn.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">${pnUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">{patrimonioNetoByDate[date].tipoCambio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${variationColorArs}`}>
                                {i < sortedDates.length - 1 ? `${variation.variationMonto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${variation.variationPorcentaje}%)` : 'N/A'}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${variationColorUsd}`}>
                                {i < sortedDates.length - 1 ? `${variation.variationMontoUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${variation.variationPorcentajeUsd}%)` : 'N/A'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                            No hay datos de patrimonio neto para mostrar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
