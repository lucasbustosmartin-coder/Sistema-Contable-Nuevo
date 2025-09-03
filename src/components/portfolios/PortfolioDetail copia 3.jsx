import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import iconImage from '../../assets/icon.png';

export default function PortfolioDetail({ portfolioId, user, setCurrentView }) {
  const [portfolio, setPortfolio] = useState(null);
  const [activos, setActivos] = useState([]);
  const [transacciones, setTransacciones] = useState([]);
  const [tiposCambio, setTiposCambio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSubView, setCurrentSubView] = useState('resumen');
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [newTransaction, setNewTransaction] = useState({
    activo_id: '',
    tipo_operacion: 'compra',
    cantidad: '',
    precio_unitario: '',
    fecha: new Date().toISOString().split('T')[0],
    moneda: 'ARS',
  });
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('ARS');
  const [monedaSeleccionadaTransacciones, setMonedaSeleccionadaTransacciones] = useState('ARS');

  useEffect(() => {
    if (user && portfolioId) {
      fetchPortfolioDetails();
      fetchActivos();
      fetchTiposCambio();
    }
  }, [user, portfolioId]);

  const fetchPortfolioDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', portfolioId)
        .eq('user_id', user.id)
        .single();

      if (portfolioError) {
        throw portfolioError;
      }
      
      if (!portfolioData) {
        throw new Error('No se encontró el portafolio.');
      }
      
      setPortfolio(portfolioData);

      const { data: transaccionesData, error: transaccionesError } = await supabase
        .from('transacciones')
        .select('*, activos(id, simbolo, nombre, moneda, tipo, ultimo_precio, ultimo_precio_ars)')
        .eq('portafolio_id', portfolioId)
        .order('fecha', { ascending: false });

      if (transaccionesError) {
        throw transaccionesError;
      }

      setTransacciones(Array.isArray(transaccionesData) ? transaccionesData : []);
    } catch (err) {
      console.error('Error fetching portfolio details:', err.message);
      setError(err.message || 'Error al cargar los detalles del portafolio. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivos = async () => {
    try {
      const { data, error } = await supabase
        .from('activos')
        .select('id, nombre, simbolo, tipo, moneda, ultimo_precio, ultimo_precio_ars');
      if (error) throw error;
      setActivos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching activos:', err.message);
    }
  };

  const fetchTiposCambio = async () => {
    try {
      const { data, error } = await supabase
        .from('tipos_cambio')
        .select('fecha, tasa')
        .order('fecha', { ascending: true });
      if (error) throw error;
      setTiposCambio(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching tipos de cambio:', err.message);
    }
  };

  const handleTransactionChange = (e) => {
    const { name, value } = e.target;
    setNewTransaction(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenEditModal = (transaction) => {
    setEditingTransaction(transaction);
    setNewTransaction({
      activo_id: transaction.activo_id,
      tipo_operacion: transaction.tipo_operacion,
      cantidad: transaction.cantidad,
      precio_unitario: transaction.precio_unitario,
      fecha: transaction.fecha,
      moneda: transaction.moneda,
    });
    setShowAddTransactionModal(true);
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    try {
      if (!newTransaction.activo_id || !newTransaction.cantidad || !newTransaction.precio_unitario) {
        alert('Por favor, completa todos los campos obligatorios.');
        return;
      }

      const necesitaTasa = newTransaction.moneda !== 'ARS' || monedaSeleccionadaTransacciones === 'ARS';
      if (necesitaTasa && newTransaction.fecha) {
          const tasaDelDia = getTipoCambioPorFecha(newTransaction.fecha);
          if (tasaDelDia === 0) {
              alert('No se puede guardar la transacción. No hay tipo de cambio cargado para la fecha seleccionada. Por favor, elige otra fecha o carga el tipo de cambio para esa fecha.');
              return;
          }
      }
      
      const transactionData = {
        activo_id: newTransaction.activo_id,
        tipo_operacion: newTransaction.tipo_operacion,
        cantidad: parseFloat(newTransaction.cantidad),
        precio_unitario: parseFloat(newTransaction.precio_unitario),
        fecha: newTransaction.fecha,
        moneda: newTransaction.moneda,
        portafolio_id: portfolioId,
      };

      let error = null;

      if (editingTransaction) {
        const { error: updateError } = await supabase
          .from('transacciones')
          .update(transactionData)
          .eq('id', editingTransaction.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('transacciones')
          .insert([transactionData]);
        error = insertError;
      }

      if (error) throw error;

      setShowAddTransactionModal(false);
      setEditingTransaction(null);
      setNewTransaction({
        activo_id: '',
        tipo_operacion: 'compra',
        cantidad: '',
        precio_unitario: '',
        fecha: new Date().toISOString().split('T')[0],
        moneda: 'ARS',
      });
      fetchPortfolioDetails();
    } catch (err) {
      console.error('Error al guardar la transacción:', err.message);
      alert('Error al guardar la transacción: ' + err.message);
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta transacción?')) return;
    try {
      const { error } = await supabase
        .from('transacciones')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;
      fetchPortfolioDetails();
    } catch (err) {
      console.error('Error deleting transaction:', err.message);
      alert('Error al eliminar la transacción.');
    }
  };

  const handleViewChange = (view) => {
    setCurrentSubView(view);
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

  const calculatePortfolioMetrics = () => {
    const transactions = Array.isArray(transacciones) ? transacciones : [];
    const holdings = {};

    transactions.forEach(t => {
      const activoId = t.activo_id;
      if (!holdings[activoId]) {
        holdings[activoId] = {
          cantidad: 0,
          costo_total_ars: 0,
          costo_total_usd: 0,
          activoInfo: t.activos
        };
      }
      
      const cantidad = t.cantidad;
      const precioUnitario = t.precio_unitario;
      const montoTransaccion = cantidad * precioUnitario;
      const esBono = t.activos?.tipo?.toLowerCase() === 'bono';
      
      const costoArs = convertToSelectedCurrency(montoTransaccion, t.moneda, 'ARS', t.fecha);
      const costoUsd = convertToSelectedCurrency(montoTransaccion, t.moneda, 'USD', t.fecha);
      
      if (t.tipo_operacion === 'compra') {
        holdings[activoId].cantidad += cantidad;
        holdings[activoId].costo_total_ars += esBono ? costoArs / 100 : costoArs;
        holdings[activoId].costo_total_usd += esBono ? costoUsd / 100 : costoUsd;
      } else if (t.tipo_operacion === 'venta') {
        holdings[activoId].cantidad -= cantidad;
      }
    });

    let valorActualArs = 0;
    let valorActualUsd = 0;
    let costoTotalArs = 0;
    let costoTotalUsd = 0;

    for (const activoId in holdings) {
      const holding = holdings[activoId];
      const activoInfo = holding.activoInfo;
      
      const esBono = activoInfo?.tipo?.toLowerCase() === 'bono';

      const valorArs = holding.cantidad * (esBono ? activoInfo.ultimo_precio_ars / 100 : activoInfo.ultimo_precio_ars);
      const valorUsd = holding.cantidad * (esBono ? activoInfo.ultimo_precio / 100 : activoInfo.ultimo_precio);

      valorActualArs += valorArs;
      valorActualUsd += valorUsd;

      costoTotalArs += holding.costo_total_ars;
      costoTotalUsd += holding.costo_total_usd;
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
      holdings: holdings
    };
  };

  const getTransactionCost = (transaction, monedaDisplay) => {
    const esBono = transaction.activos?.tipo?.toLowerCase() === 'bono';
    let monto = transaction.cantidad * transaction.precio_unitario;
    
    if (esBono) {
      monto = monto / 100;
    }
    
    return convertToSelectedCurrency(monto, transaction.moneda, monedaDisplay, transaction.fecha);
  };

  const getTransactionPrice = (transaction, monedaDisplay) => {
    const esBono = transaction.activos?.tipo?.toLowerCase() === 'bono';
    let precio = transaction.precio_unitario;

    if (esBono) {
      precio = precio / 100;
    }

    return convertToSelectedCurrency(precio, transaction.moneda, monedaDisplay, transaction.fecha);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const metrics = calculatePortfolioMetrics();

  if (loading) {
    return (
      <>
        <header className="bg-white shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mt-4">Detalle del Portafolio</h2>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        </main>
      </>
    );
  }

  if (error || !portfolio) {
    return (
      <>
        <header className="bg-white shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mt-4">Detalle del Portafolio</h2>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md shadow-sm">
            <p className="font-semibold mb-1">Error al cargar el portafolio</p>
            <p className="text-sm">Detalles: <span className="font-mono text-red-800">{error?.message || error || 'No se encontró el portafolio.'}</span></p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="bg-white shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mt-4">
          {portfolio.name} <span className="text-lg text-gray-500">({portfolio.description})</span>
        </h2>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-start items-center mb-6 sticky top-0 bg-white z-20">
          <div className="flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => handleViewChange('resumen')}
              className={`py-2 px-4 font-medium transition-colors duration-200 ${currentSubView === 'resumen' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Resumen
            </button>
            <button
              onClick={() => handleViewChange('tenencia')}
              className={`py-2 px-4 font-medium transition-colors duration-200 ${currentSubView === 'tenencia' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Tenencia
            </button>
            <button
              onClick={() => handleViewChange('transacciones')}
              className={`py-2 px-4 font-medium transition-colors duration-200 ${currentSubView === 'transacciones' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Transacciones
            </button>
          </div>
        </div>

        {currentSubView === 'resumen' && (
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Resumen del Portafolio</h3>
              <div className="bg-gray-200 rounded-full p-1 flex items-center">
                <button
                  onClick={() => setMonedaSeleccionada('ARS')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${monedaSeleccionada === 'ARS' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                >
                  ARS
                </button>
                <button
                  onClick={() => setMonedaSeleccionada('USD')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${monedaSeleccionada === 'USD' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                >
                  USD
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Valor Actual</p>
                <p className="text-xl font-bold text-gray-800">
                  {monedaSeleccionada === 'ARS'
                    ? `$${metrics.valorActualArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${metrics.valorActualUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Costo Total</p>
                <p className="text-xl font-bold text-gray-800">
                  {monedaSeleccionada === 'ARS'
                    ? `$${metrics.costoTotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${metrics.costoTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Rendimiento</p>
                <p className={`text-xl font-bold ${monedaSeleccionada === 'ARS' ? (metrics.rendimientoMontoArs >= 0 ? 'text-green-600' : 'text-red-600') : (metrics.rendimientoMontoUsd >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                  {monedaSeleccionada === 'ARS'
                    ? `$${metrics.rendimientoMontoArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${metrics.rendimientoMontoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
                <p className={`text-sm font-medium ${monedaSeleccionada === 'ARS' ? (metrics.rendimientoMontoArs >= 0 ? 'text-green-600' : 'text-red-600') : (metrics.rendimientoMontoUsd >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                  {monedaSeleccionada === 'ARS' ? `${metrics.rendimientoPorcentajeArs.toFixed(2)}%` : `${metrics.rendimientoPorcentajeUsd.toFixed(2)}%`}
                </p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mt-8 mb-4">Desempeño por Activo</h3>
            <div className="overflow-y-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-30">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Actual</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rendimiento</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.values(metrics.holdings).map((holding, index) => {
                    const costo = monedaSeleccionada === 'ARS' ? holding.costo_total_ars : holding.costo_total_usd;
                    const cantidad = holding.cantidad;
                    const activoInfo = holding.activoInfo;
                    
                    const esBono = activoInfo?.tipo?.toLowerCase() === 'bono';
                    const valor = monedaSeleccionada === 'ARS'
                      ? holding.cantidad * (esBono ? activoInfo.ultimo_precio_ars / 100 : activoInfo.ultimo_precio_ars)
                      : holding.cantidad * (esBono ? activoInfo.ultimo_precio / 100 : activoInfo.ultimo_precio);
                    
                    const rendimientoMonto = valor - costo;
                    const rendimientoPorcentaje = costo > 0 ? (rendimientoMonto / costo) * 100 : 0;

                    if (holding.cantidad === 0) return null;

                    return (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                          {holding.activoInfo.nombre} ({holding.activoInfo.simbolo})
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {holding.cantidad.toLocaleString('es-AR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">
                          {costo.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">
                          {valor.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${rendimientoMonto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {rendimientoMonto.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
                          <p className="text-xs font-medium">{rendimientoPorcentaje.toFixed(2)}%</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentSubView === 'tenencia' && (
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Detalle de Tenencia</h3>
              <div className="bg-gray-200 rounded-full p-1 flex items-center">
                <button
                  onClick={() => setMonedaSeleccionada('ARS')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${monedaSeleccionada === 'ARS' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                >
                  ARS
                </button>
                <button
                  onClick={() => setMonedaSeleccionada('USD')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${monedaSeleccionada === 'USD' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                >
                  USD
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto max-h-[500px]">
              {Object.values(metrics.holdings).map((holding) => {
                if (holding.cantidad <= 0) return null;

                const activoInfo = holding.activoInfo;
                const compras = transacciones
                  .filter(t => t.activo_id === activoInfo.id && t.tipo_operacion === 'compra')
                  .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                
                if (compras.length === 0) return null;

                const costoTotalHolding = monedaSeleccionada === 'ARS' ? holding.costo_total_ars : holding.costo_total_usd;
                const esBono = activoInfo?.tipo?.toLowerCase() === 'bono';
                const valorActualHolding = monedaSeleccionada === 'ARS'
                  ? holding.cantidad * (esBono ? activoInfo.ultimo_precio_ars / 100 : activoInfo.ultimo_precio_ars)
                  : holding.cantidad * (esBono ? activoInfo.ultimo_precio / 100 : activoInfo.ultimo_precio);
                const rendimientoMontoHolding = valorActualHolding - costoTotalHolding;
                const rendimientoPorcentajeHolding = costoTotalHolding > 0 ? (rendimientoMontoHolding / costoTotalHolding) * 100 : 0;


                return (
                  <div key={activoInfo.id} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-md font-semibold text-gray-800">{activoInfo.nombre} ({activoInfo.simbolo})</h4>
                      <p className="text-sm text-gray-600">Cantidad Total: {holding.cantidad.toLocaleString('es-AR')}</p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-sm text-gray-500">Costo Total</p>
                        <p className="text-lg font-bold text-gray-800">
                           {costoTotalHolding.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-sm text-gray-500">Valor Actual</p>
                        <p className="text-lg font-bold text-gray-800">
                          {valorActualHolding.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-sm text-gray-500">Rendimiento</p>
                        <p className={`text-lg font-bold ${rendimientoMontoHolding >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {rendimientoMontoHolding.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
                        </p>
                        <p className={`text-xs font-medium ${rendimientoMontoHolding >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {rendimientoPorcentajeHolding.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Detalle de Compras:</h5>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nominales</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unitario ({monedaSeleccionada})</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Total ({monedaSeleccionada})</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Actual</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rendimiento</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {compras.map(t => {
                          const costoTransaccion = getTransactionCost(t, monedaSeleccionada);
                          const esBonoTransaccion = t.activos?.tipo?.toLowerCase() === 'bono';
                          const ultimoPrecio = monedaSeleccionada === 'ARS' ? t.activos.ultimo_precio_ars : t.activos.ultimo_precio;
                          const valorActualTransaccion = t.cantidad * (esBonoTransaccion ? ultimoPrecio / 100 : ultimoPrecio);
                          const rendimientoMontoTransaccion = valorActualTransaccion - costoTransaccion;
                          const rendimientoPorcentajeTransaccion = costoTransaccion > 0 ? (rendimientoMontoTransaccion / costoTransaccion) * 100 : 0;

                          return (
                            <tr key={t.id}>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{formatDate(t.fecha)}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{t.cantidad.toLocaleString('es-AR')}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-right">
                                {getTransactionPrice(t, monedaSeleccionada).toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-right">
                                {costoTransaccion.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-right">
                                {valorActualTransaccion.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
                              </td>
                              <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold text-right ${rendimientoMontoTransaccion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {rendimientoMontoTransaccion.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
                                <p className="text-xs font-medium">{rendimientoPorcentajeTransaccion.toFixed(2)}%</p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {currentSubView === 'transacciones' && (
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Transacciones</h3>
              <div className="flex items-center space-x-3">
                <div className="bg-gray-200 rounded-full p-1 flex items-center">
                  <button
                    onClick={() => setMonedaSeleccionadaTransacciones('ARS')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${monedaSeleccionadaTransacciones === 'ARS' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                  >
                    ARS
                  </button>
                  <button
                    onClick={() => setMonedaSeleccionadaTransacciones('USD')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${monedaSeleccionadaTransacciones === 'USD' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                  >
                    USD
                  </button>
                </div>
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setNewTransaction({
                      activo_id: '',
                      tipo_operacion: 'compra',
                      cantidad: '',
                      precio_unitario: '',
                      fecha: new Date().toISOString().split('T')[0],
                      moneda: 'ARS',
                    });
                    setShowAddTransactionModal(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  + Añadir Transacción
                </button>
              </div>
            </div>

            {transacciones.length > 0 ? (
              <div className="overflow-y-auto max-h-[500px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-30">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nominales</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moneda de Origen</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo de Cambio</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unitario ({monedaSeleccionadaTransacciones})</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Total ({monedaSeleccionadaTransacciones})</th>
                      <th className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transacciones.map(t => (
                      <tr key={t.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{formatDate(t.fecha)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{t.activos.nombre} ({t.activos.simbolo})</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{t.tipo_operacion}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">
                          {t.cantidad.toLocaleString('es-AR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{t.moneda}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">
                          {getTipoCambioPorFecha(t.fecha) > 0 ? getTipoCambioPorFecha(t.fecha).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">
                          {getTransactionPrice(t, monedaSeleccionadaTransacciones).toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionadaTransacciones })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">
                          {getTransactionCost(t, monedaSeleccionadaTransacciones).toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionadaTransacciones })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => handleOpenEditModal(t)} className="text-indigo-600 hover:text-indigo-900 mr-4">Editar</button>
                          <button onClick={() => handleDeleteTransaction(t.id)} className="text-red-600 hover:text-red-900">Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500">Aún no hay transacciones para este portafolio.</p>
            )}
          </div>
        )}
      </main>

      {showAddTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">{editingTransaction ? 'Editar Transacción' : 'Añadir Nueva Transacción'}</h3>
            <form onSubmit={handleSaveTransaction}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activo</label>
                  <select
                    name="activo_id"
                    value={newTransaction.activo_id}
                    onChange={handleTransactionChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecciona un activo</option>
                    {activos.map(activo => (
                      <option key={activo.id} value={activo.id}>
                        {activo.nombre} ({activo.simbolo})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Operación</label>
                  <select
                    name="tipo_operacion"
                    value={newTransaction.tipo_operacion}
                    onChange={handleTransactionChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="compra">Compra</option>
                    <option value="venta">Venta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    name="cantidad"
                    value={newTransaction.cantidad}
                    onChange={handleTransactionChange}
                    placeholder="Ej: 100"
                    step="any"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Unitario</label>
                  <input
                    type="number"
                    name="precio_unitario"
                    value={newTransaction.precio_unitario}
                    onChange={handleTransactionChange}
                    placeholder="Ej: 15000"
                    step="0.01"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    name="fecha"
                    value={newTransaction.fecha}
                    onChange={handleTransactionChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                  <select
                    name="moneda"
                    value={newTransaction.moneda}
                    onChange={handleTransactionChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTransactionModal(false);
                    setEditingTransaction(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  {editingTransaction ? 'Guardar Cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}