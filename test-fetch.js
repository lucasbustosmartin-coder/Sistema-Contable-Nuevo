fetch('https://zcvkqujfneyphoiaqvuj.supabase.co/functions/v1/actualizar-precios-docta', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdmtxdWpmbmV5cGhvaWFxdnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NTM4MjIsImV4cCI6MjA3MTUyOTgyMn0.DQYhdzdnVxRonkcaNQzzPivwTiZvhF3gc8Fz2aYw6i4',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdmtxdWpmbmV5cGhvaWFxdnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NTM4MjIsImV4cCI6MjA3MTUyOTgyMn0.DQYhdzdnVxRonkcaNQzzPivwTiZvhF3gc8Fz2aYw6i4'
  }
})
.then(r => r.text())
.then(console.log)
.catch(console.error);
