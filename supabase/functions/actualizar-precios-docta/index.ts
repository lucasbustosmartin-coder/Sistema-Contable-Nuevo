// En tu archivo index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { user_id } = await req.json();
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.');
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false
      }
    });

    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0];
    const DOCTA_API_URL = `https://www.doctacapital.com.ar/api/series?fromDate=${formattedDate}T03%3A00%3A00.000Z&adjusted=false&tickers=all&columns=date.ticker.last_price.closing_price.opening_price.low_price.high_price.currency.specie.submarket&format=csv&token=b9185669-9246-44ff-841c-2026baa88941`;
    function parseCSV(csvText) {
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        return [];
      }
      const headers = lines[0].split(",").map(h => h.trim());
      const data = [];
      for(let i = 1; i < lines.length; i++){
        if (!lines[i].trim()) continue;
        const row = lines[i].split(",");
        const item = {};
        headers.forEach((header, index) => {
          item[header] = (row[index]?.replace(/^"(.*)"$/, "$1") || "").trim();
        });
        data.push(item);
      }
      return data;
    }
    
    // ✅ CORRECCIÓN: Se eliminó el filtro por usuario_id al obtener los activos
    const { data: activosUsuario, error: fetchActivosError } = await supabase
      .from('activos')
      .select('id, simbolo, tipo, moneda, submarket');

    if (fetchActivosError) {
      console.error('Error al obtener activos:', fetchActivosError);
      throw new Error('No se pudieron obtener los activos.');
    }
    const activosExistentes = new Map(activosUsuario.map(activo => [activo.simbolo.toUpperCase(), activo]));

    const response = await fetch(DOCTA_API_URL + "&t=" + new Date().getTime());
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    
    const csvData = await response.text();
    const priceData = parseCSV(csvData);

    // ✅ CORRECCIÓN: Se obtiene el tipo de cambio sin filtrar por usuario_id
    const { data: tcData, error: tcError } = await supabase
      .from('tipos_cambio')
      .select('tasa')
      .order('fecha', { ascending: false })
      .limit(1)
      .single();

    if (tcError) {
      return new Response(JSON.stringify({
        error: 'No se pudo obtener el tipo de cambio de la base de datos.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const tipoCambio = tcData?.tasa;
    if (!tipoCambio) {
      return new Response(JSON.stringify({
        error: 'Tipo de cambio no disponible. Por favor, agregue un tipo de cambio primero.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const tipoMap = {
      'STOCK': 'accion',
      'BOPREAL': 'bono',
      'CEDEAR': 'cedear',
      'ON': 'on',
      'SUB_SOBERANO_BADLAR': 'bono',
      'DOLLAR_LINKED': 'bono',
      'ON_TAMAR': 'bono',
      'CER': 'bono',
      'FIXED_RATE': 'bono',
      'TAMAR': 'bono',
      'SUB_SOBERANO': 'bono',
      'ON_DOLLAR_LINKED': 'bono',
      'HARD_DOLLAR': 'bono'
    };

    let registrosActualizados = 0;
    let registrosNuevos = 0;
    const errors = [];
    const updateOperations = [];
    const insertOperations = [];
    
    priceData.forEach(apiActivo => {
      const simboloAPI = (apiActivo.ticker || '').toUpperCase().replace('.BA', '');
      const activoDB = activosExistentes.get(simboloAPI);

      if (!apiActivo.last_price || !simboloAPI) {
        console.log(`Advertencia: datos faltantes para el ticker: ${apiActivo.ticker}`);
        return;
      }
      
      const precioARS = parseFloat(apiActivo.last_price);
      const precioUSD = parseFloat((precioARS / tipoCambio).toFixed(4));
      const submarket = apiActivo.submarket || null;
      const nombre = apiActivo.specie || null;
      const monedaAPI = apiActivo.currency || 'ARS';

      // ✅ CORRECCIÓN: Se determina el tipo tanto para actualización como para inserción
      const tipo = tipoMap[submarket?.toUpperCase()] || 'No definido';

      if (activoDB) {
        // Actualizar activo existente
        const updatePayload = {
          ultimo_precio: precioUSD,
          ultimo_precio_ars: precioARS,
          fecha_actualizacion: new Date().toISOString(),
          submarket: submarket,
          moneda: monedaAPI,
          tipo: tipo // ✅ AGREGADO: Se actualiza el tipo
        };
        updateOperations.push(async () => {
          try {
            const { error: updateError } = await supabase
              .from('activos')
              .update(updatePayload)
              .eq('id', activoDB.id);
            if (updateError) throw updateError;
            registrosActualizados++;
          } catch (updateError) {
            console.error(`Error al actualizar ${simboloAPI}:`, updateError.message);
            errors.push({ activo: simboloAPI, error: updateError.message });
          }
        });
      } else {
        // Insertar nuevo activo
        if (nombre && submarket && simboloAPI) {
          const insertPayload = {
            simbolo: simboloAPI,
            nombre: nombre,
            moneda: monedaAPI,
            tipo: tipo, // ✅ ACTUALIZADO
            submarket: submarket,
            ultimo_precio: precioUSD,
            ultimo_precio_ars: precioARS,
            fecha_actualizacion: new Date().toISOString()
          };
          insertOperations.push(async () => {
            try {
              const { error: insertError } = await supabase
                .from('activos')
                .insert(insertPayload);
              if (insertError) throw insertError;
              registrosNuevos++;
            } catch (insertError) {
              console.error(`Error al insertar ${simboloAPI}:`, insertError.message);
              errors.push({ activo: simboloAPI, error: insertError.message });
            }
          });
        }
      }
    });

    await Promise.all(updateOperations.map(op => op()));
    await Promise.all(insertOperations.map(op => op()));

    if (errors.length > 0) {
      return new Response(JSON.stringify({
        message: `Se completó la actualización de precios, pero hubo ${errors.length} errores.`,
        details: errors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 207
      });
    }
    return new Response(JSON.stringify({
      message: `Precios actualizados correctamente. ${registrosActualizados} registros modificados. ${registrosNuevos} registros nuevos.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message || 'Error desconocido'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});