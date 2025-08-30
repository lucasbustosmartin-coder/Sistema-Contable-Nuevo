import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Sidebar from './Sidebar';

export default function EstadosFinancierosManager({ user, setCurrentView }) {
  const [estados, setEstados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ nombre: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadEstados();
  }, [user]);

  const loadEstados = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('estados_financieros')
        .select('*')
        .eq('usuario_id', user.id)
        .order('nombre', { ascending: true });

      if (fetchError) throw fetchError;
      setEstados(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (estado = null) => {
    if (estado) {
      setEditing(estado);
      setFormData({ nombre: estado.nombre });
    } else {
      setEditing(null);
      setFormData({ nombre: '' });
    }
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({ nombre: '' });
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
    if (!formData.nombre) {
      setFormError('El nombre del estado es obligatorio.');
      return;
    }

    try {
      if (editing) {
        const { error: updateError } = await supabase
          .from('estados_financieros')
          .update({ nombre: formData.nombre })
          .eq('id', editing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('estados_financieros')
          .insert({
            usuario_id: user.id,
            nombre: formData.nombre,
          });
        if (insertError) throw insertError;
      }
      await loadEstados();
      closeModal();
    } catch (err) {
      console.error('Error al guardar el estado financiero:', err.message);
      setFormError('Error al guardar. Intenta nuevamente.');
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      // Se eliminan los registros de la tabla 'entradas_contables'
      // que dependen del estado financiero que se va a eliminar.
      const { error: relatedDeleteError } = await supabase
        .from('entradas_contables')
        .delete()
        .eq('estado_financiero_id', itemToDelete);

      if (relatedDeleteError) {
        throw relatedDeleteError;
      }
      
      const { error: deleteError } = await supabase
        .from('estados_financieros')
        .delete()
        .eq('id', itemToDelete);
      if (deleteError) throw deleteError;
      await loadEstados();
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar el estado financiero:', err.message);
      setError('Error al eliminar. Intenta nuevamente.');
      closeDeleteModal();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        currentView="estados-financieros"
        setCurrentView={setCurrentView}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-semibold text-gray-800">Estados Financieros</h2>
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
                <h3 className="text-lg font-semibold text-gray-800">Lista de Estados</h3>
                <button 
                  onClick={() => openModal()}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                >
                  Nuevo Estado
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre del Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Creación</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {estados.length > 0 ? (
                      estados.map(estado => (
                        <tr key={estado.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{estado.nombre}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(estado.creado_en).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => openModal(estado)}
                              className="text-indigo-600 hover:text-indigo-800 mr-4 transition-colors duration-150"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => openDeleteModal(estado.id)}
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
                          No hay estados financieros registrados.
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
              {editing ? 'Editar Estado Financiero' : 'Nuevo Estado Financiero'}
            </h3>
            
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Estado</label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
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
      
      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirmar Eliminación</h3>
            <p className="text-sm text-gray-600 mb-6">¿Estás seguro de que deseas eliminar este estado financiero?</p>
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
