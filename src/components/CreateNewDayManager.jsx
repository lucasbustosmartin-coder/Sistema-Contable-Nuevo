import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import iconImage from '../assets/icon.png';

export default function CreateNewDayManager({ user, setCurrentView }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entriesByDate, setEntriesByDate] = useState({});
  const [rubrosAndConceptos, setRubrosAndConceptos] = useState([]);
  const [estados, setEstados] = useState([]);
  const [tiposCambio, setTiposCambio] = useState([]);
  const [newDayDate, setNewDayDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadInitialData();
  }, [user]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: allEntries, error: entriesError } = await supabase
        .from('entradas_contables')
        .select(`id, fecha, concepto_id`)
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false });
      if (entriesError) throw entriesError;
      
      const groupedEntries = {};
      if (allEntries) {
        allEntries.forEach(entry => {
          const date = entry.fecha;
          if (!groupedEntries[date]) {
            groupedEntries[date] = [];
          }
          groupedEntries[date].push(entry);
        });
      }
      setEntriesByDate(groupedEntries);
      
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
      if (rubrosData) {
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
      }
      
      setRubrosAndConceptos(conceptsList);

      const { data: estadosData, error: estadosError } = await supabase
        .from('estados_financieros')
        .select('*')
        .eq('usuario_id', user.id)
        .order('nombre', { ascending: true });
      if (estadosError) throw estadosError;
      setEstados(estadosData || []);

      const { data: allTasaData, error: tcError } = await supabase
        .from('tipos_cambio')
        .select('tasa, id, fecha')
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false });
      if (tcError) throw tcError;
      setTiposCambio(allTasaData || []);

    } catch (err) {
      console.error('Error al cargar datos iniciales:', err.message);
      setError('Error al cargar datos iniciales. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDay = async (dateToCreate) => {
    setLoading(true);
    setError(null);
    
    const { data: tcForNewDay, error: tcError } = await supabase
      .from('tipos_cambio')
      .select('id, tasa')
      .eq('usuario_id', user.id)
      .eq('fecha', dateToCreate)
      .single();

    if (tcError) {
      alert(`No se encontró un tipo de cambio para la fecha ${dateToCreate}. Por favor, regístrelo antes de crear un nuevo día.`);
      setLoading(false);
      return;
    }

    if (entriesByDate[dateToCreate]) {
        alert('Ya existen entradas para esta fecha. Redirigiendo a la vista de edición.');
        setCurrentView('entradas-contables');
        return;
    }
    
    let entriesToInsert = [];
    const sortedDates = Object.keys(entriesByDate).sort().reverse();
    const lastDate = sortedDates.find(d => d < dateToCreate);

    if (lastDate) {
      const { data: lastDayEntries, error: fetchError } = await supabase
        .from('entradas_contables')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('fecha', lastDate);
      
      if (fetchError) {
        setError('Error al replicar entradas del último día.');
        setLoading(false);
        return;
      }

      entriesToInsert = rubrosAndConceptos.map(rc => {
        const existingEntry = lastDayEntries.find(entry => entry.concepto_id === rc.id);
        const estadoId = estados.length > 0 ? estados[0].id : '';
        const tasa = tcForNewDay?.tasa;
        
        let importe_ars = 0;
        let importe_usd = 0;
        let moneda = 'ARS';

        if (existingEntry) {
          moneda = existingEntry.moneda;
          if (existingEntry.moneda === 'USD') {
            importe_usd = existingEntry.importe_usd;
            importe_ars = existingEntry.importe_usd * tasa;
          } else {
            importe_ars = existingEntry.importe_ars;
            importe_usd = existingEntry.importe_ars / tasa;
          }
        }
        
        return {
          estado_financiero_id: estadoId,
          concepto_id: rc.id,
          importe_ars: importe_ars || 0,
          importe_usd: importe_usd || 0,
          tipo: rc.tipo,
          fecha: dateToCreate,
          tipo_cambio_id: tcForNewDay?.id || null,
          usuario_id: user.id,
          moneda: moneda,
        };
      });
    } else {
      entriesToInsert = rubrosAndConceptos.map(rc => {
        const estadoId = estados.length > 0 ? estados[0].id : '';
        return {
          estado_financiero_id: estadoId,
          concepto_id: rc.id,
          importe_ars: 0,
          importe_usd: 0,
          tipo: rc.tipo,
          fecha: dateToCreate,
          tipo_cambio_id: tcForNewDay?.id || null,
          usuario_id: user.id,
          moneda: 'ARS',
        };
      });
    }

    const { error: insertError } = await supabase
      .from('entradas_contables')
      .insert(entriesToInsert);

    if (insertError) {
      console.error('Error al insertar nuevas entradas:', insertError);
      setError('Error al registrar el nuevo día. Inténtalo de nuevo.');
      setLoading(false);
      return;
    }

    setCurrentView('entradas-contables');
    
  };
  
  return (
    <div className="flex h-screen bg-gray-100 font-sans">
   
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-6">
          <div className="flex items-center space-x-4 mb-2">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800">Registrar Nuevo Día</h2>
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
            <div className="bg-white rounded-xl shadow-md p-6 w-full max-w-sm mx-auto border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Selecciona una fecha</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={newDayDate}
                  onChange={(e) => setNewDayDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setCurrentView('entradas-contables')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-150"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateDay(newDayDate)}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors duration-150"
                >
                  Crear Día
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}