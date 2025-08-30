import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdmtxdWpmbmV5cGhvaWFxdnVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTk1MzgyMiwiZXhwIjoyMDcxNTI5ODIyfQ.FqEIgbgHcRhCVFwZfrlP4qZt3hufyuucrat7XzsvlTk";
const DOCTA_TOKEN = "b9185669-9246-44ff-841c-2026baa88941";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
      },
    });
  }

  try {
    const userId = "26cf65a4-17e0-46c2-a36f-a37842f3fa8a";

    const {  activos } = await supabase
      .from("activos")
      .select("id, simbolo, moneda")
      .eq("usuario_id", userId);

    if (!activos || activos.length === 0) {
      return new Response(JSON.stringify({ message: "No hay activos" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const tickers = activos.map(a => a.simbolo).join(",");

    const url = new URL("https://www.doctacapital.com.ar/api/series");
    url.searchParams.append("fromDate", "2025-08-29T03:00:00.000Z");
    url.searchParams.append("adjusted", "false");
    url.searchParams.append("markets", "stock.bond.cedear");
    url.searchParams.append("tickers", tickers);
    url.searchParams.append("columns", "ticker,last_price");
    url.searchParams.append("format", "csv");
    url.searchParams.append("token", DOCTA_TOKEN);
    url.searchParams.append("t", Date.now().toString());

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Google-Apps-Script)",
        "Accept": "text/csv,*/*",
        "Referer": "https://script.google.com/"
      }
    });

    const csvText = await response.text();

    if (!response.ok) {
      throw new Error(`Error de Docta: ${response.status} - ${csvText}`);
    }

    const lines = csvText.trim().split("\\n");
    const headers = lines[0].split(",");
    const lastPriceIndex = headers.indexOf("last_price");

    if (lastPriceIndex === -1) {
      throw new Error("No se encontró last_price");
    }

    const priceMap: Record<string, number> = {};
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",");
      const ticker = row[0].replace(/^"(.*)"$/, "$1");
      const price = parseFloat(row[lastPriceIndex]);
      if (!isNaN(price)) {
        priceMap[ticker] = price;
      }
    }

    const today = new Date().toISOString().split("T")[0];
    const {  tcData } = await supabase
      .from("tipos_cambio")
      .select("tasa")
      .eq("fecha", today)
      .single();

    const tipoCambio = tcData?.tasa || 1100;

    for (const activo of activos) {
      const precioUsd = priceMap[activo.simbolo];
      if (precioUsd === undefined) continue;

      const precioArs = activo.moneda === "USD" ? precioUsd * tipoCambio : precioUsd;

      await supabase
        .from("activos")
        .update({
          ultimo_precio: precioUsd,
          ultimo_precio_ars: precioArs,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", activo.id);
    }

    return new Response(JSON.stringify({ success: true, updated: Object.keys(priceMap).length }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});
