import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import iconImage from '../assets/icon.png';

export default function TipoCambioManager({ user, setCurrentView }) {
  const [tiposCambio, setTiposCambio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ fecha: '', tasa: '' });
  const [formError, setFormError] = useState('');
  const [updateMessage, setUpdateMessage] = useState(null);
  
  const [filterDate, setFilterDate] = useState('');
  const [isAutomating, setIsAutomating] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const runAutomatedProcess = async () => {
      setLoading(true);
      setError(null);
      setUpdateMessage({ type: 'info', text: 'Iniciando proceso automático: Actualizando valor del dólar...' });
      
      try {
        const { data: invokeData, error: invokeError } = await supabase.functions.invoke('actualizar-tipo-cambio', {
          body: { user_id: user.id },
        });

        if (invokeError) throw new Error(invokeError.message || 'Error al actualizar el tipo de cambio.');

        setUpdateMessage({ type: 'success', text: 'Iniciando recálculo automático de registros contables...' });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await handleRecalculate();
        setUpdateMessage({ type: 'success', text: 'Proceso automático finalizado. Tabla actualizada.' });
        
      } catch (err) {
        console.error('❌ Error en el proceso automático:', err.message);
        setUpdateMessage({ type: 'error', text: `Error en el proceso automático: ${err.message}` });
      } finally {
        setIsAutomating(false);
        setLoading(false);
        loadTipoCambio();
        setTimeout(() => setUpdateMessage(null), 5000);
      }
    };

    if (isAutomating) {
      runAutomatedProcess();
    }
  }, [user, isAutomating]);

  useEffect(() => {
    if (user && !isAutomating) {
      loadTipoCambio();
    }
  }, [user, filterDate, isAutomating]);

  const loadTipoCambio = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('tipos_cambio')
        .select('*')
        .eq('usuario_id', user.id);
      
      if (filterDate) {
        query = query.eq('fecha', filterDate);
      }

      const { data: tipos, error: fetchError } = await query.order('fecha', { ascending: false });

      if (fetchError) throw fetchError;

      setTiposCambio(tipos || []);
    } catch (err) {
      console.error('❌ Error al cargar tipos de cambio:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (tipo = null) => {
    if (tipo) {
      setEditing(tipo);
      setFormData({ fecha: tipo.fecha, tasa: tipo.tasa?.toString() || '' });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setEditing(null);
      setFormData({ fecha: today, tasa: '' });
    }
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({ fecha: '', tasa: '' });
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
    
    if (!formData.fecha || !formData.tasa) {
      setFormError('Todos los campos son obligatorios');
      return;
    }

    const valorFloat = parseFloat(formData.tasa);
    if (isNaN(valorFloat) || valorFloat <= 0) {
      setFormError('El valor del dólar debe ser un número válido mayor a 0');
      return;
    }

    try {
      if (editing) {
        const { error: updateError } = await supabase
          .from('tipos_cambio')
          .update({ tasa: valorFloat })
          .eq('id', editing.id)
          .eq('usuario_id', user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('tipos_cambio')
          .insert({
            usuario_id: user.id,
            fecha: formData.fecha,
            tasa: valorFloat
          });

        if (insertError) throw insertError;
      }

      await loadTipoCambio();
      closeModal();
    } catch (err) {
      console.error('Error al guardar:', err.message);
      setFormError('Error al guardar. Intenta nuevamente.');
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const { error: relatedDeleteError } = await supabase
        .from('entradas_contables')
        .delete()
        .eq('tipo_cambio_id', itemToDelete);

      if (relatedDeleteError) {
        throw relatedDeleteError;
      }
      
      const { error: deleteError } = await supabase
        .from('tipos_cambio')
        .delete()
        .eq('id', itemToDelete)
        .eq('usuario_id', user.id);

      if (deleteError) throw deleteError;

      await loadTipoCambio();
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar:', err.message);
      setError('Error al eliminar. Intenta nuevamente.');
      closeDeleteModal();
    }
  };
  
  const handleRecalculate = async () => {
    try {
      if (!user) {
        setUpdateMessage({ type: 'error', text: 'Usuario no logueado.' });
        return;
      }

      const { data: tipos, error: tcError } = await supabase
        .from('tipos_cambio')
        .select('fecha, tasa')
        .eq('usuario_id', user.id);

      if (tcError) throw tcError;

      if (!tipos || tipos.length === 0) {
        setUpdateMessage({ type: 'success', text: 'No hay tipos de cambio cargados.' });
        return;
      }

      const tiposPorFecha = tipos.reduce((acc, tc) => {
        acc[tc.fecha] = tc.tasa;
        return acc;
      }, {});

      const { data: entradas, error: entradasError } = await supabase
        .from('entradas_contables')
        .select('id, fecha, importe_ars, importe_usd, moneda')
        .eq('usuario_id', user.id);

      if (entradasError) throw entradasError;

      if (!entradas || entradas.length === 0) {
        setUpdateMessage({ type: 'success', text: 'No hay entradas contables para recalcular.' });
        return;
      }

      const actualizaciones = [];

      entradas.forEach((entrada) => {
        const tasa = tiposPorFecha[entrada.fecha];
        if (!tasa || tasa <= 0) return;

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
          actualizaciones.push(
            supabase
              .from('entradas_contables')
              .update(updateData)
              .eq('id', entrada.id)
              .eq('usuario_id', user.id)
          );
        }
      });

      if (actualizaciones.length === 0) {
        setUpdateMessage({ type: 'success', text: 'No se encontraron registros para recalcular. Ya están actualizados.' });
        return;
      }

      const results = await Promise.all(actualizaciones);

      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('❌ Errores en actualizaciones:', errors);
        throw new Error('Algunos registros no se pudieron actualizar.');
      }
      
      setUpdateMessage({ type: 'success', text: `Recálculo masivo completado: ${actualizaciones.length} registros actualizados.` });
    } catch (err) {
      console.error('Error al recalcular:', err.message);
      setUpdateMessage({ type: 'error', text: 'Error al recalcular. Intenta nuevamente.' });
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
  

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mt-4">Tipo de Cambio</h2>
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
              <div className="p-6 flex justify-between items-center flex-wrap gap-4">
                <h3 className="text-lg font-semibold text-gray-800">Registros de Tipo de Cambio</h3>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="filter-date" className="text-sm text-gray-600 font-medium">Filtrar por Fecha:</label>
                    <input
                      id="filter-date"
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    {filterDate && (
                      <button
                        onClick={() => setFilterDate('')}
                        className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => openModal()}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center space-x-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Nuevo Registro</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor USD</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tiposCambio.length > 0 ? (
                      tiposCambio.map(tipo => (
                        <tr key={tipo.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{tipo.fecha}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${parseFloat(tipo.tasa).toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => openModal(tipo)}
                              className="text-indigo-600 hover:text-indigo-800 mr-4 transition-colors duration-150"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => openDeleteModal(tipo.id)}
                              className="text-red-600 hover:text-red-800 transition-colors duration-150"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="px-6 py-4 text-center text-gray-500">
                          {filterDate ? `No hay registros para la fecha ${filterDate}.` : 'No hay registros de tipo de cambio.'}
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
              {editing ? 'Editar Tipo de Cambio' : 'Nuevo Tipo de Cambio'}
            </h3>
            
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-75"
                    disabled={editing}
                    required
                  />
                  {editing && (
                    <p className="text-xs text-gray-500 mt-1">No se puede cambiar la fecha en edición</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor del Dólar (ARS)</label>
                  <input
                    type="number"
                    name="tasa"
                    value={formData.tasa}
                    onChange={handleInputChange}
                    placeholder="Ej: 1100"
                    step="0.01"
                    min="0.01"
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
            <p className="text-sm text-gray-600 mb-6">¿Estás seguro de que deseas eliminar este registro de tipo de cambio? Esta acción no se puede deshacer.</p>
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