import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const DOCTA_API_URL = "https://www.doctacapital.com.ar/api/dollar-series?fromDate=2025-08-01T03%3A00%3A00.000Z&columns=date.usd_mep.usd_ccl.usd_oficial&format=csv&token=b9185669-9246-44ff-841c-2026baa88941";
  const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdmtxdWpmbmV5cGhvaWFxdnVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTk1MzgyMiwiZXhwIjoyMDcxNTI5ODIyfQ.FqEIgbgHcRhCVFwZfrlP4qZt3hufyuucrat7XzsvlTk';

  const supabase = createClient(
    'https://zcvkqujfneyphoiaqvuj.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY,
  );
  
  function parseCSV(csvText) {
    const lines = csvText.trim().split("\n");
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
    
    const response = await fetch(DOCTA_API_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const csvData = await response.text();
    const priceData = parseCSV(csvData);
    
    if (!priceData || priceData.length === 0) {
      return new Response(JSON.stringify({ error: 'No se recibieron datos válidos de Docta Capital.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // ✅ CORRECCIÓN: Se actualizan los registros para cada fecha de la API
    for (const item of priceData) {
        const fecha = item.date.split('T')[0];
        const tasa = parseFloat(item.usd_mep);

        if (isNaN(tasa)) {
          console.warn(`Valor no válido para usd_mep en la fecha ${fecha}. Se omite.`);
          continue; // Salta a la siguiente iteración si el valor no es un número válido.
        }

        const { data: existingEntry, error: fetchError } = await supabase
            .from('tipos_cambio')
            .select('id')
            .eq('usuario_id', user_id)
            .eq('fecha', fecha)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 es "No se encontró un registro"
            throw fetchError;
        }

        let updateError = null;
        if (existingEntry) {
            // Actualiza el registro existente
            const { error } = await supabase
                .from('tipos_cambio')
                .update({ tasa: tasa })
                .eq('id', existingEntry.id);
            updateError = error;
        } else {
            // Inserta un nuevo registro
            const { error } = await supabase
                .from('tipos_cambio')
                .insert({
                    usuario_id: user_id,
                    fecha: fecha,
                    tasa: tasa
                });
            updateError = error;
        }

        if (updateError) {
            throw updateError;
        }
    }
    
    return new Response(JSON.stringify({ message: 'Tipos de cambio actualizados correctamente.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error desconocido.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
