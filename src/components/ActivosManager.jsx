import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import iconImage from '../assets/icon.png';

export default function ActivosManager({ user, setCurrentView, updateMessage, setUpdateMessage }) {
  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    tipo: '',
    simbolo: '',
    nombre: '',
    moneda: '',
    submarket: ''
  });
  const [formError, setFormError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [tipoCambioDisplay, setTipoCambioDisplay] = useState(null);
  
  const [sortConfig, setSortConfig] = useState({ key: 'simbolo', direction: 'ascending' });

  // ✅ NUEVOS ESTADOS PARA FILTROS
  const [filterTipo, setFilterTipo] = useState('');
  const [filterSimbolo, setFilterSimbolo] = useState('');

  const tipos = ['accion', 'cedear', 'etf', 'bono'];
  const monedas = ['ARS', 'USD'];

  useEffect(() => {
    loadActivos();
    loadLatestTipoCambio();
  }, [user, updateMessage]);

  const loadActivos = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('activos')
        .select('*, ultimo_precio, ultimo_precio_ars, fecha_actualizacion')
        .order('tipo', { ascending: true })
        .order('simbolo', { ascending: true });

      if (fetchError) throw fetchError;
      setActivos(data || []);
    } catch (err) {
      console.error('❌ Error al cargar activos:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLatestTipoCambio = async () => {
    if (!user) return;
    try {
      const { data: tcData } = await supabase
        .from('tipos_cambio')
        .select('tasa')
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false })
        .limit(1)
        .single();
      
      setTipoCambioDisplay(tcData?.tasa || null);
    } catch (err) {
      console.error('Error al cargar tipo de cambio:', err.message);
    }
  };

  const openModal = (activo = null) => {
    if (activo) {
      setEditing(activo);
      setFormData({
        tipo: activo.tipo,
        simbolo: activo.simbolo,
        nombre: activo.nombre,
        moneda: activo.moneda,
        submarket: activo.submarket || ''
      });
    } else {
      setEditing(null);
      setFormData({ tipo: '', simbolo: '', nombre: '', moneda: '', submarket: '' });
    }
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({ tipo: '', simbolo: '', nombre: '', moneda: '', submarket: '' });
    setFormError('');
  };

  const openDeleteModal = (id) => {
    setItemToDelete(id);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setItemToDelete(null);
    setShowDeleteModal(false);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      const { tipo, simbolo, nombre, moneda, submarket } = formData;

      if (!tipo || !simbolo || !nombre || !moneda || !submarket) {
        setFormError('Todos los campos son obligatorios');
        return;
      }

    try {
      if (editing) {
        const { error: updateError } = await supabase
          .from('activos')
          .update({ tipo, simbolo, nombre, moneda, submarket })
          // ✅ CORRECCIÓN: Se eliminó el filtro por usuario_id
          .eq('id', editing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('activos')
          .insert({
            // ✅ CORRECCIÓN: Se eliminó usuario_id de la inserción
            tipo,
            simbolo: simbolo.toUpperCase(),
            nombre,
            moneda,
            submarket
          });
        if (insertError) throw insertError;
      }
      await loadActivos();
      closeModal();
      setUpdateMessage({ type: 'success', text: editing ? 'Activo actualizado con éxito.' : 'Activo creado con éxito.' });
    } catch (err) {
      console.error('Error al guardar el activo:', err.message);
      setFormError('Error al guardar. Intenta nuevamente.');
      setUpdateMessage({ type: 'error', text: 'Error al guardar el activo.' });
    } finally {
      setTimeout(() => setUpdateMessage(null), 5000);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const { error: deleteError } = await supabase
        .from('activos')
        .delete()
        // ✅ CORRECCIÓN: Se eliminó el filtro por usuario_id
        .eq('id', itemToDelete);

      if (deleteError) throw deleteError;

      await loadActivos();
      closeDeleteModal();
      setUpdateMessage({ type: 'success', text: 'Activo eliminado con éxito.' });
    } catch (err) {
      console.error('Error al eliminar el activo:', err.message);
      setError('Error al eliminar. Intenta nuevamente.');
      setUpdateMessage({ type: 'error', text: 'Error al eliminar el activo.' });
      closeDeleteModal();
    } finally {
      setTimeout(() => setUpdateMessage(null), 5000);
    }
  };

  const handleActualizarPrecios = async () => {
    setIsUpdating(true);
    setUpdateMessage(null);
    try {
      if (!user) {
        setUpdateMessage({ type: 'error', text: 'Usuario no logueado.' });
        return;
      }
      
      const { data, error: invokeError } = await supabase.functions.invoke('actualizar-precios-docta', {
        body: { user_id: user.id },
      });
      
      if (invokeError) throw invokeError;
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      await loadActivos();
      await loadLatestTipoCambio();

      setUpdateMessage({ type: 'success', text: data?.message || 'Precios actualizados correctamente.' });
      
    } catch (err) {
      console.error('Error al actualizar precios:', err);
      setUpdateMessage({ type: 'error', text: 'Error al actualizar precios. Por favor, revisa la consola.' });
    } finally {
      setIsUpdating(false);
      setTimeout(() => setUpdateMessage(null), 5000);
    }
  };
  
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedActivos = () => {
    let sortableItems = [...activos];

    // ✅ NUEVA LÓGICA DE FILTRADO
    if (filterTipo) {
      sortableItems = sortableItems.filter(activo => activo.tipo === filterTipo);
    }
    if (filterSimbolo) {
      sortableItems = sortableItems.filter(activo => activo.simbolo.toLowerCase().includes(filterSimbolo.toLowerCase()));
    }

    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let valueA, valueB;

        if (sortConfig.key === 'ultimo_precio' || sortConfig.key === 'ultimo_precio_ars') {
          valueA = a[sortConfig.key] || 0;
          valueB = b[sortConfig.key] || 0;
        } else if (sortConfig.key === 'fecha_actualizacion') {
          valueA = a.fecha_actualizacion ? new Date(a.fecha_actualizacion) : new Date(0);
          valueB = b.fecha_actualizacion ? new Date(b.fecha_actualizacion) : new Date(0);
        } else {
          valueA = (a[sortConfig.key] || '').toLowerCase();
          valueB = (b[sortConfig.key] || '').toLowerCase();
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
  
  const activosToDisplay = sortedActivos();

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-6">
          <div className="flex items-center space-x-4 mb-2">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800">Precios</h2>
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
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
              <div className="px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <h3 className="text-lg font-semibold text-gray-800">Lista de Activos</h3>
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                  {tipoCambioDisplay && (
                    <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                      T.C. actual: <span className="font-mono font-semibold">${tipoCambioDisplay?.toFixed(2)}</span>
                    </span>
                  )}
                  <div className="flex flex-col items-end space-y-2">
                    <button
                      onClick={handleActualizarPrecios}
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
                          <span>Actualizando precios...</span>
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
                  </div>
                  
                  <button
                    onClick={() => openModal()}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center space-x-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Nuevo Activo</span>
                  </button>
                </div>
              </div>

              {/* ✅ NUEVOS FILTROS */}
              <div className="p-6 bg-gray-100 border-t border-gray-200 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-1">
                  <label htmlFor="filter-tipo" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Tipo</label>
                  <select
                    id="filter-tipo"
                    value={filterTipo}
                    onChange={(e) => setFilterTipo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Todos</option>
                    {tipos.map((t) => (
                      <option key={t} value={t}>
                        {t === 'accion' ? 'Acción' : t === 'cedear' ? 'Cedear' : t === 'etf' ? 'ETF' : 'Bono'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label htmlFor="filter-simbolo" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Ticker</label>
                  <input
                    type="text"
                    id="filter-simbolo"
                    value={filterSimbolo}
                    onChange={(e) => setFilterSimbolo(e.target.value)}
                    placeholder="Ej: GGAL"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('tipo')}>
                        Tipo
                        {sortConfig.key === 'tipo' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('simbolo')}>
                        Ticker
                        {sortConfig.key === 'simbolo' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('submarket')}>
                        Submarket
                        {sortConfig.key === 'submarket' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('moneda')}>
                        Moneda
                        {sortConfig.key === 'moneda' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('ultimo_precio')}>
                        Precio USD
                        {sortConfig.key === 'ultimo_precio' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('ultimo_precio_ars')}>
                        Precio ARS
                        {sortConfig.key === 'ultimo_precio_ars' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('fecha_actualizacion')}>
                        Última Actualización
                        {sortConfig.key === 'fecha_actualizacion' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activosToDisplay.length > 0 ? (
                      activosToDisplay.map((activo) => (
                        <tr key={activo.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{activo.tipo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{activo.simbolo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{activo.submarket}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{activo.moneda}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {activo.ultimo_precio ? `$${activo.ultimo_precio?.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : <span className="text-gray-400">Sin datos</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                            {activo.ultimo_precio_ars ? `$${activo.ultimo_precio_ars?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : <span className="text-gray-400">Sin datos</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {activo.fecha_actualizacion ? new Date(activo.fecha_actualizacion).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => openModal(activo)}
                              className="text-indigo-600 hover:text-indigo-800 mr-4 transition-colors duration-150"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => openDeleteModal(activo.id)}
                              className="text-red-600 hover:text-red-800 transition-colors duration-150"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                          No tenés activos registrados.
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              {editing ? 'Editar Activo' : 'Nuevo Activo'}
            </h3>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Seleccionar tipo</option>
                    {tipos.map((t) => (
                      <option key={t} value={t}>
                        {t === 'accion' ? 'Acción' : t === 'cedear' ? 'Cedear' : t === 'etf' ? 'ETF' : 'Bono'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ticker</label>
                  <input
                    type="text"
                    name="simbolo"
                    value={formData.simbolo}
                    onChange={(e) => setFormData({ ...formData, simbolo: e.target.value.toUpperCase() })}
                    placeholder="Ej: GGAL, AAPL, AL30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    placeholder="Ej: Grupo Galicia, Apple Inc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                  <select
                    name="moneda"
                    value={formData.moneda}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Seleccionar moneda</option>
                    {monedas.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Submarket</label>
                  <input
                    type="text"
                    name="submarket"
                    value={formData.submarket}
                    onChange={handleInputChange}
                    placeholder="Ej: BYMA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-150"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors duration-150"
                >
                  {editing ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirmar Eliminación</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar este activo? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors duration-150"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}