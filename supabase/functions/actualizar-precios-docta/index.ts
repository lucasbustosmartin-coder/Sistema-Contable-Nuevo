cat > src/components/EntradasContablesManager.jsx << 'EOL'
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Sidebar from './Sidebar';

export default function EntradasContablesManager({ user, setCurrentView }) {
  const [entriesByDate, setEntriesByDate] = useState({});
  const [rubrosAndConceptos, setRubrosAndConceptos] = useState([]);
  const [tiposCambio, setTiposCambio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [view, setView] = useState('list'); // 'list' o 'edit'
  const [selectedDate, setSelectedDate] = useState('');
  const [entriesForEditing, setEntriesForEditing] = useState([]);
  const [showDeleteDayModal, setShowDeleteDayModal] = useState(false);

  // Función para abrir la vista de edición
  const openEditView = (date) => {
    setSelectedDate(date);
    setView('edit');
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (view === 'edit') {
      loadEntriesForEditing();
    }
  }, [view, selectedDate, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar tipos de cambio
      const { data: tcData, error: tcError } = await supabase
        .from('tipos_cambio')
        .select('id, fecha, tasa')
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false });
      if (tcError) throw tcError;
      setTiposCambio(tcData || []);

      // Cargar entradas contables
      const { data: allEntries, error: entriesError } = await supabase
        .from('entradas_contables')
        .select(`
          id,
          fecha,
          importe_ars,
          importe_usd,
          moneda,
          estado_financiero_id,
          tipo,
          concepto_id,
          conceptos_contables (
            concepto,
            rubro_id,
            rubros (nombre)
          )
        `)
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false });
      if (entriesError) throw entriesError;

      // Agrupar por fecha
      const grouped = {};
      allEntries.forEach(entry => {
        const date = entry.fecha;
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(entry);
      });
      setEntriesByDate(grouped);

      // Cargar rubros y conceptos
      const { data: rubrosData, error: rubrosError } = await supabase
        .from('rubros')
        .select(`
          id,
          nombre,
          conceptos_contables (
            id,
            concepto,
            activo
          )
        `)
        .eq('usuario_id', user.id)
        .order('nombre', { ascending: true });
      if (rubrosError) throw rubrosError;

      const conceptsList = [];
      rubrosData.forEach(rubro => {
        rubro.conceptos_contables.forEach(concepto => {
          if (concepto.activo) {
            conceptsList.push({
              ...concepto,
              rubro_id: rubro.id,
              rubro_nombre: rubro.nombre,
              tipo: rubro.nombre.toLowerCase().includes('activo corriente') ? 'Activo Corriente' :
                    rubro.nombre.toLowerCase().includes('activo no corriente') ? 'Activo No Corriente' :
                    rubro.nombre.toLowerCase().includes('pasivo') ? 'Pasivo' : ''
            });
          }
        });
      });

      conceptsList.sort((a, b) => {
        if (a.rubro_nombre < b.rubro_nombre) return -1;
        if (a.rubro_nombre > b.rubro_nombre) return 1;
        if (a.concepto < b.concepto) return -1;
        if (a.concepto > b.concepto) return 1;
        return 0;
      });

      setRubrosAndConceptos(conceptsList);

    } catch (err) {
      console.error('Error al cargar datos:', err.message);
      setError('Error al cargar datos. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const loadEntriesForEditing = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from('entradas_contables')
        .select(`
          id,
          fecha,
          importe_ars,
          importe_usd,
          moneda,
          estado_financiero_id,
          tipo,
          concepto_id,
          conceptos_contables (
            concepto,
            rubro_id,
            rubros (nombre)
          )
        `)
        .eq('usuario_id', user.id)
        .eq('fecha', selectedDate);
      if (entriesError) throw entriesError;

      // Obtener tipo de cambio actual para esta fecha
      const tcForDay = tiposCambio.find(tc => tc.fecha === selectedDate);
      const tasaActual = tcForDay?.tasa || 0;

      const entriesForEditing = entriesData.map(entry => {
        const concept = rubrosAndConceptos.find(c => c.id === entry.concepto_id);
        let monto = entry.moneda === 'ARS' ? entry.importe_ars : entry.importe_usd;

        // Recalcular con la tasa actual
        let importe_ars = 0;
        let importe_usd = 0;
        if (tasaActual > 0) {
          if (entry.moneda === 'ARS') {
            importe_ars = entry.importe_ars;
            importe_usd = entry.importe_ars / tasaActual;
          } else {
            importe_usd = entry.importe_usd;
            importe_ars = entry.importe_usd * tasaActual;
          }
        }

        return {
          ...entry,
          rubro_nombre: concept?.rubro_nombre || '',
          concepto: entry.conceptos_contables?.concepto || '',
          monto: monto,
          tipoCambio: tasaActual,
          importe_ars: parseFloat(importe_ars.toFixed(2)),
          importe_usd: parseFloat(importe_usd.toFixed(2))
        };
      });

      entriesForEditing.sort((a, b) => {
        if (a.rubro_nombre < b.rubro_nombre) return -1;
        if (a.rubro_nombre > b.rubro_nombre) return 1;
        if (a.concepto < b.concepto) return -1;
        if (a.concepto > b.concepto) return 1;
        return 0;
      });

      setEntriesForEditing(entriesForEditing);
    } catch (err) {
      console.error('Error al cargar entradas para el día seleccionado:', err.message);
      setError('Error al cargar entradas para el día seleccionado.');
    } finally {
      setLoading(false);
    }
  };

  const handleEntryChange = (index, field, value) => {
    const updated = [...entriesForEditing];
    updated[index][field] = value;

    const entry = updated[index];
    const tasa = entry.tipoCambio;

    if (tasa > 0) {
      if (field === 'monto') {
        entry.monto = parseFloat(value) || 0;
      }

      if (entry.moneda === 'ARS') {
        entry.importe_ars = entry.monto;
        entry.importe_usd = entry.monto / tasa;
      } else {
        entry.importe_usd = entry.monto;
        entry.importe_ars = entry.monto * tasa;
      }
    } else {
      entry.importe_ars = 0;
      entry.importe_usd = 0;
    }

    setEntriesForEditing(updated);
  };

  const handleSaveDay = async () => {
    setLoading(true);
    setError(null);
    try {
      const tcForDay = tiposCambio.find(tc => tc.fecha === selectedDate);
      const tipoCambioId = tcForDay ? tcForDay.id : null;

      const entriesToUpsert = entriesForEditing.map(entry => ({
        id: entry.id,
        estado_financiero_id: entry.estado_financiero_id,
        tipo: entry.tipo,
        usuario_id: user.id,
        fecha: selectedDate,
        moneda: entry.moneda,
        importe_ars: parseFloat(entry.importe_ars) || 0,
        importe_usd: parseFloat(entry.importe_usd) || 0,
        tipo_cambio_id: tipoCambioId,
        concepto_id: entry.concepto_id,
      }));

      const { error: upsertError } = await supabase
        .from('entradas_contables')
        .upsert(entriesToUpsert);

      if (upsertError) throw upsertError;

      alert('Cambios guardados con éxito.');
      loadData();
      setView('list');
    } catch (err) {
      console.error('Error al guardar el día:', err.message);
      setError('Error al guardar el día. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDay = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('entradas_contables')
        .delete()
        .eq('usuario_id', user.id)
        .eq('fecha', selectedDate);

      if (deleteError) throw deleteError;

      alert('Día eliminado con éxito.');
      loadData();
      setView('list');
      setShowDeleteDayModal(false);
    } catch (err) {
      console.error('Error al eliminar el día:', err.message);
      setError('Error al eliminar el día. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const renderListView = () => (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">Días Contables</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {Object.keys(entriesByDate).length > 0 ? (
          Object.keys(entriesByDate).map(date => (
            <div
              key={date}
              className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150"
            >
              <span className="font-medium text-gray-800">
                {new Date(date + 'T00:00:00').toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                <span className="text-sm text-gray-500 ml-2">
                  ({entriesByDate[date].length} registros)
                </span>
              </span>
              <button
                onClick={() => openEditView(date)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors duration-150"
              >
                Editar
              </button>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-8">No hay días registrados.</p>
        )}
      </div>
    </div>
  );

  const renderEditView = () => (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          Editar registros - {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setView('list')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
          >
            Volver
          </button>
          <button
            onClick={handleSaveDay}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
          >
            Guardar Cambios
          </button>
          <button
            onClick={() => setShowDeleteDayModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
          >
            Eliminar Día
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rubro</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Moneda</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tipo de Cambio</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor ARS</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor USD</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entriesForEditing.map((entry, index) => (
              <tr key={entry.id}>
                <td className="p-1 whitespace-nowrap text-sm text-gray-600">{entry.rubro_nombre}</td>
                <td className="p-1 whitespace-nowrap text-sm font-medium text-gray-800">{entry.concepto}</td>
                <td className="p-1">
                  <select
                    value={entry.moneda}
                    onChange={(e) => handleEntryChange(index, 'moneda', e.target.value)}
                    className="w-full text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </td>
                <td className="p-1 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={entry.monto}
                    onChange={(e) => handleEntryChange(index, 'monto', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-right"
                  />
                </td>
                <td className="p-1 whitespace-nowrap text-sm text-gray-600 text-right">
                  {entry.tipoCambio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-1 whitespace-nowrap text-sm text-gray-600 text-right">
                  ${entry.importe_ars.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-1 whitespace-nowrap text-sm text-gray-600 text-right">
                  ${entry.importe_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        currentView="entradas-contables"
        setCurrentView={setCurrentView}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-semibold text-gray-800">Entradas Contables</h2>
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
            view === 'list' ? renderListView() : renderEditView()
          )}
        </main>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteDayModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirmar Eliminación</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar todas las entradas del día{' '}
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR')}?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowDeleteDayModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteDay}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
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
EOL