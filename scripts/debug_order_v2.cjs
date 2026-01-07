
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.resolve(process.cwd(), '.env');
let envContent = '';
try {
    envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
    console.error('Could not read .env', e);
    process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        env[key] = val;
    }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('Fetching order 53612...');

    // 1. Get Order ID
    const { data: orders, error: oError } = await supabase
        .from('orders')
        .select('id, order_id')
        .eq('order_id', '53612');

    if (oError) { console.error('Order Error', oError); return; }

    if (!orders || orders.length === 0) {
        console.log('No order found with order_id 53612');
        return;
    }

    const orderId = orders[0].id;
    console.log(`Internal ID: ${orderId}`);

    // 2. Get Items
    const { data: items, error: iError } = await supabase
        .from('order_items')
        .select('id, product_name, current_stage, assigned_department, status')
        .eq('order_id', orderId);

    if (iError) { console.error('Items Error', iError); return; }

    console.log('Detailed Items:', JSON.stringify(items, null, 2));
}

inspect();
