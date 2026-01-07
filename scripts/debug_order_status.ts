
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

async function inspectOrder() {
    console.log('Inspecting order 53612...');

    // Try to find the order or order_item
    // The user screenshot shows "53612" which is likely the display_id (order_id) from 'orders' table
    // We need to join with order_items or find the item linked to it.

    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, order_id, created_at')
        .eq('order_id', '53612');

    if (orderError) {
        console.error('Error fetching order:', orderError);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log('Order 53612 not found in orders table.');
        return;
    }

    const order = orders[0];
    console.log('Found Order:', order);

    const { data: items, error: itemError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

    if (itemError) {
        console.error('Error fetching items:', itemError);
        return;
    }

    console.log('Order Items:', JSON.stringify(items, null, 2));
}

inspectOrder();
