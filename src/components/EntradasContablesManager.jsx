import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import iconImage from '../assets/icon.png';

export default function EntradasContablesManager({ user, setCurrentView }) {
  const [entriesByDate, setEntriesByDate] = useState({});
  const [rubrosAndConceptos, setRubrosAndConceptos] = useState([]);
  const [tiposCambio, setTiposCambio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [view, setView] = useState('list');
  const [selectedDate, setSelectedDate] = useState('');
  const [entriesForEditing, setEntriesForEditing] = useState([]);
  const [showDeleteDayModal, setShowDeleteDayModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [currentFileEntry, setCurrentFileEntry] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const openEditView = (date) => {
    setSelectedDate(date);
    setView('edit');
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (view === 'edit') {
      const saved = sessionStorage.getItem('editing_day_' + selectedDate);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setEntriesForEditing(parsed);
          setLoading(false);
          return;
        } catch (e) {
          console.warn('No se pudo recuperar los datos guardados');
        }
      }
      loadEntriesForEditing();
    }
  }, [view, selectedDate, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: tcData, error: tcError } = await supabase
        .from('tipos_cambio')
        .select('id, fecha, tasa')
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false });
      if (tcError) throw tcError;
      setTiposCambio(tcData || []);

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
          archivo_url,
          conceptos_contables (
            concepto,
            rubro_id,
            rubros (nombre)
          )
        `)
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false });
      if (entriesError) throw entriesError;

      const grouped = {};
      allEntries.forEach(entry => {
        const date = entry.fecha;
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(entry);
      });
      setEntriesByDate(grouped);

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

  const getSignedUrl = async (path) => {
    try {
      const { data, error } = await supabase.storage
        .from('entradas-archivos')
        .createSignedUrl(path, 60);
      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      console.error('Error al obtener URL firmada:', err);
      return null;
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
          archivo_url,
          conceptos_contables (
            concepto,
            rubro_id,
            rubros (nombre)
          )
        `)
        .eq('usuario_id', user.id)
        .eq('fecha', selectedDate);
      if (entriesError) throw entriesError;

      const tcForDay = tiposCambio.find(tc => tc.fecha === selectedDate);
      const tasaActual = tcForDay?.tasa || 1;

      const entriesForEditing = await Promise.all(entriesData.map(async entry => {
        const concept = rubrosAndConceptos.find(c => c.id === entry.concepto_id);
        let monto = entry.moneda === 'ARS' ? entry.importe_ars : entry.importe_usd;

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
          importe_usd: parseFloat(importe_usd.toFixed(2)),
        };
      }));

      entriesForEditing.sort((a, b) => {
        if (a.rubro_nombre < b.rubro_nombre) return -1;
        if (a.rubro_nombre > b.rubro_nombre) return 1;
        if (a.concepto < b.concepto) return -1;
        if (a.concepto > b.concepto) return 1;
        return 0;
      });

      setEntriesForEditing(entriesForEditing);

      try {
        sessionStorage.setItem('editing_day_' + selectedDate, JSON.stringify(entriesForEditing));
      } catch (e) {
        console.warn('No se pudo guardar en sessionStorage');
      }
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
      if (field === 'moneda') {
        if (entry.moneda === 'ARS') {
          entry.monto = entry.importe_ars;
        } else {
          entry.monto = entry.importe_usd;
        }
      }

      if (entry.moneda === 'ARS') {
        entry.importe_ars = entry.monto;
        entry.importe_usd = entry.monto / tasa;
      } else {
        entry.importe_usd = entry.monto;
        entry.importe_ars = entry.importe_usd * tasa;
      }
    } else {
      entry.importe_ars = 0;
      entry.importe_usd = 0;
    }

    setEntriesForEditing(updated);

    try {
      sessionStorage.setItem('editing_day_' + selectedDate, JSON.stringify(updated));
    } catch (e) {
      console.warn('No se pudo guardar en sessionStorage');
    }
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
        archivo_url: entry.archivo_url
      }));

      const { error: upsertError } = await supabase
        .from('entradas_contables')
        .upsert(entriesToUpsert);

      if (upsertError) throw upsertError;

      try {
        sessionStorage.removeItem('editing_day_' + selectedDate);
      } catch (e) {
        console.warn('No se pudo limpiar sessionStorage');
      }

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

      try {
        sessionStorage.removeItem('editing_day_' + selectedDate);
      } catch (e) {
        console.warn('No se pudo limpiar sessionStorage');
      }

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

  const openFileModal = (entry) => {
    setCurrentFileEntry(entry);
    setFileToUpload(null);
    setUploadError('');
    setShowFileModal(true);
  };
  
  const closeFileModal = () => {
    setShowFileModal(false);
    setCurrentFileEntry(null);
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileToUpload(file);
    }
  };
  
  const handleViewFile = async (entry) => {
    try {
        if (!entry.archivo_url) {
            alert('No se encontró un archivo para este registro.');
            return;
        }

        const fullUrlParts = entry.archivo_url.split('/public/entradas-archivos/');
        if (fullUrlParts.length < 2) {
            console.error('URL del archivo no tiene el formato esperado:', entry.archivo_url);
            alert('La URL del archivo no es válida.');
            return;
        }
        const filePath = fullUrlParts[1];

        const { data, error } = await supabase.storage
            .from('entradas-archivos')
            .createSignedUrl(filePath, 60);

        if (error) throw error;
        
        window.open(data.signedUrl, '_blank');
        
    } catch (err) {
        console.error('Error al generar la URL firmada:', err);
        alert('Hubo un error al intentar ver el archivo. Intenta de nuevo.');
    }
};

  const handleRemoveFile = async (entry, index) => {
    const confirmRemove = window.confirm("¿Estás seguro de que quieres eliminar el archivo de este registro? Esta acción es irreversible.");
    if (confirmRemove) {
        const path = entry.archivo_url.split('/public/entradas-archivos/')[1];
        
        try {
            const { error: deleteStorageError } = await supabase.storage
                .from('entradas-archivos')
                .remove([path]);
            
            if (deleteStorageError) throw deleteStorageError;

            const { error: updateDbError } = await supabase
                .from('entradas_contables')
                .update({ archivo_url: null })
                .eq('id', entry.id)
                .eq('usuario_id', user.id);

            if (updateDbError) throw updateDbError;

            const updatedEntries = [...entriesForEditing];
            updatedEntries[index].archivo_url = null;
            setEntriesForEditing(updatedEntries);
            
            alert('Archivo eliminado con éxito.');
            loadEntriesForEditing();
        } catch (err) {
            console.error('Error al eliminar el archivo:', err);
            alert('Error al eliminar el archivo. Intenta de nuevo.');
        }
    }
  };
  
  const handleFileUpload = async () => {
    if (!fileToUpload) {
      setUploadError('No se ha seleccionado ningún archivo.');
      return;
    }
    if (!currentFileEntry) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${currentFileEntry.id}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('entradas-archivos')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('entradas-archivos')
        .getPublicUrl(filePath);

      if (!publicUrlData) throw new Error("No se pudo obtener la URL pública del archivo");

      const newUrl = publicUrlData.publicUrl;

      const { error: updateDbError } = await supabase
          .from('entradas_contables')
          .update({ archivo_url: newUrl })
          .eq('id', currentFileEntry.id)
          .eq('usuario_id', user.id); 

      if (updateDbError) throw updateDbError;

      const updatedEntries = [...entriesForEditing];
      const index = updatedEntries.findIndex(e => e.id === currentFileEntry.id);
      if (index !== -1) {
        updatedEntries[index].archivo_url = newUrl;
        setEntriesForEditing(updatedEntries);
        sessionStorage.setItem('editing_day_' + selectedDate, JSON.stringify(updatedEntries));
      }

      setUploadError('Archivo subido y guardado con éxito.');
      closeFileModal();
    } catch (err) {
      console.error('Error al subir el archivo:', err);
      setUploadError('Error al subir el archivo. Intenta de nuevo.');
    } finally {
      setIsUploading(false);
      setFileToUpload(null);
    }
  };
  
  const renderListView = () => (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2d00/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.28-8.28Z" />
                </svg>
                <span>Editar</span>
              </button>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-8">No hay días registrados.</p>
        )}
      </div>
    </div>
  );

  const renderEditView = () => {
    const totales = entriesForEditing?.length > 0
      ? entriesForEditing.reduce((acc, entry) => {
          if (!entry?.tipo) return acc;
          if (!acc[entry.tipo]) {
            acc[entry.tipo] = { ars: 0, usd: 0 };
          }
          acc[entry.tipo].ars += entry.importe_ars || 0;
          acc[entry.tipo].usd += entry.importe_usd || 0;
          return acc;
        }, {})
      : {};

    const activoCorriente = totales['Activo Corriente']?.ars || 0;
    const activoNoCorriente = totales['Activo No Corriente']?.ars || 0;
    const pasivo = totales['Pasivo']?.ars || 0;
    const patrimonioNetoARS = (activoCorriente + activoNoCorriente) - pasivo;

    const tasaRef = entriesForEditing[0]?.tipoCambio || 1;
    const patrimonioNetoUSD = tasaRef > 0 ? patrimonioNetoARS / tasaRef : 0;
    
    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
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

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Los valores se recalculan automáticamente con el tipo de cambio actual del día.
          </p>
        </div>

        <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="bg-white">
              <tr className="bg-gray-50">
                <td className="w-[85%] px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Activo Corriente</td>
                <td className="w-[15%] px-3 py-2 text-right font-bold text-green-700">
                  ${(totales['Activo Corriente']?.ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
                <td className="w-[15%] px-3 py-2 text-right font-bold text-green-700">
                  ${(totales['Activo Corriente']?.usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="w-[85%] px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Activo No Corriente</td>
                <td className="w-[15%] px-3 py-2 text-right font-bold text-green-500">
                  ${(totales['Activo No Corriente']?.ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
                <td className="w-[15%] px-3 py-2 text-right font-bold text-green-500">
                  ${(totales['Activo No Corriente']?.usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="w-[85%] px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pasivo</td>
                <td className="w-[15%] px-3 py-2 text-right font-bold text-red-600">
                  ${(totales['Pasivo']?.ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
                <td className="w-[15%] px-3 py-2 text-right font-bold text-red-600">
                  ${(totales['Pasivo']?.usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
                <td className="w-[85%] px-3 py-2 text-right text-lg text-gray-800">Patrimonio Neto</td>
                <td className="w-[15%] px-3 py-2 text-right text-lg text-gray-800">
                  ${patrimonioNetoARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
                <td className="w-[15%] px-3 py-2 text-right text-lg text-gray-800">
                  ${patrimonioNetoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Agregado para habilitar el scroll vertical */}
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-[15%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rubro</th>
                <th className="w-[20%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                <th className="w-[10%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Imagen</th>
                <th className="w-[10%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Moneda</th>
                <th className="w-[10%] px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                <th className="w-[15%] px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tipo de Cambio</th>
                <th className="w-[10%] px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor ARS</th>
                <th className="w-[10%] px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor USD</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entriesForEditing.length > 0 ? (
                entriesForEditing.map((entry, index) => (
                  <tr key={entry.id}>
                    <td className="p-1 whitespace-nowrap text-sm text-gray-600">{entry.rubro_nombre}</td>
                    <td className="p-1 whitespace-nowrap text-sm font-medium text-gray-800">{entry.concepto}</td>
                    <td className="p-1 whitespace-nowrap text-sm flex items-center space-x-2">
                      {entry.archivo_url ? (
                        <>
                          <button
                            onClick={() => handleViewFile(entry)}
                            className="px-3 py-1 rounded-md text-white text-xs font-medium transition-colors duration-150 bg-indigo-600 hover:bg-indigo-700"
                          >
                            Ver Archivo
                          </button>
                          <button
                            onClick={() => handleRemoveFile(entry, index)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            (Eliminar)
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openFileModal(entry)}
                          className="px-3 py-1 rounded-md text-white text-xs font-medium transition-colors duration-150 bg-gray-400 hover:bg-gray-500"
                        >
                          Anexar Archivo
                        </button>
                      )}
                    </td>
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
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                    No hay entradas contables para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">


      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-6">
          <div className="flex items-center space-x-4 mb-2">
            <img src={iconImage} alt="Gestión Patrimonial Icono" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-indigo-600">Gestión Patrimonial</span>
          </div>
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
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}?
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

      {/* Modal para anexar o ver archivo */}
      {showFileModal && currentFileEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Anexar Archivo</h3>
            
            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {uploadError}
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seleccionar un archivo:
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {fileToUpload && (
                <p className="text-sm text-gray-600 mt-2">
                  Archivo seleccionado: <span className="font-medium">{fileToUpload.name}</span>
                </p>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={closeFileModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleFileUpload}
                disabled={!fileToUpload || isUploading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors duration-150 flex items-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.962l2-2.671z"></path>
                  </svg>
                ) : null}
                <span>{isUploading ? 'Subiendo...' : 'Subir y Guardar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}