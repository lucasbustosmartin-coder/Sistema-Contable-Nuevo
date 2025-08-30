import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Sidebar from './Sidebar';

export default function ActivosManager({ user, setCurrentView }) {
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
    moneda: ''
  });
  const [formError, setFormError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState(null);

  const tipos = ['accion', 'cedear', 'etf', 'bono'];
  const monedas = ['ARS', 'USD'];

  useEffect(() => {
    loadActivos();
  }, [user]);

  const loadActivos = async () => {
    // ✅ CORRECCIÓN 1: Se agregó una comprobación para evitar el error si 'user' no está definido
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      // ✅ Se asegura de seleccionar las columnas de precios para que se muestren
      const { data, error: fetchError } = await supabase
        .from('activos')
        .select('*, ultimo_precio, ultimo_precio_ars, fecha_actualizacion')
        .eq('usuario_id', user.id)
        .order('nombre', { ascending: true });

      if (fetchError) throw fetchError;
      setActivos(data || []);
    } catch (err) {
      console.error('❌ Error al cargar activos:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (activo = null) => {
    if (activo) {
      setEditing(activo);
      setFormData({
        tipo: activo.tipo,
        simbolo: activo.simbolo,
        nombre: activo.nombre,
        moneda: activo.moneda
      });
    } else {
      setEditing(null);
      setFormData({ tipo: '', simbolo: '', nombre: '', moneda: '' });
    }
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({ tipo: '', simbolo: '', nombre: '', moneda: '' });
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
    const { tipo, simbolo, nombre, moneda } = formData;

    if (!tipo || !simbolo || !nombre || !moneda) {
      setFormError('Todos los campos son obligatorios');
      return;
    }

    try {
      if (editing) {
        const { error: updateError } = await supabase
          .from('activos')
          .update({ tipo, simbolo, nombre, moneda })
          .eq('id', editing.id)
          .eq('usuario_id', user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('activos')
          .insert({
            usuario_id: user.id,
            tipo,
            simbolo: simbolo.toUpperCase(),
            nombre,
            moneda
          });

        if (insertError) throw insertError;
      }

      await loadActivos();
      closeModal();
    } catch (err) {
      console.error('Error al guardar el activo:', err.message);
      setFormError('Error al guardar. Intenta nuevamente.');
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const { error: deleteError } = await supabase
        .from('activos')
        .delete()
        .eq('id', itemToDelete)
        .eq('usuario_id', user.id);

      if (deleteError) throw deleteError;

      await loadActivos();
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar el activo:', err.message);
      setError('Error al eliminar. Intenta nuevamente.');
      closeDeleteModal();
    }
  };

  // ✅ CORRECCIÓN 2: Lógica de actualización de precios integrada
  const handleActualizarPrecios = async () => {
    setIsUpdating(true);
    const DOCTA_API_URL = "https://www.doctacapital.com.ar/api/series?fromDate=2025-08-29T03%3A00%3A00.000Z&adjusted=false&markets=stock.bond.cedear&tickers=all&columns=date.ticker.last_price.closing_price.opening_price.low_price.high_price&format=csv&token=b9185669-9246-44ff-841c-2026baa88941";
    
    try {
      if (!user) {
        setUpdateMessage({ type: 'error', text: 'Usuario no logueado.' });
        return;
      }

      const { data: activosUsuario, error: fetchActivosError } = await supabase
        .from('activos')
        .select('id, simbolo, moneda')
        .eq('usuario_id', user.id);

      if (fetchActivosError) throw fetchActivosError;

      const simbolos = activosUsuario.map(a => a.simbolo);

      const response = await fetch(DOCTA_API_URL + "&t=" + new Date().getTime());
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      
      const csvData = await response.text();
      const priceData = parseCSV(csvData);

      const priceMap = {};
      priceData.forEach(item => {
        if (simbolos.includes(item.ticker) && item.last_price) {
          priceMap[item.ticker] = parseFloat(item.last_price);
        }
      });
      
      const { data: tcData } = await supabase
        .from('tipos_cambio')
        .select('tasa')
        .eq('fecha', new Date().toISOString().split('T')[0])
        .single();
      const tipoCambio = tcData?.tasa || 1100;
      
      for (const activo of activosUsuario) {
        const precioUsd = priceMap[activo.simbolo];
        if (precioUsd !== undefined) {
          const precioArs = activo.moneda === 'USD' ? precioUsd * tipoCambio : precioUsd;
          
          await supabase
            .from('activos')
            .update({
              ultimo_precio: precioUsd,
              ultimo_precio_ars: precioArs,
              fecha_actualizacion: new Date().toISOString(),
            })
            .eq('id', activo.id);
        }
      }
      
      function parseCSV(csvText) {
        const fixedText = csvText.replace(/'(\d{4}-\d{2}-\d{2})/g, '\n$1');
        const lines = fixedText.trim().split("\n");
        const headers = lines[0].split(",");
        const data = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const row = lines[i].split(",");
          const item = {};
          headers.forEach((header, index) => {
            item[header] = row[index]?.replace(/^"(.*)"$/, "$1") || "";
          });
          data.push(item);
        }
        return data;
      }
      
      await loadActivos();
      setUpdateMessage({ type: 'success', text: 'Precios actualizados correctamente.' });
      
    } catch (err) {
      console.error('Error al actualizar precios:', err);
      setUpdateMessage({ type: 'error', text: 'Error al actualizar precios. Por favor, revisa la consola.' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        currentView="activos"
        setCurrentView={setCurrentView}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-800">Mis Activos</h2>
            <button
              onClick={handleActualizarPrecios}
              disabled={isUpdating}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center space-x-2 ${
                isUpdating ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a2.252 2.252 0 0 0 1.588.662 2.252 2.252 0 0 0 1.588-.662l3.181-3.183m0 0v4.991m0-4.991a2.252 2.252 0 0 1 1.588-.662 2.252 2.252 0 0 1 1.588.662l3.181 3.183a2.252 2.252 0 0 1 1.588.662 2.252 2.252 0 0 1 1.588-.662l3.181-3.183" />
              </svg>
              <span>{isUpdating ? 'Actualizando...' : 'Actualizar Precios'}</span>
            </button>
          </div>
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
                <h3 className="text-lg font-semibold text-gray-800">Lista de Activos</h3>
                <button
                  onClick={() => openModal()}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                >
                  Nuevo Activo
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Símbolo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moneda</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Actual</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activos.length > 0 ? (
                      activos.map((activo) => (
                        <tr key={activo.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{activo.nombre}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{activo.simbolo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{activo.tipo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{activo.moneda}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {activo.ultimo_precio_ars ? (
                              <div>
                                <div>USD: ${activo.ultimo_precio?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                <div className="font-medium">ARS: ${activo.ultimo_precio_ars.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400">Sin datos</span>
                            )}
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
                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
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

      {/* Modal para Crear/Editar */}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Símbolo</label>
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

      {/* Modal de mensajes */}
      {updateMessage && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4`}>
          <div className={`rounded-lg p-6 w-full max-w-sm mx-auto text-center shadow-lg transition-all duration-300 ${
            updateMessage.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            <p className="font-semibold mb-2">{updateMessage.type === 'success' ? 'Éxito' : 'Error'}</p>
            <p className="text-sm mb-4">{updateMessage.text}</p>
            <button
              onClick={() => setUpdateMessage(null)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                updateMessage.type === 'success' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
