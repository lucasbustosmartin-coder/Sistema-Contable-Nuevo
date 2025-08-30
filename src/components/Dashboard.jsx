import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import Sidebar from './Sidebar';
import iconImage from '../assets/icon.png';

export default function Dashboard({ user, setCurrentView }) {
  const [patrimonioNetoByDate, setPatrimonioNetoByDate] = useState({});
  const [detalleFecha, setDetalleFecha] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  
  const formatDate = (date) => date.toISOString().split('T')[0];
  const [fechaInicio, setFechaInicio] = useState(formatDate(lastMonth));
  const [fechaFin, setFechaFin] = useState(formatDate(today));
  
  const [conceptosMap, setConceptosMap] = useState({});
  const [rubrosMap, setRubrosMap] = useState({});
  
  const detalleRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadData(fechaInicio, fechaFin);
    } else {
      setLoading(false);
    }
  }, [user, fechaInicio, fechaFin]);

  const loadData = async (inicio = null, fin = null) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let entriesQuery = supabase
        .from('entradas_contables')
        .select('fecha, importe_ars, importe_usd, tipo, tipo_cambio_id, concepto_id')
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: true });

      if (inicio) {
        entriesQuery = entriesQuery.gte('fecha', inicio);
      }
      if (fin) {
        entriesQuery = entriesQuery.lte('fecha', fin);
      }

      const { data: entriesData, error: entriesError } = await entriesQuery;
      if (entriesError) throw entriesError;

      const { data: tiposCambioData, error: tcError } = await supabase
        .from('tipos_cambio')
        .select('id, fecha, tasa')
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: true });
      if (tcError) throw tcError;

      const { data: rubrosData, error: rubrosError } = await supabase
        .from('rubros')
        .select('id, nombre');
      if (rubrosError) throw rubrosError;

      const { data: conceptosData, error: conceptosError } = await supabase
        .from('conceptos_contables')
        .select('id, concepto, rubro_id');
      if (conceptosError) throw conceptosError;

      const rubrosMapTemp = rubrosData.reduce((map, r) => {
        map[r.id] = r.nombre;
        return map;
      }, {});
      setRubrosMap(rubrosMapTemp);

      const conceptosMapTemp = conceptosData.reduce((map, c) => {
        map[c.id] = { nombre: c.concepto, rubro_id: c.rubro_id };
        return map;
      }, {});
      setConceptosMap(conceptosMapTemp);

      const tcMap = tiposCambioData.reduce((map, tc) => {
        map[tc.fecha] = tc.tasa;
        return map;
      }, {});

      const totalsByDate = entriesData.reduce((acc, entry) => {
        const date = entry.fecha;
        if (!acc[date]) {
          acc[date] = { 
            'Activo Corriente': 0,
            'Activo No Corriente': 0,
            'Pasivo': 0,
            'Patrimonio Neto': 0,
            'Activo Corriente_usd': 0,
            'Activo No Corriente_usd': 0,
            'Pasivo_usd': 0,
            'Patrimonio Neto_usd': 0,
            tipoCambio: tcMap[date] || 0,
          };
        }
        
        const importeArs = entry.importe_ars;
        const importeUsd = entry.importe_usd;

        if (entry.tipo === 'Activo Corriente') {
          acc[date]['Activo Corriente'] += importeArs;
          acc[date]['Activo Corriente_usd'] += importeUsd;
        } else if (entry.tipo === 'Activo No Corriente') {
          acc[date]['Activo No Corriente'] += importeArs;
          acc[date]['Activo No Corriente_usd'] += importeUsd;
        } else if (entry.tipo === 'Pasivo') {
          acc[date]['Pasivo'] += importeArs;
          acc[date]['Pasivo_usd'] += importeUsd;
        }
        
        acc[date]['Patrimonio Neto'] = (acc[date]['Activo Corriente'] + acc[date]['Activo No Corriente']) - acc[date]['Pasivo'];
        acc[date]['Patrimonio Neto_usd'] = (acc[date]['Activo Corriente_usd'] + acc[date]['Activo No Corriente_usd']) - acc[date]['Pasivo_usd'];
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

  const cargarDetalle = async (fecha) => {
    if (!user) {
      alert('Error: No se puede cargar el detalle sin un usuario autenticado.');
      return;
    }
    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from('entradas_contables')
        .select('importe_ars, importe_usd, concepto_id, tipo')
        .eq('usuario_id', user.id)
        .eq('fecha', fecha);

      if (entriesError) throw entriesError;

      const detallePorTipoYRubro = entriesData.reduce((acc, entry) => {
        const concepto = conceptosMap[entry.concepto_id];
        if (!concepto) return acc;

        const rubroNombre = rubrosMap[concepto.rubro_id] || 'Sin Rubro';
        const tipoEntry = entry.tipo;

        if (!acc[tipoEntry]) {
          acc[tipoEntry] = {
            totalTipoArs: 0,
            totalTipoUsd: 0,
            rubros: {},
          };
        }

        if (!acc[tipoEntry].rubros[rubroNombre]) {
          acc[tipoEntry].rubros[rubroNombre] = { totalArs: 0, totalUsd: 0, conceptos: [] };
        }

        acc[tipoEntry].rubros[rubroNombre].totalArs += entry.importe_ars;
        acc[tipoEntry].rubros[rubroNombre].totalUsd += entry.importe_usd;
        acc[tipoEntry].totalTipoArs += entry.importe_ars;
        acc[tipoEntry].totalTipoUsd += entry.importe_usd;
        acc[tipoEntry].rubros[rubroNombre].conceptos.push({
          nombre: concepto.nombre,
          ars: entry.importe_ars,
          usd: entry.importe_usd
        });
        return acc;
      }, {});

      const activoCorrienteArs = detallePorTipoYRubro['Activo Corriente']?.totalTipoArs || 0;
      const activoNoCorrienteArs = detallePorTipoYRubro['Activo No Corriente']?.totalTipoArs || 0;
      const pasivoArs = detallePorTipoYRubro['Pasivo']?.totalTipoArs || 0;
      const patrimonioNetoArs = activoCorrienteArs + activoNoCorrienteArs - pasivoArs;

      const activoCorrienteUsd = detallePorTipoYRubro['Activo Corriente']?.totalTipoUsd || 0;
      const activoNoCorrienteUsd = detallePorTipoYRubro['Activo No Corriente']?.totalTipoUsd || 0;
      const pasivoUsd = detallePorTipoYRubro['Pasivo']?.totalTipoUsd || 0;
      const patrimonioNetoUsd = activoCorrienteUsd + activoNoCorrienteUsd - pasivoUsd;

      setDetalleFecha({ 
        fecha, 
        detalle: detallePorTipoYRubro,
        totales: {
          'Activo Corriente': activoCorrienteArs,
          'Activo No Corriente': activoNoCorrienteArs,
          'Pasivo': pasivoArs,
          'Patrimonio Neto': patrimonioNetoArs,
        },
        totalesUsd: {
          'Activo Corriente': activoCorrienteUsd,
          'Activo No Corriente': activoNoCorrienteUsd,
          'Pasivo': pasivoUsd,
          'Patrimonio Neto': patrimonioNetoUsd,
        }
      });
      
      setTimeout(() => {
        detalleRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err) {
      console.error('Error al cargar detalle:', err.message);
      alert('Error al cargar el detalle de la fecha.');
    }
  };

  const handleApplyFilter = () => {};

  const calculateVariations = (sortedDates) => {
    const variations = {};
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const currentDate = sortedDates[i];
      const prevDate = sortedDates[i + 1]; 
      
      const currentPN = patrimonioNetoByDate[currentDate]?.['Patrimonio Neto'] || 0;
      const currentPNUsd = patrimonioNetoByDate[currentDate]?.['Patrimonio Neto_usd'] || 0;
      const prevPN = patrimonioNetoByDate[prevDate]?.['Patrimonio Neto'] || 0;
      const prevPNUsd = patrimonioNetoByDate[prevDate]?.['Patrimonio Neto_usd'] || 0;
      
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
  
  const patrimonioNetoInicial = initialDate ? patrimonioNetoByDate[initialDate]['Patrimonio Neto'] : 0;
  const patrimonioNetoInicialUsd = initialDate ? patrimonioNetoByDate[initialDate]['Patrimonio Neto_usd'] : 0;
  const patrimonioNetoActual = lastDate ? patrimonioNetoByDate[lastDate]['Patrimonio Neto'] : 0;
  const patrimonioNetoActualUsd = lastDate ? patrimonioNetoByDate[lastDate]['Patrimonio Neto_usd'] : 0;
  
  const variacionArs = patrimonioNetoActual - patrimonioNetoInicial;
  const variacionPorcentajeArs = patrimonioNetoInicial !== 0 ? ((variacionArs / patrimonioNetoInicial) * 100).toFixed(2) : 'N/A';
  const variacionColorArs = variacionArs >= 0 ? 'text-green-600' : 'text-red-600';
  
  const variacionUsd = patrimonioNetoActualUsd - patrimonioNetoInicialUsd;
  const variacionPorcentajeUsd = patrimonioNetoInicialUsd !== 0 ? ((variacionUsd / patrimonioNetoInicialUsd) * 100).toFixed(2) : 'N/A';
  const variacionColorUsd = variacionUsd >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar
        currentView="dashboard"
        setCurrentView={setCurrentView}
        user={user}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mt-4">Dashboard</h2>
        </header>
        
        <main className="flex-1 overflow-y-auto p-6">
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
              {/* Contenedor de Filtro de Fechas */}
              <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Filtrar por Fecha</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleApplyFilter}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Aplicar Filtro
                    </button>
                  </div>
                </div>
              </div>

              {/* Contenedor de Resumen */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                  <p className="text-sm font-medium text-gray-500">Patrimonio Neto Inicial</p>
                  <p className="text-xl font-semibold text-gray-800 mt-1">${patrimonioNetoInicial.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-gray-500">ARS</span></p>
                  <p className="text-base text-gray-600 mt-1">${patrimonioNetoInicialUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-gray-500">USD</span></p>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                  <p className="text-sm font-medium text-gray-500">Patrimonio Neto Actual</p>
                  <p className="text-xl font-semibold text-gray-800 mt-1">${patrimonioNetoActual.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-gray-500">ARS</span></p>
                  <p className="text-base text-gray-600 mt-1">${patrimonioNetoActualUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-gray-500">USD</span></p>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                  <p className="text-sm font-medium text-gray-500">Variación ARS</p>
                  <p className={`text-xl font-semibold mt-1 ${variacionColorArs}`}>
                    ${variacionArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className={`text-sm mt-1 ${variacionColorArs}`}>
                    {variacionPorcentajeArs}%
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                  <p className="text-sm font-medium text-gray-500">Variación USD</p>
                  <p className={`text-xl font-semibold mt-1 ${variacionColorUsd}`}>
                    ${variacionUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className={`text-sm mt-1 ${variacionColorUsd}`}>
                    {variacionPorcentajeUsd}%
                  </p>
                </div>
              </div>

              {/* Contenedor de Tabla */}
              <div className="bg-white rounded-xl shadow-md p-6 mt-6 border border-gray-200">
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
                          const pn = patrimonioNetoByDate[date]['Patrimonio Neto'];
                          const pnUsd = patrimonioNetoByDate[date]['Patrimonio Neto_usd'];
                          const variation = variations[date];
                          const variationColorArs = variation?.variationMonto >= 0 ? 'text-green-600' : 'text-red-600';
                          const variationColorUsd = variation?.variationMontoUsd >= 0 ? 'text-green-600' : 'text-red-600';
                          
                          return (
                            <tr 
                              key={date} 
                              className={`${isLastDate ? 'font-bold' : ''} hover:bg-gray-50 cursor-pointer`}
                              onClick={() => cargarDetalle(date)}
                            >
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${isLastDate ? 'text-base text-gray-800' : 'text-gray-800'}`}>
                                {new Date(date + 'T00:00:00').toLocaleDateString('es-AR')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">${pn.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">${pnUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">{patrimonioNetoByDate[date]?.tipoCambio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${variationColorArs}`}>
                                {variation ? `${variation.variationMonto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${variation.variationPorcentaje}%)` : 'N/A'}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${variationColorUsd}`}>
                                {variation ? `${variation.variationMontoUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${variation.variationPorcentajeUsd}%)` : 'N/A'}
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

              {/* Contenedor de Detalle por Fecha */}
              {detalleFecha && (
                <div ref={detalleRef} className="bg-white rounded-xl shadow-md p-6 mt-6 border-t-4 border-indigo-500 animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-800">
                      Detalle del {new Date(detalleFecha.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                    </h3>
                    <button
                      onClick={() => setDetalleFecha(null)}
                      className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    {Object.entries(detalleFecha.totales).map(([tipo, total], index) => {
                      const colorClassArs = tipo === 'Patrimonio Neto' ? 'text-indigo-700' : tipo === 'Pasivo' ? 'text-red-700' : 'text-gray-800';
                      const colorClassUsd = tipo === 'Patrimonio Neto' ? 'text-indigo-600' : tipo === 'Pasivo' ? 'text-red-600' : 'text-gray-600';
                      return (
                        <div key={index} className="bg-gray-50 rounded-lg shadow-inner p-6 border border-gray-200">
                          <p className="text-sm font-medium text-gray-500">{tipo}</p>
                          <p className={`text-lg font-semibold mt-1 ${colorClassArs}`}>
                            ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS
                          </p>
                          <p className={`text-sm mt-1 ${colorClassUsd}`}>
                            ${detalleFecha.totalesUsd[tipo].toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Detalle por Concepto</h4>
                    <div className="h-96 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rubro</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importe ARS</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importe USD</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(detalleFecha.detalle).map(([tipo, datos]) => (
                            Object.entries(datos.rubros).map(([rubro, datosRubro]) => (
                              datosRubro.conceptos.map((concepto, index) => (
                                <tr key={`${tipo}-${rubro}-${index}`}>
                                  {index === 0 && (
                                    <td rowSpan={datosRubro.conceptos.length} className="px-6 py-4 text-sm text-gray-700 align-top border-r-2 border-gray-100">{rubro}</td>
                                  )}
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{concepto.nombre}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">${concepto.ars.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">${concepto.usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                              ))
                            ))
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}