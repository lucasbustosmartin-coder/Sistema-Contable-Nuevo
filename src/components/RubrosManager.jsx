import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Sidebar from './Sidebar';
import iconImage from '../assets/icon.png';

export default function RubrosManager({ user, setCurrentView }) {
  const [rubros, setRubros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ nombre: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadRubros();
  }, [user]);

  const loadRubros = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('rubros')
        .select('*')
        .eq('usuario_id', user.id)
        .order('nombre', { ascending: true });

      if (fetchError) throw fetchError;
      setRubros(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (rubro = null) => {
    if (rubro) {
      setEditing(rubro);
      setFormData({ nombre: rubro.nombre });
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
      setFormError('El nombre del rubro es obligatorio.');
      return;
    }

    try {
      if (editing) {
        const { error: updateError } = await supabase
          .from('rubros')
          .update({ nombre: formData.nombre })
          .eq('id', editing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('rubros')
          .insert({
            usuario_id: user.id,
            nombre: formData.nombre,
          });
        if (insertError) throw insertError;
      }
      await loadRubros();
      closeModal();
    } catch (err) {
      console.error('Error al guardar el rubro:', err.message);
      setFormError('Error al guardar. Intenta nuevamente.');
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      // ✅ Se agrega un paso para eliminar los conceptos asociados antes de eliminar el rubro
      const { error: relatedDeleteError } = await supabase
        .from('conceptos_contables')
        .delete()
        .eq('rubro_id', itemToDelete);

      if (relatedDeleteError) {
        throw relatedDeleteError;
      }

      const { error: deleteError } = await supabase
        .from('rubros')
        .delete()
        .eq('id', itemToDelete);
      if (deleteError) throw deleteError;
      await loadRubros();
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar el rubro:', err.message);
      setError('Error al eliminar. Intenta nuevamente.');
      closeDeleteModal();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar
        currentView="rubros"
        setCurrentView={setCurrentView}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-6">
          <div className="flex items-center space-x-4 mb-2">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800">Gestión de Rubros</h2>
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
              <div className="px-6 py-4 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Lista de Rubros</h3>
                <button 
                  onClick={() => openModal()}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center space-x-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>Nuevo Rubro</span>
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre del Rubro</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rubros.length > 0 ? (
                      rubros.map(rubro => (
                        <tr key={rubro.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{rubro.nombre}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => openModal(rubro)}
                              className="text-indigo-600 hover:text-indigo-800 mr-4 transition-colors duration-150"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => openDeleteModal(rubro.id)}
                              className="text-red-600 hover:text-red-800 transition-colors duration-150"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className="px-6 py-4 text-center text-gray-500">
                          No hay rubros registrados.
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
              {editing ? 'Editar Rubro' : 'Nuevo Rubro'}
            </h3>
            
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Rubro</label>
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
            <p className="text-sm text-gray-600 mb-6">¿Estás seguro de que deseas eliminar este rubro? Esta acción también eliminará todos los conceptos asociados.</p>
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