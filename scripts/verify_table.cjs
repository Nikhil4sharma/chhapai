
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        envFile.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                envVars[key] = value;
            }
        });
        return envVars;
    } catch (e) { return {}; }
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("Checking if payment_ledger exists...");
    const { data, error } = await supabase.from('payment_ledger').select('count', { count: 'exact', head: true });

    if (error) {
        console.error("Error accessing payment_ledger:", error.message);
        if (error.code === '42P01') {
            console.log("Table DOES NOT exist.");
        }
    } else {
        console.log("Table payment_ledger EXISTS.");
    }
}

check();
