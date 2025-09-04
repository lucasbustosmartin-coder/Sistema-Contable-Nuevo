import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import iconImage from '../../assets/icon.png';

export default function Portfolios({ user, setCurrentView, updateMessage, setUpdateMessage }) {
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPortfolioData, setNewPortfolioData] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState('');
  const [tiposCambio, setTiposCambio] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTiposCambio();
    }
  }, [user]);

  useEffect(() => {
    if (user && tiposCambio.length > 0) {
      handleFullUpdate();
    }
  }, [user, tiposCambio]);
  
  const handleRecalculateAndPriceUpdate = async () => {
    try {
      setUpdateMessage({ type: 'info', text: 'Recalculando valores contables...' });

      const { data: tipos, error: tcError } = await supabase
        .from('tipos_cambio')
        .select('fecha, tasa')
        .eq('usuario_id', user.id);
      if (tcError) throw tcError;

      const tiposPorFecha = tipos.reduce((acc, tc) => {
        acc[tc.fecha] = tc.tasa;
        return acc;
      }, {});

      const { data: entradas, error: entradasError } = await supabase
        .from('entradas_contables')
        .select('id, fecha, importe_ars, importe_usd, moneda')
        .eq('usuario_id', user.id);
      if (entradasError) throw entradasError;
      
      const actualizaciones = entradas.map(entrada => {
        const tasa = tiposPorFecha[entrada.fecha];
        if (!tasa || tasa <= 0) return null;

        let debeActualizar = false;
        let updateData = {};

        if (entrada.moneda === 'ARS') {
          const nuevoUSD = parseFloat((entrada.importe_ars / tasa).toFixed(2));
          if (nuevoUSD !== entrada.importe_usd) {
            debeActualizar = true;
            updateData = { importe_usd: nuevoUSD };
          }
        } else if (entrada.moneda === 'USD') {
          const nuevoARS = parseFloat((entrada.importe_usd * tasa).toFixed(2));
          if (nuevoARS !== entrada.importe_ars) {
            debeActualizar = true;
            updateData = { importe_ars: nuevoARS };
          }
        }
        
        if (debeActualizar) {
          return supabase
            .from('entradas_contables')
            .update(updateData)
            .eq('id', entrada.id)
            .eq('usuario_id', user.id);
        }
        return null;
      }).filter(Boolean);

      if (actualizaciones.length > 0) {
        const results = await Promise.all(actualizaciones);
        const errors = results.filter(result => result.error);
        if (errors.length > 0) {
          throw new Error('Algunos registros contables no se pudieron actualizar.');
        }
      }

      setUpdateMessage({ type: 'info', text: 'Actualizando los valors de los registros contables y los precios de los activos en cartera...' });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: preciosData, error: preciosError } = await supabase.functions.invoke('actualizar-precios-docta', {
        body: { user_id: user.id },
      });
      if (preciosError) throw preciosError;

      return { success: true };

    } catch (err) {
      console.error('Error al recalcular y actualizar precios:', err);
      throw new Error(err.message || 'Error en el proceso de actualización.');
    }
  };

  const handleFullUpdate = async () => {
    setIsUpdating(true);
    try {
      setUpdateMessage({ type: 'info', text: 'Iniciando actualización completa...' });

      // 1. Actualizar Tipo de Cambio
      setUpdateMessage({ type: 'info', text: 'Actualizando la información del tipo de cambio Mep...' });
      const { error: tcError } = await supabase.functions.invoke('actualizar-tipo-cambio', {
        body: { user_id: user.id },
      });
      if (tcError) throw tcError;
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 2. Recalcular y Actualizar Precios de Activos
      await handleRecalculateAndPriceUpdate();

      setUpdateMessage({ type: 'success', text: '¡Actualización completa! Todos los precios han sido sincronizados.' });
    } catch (err) {
      console.error('Error en la actualización completa:', err);
      setUpdateMessage({ type: 'error', text: err.message || 'Error en la actualización. Por favor, intenta de nuevo.' });
    } finally {
      loadPortfolios();
      setIsUpdating(false);
      setTimeout(() => setUpdateMessage(null), 5000);
    }
  };

  const fetchTiposCambio = async () => {
    try {
      const { data, error } = await supabase
        .from('tipos_cambio')
        .select('fecha, tasa')
        .order('fecha', { ascending: true });
      if (error) throw error;
      setTiposCambio(data);
    } catch (err) {
      console.error('Error fetching tipos de cambio:', err.message);
    }
  };

  const getTipoCambioPorFecha = (fecha) => {
    const tasa = tiposCambio.find(tc => tc.fecha === fecha);
    return tasa ? tasa.tasa : 0;
  };

  const convertToSelectedCurrency = (value, fromCurrency, toCurrency, date) => {
    if (fromCurrency === toCurrency) {
      return value;
    }
    const tasa = getTipoCambioPorFecha(date);
    if (tasa === 0) return 0;
    
    if (fromCurrency === 'ARS' && toCurrency === 'USD') {
      return value / tasa;
    } else if (fromCurrency === 'USD' && toCurrency === 'ARS') {
      return value * tasa;
    }
    return value;
  };

  // ✅ CORREGIDO: Lógica de cálculo unificada (misma que en PortfolioDetail)
  const calculatePortfolioMetrics = (transacciones, brokerFilter = 'todos') => {
    const filteredTransactions = brokerFilter === 'todos'
      ? transacciones
      : transacciones.filter(t => t.broker_id === brokerFilter);
      
    const holdings = {};

    // Ordenar transacciones por fecha de forma ascendente
    filteredTransactions.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    filteredTransactions.forEach(t => {
      const activoId = t.activo_id;
      if (!holdings[activoId]) {
        holdings[activoId] = {
          cantidad: 0,
          costo_total_ars: 0,
          costo_total_usd: 0,
          activoInfo: t.activos,
          brokers: {},
          compras: [] // Almacenará las compras abiertas de este activo
        };
      }
      
      const cantidad = parseFloat(t.cantidad);
      const precioUnitario = parseFloat(t.precio_unitario);
      const montoTransaccion = cantidad * precioUnitario;
      const esBono = t.activos?.tipo?.toLowerCase() === 'bono';
      
      const costoArs = convertToSelectedCurrency(montoTransaccion, t.moneda, 'ARS', t.fecha);
      const costoUsd = convertToSelectedCurrency(montoTransaccion, t.moneda, 'USD', t.fecha);
      
      const brokerId = t.broker_id;
      if (!holdings[activoId].brokers[brokerId]) {
        holdings[activoId].brokers[brokerId] = {
          cantidad: 0,
          costo_total_ars: 0,
          costo_total_usd: 0,
        };
      }
      
      if (t.tipo_operacion === 'compra') {
        const costoUnitarioArs = esBono ? (costoArs / 100) / cantidad : costoArs / cantidad;
        const costoUnitarioUsd = esBono ? (costoUsd / 100) / cantidad : costoUsd / cantidad;
        
        holdings[activoId].compras.push({
          id: t.id,
          cantidad_restante: cantidad,
          costo_unitario_ars: costoUnitarioArs,
          costo_unitario_usd: costoUnitarioUsd,
          broker_id: brokerId,
        });
        
      } else if (t.tipo_operacion === 'venta') {
        let cantidadPendiente = cantidad;
        
        // Procesa las ventas contra las compras más antiguas (FIFO)
        for (let i = 0; i < holdings[activoId].compras.length && cantidadPendiente > 0; i++) {
          const compra = holdings[activoId].compras[i];
          if (compra.cantidad_restante > 0) {
            const cantidadARestar = Math.min(cantidadPendiente, compra.cantidad_restante);
            compra.cantidad_restante -= cantidadARestar;
            cantidadPendiente -= cantidadARestar;
          }
        }
      }
    });

    // Calcular la cantidad final y el costo total a partir de las compras restantes
    for (const activoId in holdings) {
      const holding = holdings[activoId];
      holding.cantidad = 0;
      holding.costo_total_ars = 0;
      holding.costo_total_usd = 0;
      for (const brokerId in holding.brokers) {
        holding.brokers[brokerId].cantidad = 0;
        holding.brokers[brokerId].costo_total_ars = 0;
        holding.brokers[brokerId].costo_total_usd = 0;
      }
      
      holding.compras.forEach(compra => {
        const cantidadRestante = compra.cantidad_restante;
        if (cantidadRestante > 0) {
          holding.cantidad += cantidadRestante;
          holding.brokers[compra.broker_id].cantidad += cantidadRestante;
          holding.costo_total_ars += cantidadRestante * compra.costo_unitario_ars;
          holding.costo_total_usd += cantidadRestante * compra.costo_unitario_usd;
          holding.brokers[compra.broker_id].costo_total_ars += cantidadRestante * compra.costo_unitario_ars;
          holding.brokers[compra.broker_id].costo_total_usd += cantidadRestante * compra.costo_unitario_usd;
        }
      });

      const esBono = holding.activoInfo?.tipo?.toLowerCase() === 'bono';
      const valorArs = holding.cantidad > 0 ? (esBono ? holding.cantidad * holding.activoInfo.ultimo_precio_ars / 100 : holding.cantidad * holding.activoInfo.ultimo_precio_ars) : 0;
      const valorUsd = holding.cantidad > 0 ? (esBono ? holding.cantidad * holding.activoInfo.ultimo_precio / 100 : holding.cantidad * holding.activoInfo.ultimo_precio) : 0;
      
      holding.valor_actual_ars = valorArs;
      holding.valor_actual_usd = valorUsd;
    }
    
    // Calcular los totales del portafolio
    let valorActualArs = 0;
    let valorActualUsd = 0;
    let costoTotalArs = 0;
    let costoTotalUsd = 0;
    let cantidadActivos = 0;

    for (const activoId in holdings) {
      const holding = holdings[activoId];
      valorActualArs += holding.valor_actual_ars;
      valorActualUsd += holding.valor_actual_usd;
      costoTotalArs += holding.costo_total_ars;
      costoTotalUsd += holding.costo_total_usd;
      if (holding.cantidad > 0) {
        cantidadActivos++;
      }
    }

    const rendimientoMontoArs = valorActualArs - costoTotalArs;
    const rendimientoPorcentajeArs = costoTotalArs > 0 ? (rendimientoMontoArs / costoTotalArs) * 100 : 0;
    const rendimientoMontoUsd = valorActualUsd - costoTotalUsd;
    const rendimientoPorcentajeUsd = costoTotalUsd > 0 ? (rendimientoMontoUsd / costoTotalUsd) * 100 : 0;

    return {
      valorActualArs,
      valorActualUsd,
      costoTotalArs,
      costoTotalUsd,
      rendimientoMontoArs,
      rendimientoPorcentajeArs,
      rendimientoMontoUsd,
      rendimientoPorcentajeUsd,
      cantidadActivos
    };
  };

  const loadPortfolios = async () => {
    try {
      setLoading(true);
      const { data: portfoliosData, error: portfoliosError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (portfoliosError) throw portfoliosError;

      const updatedPortfolios = await Promise.all(
        portfoliosData.map(async (pf) => {
          const { data: transacciones, error: transaccionesError } = await supabase
            .from('transacciones')
            .select('*, activos(id, tipo, ultimo_precio, ultimo_precio_ars)')
            .eq('portafolio_id', pf.id)
            .order('fecha', { ascending: true });

          if (transaccionesError) throw transaccionesError;
          
          const metrics = calculatePortfolioMetrics(transacciones, 'todos');

          return {
            ...pf,
            valorActualArs: metrics.valorActualArs,
            valorActualUsd: metrics.valorActualUsd,
            rendimientoMontoArs: metrics.rendimientoMontoArs,
            rendimientoMontoUsd: metrics.rendimientoMontoUsd,
            rendimientoPorcentajeArs: metrics.rendimientoPorcentajeArs,
            rendimientoPorcentajeUsd: metrics.rendimientoPorcentajeUsd,
            cantidadActivos: metrics.cantidadActivos,
          };
        })
      );
      
      setPortfolios(updatedPortfolios);
    } catch (err) {
      console.error('Error al cargar portfolios:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = async (e) => {
    e.preventDefault();
    if (!newPortfolioData.name) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    setFormError('');

    try {
      const { data, error } = await supabase
        .from('portfolios')
        .insert({
          user_id: user.id,
          name: newPortfolioData.name,
          description: newPortfolioData.description
        })
        .select();

      if (error) throw error;
      
      setNewPortfolioData({ name: '', description: '' });
      setShowCreateModal(false);
      loadPortfolios(); 
    } catch (err) {
      console.error('Error al crear el portafolio:', err.message);
      setFormError('Error al crear el portafolio. Intenta de nuevo.');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="bg-white shadow-sm p-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-4">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={handleFullUpdate}
              disabled={isUpdating}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                isUpdating ? 'bg-gray-400 cursor-not-allowed text-gray-200' : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              {isUpdating ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.962l2-2.671z"></path>
                  </svg>
                  <span>Actualizando...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.03M4.032 9.417l2.687-2.685m-2.687 2.685a8.25 8.25 0 0113.803-3.03L21.03 3.485c.036.002.071.006.106.01L2.985 19.644z" />
                  </svg>
                  <span>Actualizar precios</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-black text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors duration-150"
            >
              Crear Portafolio
            </button>
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mt-4">Portafolios</h2>
      </header>
      {updateMessage && (
        <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 shadow-lg transition-all duration-300 ${
          updateMessage.type === 'success' ? 'bg-green-100 text-green-700 border-b border-green-200' : 'bg-red-100 text-red-700 border-b border-red-200'
        }`}>
          <p className="text-sm font-medium">
            {updateMessage.text}
          </p>
          <button
            onClick={() => setUpdateMessage(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>
      )}
      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {portfolios.length > 0 ? (
              portfolios.map((pf) => (
                <PortfolioCard 
                  key={pf.id} 
                  portfolio={pf} 
                  setCurrentView={setCurrentView} 
                />
              ))
            ) : (
              <div className="col-span-full bg-white rounded-xl shadow-md p-6 text-center text-gray-500">
                <p>Aún no tienes portafolios. ¡Crea uno para empezar!</p>
              </div>
            )}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Crear Nuevo Portafolio</h3>
            
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePortfolio}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    name="name"
                    value={newPortfolioData.name}
                    onChange={(e) => setNewPortfolioData({ ...newPortfolioData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ej: Cartera de Inversión a Largo Plazo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                  <textarea
                    name="description"
                    value={newPortfolioData.description}
                    onChange={(e) => setNewPortfolioData({ ...newPortfolioData, description: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Una breve descripción de esta cartera"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormError('');
                    setNewPortfolioData({ name: '', description: '' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-150"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors duration-150"
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const PortfolioCard = ({ portfolio, setCurrentView }) => {
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('ARS');
  
  const renderRendimiento = () => {
    let rendimientoMonto, rendimientoPorcentaje, currency, isPositive;
    
    if (monedaSeleccionada === 'ARS') {
      rendimientoMonto = portfolio.rendimientoMontoArs;
      rendimientoPorcentaje = portfolio.rendimientoPorcentajeArs;
      currency = 'ARS';
    } else {
      rendimientoMonto = portfolio.rendimientoMontoUsd;
      rendimientoPorcentaje = portfolio.rendimientoPorcentajeUsd;
      currency = 'USD';
    }
    
    isPositive = rendimientoMonto >= 0;

    const formattedMonto = `${rendimientoMonto.toLocaleString('es-AR', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })}`;
    const formattedPorcentaje = `${rendimientoPorcentaje.toFixed(2)}%`;
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
    
    return (
      <p className={`text-lg font-semibold ${colorClass}`}>
        {formattedMonto} ({formattedPorcentaje})
      </p>
    );
  };

  const renderValue = (arsValue, usdValue) => {
    return monedaSeleccionada === 'ARS' ? 
      `$${arsValue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS` :
      `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  };

  return (
    <div key={portfolio.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{portfolio.name}</h3>
          <p className="text-sm text-gray-500">{portfolio.description}</p>
        </div>
        
        <div className="bg-gray-200 rounded-full p-1 flex items-center flex-shrink-0">
          <button
            onClick={() => setMonedaSeleccionada('ARS')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${monedaSeleccionada === 'ARS' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
          >
            ARS
          </button>
          <button
            onClick={() => setMonedaSeleccionada('USD')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${monedaSeleccionada === 'USD' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
          >
            USD
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-500">Valor Actual</p>
          <p className="text-xl font-bold text-gray-800">
            {renderValue(portfolio.valorActualArs, portfolio.valorActualUsd)}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Rendimiento</p>
          {renderRendimiento()}
        </div>

        <div>
          <p className="text-sm text-gray-500">Cantidad de Activos</p>
          <p className="text-lg font-medium text-gray-700">{portfolio.cantidadActivos}</p>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setCurrentView('portfolio-detail', portfolio.id, monedaSeleccionada)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors duration-150"
        >
          Ver detalles del porfolio
        </button>
      </div>
    </div>
  );
};