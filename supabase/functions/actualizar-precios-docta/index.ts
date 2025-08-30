import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const DOCTA_API_URL = "https://www.doctacapital.com.ar/api/series?fromDate=2025-08-29T03%3A00%3A00.000Z&adjusted=false&markets=stock.bond.cedear&tickers=all&columns=date.ticker.last_price.closing_price.opening_price.low_price.high_price&format=csv&token=b9185669-9246-44ff-841c-2026baa88941";
  const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdmtxdWpmbmV5cGhvaWFxdnVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTk1MzgyMiwiZXhwIjoyMDcxNTI5ODIyfQ.FqEIgbgHcRhCVFwZfrlP4qZt3hufyuucrat7XzsvlTk';

  const supabase = createClient(
    'https://zcvkqujfneyphoiaqvuj.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY,
  );

  function parseCSV(csvText) {
    const fixedText = csvText.replace(/'(\d{4}-\d{2}-\d{2})/g, '\n$1');
    const lines = fixedText.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("CSV vacío");
    }
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

  try {
    const { user_id } = await req.json();

    const { data: activosUsuario, error: fetchActivosError } = await supabase
      .from('activos')
      .select('id, simbolo, tipo, moneda')
      .eq('usuario_id', user_id);

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
    
    // ✅ CORRECCIÓN: Se busca la última tasa de cambio disponible si no se encuentra la de hoy.
    const { data: tcData, error: tcError } = await supabase
      .from('tipos_cambio')
      .select('tasa')
      .order('fecha', { ascending: false })
      .limit(1)
      .single();

    if (tcError) {
      return new Response(JSON.stringify({ error: 'No se pudo obtener el tipo de cambio de la base de datos.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const tipoCambio = tcData?.tasa;
    
    for (const activo of activosUsuario) {
      const precioDocta = priceMap[activo.simbolo];
      if (precioDocta !== undefined) {
        let ultimo_precio_usd;
        let ultimo_precio_ars;

        ultimo_precio_ars = precioDocta;
        ultimo_precio_usd = precioDocta / tipoCambio;
        
        await supabase
          .from('activos')
          .update({
            ultimo_precio: ultimo_precio_usd,
            ultimo_precio_ars: ultimo_precio_ars,
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq('id', activo.id);
      }
    }
    
    return new Response(JSON.stringify({ message: 'Precios actualizados correctamente.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error desconocido' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
