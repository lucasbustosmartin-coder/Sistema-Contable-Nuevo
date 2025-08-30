import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zcvkqujfneyphoiaqvuj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdmtxdWpmbmV5cGhvaWFxdnVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTk1MzgyMiwiZXhwIjoyMDcxNTI5ODIyfQ.FqEIgbgHcRhCVFwZfrlP4qZt3hufyuucrat7XzsvlTk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  try {
    const { data, error } = await supabase
      .from('activos')
      .select('*')
      .limit(10);

    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Todos los activos:', data);
    }
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
  }
}

test();
