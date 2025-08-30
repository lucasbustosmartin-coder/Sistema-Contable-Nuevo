import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Sidebar from './Sidebar';

export default function TipoCambioManager({ user, setCurrentView }) {
  // Estado para la lista de tipos de cambio, carga y errores
  const [tiposCambio, setTiposCambio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para los modales y el formulario
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ fecha: '', tasa: '' });
  const [formError, setFormError] = useState('');
  
  // Estado para el modal de confirmación de recálculo
  const [showRecalculateModal, setShowRecalculateModal] = useState(false);

  // Hook para cargar los datos al inicio y cuando el usuario cambia
  useEffect(() => {
    loadTipoCambio();
  }, [user]);

  // Carga los tipos de cambio desde Supabase
  const loadTipoCambio = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: tipos, error: fetchError } = await supabase
        .from('tipos_cambio')
        .select('*')
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('📦 Tipos de cambio cargados:', tipos);
      setTiposCambio(tipos || []);
    } catch (err) {
      console.error('❌ Error al cargar tipos de cambio:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Abre el modal de creación/edición
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

  // Cierra el modal de creación/edición
  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({ fecha: '', tasa: '' });
    setFormError('');
  };

  // Abre el modal de confirmación de eliminación
  const openDeleteModal = (id) => {
    setItemToDelete(id);
    setShowDeleteModal(true);
  };

  // Cierra el modal de confirmación de eliminación
  const closeDeleteModal = () => {
    setItemToDelete(null);
    setShowDeleteModal(false);
  };
  
  // Abre el modal de confirmación de recálculo
  const openRecalculateModal = () => {
    setShowRecalculateModal(true);
  };
  
  // Cierra el modal de confirmación de recálculo
  const closeRecalculateModal = () => {
    setShowRecalculateModal(false);
  };

  // Maneja los cambios en los inputs del formulario
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Maneja el envío del formulario para crear o actualizar un registro
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
        // ✅ CORRECCIÓN: Agregando el filtro por usuario_id para cumplir con la política de RLS
        const { error: updateError } = await supabase
          .from('tipos_cambio')
          .update({ tasa: valorFloat })
          .eq('id', editing.id)
          .eq('usuario_id', user.id); // <--- LÍNEA AÑADIDA

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

  // Maneja la eliminación de un registro
  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      // Intenta eliminar registros relacionados primero
      const { error: relatedDeleteError } = await supabase
        .from('entradas_contables')
        .delete()
        .eq('tipo_cambio_id', itemToDelete);

      if (relatedDeleteError) {
        throw relatedDeleteError;
      }
      
      // Luego elimina el registro principal
      const { error: deleteError } = await supabase
        .from('tipos_cambio')
        .delete()
        .eq('id', itemToDelete)
        .eq('usuario_id', user.id); // Añadir filtro de seguridad aquí también

      if (deleteError) throw deleteError;

      await loadTipoCambio();
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar:', err.message);
      setError('Error al eliminar. Intenta nuevamente.');
      closeDeleteModal();
    }
  };

  // Maneja el recálculo masivo de todos los registros
  const handleRecalcularTodosLosRegistros = async () => {
    if (!window.confirm('¿Estás seguro de que deseas recalcular todos los registros contables con los tipos de cambio actuales?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Obtener todos los tipos de cambio
      const { data: tipos, error: tcError } = await supabase
        .from('tipos_cambio')
        .select('fecha, tasa')
        .eq('usuario_id', user.id);

      if (tcError) throw tcError;

      if (!tipos || tipos.length === 0) {
        alert('No hay tipos de cambio cargados.');
        return;
      }

      const tiposPorFecha = tipos.reduce((acc, tc) => {
        acc[tc.fecha] = tc.tasa;
        return acc;
      }, {});

      // 2. Obtener todas las entradas contables
      const { data: entradas, error: entradasError } = await supabase
        .from('entradas_contables')
        .select('id, fecha, importe_ars, importe_usd, moneda')
        .eq('usuario_id', user.id);

      if (entradasError) throw entradasError;

      if (!entradas || entradas.length === 0) {
        alert('No hay entradas contables para recalcular.');
        return;
      }

      // 🔍 DEBUG: Ver entradas originales
      console.log('📥 Entradas originales:', entradas);

      // 3. Preparar las promesas de actualización
      const actualizaciones = [];

      entradas.forEach((entrada) => {
        const tasa = tiposPorFecha[entrada.fecha];
        if (!tasa || tasa <= 0) return;

        let nuevoARS, nuevoUSD;

        if (entrada.moneda === 'ARS') {
          // Mantener `importe_ars`, recalcular `importe_usd`
          nuevoARS = entrada.importe_ars;
          nuevoUSD = Math.round((entrada.importe_ars / tasa) * 100) / 100;
        } else {
          // Mantener `importe_usd`, recalcular `importe_ars`
          nuevoUSD = entrada.importe_usd;
          nuevoARS = Math.round((entrada.importe_usd * tasa) * 100) / 100;
        }

        // 🔍 DEBUG: Ver cada cálculo
        console.log(`📌 ID ${entrada.id}:`, {
          moneda: entrada.moneda,
          original_ars: entrada.importe_ars,
          original_usd: entrada.importe_usd,
          tasa,
          nuevo_ars: nuevoARS,
          nuevo_usd: nuevoUSD
        });
        
        // CORRECCIÓN: Agregar la promesa de actualización individual
        actualizaciones.push(
          supabase
            .from('entradas_contables')
            .update({ importe_ars: nuevoARS, importe_usd: nuevoUSD })
            .eq('id', entrada.id)
            .eq('usuario_id', user.id)
        );
      });

      if (actualizaciones.length === 0) {
        alert('No hay registros para recalcular.');
        return;
      }

      // 🔍 DEBUG: Ver todos los valores a actualizar
      console.log('📤 Ejecutando actualizaciones en paralelo:', actualizaciones.length);

      // 4. Hacer el update en paralelo
      const results = await Promise.all(actualizaciones);

      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('❌ Errores en actualizaciones:', errors);
        throw new Error('Algunos registros no se pudieron actualizar.');
      }

      alert(`¡Recálculo masivo completado! ${actualizaciones.length} registros actualizados.`);
    } catch (err) {
      console.error('Error al recalcular:', err.message);
      setError('Error al recalcular. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        currentView="tipo-cambio"
        setCurrentView={setCurrentView}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-semibold text-gray-800">Tipo de Cambio</h2>
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
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Registros de Tipo de Cambio</h3>
                <button 
                  onClick={() => openModal()}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                >
                  Nuevo Registro
                </button>
              </div>

              <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
                <button
                  onClick={handleRecalcularTodosLosRegistros}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors duration-150 flex items-center space-x-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a2.252 2.252 0 0 0 1.588.662 2.252 2.252 0 0 0 1.588-.662l3.181-3.183m0 0v4.991m0-4.991a2.252 2.252 0 0 1 1.588-.662 2.252 2.252 0 0 1 1.588.662l3.181 3.183a2.252 2.252 0 0 1 1.588.662 2.252 2.252 0 0 1 1.588-.662l3.181-3.183" />
                  </svg>
                  <span>Recalcular todos los registros</span>
                </button>
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
                          No hay registros de tipo de cambio.
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

      {/* Modal para Crear/Editar */}
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
      
      {/* Modal de confirmación de eliminación */}
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
    </div>
  );
}
