import fetch from 'node-fetch';

async function testDocta() {
  const url = new URL('https://www.doctacapital.com.ar/api/series');
  url.searchParams.append('fromDate', '2025-08-29T03%3A00%3A00.000Z'); // Codificado
  url.searchParams.append('adjusted', 'false');
  url.searchParams.append('markets', 'stock.bond.cedear');
  url.searchParams.append('tickers', 'GGAL');
  url.searchParams.append('columns', 'ticker,last_price');
  url.searchParams.append('format', 'csv');
  url.searchParams.append('token', 'b9185669-9246-44ff-841c-2026baa88941');
  url.searchParams.append('t', new Date().getTime()); // Timestamp

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Google-Apps-Script)',
        'Accept': 'text/csv,*/*',
        'Referer': 'https://script.google.com/'
      }
    });

    const csvText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${csvText}`);
    }

    console.log('✅ Conexión exitosa con Docta Capital');
    console.log('📦 Respuesta:', csvText);
  } catch (error) {
    console.error('❌ Error al conectar con Docta Capital:', error.message);
  }
}

testDocta();
