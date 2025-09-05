import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
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

    const fromDate = '2023-01-01';
    const cacheBuster = Date.now();
    const DOCTA_API_URL = `https://www.doctacapital.com.ar/api/dollar-series?fromDate=${fromDate}T03%3A00%3A00.000Z&columns=date.usd_mep.usd_ccl.usd_oficial&format=csv&token=b9185669-9246-44ff-841c-2026baa88941&_=${cacheBuster}`;

    const response = await fetch(DOCTA_API_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const csvData = await response.text();
    const priceData = parseCSV(csvData);

    if (!priceData || priceData.length === 0) {
      return new Response(JSON.stringify({
        error: 'No se recibieron datos válidos de Docta Capital.'
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 500
      });
    }

    const operations = priceData.map((item) => async () => {
      const fecha = item.date.split('T')[0];
      const tasa = parseFloat(item.usd_mep);

      if (isNaN(tasa) || tasa <= 0) {
        return {
          error: `Valor de tasa no válido para la fecha ${fecha}`
        };
      }

      const { data: existingEntry, error: fetchError } = await supabase
        .from('tipos_cambio')
        .select('id')
        .eq('usuario_id', user_id)
        .eq('fecha', fecha)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        return {
          error: `Error al buscar registro para la fecha ${fecha}: ${fetchError.message}`
        };
      }

      if (existingEntry) {
        const { error: updateError } = await supabase
          .from('tipos_cambio')
          .update({ tasa: tasa })
          .eq('id', existingEntry.id);

        if (updateError) {
          return {
            error: `Error al actualizar registro para la fecha ${fecha}: ${updateError.message}`
          };
        }
        return {
          message: 'actualizado'
        };
      } else {
        const { error: insertError } = await supabase
          .from('tipos_cambio')
          .insert({
            usuario_id: user_id,
            fecha: fecha,
            tasa: tasa
          });

        if (insertError) {
          return {
            error: `Error al insertar registro para la fecha ${fecha}: ${insertError.message}`
          };
        }
        return {
          message: 'insertado'
        };
      }
    });

    const results = await Promise.all(operations.map((op) => op()));
    const errors = results.filter((r) => r.error);

    if (errors.length > 0) {
      return new Response(JSON.stringify({
        message: `Se completó la actualización, pero hubo ${errors.length} errores.`,
        details: errors
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 207
      });
    }

    return new Response(JSON.stringify({
      message: 'Tipos de cambio actualizados correctamente.'
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status: 200
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message || 'Error desconocido al ejecutar la función.'
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status: 500
    });
  }
});

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV vacío o sin datos");
  }
  const headers = lines[0].split(",").map((h) => h.trim());
  const data = [];
  for (let i = 1; i < lines.length; i++) {
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