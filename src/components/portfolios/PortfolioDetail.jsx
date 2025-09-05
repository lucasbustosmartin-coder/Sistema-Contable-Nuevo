import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import iconImage from '../../assets/icon.png';
// Quitar la importación de 'react-export-table-to-excel'

// ✅ NUEVO: Importación del componente de la gráfica
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function PortfolioDetail({ portfolioId, user, setCurrentView, selectedCurrency }) {
  const [portfolio, setPortfolio] = useState(null);
  const [portfolios, setPortfolios] = useState([]); // ✅ NUEVO: Estado para guardar la lista de todas las carteras
  const [transacciones, setTransacciones] = useState([]);
  const [tiposCambio, setTiposCambio] = useState([]);
  const [brokers, setBrokers] = useState([]);
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
    broker_id: '',
  });
  const [monedaSeleccionada, setMonedaSeleccionada] = useState(selectedCurrency || 'ARS');
  const [monedaSeleccionadaTransacciones, setMonedaSeleccionadaTransacciones] = useState(selectedCurrency || 'ARS');

  const [isXLSXLoaded, setIsXLSXLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'descending' });
  const [sortResumenConfig, setSortResumenConfig] = useState({ key: null, direction: 'ascending' });
  
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [showDeleteBrokerModal, setShowDeleteBrokerModal] = useState(false);
  const [brokerToDelete, setBrokerToDelete] = useState(null);
  const [editingBroker, setEditingBroker] = useState(null);
  const [brokerFormData, setBrokerFormData] = useState({ nombre: '', descripcion: '', cuenta_comitente: '' });
  const [brokerFormError, setBrokerFormError] = useState('');
  
  const [brokerFilter, setBrokerFilter] = useState('todos');
  
  const [cantidadDisponible, setCantidadDisponible] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState(null);
  
  const [currentPortfolioId, setCurrentPortfolioId] = useState(portfolioId); // ✅ NUEVO: Estado para la ID de la cartera actual
  const [activos, setActivos] = useState([]); // ✅ CORREGIDO: Declaración del estado 'activos'
  
  // ✅ NUEVO: Estado para el valor del dólar MEP y su variación
  const [dolarMep, setDolarMep] = useState({
    valor: null,
    variacion: null,
    porcentaje: null,
    tendencia: null,
  });

  // ✅ NUEVO: Estado para controlar la visibilidad de la gráfica
  const [showChart, setShowChart] = useState(false);
  // ✅ NUEVO: Estado para controlar la visibilidad de la gráfica por submarket
  const [showSubmarketChart, setShowSubmarketChart] = useState(false);


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

  // ✅ MODIFICADO: Ahora depende de `currentPortfolioId`
  useEffect(() => {
    if (user && currentPortfolioId) {
      fetchPortfolioDetails();
      fetchActivos();
      fetchTiposCambio();
      fetchBrokers();
    }
  }, [user, currentPortfolioId]);
  
  useEffect(() => {
    if (user) {
      fetchAllPortfolios(); // ✅ NUEVO: Cargar todas las carteras al inicio
      fetchMepPrice(); // ✅ NUEVO: Cargar el precio del MEP al inicio
    }
  }, [user]);

  useEffect(() => {
    setMonedaSeleccionada(selectedCurrency);
    setMonedaSeleccionadaTransacciones(selectedCurrency);
  }, [selectedCurrency]);
  
  // ✅ NUEVO: Función para obtener el precio del dólar MEP y calcular la variación
  const fetchMepPrice = async () => {
    try {
      const { data, error } = await supabase
        .from('tipos_cambio')
        .select('fecha, tasa')
        .order('fecha', { ascending: false }) // Obtener los últimos 2 registros
        .limit(2);

      if (error) throw error;
      
      if (data && data.length >= 2) {
        const hoy = data[0].tasa;
        const ayer = data[1].tasa;
        const variacion = hoy - ayer;
        const porcentaje = (variacion / ayer) * 100;

        setDolarMep({
          valor: hoy,
          variacion: variacion,
          porcentaje: porcentaje,
          tendencia: variacion >= 0 ? 'subida' : 'bajada',
        });
      } else {
        console.warn('No hay suficientes datos para calcular la variación del dólar MEP.');
        setDolarMep({
          valor: null,
          variacion: null,
          porcentaje: null,
          tendencia: null,
        });
      }
    } catch (err) {
      console.error('Error fetching MEP price:', err.message);
      setDolarMep({
        valor: null,
        variacion: null,
        porcentaje: null,
        tendencia: null,
      });
    }
  };

  // ✅ NUEVO: Función para obtener todas las carteras del usuario
  const fetchAllPortfolios = async () => {
    try {
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      setPortfolios(data || []);
    } catch (err) {
      console.error('Error fetching all portfolios:', err.message);
    }
  };
  
  // ✅ MODIFICADO: Usa `currentPortfolioId` en lugar de `portfolioId`
  const handleFullUpdate = async () => {
    setIsUpdating(true);
    try {
      setUpdateMessage({ type: 'info', text: 'Iniciando actualización completa...' });

      setUpdateMessage({ type: 'info', text: 'Actualizando la información del tipo de cambio Mep...' });
      const { error: tcError } = await supabase.functions.invoke('actualizar-tipo-cambio', {
        body: { user_id: user.id },
      });
      if (tcError) throw tcError;
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setUpdateMessage({ type: 'info', text: 'Actualizando valores contables y el precios de los activos en cartera...' });
      
      const { data: tipos, error: reFetchTcError } = await supabase
        .from('tipos_cambio')
        .select('fecha, tasa')
        .eq('usuario_id', user.id);
      if (reFetchTcError) throw reFetchTcError;
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

      await supabase.functions.invoke('actualizar-precios-docta', {
        body: { user_id: user.id },
      });
      
      setUpdateMessage({ type: 'success', text: '¡Actualización completa! Los precios han sido sincronizados.' });

    } catch (err) {
      console.error('Error en la actualización completa:', err);
      setUpdateMessage({ type: 'error', text: err.message || 'Error en la actualización. Por favor, intenta de nuevo.' });
    } finally {
      fetchPortfolioDetails();
      fetchTiposCambio();
      fetchMepPrice(); // ✅ NUEVO: Volver a buscar el precio del MEP después de la actualización
      setIsUpdating(false);
      setTimeout(() => setUpdateMessage(null), 5000);
    }
  };

  const fetchPortfolioDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', currentPortfolioId)
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
        .select('*, activos(id, simbolo, nombre, moneda, tipo, ultimo_precio, ultimo_precio_ars, submarket), brokers(nombre, cuenta_comitente)')
        .eq('portafolio_id', currentPortfolioId);

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
        .select('id, nombre, simbolo, tipo, moneda, ultimo_precio, ultimo_precio_ars')
        .order('simbolo', { ascending: true }); // ✅ MODIFICADO: ordenar por símbolo
      if (error) throw error;
      setActivos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching activos:', err.message);
    }
  };
  
  const fetchBrokers = async () => {
    try {
      const { data, error } = await supabase
        .from('brokers')
        .select('id, nombre, descripcion, cuenta_comitente')
        .eq('user_id', user.id)
        .order('nombre', { ascending: true });
        
      if (error) throw error;
      setBrokers(data || []);
    } catch (err) {
      console.error('Error fetching brokers:', err.message);
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
  
  const handleOpenNewTransactionModal = (tipoOperacion) => {
    setEditingTransaction(null);
    setNewTransaction({
      activo_id: '',
      tipo_operacion: tipoOperacion,
      cantidad: '',
      precio_unitario: '',
      fecha: new Date().toISOString().split('T')[0],
      moneda: 'ARS',
      broker_id: '',
    });
    setCantidadDisponible(0);
    setShowAddTransactionModal(true);
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
      broker_id: transaction.broker_id || '',
    });
    const currentHoldings = calculatePortfolioMetrics(transacciones, brokerFilter).holdings;
    const disponible = currentHoldings[transaction.activo_id]?.brokers[transaction.broker_id]?.cantidad || 0;
    setCantidadDisponible(disponible);
    setShowAddTransactionModal(true);
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    try {
      if (!newTransaction.activo_id || !newTransaction.cantidad || !newTransaction.precio_unitario || !newTransaction.broker_id) {
        alert('Por favor, completa todos los campos obligatorios, incluyendo el bróker.');
        return;
      }
      
      if (newTransaction.tipo_operacion === 'venta') {
        const currentHoldings = calculatePortfolioMetrics(transacciones, brokerFilter).holdings;
        const holdingPorBroker = currentHoldings[newTransaction.activo_id]?.brokers[newTransaction.broker_id]?.cantidad || 0;
        
        if (parseFloat(newTransaction.cantidad) > holdingPorBroker) {
          alert('No puedes vender una cantidad mayor a la que posees en este bróker.');
          return;
        }
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
        portafolio_id: currentPortfolioId, // ✅ MODIFICADO: Usa `currentPortfolioId`
        broker_id: newTransaction.broker_id,
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
        broker_id: '',
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
  
  // ✅ CORREGIDO: Lógica de cálculo con FIFO
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

    for (const activoId in holdings) {
      const holding = holdings[activoId];
      valorActualArs += holding.valor_actual_ars;
      valorActualUsd += holding.valor_actual_usd;
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
  
  const getBrokerNameById = (brokerId) => {
    const broker = brokers.find(b => b.id === brokerId);
    return broker ? broker.nombre : 'N/A';
  };
  
  // ✅ MODIFICADO: Se declara metrics una sola vez
  const metrics = calculatePortfolioMetrics(transacciones, brokerFilter);

  const handleExportTenencias = async () => {
    if (!isXLSXLoaded) {
      alert('La librería de exportación a Excel aún no ha cargado.');
      return;
    }

    const allCompras = transacciones.filter(t => t.tipo_operacion === 'compra')
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (allCompras.length === 0) {
      alert('No hay transacciones de compra para exportar.');
      return;
    }

    setIsExporting(true);

    try {
      // ✅ MODIFICADO: Añadir nuevos encabezados para precio de compra y precio actual
      const headers = [
        'Activo',
        'Bróker',
        'Fecha',
        'Nominales',
        `Precio de Compra (${monedaSeleccionada})`,
        `Precio Actual (${monedaSeleccionada})`,
        `Costo Total (${monedaSeleccionada})`,
        `Valor Actual Total (${monedaSeleccionada})`,
        `Rendimiento (${monedaSeleccionada})`,
        `Rendimiento (%)`
      ];

      const dataToExport = allCompras.map(t => {
        const costoTransaccion = getTransactionCost(t, monedaSeleccionada);
        const esBonoTransaccion = t.activos?.tipo?.toLowerCase() === 'bono';
        const ultimoPrecio = monedaSeleccionada === 'ARS' ? t.activos.ultimo_precio_ars : t.activos.ultimo_precio;
        const valorActualTransaccion = (esBonoTransaccion ? ultimoPrecio / 100 : ultimoPrecio) * t.cantidad;
        
        const rendimientoMontoTransaccion = valorActualTransaccion - costoTransaccion;
        const rendimientoPorcentajeTransaccion = costoTransaccion > 0 ? (valorActualTransaccion / costoTransaccion - 1) : 0;
        
        const precioUnitario = getTransactionPrice(t, monedaSeleccionada);
        // ✅ NUEVO: Lógica para calcular el precio actual unitario
        const precioActualUnitario = (esBonoTransaccion ? ultimoPrecio / 100 : ultimoPrecio);

        // ✅ MODIFICADO: Se agrega el precio de compra y el precio actual
        return [
          { v: `${t.activos.nombre} (${t.activos.simbolo})`, t: 's' },
          { v: getBrokerNameById(t.broker_id), t: 's' },
          { v: formatDate(t.fecha), t: 's' },
          { v: parseFloat(t.cantidad), t: 'n' },
          // ✅ NUEVO: Agregar precio de compra con formato condicional
          { v: parseFloat(precioUnitario), t: 'n', z: monedaSeleccionada === 'USD' ? '#,##0.0000' : '#,##0.00' },
          // ✅ NUEVO: Agregar precio actual con formato condicional
          { v: parseFloat(precioActualUnitario), t: 'n', z: monedaSeleccionada === 'USD' ? '#,##0.0000' : '#,##0.00' },
          { v: parseFloat(costoTransaccion), t: 'n', z: '#,##0.00' },
          { v: parseFloat(valorActualTransaccion), t: 'n', z: '#,##0.00' },
          { v: parseFloat(rendimientoMontoTransaccion), t: 'n', z: '#,##0.00' },
          { v: parseFloat(rendimientoPorcentajeTransaccion), t: 'n' }
        ];
      });

      const ws = window.XLSX.utils.aoa_to_sheet([]);
      window.XLSX.utils.sheet_add_aoa(ws, [headers]);
      window.XLSX.utils.sheet_add_aoa(ws, dataToExport, { origin: 'A2' });

      // ✅ MODIFICADO: Se ajustan los anchos de columna para los nuevos campos
      ws['!cols'] = [
        { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, 
        { wch: 25 }, { wch: 25 }, 
        { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
      ];

      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Detalle de Compras");
      
      const filename = `Detalle_Tenencia_${portfolio.name.replace(/\s/g, '_')}.xlsx`;
      window.XLSX.writeFile(wb, filename);

    } catch (err) {
      console.error("Error al exportar a Excel:", err);
      alert("Error al exportar a Excel. Inténtalo de nuevo.");
    } finally {
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsExporting(false);
    }
  };

  const handleExportTransacciones = async () => {
    if (!isXLSXLoaded) {
      alert('La librería de exportación a Excel aún no ha cargado.');
      return;
    }

    if (transacciones.length === 0) {
      alert('No hay transacciones para exportar.');
      return;
    }

    setIsExporting(true);

    try {
      const headers = [
        'Activo',
        'Bróker',
        'Fecha',
        'Tipo',
        'Nominales',
        'Moneda de Origen',
        'Tipo de Cambio',
        `Precio Unitario (${monedaSeleccionadaTransacciones})`,
        `Costo Total (${monedaSeleccionadaTransacciones})`,
      ];

      const dataToExport = transactionsToDisplay.map(t => {
        const precioUnitario = getTransactionPrice(t, monedaSeleccionadaTransacciones);
        const costoTransaccion = getTransactionCost(t, monedaSeleccionadaTransacciones);
        
        return [
          { v: `${t.activos.nombre} (${t.activos.simbolo})`, t: 's' },
          { v: t.brokers?.nombre || '-', t: 's' },
          { v: formatDate(t.fecha), t: 's' },
          { v: t.tipo_operacion.toUpperCase(), t: 's' },
          { v: parseFloat(t.cantidad), t: 'n' },
          { v: t.moneda, t: 's' },
          { v: getTipoCambioPorFecha(t.fecha) > 0 ? getTipoCambioPorFecha(t.fecha) : '-', t: 'n' },
          { v: parseFloat(precioUnitario), t: 'n', z: '#,##0.00' },
          { v: parseFloat(costoTransaccion), t: 'n', z: '#,##0.00' },
        ];
      });

      const ws = window.XLSX.utils.aoa_to_sheet([]);
      window.XLSX.utils.sheet_add_aoa(ws, [headers]);
      window.XLSX.utils.sheet_add_aoa(ws, dataToExport, { origin: 'A2' });

      ws['!cols'] = [
        { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
        { wch: 20 }
      ];

      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Detalle de Transacciones");
      
      const filename = `Detalle_Transacciones_${portfolio.name.replace(/\s/g, '_')}.xlsx`;
      window.XLSX.writeFile(wb, filename);

    } catch (err) {
      console.error("Error al exportar a Excel:", err);
      alert("Error al exportar a Excel. Inténtalo de nuevo.");
    } finally {
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsExporting(false);
    }
  };

  const sortedTransactions = [...transacciones].sort((a, b) => {
    const simboloA = a.activos.simbolo.toLowerCase();
    const simboloB = b.activos.simbolo.toLowerCase();
    
    if (simboloA < simboloB) return -1;
    if (simboloA > simboloB) return 1;
    
    const dateA = new Date(a.fecha);
    const dateB = new Date(b.fecha);
    
    return dateB - dateA;
  });

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const requestResumenSort = (key) => {
    let direction = 'ascending';
    if (sortResumenConfig.key === key && sortResumenConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortResumenConfig({ key, direction });
  };

  const sortedTransacciones = () => {
    const sortableItems = [...transacciones];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let valueA, valueB;
        if (sortConfig.key === 'activo') {
          valueA = a.activos.simbolo.toLowerCase();
          valueB = b.activos.simbolo.toLowerCase();
        } else if (sortConfig.key === 'fecha') {
          valueA = new Date(a.fecha);
          valueB = new Date(b.fecha);
        } else if (sortConfig.key === 'tipo_operacion') {
          valueA = a.tipo_operacion.toLowerCase();
          valueB = b.tipo_operacion.toLowerCase();
        } else if (sortConfig.key === 'cantidad') {
          valueA = parseFloat(a.cantidad);
          valueB = parseFloat(b.cantidad);
        } else if (sortConfig.key === 'moneda') {
          valueA = a.moneda.toLowerCase();
          valueB = b.moneda.toLowerCase();
        } else if (sortConfig.key === 'precio_unitario') {
          valueA = getTransactionPrice(a, monedaSeleccionadaTransacciones);
          valueB = getTransactionPrice(b, monedaSeleccionadaTransacciones);
        } else if (sortConfig.key === 'costo_total') {
          valueA = getTransactionCost(a, monedaSeleccionadaTransacciones);
          valueB = getTransactionCost(b, monedaSeleccionadaTransacciones);
        }

        if (valueA < valueB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valueA > valueB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  };
  
  const transactionsToDisplay = sortedTransacciones();

  const sortedResumenHoldings = () => {
    // ✅ MODIFICADO: Se pasa 'transacciones' a la función de cálculo
    const holdings = Object.values(calculatePortfolioMetrics(transacciones, brokerFilter).holdings);
    const sortableItems = holdings.filter(holding => holding.cantidad > 0);
    
    if (sortResumenConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let valueA, valueB;
        
        switch (sortResumenConfig.key) {
          case 'activo':
            valueA = a.activoInfo.simbolo.toLowerCase();
            valueB = b.activoInfo.simbolo.toLowerCase();
            break;
          case 'cantidad':
            valueA = parseFloat(a.cantidad);
            valueB = parseFloat(b.cantidad);
            break;
          case 'costo_total':
            valueA = monedaSeleccionada === 'ARS' ? a.costo_total_ars : a.costo_total_usd;
            valueB = monedaSeleccionada === 'ARS' ? b.costo_total_ars : b.costo_total_usd;
            break;
          case 'valor_actual':
            const esBonoA = a.activoInfo?.tipo?.toLowerCase() === 'bono';
            const esBonoB = b.activoInfo?.tipo?.toLowerCase() === 'bono';
            valueA = monedaSeleccionada === 'ARS' 
              ? (esBonoA ? a.activoInfo.ultimo_precio_ars : a.activoInfo.ultimo_precio_ars) * a.cantidad / (esBonoA ? 100 : 1)
              : (esBonoA ? a.activoInfo.ultimo_precio / 100 : a.activoInfo.ultimo_precio) * a.cantidad;
            valueB = monedaSeleccionada === 'ARS' 
              ? (esBonoB ? b.activoInfo.ultimo_precio_ars : b.activoInfo.ultimo_precio_ars) * b.cantidad / (esBonoB ? 100 : 1)
              : (esBonoB ? b.activoInfo.ultimo_precio / 100 : b.activoInfo.ultimo_precio) * b.cantidad;
            break;
          case 'rendimiento':
            const costoA = monedaSeleccionada === 'ARS' ? a.costo_total_ars : a.costo_total_usd;
            const costoB = monedaSeleccionada === 'ARS' ? b.costo_total_ars : b.costo_total_usd;
            const valorA = monedaSeleccionada === 'ARS' 
              ? (a.activoInfo?.tipo?.toLowerCase() === 'bono' ? a.activoInfo.ultimo_precio_ars : a.activoInfo.ultimo_precio_ars) * a.cantidad / (a.activoInfo?.tipo?.toLowerCase() === 'bono' ? 100 : 1)
              : (a.activoInfo?.tipo?.toLowerCase() === 'bono' ? a.activoInfo.ultimo_precio / 100 : a.activoInfo.ultimo_precio) * a.cantidad;
            const valorB = monedaSeleccionada === 'ARS' 
              ? (b.activoInfo?.tipo?.toLowerCase() === 'bono' ? b.activoInfo.ultimo_precio_ars : b.activoInfo.ultimo_precio_ars) * b.cantidad / (b.activoInfo?.tipo?.toLowerCase() === 'bono' ? 100 : 1)
              : (b.activoInfo?.tipo?.toLowerCase() === 'bono' ? b.activoInfo.ultimo_precio / 100 : b.activoInfo.ultimo_precio) * b.cantidad;
            valueA = valorA - costoA;
            valueB = valorB - costoB;
            break;
          default:
            return 0;
        }

        if (valueA < valueB) {
          return sortResumenConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valueA > valueB) {
          return sortResumenConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  };

  const resumenHoldingsToDisplay = sortedResumenHoldings();
  
  const openBrokerModal = (broker = null) => {
    if (broker) {
      setEditingBroker(broker);
      setBrokerFormData({ nombre: broker.nombre, descripcion: broker.descripcion || '', cuenta_comitente: broker.cuenta_comitente || '' });
    } else {
      setEditingBroker(null);
      setBrokerFormData({ nombre: '', descripcion: '', cuenta_comitente: '' });
    }
    setBrokerFormError('');
    setShowBrokerModal(true);
  };

  const closeBrokerModal = () => {
    setShowBrokerModal(false);
    setEditingBroker(null);
    setBrokerFormData({ nombre: '', descripcion: '', cuenta_comitente: '' });
    setBrokerFormError('');
  };

  const openDeleteBrokerModal = (broker) => {
    setBrokerToDelete(broker);
    setShowDeleteBrokerModal(true);
  };

  const closeDeleteBrokerModal = () => {
    setBrokerToDelete(null);
    setShowDeleteBrokerModal(false);
  };

  const handleBrokerInputChange = (e) => {
    setBrokerFormData({ ...brokerFormData, [e.target.name]: e.target.value });
  };

  const handleBrokerSubmit = async (e) => {
    e.preventDefault();
    
    if (!brokerFormData.nombre) {
      setBrokerFormError('El nombre del bróker es obligatorio.');
      return;
    }

    try {
      let error = null;
      if (editingBroker) {
        const { error: updateError } = await supabase
          .from('brokers')
          .update({ nombre: brokerFormData.nombre, descripcion: brokerFormData.descripcion, cuenta_comitente: brokerFormData.cuenta_comitente })
          .eq('id', editingBroker.id)
          .eq('user_id', user.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('brokers')
          .insert({
            user_id: user.id,
            nombre: brokerFormData.nombre,
            descripcion: brokerFormData.descripcion,
            cuenta_comitente: brokerFormData.cuenta_comitente
          });
        error = insertError;
      }

      if (error) throw error;
      await fetchBrokers();
      closeBrokerModal();
    } catch (err) {
      console.error('Error al guardar:', err.message);
      setBrokerFormError('Error al guardar: ' + err.message);
    }
  };

  const handleDeleteBroker = async () => {
    if (!brokerToDelete) return;
    try {
      const { data: transacciones, error: transaccionesError } = await supabase
        .from('transacciones')
        .select('id')
        .eq('broker_id', brokerToDelete.id);
        
      if (transaccionesError) throw transaccionesError;
      
      if (transacciones.length > 0) {
        alert('No se puede eliminar este bróker porque tiene transacciones asociadas. Elimina las transacciones primero.');
        closeDeleteBrokerModal();
        return;
      }

      const { error: deleteError } = await supabase
        .from('brokers')
        .delete()
        .eq('id', brokerToDelete.id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;
      await fetchBrokers();
      closeDeleteBrokerModal();
    } catch (err) {
      console.error('Error al eliminar:', err.message);
      setError('Error al eliminar: ' + err.message);
      closeDeleteBrokerModal();
    }
  };

  // ✅ NUEVO: Lógica para preparar los datos de la gráfica de distribución por activo
  const chartData = {
    labels: resumenHoldingsToDisplay.map(h => `${h.activoInfo.simbolo} (${h.activoInfo.nombre})`),
    datasets: [
      {
        label: 'Distribución por Activo',
        data: resumenHoldingsToDisplay.map(h => {
            const esBono = h.activoInfo?.tipo?.toLowerCase() === 'bono';
            const valor = monedaSeleccionada === 'ARS'
                ? (esBono ? h.cantidad * h.activoInfo.ultimo_precio_ars / 100 : h.cantidad * h.activoInfo.ultimo_precio_ars)
                : (esBono ? h.cantidad * h.activoInfo.ultimo_precio / 100 : h.cantidad * h.activoInfo.ultimo_precio);
            return valor;
        }),
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED',
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED',
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED',
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED'
        ],
        hoverOffset: 4
      }
    ]
  };

  // ✅ NUEVO: Lógica para preparar los datos de la gráfica por submarket
  const submarketHoldings = resumenHoldingsToDisplay.reduce((acc, holding) => {
    const submarket = holding.activoInfo.submarket || 'Sin submercado';
    const esBono = holding.activoInfo?.tipo?.toLowerCase() === 'bono';
    const valor = monedaSeleccionada === 'ARS'
        ? (esBono ? holding.cantidad * holding.activoInfo.ultimo_precio_ars / 100 : holding.cantidad * holding.activoInfo.ultimo_precio_ars)
        : (esBono ? holding.cantidad * holding.activoInfo.ultimo_precio / 100 : holding.cantidad * holding.activoInfo.ultimo_precio);
    
    if (acc[submarket]) {
      acc[submarket] += valor;
    } else {
      acc[submarket] = valor;
    }
    return acc;
  }, {});

  const submarketChartData = {
    labels: Object.keys(submarketHoldings),
    datasets: [
      {
        label: 'Distribución por Submercado',
        data: Object.values(submarketHoldings),
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED',
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED',
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED',
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED'
        ],
        hoverOffset: 4
      }
    ]
  };

  // ✅ NUEVO: Lógica para mostrar los porcentajes en los tooltips de los gráficos
  const chartOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) + '%' : '0.00%';
            return `${label}: ${value.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })} (${percentage})`;
          }
        }
      }
    }
  };
  
  // ✅ NUEVO: Lógica para mostrar los porcentajes en los tooltips del gráfico de submercado
  const submarketChartOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) + '%' : '0.00%';
            return `${label}: ${value.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })} (${percentage})`;
          }
        }
      }
    }
  };


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
          {dolarMep.valor && (
            <div className="flex items-center space-x-2 py-2 px-4 bg-white rounded-lg shadow-sm border border-gray-200 text-sm font-semibold">
              <span className="text-gray-600">Dólar MEP:</span>
              <span className="text-gray-800">
                ${dolarMep.valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {dolarMep.variacion !== null && (
                <span className={`font-medium flex items-center ${dolarMep.tendencia === 'subida' ? 'text-green-600' : 'text-red-600'}`}>
                  {dolarMep.tendencia === 'subida' ? '▲' : '▼'}
                  {Math.abs(dolarMep.variacion).toFixed(2)} ({dolarMep.porcentaje.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mt-4">
          <label htmlFor="portfolio-selector" className="sr-only">Seleccionar Cartera</label>
          <select
            id="portfolio-selector"
            value={currentPortfolioId}
            onChange={(e) => setCurrentPortfolioId(e.target.value)}
            className="text-2xl font-semibold text-gray-800 bg-white border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {portfolios.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="text-lg text-gray-500 ml-4">
            ({portfolio.description})
          </span>
        </h2>
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
            <button
              onClick={() => handleViewChange('brokers')}
              className={`py-2 px-4 font-medium transition-colors duration-200 ${currentSubView === 'brokers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Brókers
            </button>
          </div>
        </div>

        {currentSubView === 'resumen' && (
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Resumen del Portafolio</h3>
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleFullUpdate}
                  disabled={isUpdating}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                    isUpdating ? 'bg-gray-400 cursor-not-allowed text-gray-200' : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                >
                  {isUpdating ? (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.962l2-2.671z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.03M4.032 9.417l2.687-2.685m-2.687 2.685a8.25 8.25 0 0113.803-3.03L21.03 3.485c.036.002.071.006.106.01L2.985 19.644z" />
                    </svg>
                  )}
                  <span>Actualizar precios</span>
                </button>
                <div className="flex items-center space-x-2">
                  <label htmlFor="broker-filter" className="text-sm font-medium text-gray-600">Ver por Bróker:</label>
                  <select
                    id="broker-filter"
                    value={brokerFilter}
                    onChange={(e) => setBrokerFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="todos">Todos</option>
                    {brokers.map(broker => (
                      <option key={broker.id} value={broker.id}>{broker.nombre}</option>
                    ))}
                  </select>
                </div>
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
            </div>
            
            {/* ✅ NUEVO: Botones para mostrar/ocultar los gráficos */}
            <div className="flex justify-end mb-4 space-x-2">
              <button
                onClick={() => {
                  setShowChart(!showChart);
                  setShowSubmarketChart(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  showChart ? 'bg-indigo-700 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                } flex items-center space-x-2`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM12 2.25v2.25m3.75 3.75h-3.75h3.75z" />
                </svg>
                <span>{showChart ? 'Ocultar por Activo' : 'Ver por Activo'}</span>
              </button>
              <button
                onClick={() => {
                  setShowSubmarketChart(!showSubmarketChart);
                  setShowChart(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  showSubmarketChart ? 'bg-indigo-700 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                } flex items-center space-x-2`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM12 2.25v2.25m3.75 3.75h-3.75h3.75z" />
                </svg>
                <span>{showSubmarketChart ? 'Ocultar por Submercado' : 'Ver por Submercado'}</span>
              </button>
            </div>
            
            {/* ✅ NUEVO: Lógica para mostrar la gráfica por activo */}
            {showChart && resumenHoldingsToDisplay.length > 0 && (
              <div className="bg-gray-50 p-6 rounded-lg shadow-inner mb-6 flex flex-col items-center">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Activo ({monedaSeleccionada})</h4>
                <div className="w-full max-w-lg">
                  <Doughnut data={chartData} options={chartOptions} />
                </div>
              </div>
            )}
            
            {/* ✅ NUEVO: Lógica para mostrar la gráfica por submercado */}
            {showSubmarketChart && resumenHoldingsToDisplay.length > 0 && (
              <div className="bg-gray-50 p-6 rounded-lg shadow-inner mb-6 flex flex-col items-center">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Submercado ({monedaSeleccionada})</h4>
                <div className="w-full max-w-lg">
                  <Doughnut data={submarketChartData} options={submarketChartOptions} />
                </div>
              </div>
            )}
            
            {/* ✅ NUEVO: Mensaje para gráficos sin datos */}
            {(showChart || showSubmarketChart) && resumenHoldingsToDisplay.length === 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.257 3.518A8.96 8.96 0 0112 2.25c3.07 0 5.825 1.488 7.5 3.75a8.96 8.96 0 01-3.75 5.25c-.274-.294-.582-.55-.916-.77A5.992 5.992 0 0012 8.25a5.992 5.992 0 00-4.043 1.455c-.334.22-.642.476-.916.77a8.96 8.96 0 01-3.75-5.25c1.675-2.262 4.43-3.75 7.5-3.75zm1.53 10.96a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zm0 10.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">No hay datos para mostrar</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>Para ver la distribución de tu portafolio, necesitas tener activos con un valor actual mayor a cero.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}


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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestResumenSort('activo')}>
                      Activo
                      {sortResumenConfig.key === 'activo' && (
                        <span className="ml-1">
                          {sortResumenConfig.direction === 'ascending' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestResumenSort('cantidad')}>
                      Cantidad
                      {sortResumenConfig.key === 'cantidad' && (
                        <span className="ml-1">
                          {sortResumenConfig.direction === 'ascending' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestResumenSort('costo_total')}>
                      Costo Total
                      {sortResumenConfig.key === 'costo_total' && (
                        <span className="ml-1">
                          {sortResumenConfig.direction === 'ascending' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestResumenSort('valor_actual')}>
                      Valor Actual
                      {sortResumenConfig.key === 'valor_actual' && (
                        <span className="ml-1">
                          {sortResumenConfig.direction === 'ascending' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestResumenSort('rendimiento')}>
                      Rendimiento
                      {sortResumenConfig.key === 'rendimiento' && (
                        <span className="ml-1">
                          {sortResumenConfig.direction === 'ascending' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {resumenHoldingsToDisplay.map((holding, index) => {
                    const costo = monedaSeleccionada === 'ARS' ? holding.costo_total_ars : holding.costo_total_usd;
                    const cantidad = holding.cantidad;
                    const activoInfo = holding.activoInfo;
                    
                    const esBono = activoInfo?.tipo?.toLowerCase() === 'bono';
                    const valorArs = (esBono ? holding.cantidad * activoInfo.ultimo_precio_ars / 100 : holding.cantidad * activoInfo.ultimo_precio_ars);
                    const valorUsd = (esBono ? holding.cantidad * activoInfo.ultimo_precio / 100 : holding.cantidad * activoInfo.ultimo_precio);
                    const valorCalculado = monedaSeleccionada === 'ARS' ? valorArs : valorUsd;
                    
                    const rendimientoMonto = valorCalculado - costo;
                    const rendimientoPorcentaje = costo > 0 ? (valorCalculado / costo - 1) * 100 : 0;

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
                          {valorCalculado.toLocaleString('es-AR', { style: 'currency', currency: monedaSeleccionada })}
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
              <div className="flex items-center space-x-3">
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
                <button
                  onClick={handleExportTenencias}
                  disabled={isExporting || !isXLSXLoaded || transacciones.length === 0}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                    isExporting || !isXLSXLoaded || transacciones.length === 0
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.962l2-2.671z"></path>
                      </svg>
                      <span>Generando Excel...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      <span>Exportar a Excel</span>
                    </>
                  )}
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
                  ? (esBono ? activoInfo.ultimo_precio_ars : activoInfo.ultimo_precio_ars) * holding.cantidad / (esBono ? 100 : 1)
                  : (esBono ? activoInfo.ultimo_precio / 100 : activoInfo.ultimo_precio) * holding.cantidad;
                const rendimientoMontoHolding = valorActualHolding - costoTotalHolding;
                const rendimientoPorcentajeHolding = costoTotalHolding > 0 ? (valorActualHolding / costoTotalHolding - 1) * 100 : 0;


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
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0">
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
                          const valorActualTransaccion = (esBonoTransaccion ? ultimoPrecio / 100 : ultimoPrecio) * t.cantidad;
                          const rendimientoMontoTransaccion = valorActualTransaccion - costoTransaccion;
                          const rendimientoPorcentajeTransaccion = costoTransaccion > 0 ? (valorActualTransaccion / costoTransaccion - 1) * 100 : 0;

                          return (
                            <tr key={t.id}>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{formatDate(t.fecha)}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{t.cantidad.toLocaleString('es-AR')}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-right">
                                {monedaSeleccionada === 'USD'
                                  ? `$${getTransactionPrice(t, monedaSeleccionada).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
                                  : `$${getTransactionPrice(t, monedaSeleccionada).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                  onClick={handleExportTransacciones}
                  disabled={isExporting || !isXLSXLoaded || transacciones.length === 0}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                    isExporting || !isXLSXLoaded || transacciones.length === 0
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.962l2-2.671z"></path>
                      </svg>
                      <span>Generando Excel...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      <span>Exportar a Excel</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleOpenNewTransactionModal('compra')}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  + Añadir Compra
                </button>
                <button
                  onClick={() => handleOpenNewTransactionModal('venta')}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  + Añadir Venta
                </button>
              </div>
            </div>

            {transacciones.length > 0 ? (
              <div className="overflow-y-auto max-h-[500px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-30">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('activo')}>
                        Activo
                        {sortConfig.key === 'activo' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bróker</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('fecha')}>
                        Fecha
                        {sortConfig.key === 'fecha' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('tipo_operacion')}>
                        Tipo
                        {sortConfig.key === 'tipo_operacion' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('cantidad')}>
                        Nominales
                        {sortConfig.key === 'cantidad' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('moneda')}>
                        Moneda de Origen
                        {sortConfig.key === 'moneda' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo de Cambio</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('precio_unitario')}>
                        Precio Unitario ({monedaSeleccionadaTransacciones})
                        {sortConfig.key === 'precio_unitario' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('costo_total')}>
                        Costo Total ({monedaSeleccionadaTransacciones})
                        {sortConfig.key === 'costo_total' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactionsToDisplay.map(t => (
                      <tr key={t.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{t.activos.nombre} ({t.activos.simbolo})</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{t.brokers?.nombre || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{formatDate(t.fecha)}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${t.tipo_operacion === 'compra' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.tipo_operacion.toUpperCase()}
                        </td>
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
        
        {currentSubView === 'brokers' && (
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Registros de Brókers</h3>
              <button 
                onClick={() => openBrokerModal()}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Nuevo Bróker</span>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cuenta Comitente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {brokers.length > 0 ? (
                    brokers.map(broker => (
                      <tr key={broker.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{broker.nombre}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{broker.cuenta_comitente}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{broker.descripcion}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => openBrokerModal(broker)}
                            className="text-indigo-600 hover:text-indigo-800 mr-4 transition-colors duration-150"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => openDeleteBrokerModal(broker)}
                            className="text-red-600 hover:text-red-800 transition-colors duration-150"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                        No hay brókers registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal para Añadir/Editar Transacción */}
      {showAddTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              {editingTransaction ? 'Editar Transacción' : (newTransaction.tipo_operacion === 'compra' ? 'Añadir Nueva Compra' : 'Añadir Nueva Venta')}
            </h3>
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
                        {activo.simbolo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bróker</label>
                  <select
                    name="broker_id"
                    value={newTransaction.broker_id}
                    onChange={handleTransactionChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecciona un bróker</option>
                    {brokers.map(broker => (
                      <option key={broker.id} value={broker.id}>
                        {broker.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">Cantidad</label>
                    {newTransaction.tipo_operacion === 'venta' && newTransaction.activo_id && newTransaction.broker_id && (
                      <span className="text-xs text-gray-500">Disponible: {cantidadDisponible.toLocaleString('es-AR')}</span>
                    )}
                  </div>
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
      
      {/* Modal para Añadir/Editar Bróker */}
      {showBrokerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              {editingBroker ? 'Editar Bróker' : 'Nuevo Bróker'}
            </h3>
            
            {brokerFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {brokerFormError}
              </div>
            )}

            <form onSubmit={handleBrokerSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    name="nombre"
                    value={brokerFormData.nombre}
                    onChange={handleBrokerInputChange}
                    placeholder="Ej: Brubank"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Comitente</label>
                  <input
                    type="text"
                    name="cuenta_comitente"
                    value={brokerFormData.cuenta_comitente}
                    onChange={handleBrokerInputChange}
                    placeholder="Ej: 12345678"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
                  <input
                    type="text"
                    name="descripcion"
                    value={brokerFormData.descripcion}
                    onChange={handleBrokerInputChange}
                    placeholder="Ej: Bróker principal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={closeBrokerModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-150"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors duration-150"
                >
                  {editingBroker ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal de Confirmación de Eliminación de Bróker */}
      {showDeleteBrokerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirmar Eliminación</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar el bróker <span className="font-semibold">{brokerToDelete?.nombre}</span>? Esta acción no se puede deshacer y fallará si hay transacciones asociadas.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeDeleteBrokerModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteBroker}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors duration-150"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}