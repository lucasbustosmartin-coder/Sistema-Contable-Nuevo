import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Sidebar from './Sidebar';

export default function ConceptosContablesManager({ user, setCurrentView }) {
  const [conceptos, setConceptos] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [itemToToggle, setItemToToggle] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ rubro_id: '', concepto: '' });
  const [formError, setFormError] = useState('');

  // Lógica de carga de datos para conceptos y rubros
  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar la lista de rubros
      const { data: rubrosData, error: rubrosError } = await supabase
        .from('rubros')
        .select('*')
        .eq('usuario_id', user.id)
        .order('nombre', { ascending: true });

      if (rubrosError) throw rubrosError;
      setRubros(rubrosData || []);

      // Cargar la lista de conceptos, incluyendo la columna 'activo'
      const { data: conceptosData, error: conceptosError } = await supabase
        .from('conceptos_contables')
        .select(`
          id,
          concepto,
          activo,
          rubro_id,
          rubros (
            nombre
          )
        `)
        .eq('usuario_id', user.id)
        .order('concepto', { ascending: true });

      if (conceptosError) throw conceptosError;
      setConceptos(conceptosData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manejo de modales y formularios
  const openModal = (concepto = null) => {
    if (concepto) {
      setEditing(concepto);
      setFormData({ rubro_id: concepto.rubro_id, concepto: concepto.concepto });
    } else {
      setEditing(null);
      setFormData({ rubro_id: '', concepto: '' });
    }
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({ rubro_id: '', concepto: '' });
    setFormError('');
  };

  const openToggleModal = (item) => {
    setItemToToggle(item);
    setShowToggleModal(true);
  };

  const closeToggleModal = () => {
    setItemToToggle(null);
    setShowToggleModal(false);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.rubro_id || !formData.concepto) {
      setFormError('Los campos Rubro y Concepto son obligatorios');
      return;
    }

    try {
      if (editing) {
        const { error: updateError } = await supabase
          .from('conceptos_contables')
          .update({
            rubro_id: formData.rubro_id,
            concepto: formData.concepto,
          })
          .eq('id', editing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('conceptos_contables')
          .insert({
            usuario_id: user.id,
            rubro_id: formData.rubro_id,
            concepto: formData.concepto,
          });
        if (insertError) throw insertError;
      }
      await loadData();
      closeModal();
    } catch (err) {
      console.error('Error al guardar el concepto:', err.message);
      setFormError('Error al guardar. Intenta nuevamente.');
    }
  };

  const handleToggleActive = async () => {
    if (!itemToToggle) return;
    try {
      const { error: toggleError } = await supabase
        .from('conceptos_contables')
        .update({ activo: !itemToToggle.activo })
        .eq('id', itemToToggle.id);
      if (toggleError) throw toggleError;
      await loadData();
      closeToggleModal();
    } catch (err) {
      console.error('Error al cambiar el estado del concepto:', err.message);
      setError('Error al cambiar el estado. Intenta nuevamente.');
      closeToggleModal();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        currentView="conceptos"
        setCurrentView={setCurrentView}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-semibold text-gray-800">Gestión de Conceptos</h2>
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
                <h3 className="text-lg font-semibold text-gray-800">Lista de Conceptos</h3>
                <button 
                  onClick={() => openModal()}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                >
                  Nuevo Concepto
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rubro</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {conceptos.length > 0 ? (
                      conceptos.map(concepto => (
                        <tr key={concepto.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{concepto.concepto}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{concepto.rubros?.nombre}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${concepto.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {concepto.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => openModal(concepto)}
                              className="text-indigo-600 hover:text-indigo-800 mr-4 transition-colors duration-150"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => openToggleModal(concepto)}
                              className={`transition-colors duration-150 ${concepto.activo ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                            >
                              {concepto.activo ? 'Deshabilitar' : 'Habilitar'}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                          No hay conceptos registrados.
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
              {editing ? 'Editar Concepto' : 'Nuevo Concepto'}
            </h3>
            
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rubro</label>
                  <select
                    name="rubro_id"
                    value={formData.rubro_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Selecciona un rubro</option>
                    {rubros.map(rubro => (
                      <option key={rubro.id} value={rubro.id}>{rubro.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
                  <input
                    type="text"
                    name="concepto"
                    value={formData.concepto}
                    onChange={handleInputChange}
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
      
      {/* Modal de confirmación para habilitar/deshabilitar */}
      {showToggleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {itemToToggle?.activo ? 'Deshabilitar Concepto' : 'Habilitar Concepto'}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de que deseas {itemToToggle?.activo ? 'deshabilitar' : 'habilitar'} el concepto "{itemToToggle?.concepto}"?
              Esta acción afectará la visibilidad en los formularios de entrada de datos.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeToggleModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleToggleActive}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors duration-150 ${itemToToggle?.activo ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {itemToToggle?.activo ? 'Deshabilitar' : 'Habilitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
