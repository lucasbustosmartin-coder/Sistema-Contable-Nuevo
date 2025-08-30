import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zcvkqujfneyphoiaqvuj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdmtxdWpmbmV5cGhvaWFxdnVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTk1MzgyMiwiZXhwIjoyMDcxNTI5ODIyfQ.FqEIgbgHcRhCVFwZfrlP4qZt3hufyuucrat7XzsvlTk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  try {
    console.log('1. Buscando activos...');
    
    const { data, error } = await supabase
      .from('activos')
      .select('*')
      .eq('usuario_id', '26cf65a4-17e0-46c2-a36f-a37842f3fa8a');

    if (error) {
      console.error('Error en la consulta:', error);
      return;
    }

    console.log(`2. Encontrados ${data.length} activos:`);
    console.log(data);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
