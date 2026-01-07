const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '..', '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        envFile.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, '');
                envVars[key] = value;
            }
        });
        return envVars;
    } catch (e) {
        console.error('Error loading .env file:', e);
        return process.env;
    }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
let usingServiceKey = true;
let activeKey = serviceKey;

if (!activeKey) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not found. Using VITE_SUPABASE_ANON_KEY. RLS policies will apply.');
    activeKey = env.VITE_SUPABASE_ANON_KEY;
    usingServiceKey = false;
}

if (!supabaseUrl || !activeKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, activeKey);

async function diagnose() {
    console.log('--- Starting Database Diagnosis ---');

    // 1. Check payment_ledger table
    console.log('\n1. Checking payment_ledger table...');
    const { data: ledgerData, error: ledgerError } = await supabase
        .from('payment_ledger')
        .select('id')
        .limit(1);

    if (ledgerError) {
        console.error('❌ Error accessing payment_ledger:', ledgerError.message, ledgerError.code);
        if (ledgerError.code === '42P01') console.error('   -> Table does not exist!');
        if (ledgerError.code === '404') console.error('   -> API returned 404 (Not Found)');
    } else {
        console.log('✅ payment_ledger table exists and is accessible.');
    }

    // 2. Check timeline table
    console.log('\n2. Checking timeline table...');
    const { data: timelineData, error: timelineError } = await supabase
        .from('timeline')
        .select('id')
        .limit(1);

    if (timelineError) {
        console.error('❌ Error accessing timeline:', timelineError.message, timelineError.code);
    } else {
        console.log('✅ timeline table exists.');
    }

    // 3. Check Order #53622 (from screenshot)
    console.log('\n3. Checking Order #53622...');
    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_id, customer_id, customer_name, customer_email')
        .eq('order_id', '53622')
        .single();

    if (orderError) {
        console.error('❌ Error fetching order 53622:', orderError.message);
    } else if (orderData) {
        console.log('✅ Order found:', orderData);
        if (!orderData.customer_id) {
            console.warn('⚠️ Order 53622 has NULL customer_id. This causes "Missing customer association".');
        } else {
            console.log('✅ Order 53622 has customer_id:', orderData.customer_id);
        }
    }

    // 4. Check if we can link customer
    if (orderData && !orderData.customer_id && orderData.customer_email) {
        console.log('\n4. Checking if wc_customers record exists for:', orderData.customer_email);
        const { data: custData, error: custError } = await supabase
            .from('wc_customers')
            .select('id, email')
            .eq('email', orderData.customer_email)
            .maybeSingle();

        if (custData) {
            console.log('✅ Matching customer found in wc_customers:', custData.id);
            console.log('   -> We can run a backfill to link this order.');
        } else {
            console.warn('⚠️ No matching customer found in wc_customers.');
        }
    }

    console.log('\n--- Diagnosis Complete ---');
}

diagnose();
