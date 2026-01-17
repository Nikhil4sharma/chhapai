
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars from .env file manually or just use process.env if loaded
// Since we are running via tsx, we might need to load them.
// Hardcoding for this specific debug script is safer if we can read the file, but I'll try to rely on the environment or read .env.

// Actually, I'll just read the .env file content first to get the keys? 
// No, I'll assume standard vite envs are available or I will grab them from the file system.

const SUPABASE_URL = 'https://hswgdeldouyclpeqbbgq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("--- Checking User Profiles ---");
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department');

    if (profileError) console.error("Error fetching profiles:", profileError);
    else {
        console.table(profiles);
        // specific check for expected agents
        const targets = ['rohini@chhapai.in', 'work@chhapai.in', 'chd+1@chhapai.in'];
        profiles?.forEach(p => {
            if (p.email && targets.some(t => p.email.includes(t))) {
                console.log(`FOUND TARGET: ${p.email} -> ID: ${p.id}`);
            }
        });
    }

    console.log("\n--- Checking Last 3 Debug Payloads ---");
    const { data: payloads, error: payloadError } = await supabase
        .from('debug_payloads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (payloadError) {
        console.error("Error fetching debug_payloads (table might not exist?):", payloadError);
    } else {
        payloads.forEach((p, i) => {
            console.log(`\n[Payload ${i + 1}] ID: ${p.id} Created: ${p.created_at}`);
            const data = typeof p.payload === 'string' ? JSON.parse(p.payload) : p.payload;

            // Log relevant keys
            console.log("  Top Level Keys:", Object.keys(data).filter(k => k.includes('agent') || k.includes('user')));
            console.log("  Order ID:", data.id);
            console.log("  Status:", data.status);

            // Check for Agent info
            const meta = data.meta_data || [];
            console.log("  Meta Data (Agent Check):");
            meta.forEach((m: any) => {
                if (['sales_agent', 'agent', 'ordered_by', '_sales_agent'].includes(m.key)) {
                    console.log(`    FOUND AGENT META: ${m.key} = ${m.value}`);
                }
            });
        });
    }
}

main();
