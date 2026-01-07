
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars manually
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatusColumn() {
    console.log('Checking for status column in order_items...');

    // Try to select the 'status' column from a single row
    const { data, error } = await supabase
        .from('order_items')
        .select('status')
        .limit(1);

    if (error) {
        console.error('Error selecting status column:', error);
        if (error.code === '42703') { // "column does not exist"
            console.log('FAIL: status column does not exist.');
            process.exit(1);
        }
        // Other errors might be permissions, but assuming admin/anon has read access if RLS allows? 
        // Wait, anon key might hit RLS.
        // Ideally we use service role key if available, but anon is what we have typically in .env for frontend.
        // If table has RLS, we might get 0 rows or error.
        console.log('Error details:', error);
    } else {
        console.log('SUCCESS: status column exists.');
        console.log('Data sample:', data);
    }
}

checkStatusColumn();
