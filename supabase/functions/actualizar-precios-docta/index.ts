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
    const DOCTA_API_URL = `https://www.doctacapital.com.ar/api/series?fromDate=${formattedDate}T03%3A00%3A00.000Z&adjusted=false&markets=stock.bond.cedear&tickers=all&columns=date.ticker.last_price.closing_price.opening_price.low_price.high_price&format=csv&token=b9185669-9246-44ff-841c-2026baa88941`;
    function parseCSV(csvText) {
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        throw new Error("CSV vacío");
      }
      const headers = lines[0].split(",").map((h)=>h.trim());
      const data = [];
      for(let i = 1; i < lines.length; i++){
        if (!lines[i].trim()) continue;
        const row = lines[i].split(",");
        const item = {};
        headers.forEach((header, index)=>{
          item[header] = (row[index]?.replace(/^"(.*)"$/, "$1") || "").trim();
        });
        data.push(item);
      }
      return data;
    }
    const { data: activosUsuario, error: fetchActivosError } = await supabase.from('activos').select('id, simbolo, tipo, moneda, ultimo_precio, ultimo_precio_ars').eq('usuario_id', user_id);
    if (fetchActivosError) {
      console.error('Error al obtener activos del usuario:', fetchActivosError);
      throw new Error('No se pudieron obtener los activos del usuario.');
    }
    if (!activosUsuario || activosUsuario.length === 0) {
      console.log('No se encontraron activos para el usuario. Finalizando.');
      return new Response(JSON.stringify({
        message: 'No se encontraron activos para actualizar.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    const response = await fetch(DOCTA_API_URL + "&t=" + new Date().getTime());
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    const csvData = await response.text();
    const priceData = parseCSV(csvData);
    const priceMap = {};
    priceData.forEach((item)=>{
      if (item.ticker && item.last_price) {
        const ticker = item.ticker.toUpperCase();
        priceMap[ticker.replace('.BA', '')] = parseFloat(item.last_price);
        priceMap[ticker] = parseFloat(item.last_price);
      }
    });
    // ✅ CORREGIDO: Se obtiene el tipo de cambio filtrando por el user_id
    const { data: tcData, error: tcError } = await supabase.from('tipos_cambio').select('tasa').eq('usuario_id', user_id).order('fecha', {
      ascending: false
    }).limit(1).single();
    if (tcError) {
      return new Response(JSON.stringify({
        error: 'No se pudo obtener el tipo de cambio de la base de datos.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    const tipoCambio = tcData?.tasa;
    if (!tipoCambio) {
      return new Response(JSON.stringify({
        error: 'Tipo de cambio no disponible. Por favor, agregue un tipo de cambio primero.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    let registrosActualizados = 0;
    const errors = [];
    const updateOperations = activosUsuario.map((activo)=>{
      return async ()=>{
        const simboloDB = activo.simbolo.toUpperCase();
        let precioAPI = priceMap[simboloDB];
        if (precioAPI === undefined) {
          console.log(`Advertencia: No se encontró precio para el símbolo ${activo.simbolo}`);
          return;
        }
        let ultimo_precio_usd;
        let ultimo_precio_ars;
        
        // Asumiendo que todos los precios de la API son en ARS
        ultimo_precio_ars = precioAPI;
        ultimo_precio_usd = parseFloat((precioAPI / tipoCambio).toFixed(4));
        
        const updatePayload = {
          fecha_actualizacion: new Date().toISOString(),
          ultimo_precio: ultimo_precio_usd,
          ultimo_precio_ars: ultimo_precio_ars
        };
        try {
          await supabase.from('activos').update(updatePayload).eq('id', activo.id).eq('usuario_id', user_id);
          registrosActualizados++;
        } catch (updateError) {
          console.error(`Error al actualizar el activo ${activo.simbolo}:`, updateError);
          errors.push({
            activo: activo.simbolo,
            error: updateError.message
          });
        }
      };
    });
    await Promise.all(updateOperations.map((op)=>op()));
    if (errors.length > 0) {
      return new Response(JSON.stringify({
        message: `Se completó la actualización de precios, pero hubo ${errors.length} errores.`,
        details: errors
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 207
      });
    }
    return new Response(JSON.stringify({
      message: `Precios actualizados correctamente. ${registrosActualizados} registros modificados.`
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message || 'Error desconocido'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});