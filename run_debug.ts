
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hswgdeldouyclpeqbbgq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("--- Testing Import Result (After FK Fix) ---");

    // Simulate a payload that SHOULD go to Work/Jaskaran
    const testPayload = {
        order_id: "test-debug-003", // New ID
        status: "processing",
        total: 100,
        customer: {
            email: "test.work2@example.com",
            first_name: "Test",
            last_name: "Work"
        },
        meta_data: [
            { key: "sales_agent", value: "Work" }
        ],
        items: []
    };

    const { data, error } = await supabase.rpc('import_wc_order', { payload: testPayload });
    console.log("Import Result UUID:", data);
    console.log("Error:", error);

    if (data) {
        // Fetch the assigned user for this order
        const { data: orderData } = await supabase
            .from('orders')
            .select('assigned_user')
            .eq('id', data)
            .single();
        console.log("Assigned User ID:", orderData?.assigned_user);
    }
}

main();
