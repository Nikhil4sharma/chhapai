
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY; // OR Service Role if needed

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('Inspecting order_items table...');
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error selecting from order_items:', error);
    // If we can't select, we definitely can't check columns easily via select.
    // Try explicit RPC or look at error message.
  } else {
    console.log('Sample row keys:', data && data.length > 0 ? Object.keys(data[0]) : 'No rows found');
  }
}

inspect();
