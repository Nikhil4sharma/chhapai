// WooCommerce Auto-Import Cron Function
// Runs every 5 minutes to import processing orders from WooCommerce

// Deno types for Supabase Edge Functions
// @ts-ignore - Deno runtime provides these types
declare const Deno: {
    env: {
        get(key: string): string | undefined;
    };
};

// @ts-ignore - Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to normalize order numbers
function normalizeOrderNumber(orderNum: string | number | null | undefined): string {
    if (!orderNum) return '';
    const str = orderNum.toString().trim();
    const withoutPrefix = str.replace(/^(WC|MAN)-/i, '');
    return withoutPrefix.replace(/\D/g, '');
}

// Helper to build full address
function buildFullAddress(addr: any): string {
    if (!addr) return '';
    const parts = [
        addr.address_1,
        addr.address_2,
        addr.city,
        addr.state,
        addr.postcode,
        addr.country,
    ].filter(Boolean);
    return parts.join(', ');
}

// Helper to parse product meta data
function parseProductMeta(metaData: any[]): Record<string, string> {
    const specifications: Record<string, string> = {};

    if (!Array.isArray(metaData)) return specifications;

    const skipKeys = ['_reduced_stock', '_restock_refunded_items', '_product_addons', '_qty'];

    for (const meta of metaData) {
        if (!meta.key || skipKeys.includes(meta.key) || meta.key.startsWith('_')) {
            continue;
        }

        const displayKey = meta.display_key || meta.key;
        const displayValue = meta.display_value || meta.value;

        if (displayValue && typeof displayValue === 'string' && displayValue.trim()) {
            specifications[displayKey] = displayValue.trim();
        }
    }

    return specifications;
}

serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        console.log('[WooCommerce Auto-Import] Starting cron job...');

        // Get credentials from environment
        const storeUrl = Deno.env.get('WOOCOMMERCE_STORE_URL')?.replace(/\/$/, '');
        const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
        const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

        if (!storeUrl || !consumerKey || !consumerSecret) {
            console.error('[WooCommerce Auto-Import] Credentials not configured');
            return new Response(JSON.stringify({
                success: false,
                error: 'WooCommerce credentials not configured'
            }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Create Supabase admin client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        const allOrders: any[] = [];
        const MAX_PAGES = 10; // Process up to 500 processing orders

        // 1. Fetch ALL processing orders (Pagination Loop)
        console.log('[WooCommerce Auto-Import] Fetching processing orders...');
        for (let page = 1; page <= MAX_PAGES; page++) {
            const apiUrl = `${storeUrl}/wp-json/wc/v3/orders?status=processing&per_page=50&page=${page}&orderby=date&order=asc`; // Check old orders first? or desc?
            // User said "53660 purani date... processing m h". DESC gets newest first. ASC gets oldest first.
            // If we want to catch OLD orders, iterating DESC might miss them if we stop early. 
            // ASC will fetch oldest processing first. Let's stick to DESC to prioritise new, but iterate enough pages.
            // Actually, if we use DESC and default page 1, we see NEW first.
            // We need to iterate enough pages to reach OLD ones.
            // Let's us DESC as standard, but ensure loop continues.

            const pagedUrl = `${storeUrl}/wp-json/wc/v3/orders?status=processing&per_page=50&page=${page}&orderby=date&order=desc`;

            const response = await fetch(pagedUrl, {
                headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
            });

            if (!response.ok) break;
            const orders = await response.json();
            if (!orders || orders.length === 0) break;

            allOrders.push(...orders);
            console.log(`[WooCommerce Auto-Import] Page ${page}: Found ${orders.length} processing orders`);

            if (orders.length < 50) break; // End of list
        }

        // 2. Fetch RECENT completed orders (Page 1 only) to sync status
        console.log('[WooCommerce Auto-Import] Fetching recent completed orders...');
        try {
            const completedUrl = `${storeUrl}/wp-json/wc/v3/orders?status=completed&per_page=20&page=1&orderby=date&order=desc`;
            const dimResponse = await fetch(completedUrl, {
                headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
            });
            if (dimResponse.ok) {
                const completedOrders = await dimResponse.json();
                if (completedOrders && completedOrders.length > 0) {
                    allOrders.push(...completedOrders);
                    console.log(`[WooCommerce Auto-Import] Found ${completedOrders.length} recent completed orders`);
                }
            }
        } catch (e) {
            console.warn('Failed to fetch completed orders', e);
        }

        console.log(`[WooCommerce Auto-Import] Total orders to process: ${allOrders.length}`);

        const results = {
            total: allOrders.length,
            imported: 0,
            skipped: 0,
            errors: [] as string[],
        };

        for (const wooOrder of allOrders) {
            try {
                // Determine Status
                const wcStatus = wooOrder.status;
                const isCompleted = wcStatus === 'completed';
                const internalStatus = isCompleted ? 'completed' : 'new_order';

                // Check if already imported
                const { data: existingOrder } = await supabase
                    .from('orders')
                    .select('id, status, order_status')
                    .eq('wc_order_id', wooOrder.id.toString())
                    .maybeSingle();

                // If exists and status matches, skip
                if (existingOrder) {
                    if (existingOrder.order_status === internalStatus) {
                        results.skipped++;
                        continue;
                    }
                    console.log(`[WooCommerce Auto-Import] Updating status for order ${wooOrder.id}: ${existingOrder.order_status} -> ${internalStatus}`);
                }

                // Prepare order payload
                // REMOVED LOCAL ASSIGNMENT LOGIC: delegating strictly to import_wc_order RPC which has robust rules
                const orderPayload = {
                    order_id: wooOrder.number || wooOrder.id.toString(),
                    status: wcStatus, // Pass WC status
                    order_status: internalStatus, // Pass Internal status explicitly
                    payment_status: 'pending',
                    total: parseFloat(wooOrder.total) || 0,
                    // assigned_user_id: assignedUserId, // Let RPC decide based on meta_data
                    sales_agent: typeof wooOrder.sales_agent === 'string' ? wooOrder.sales_agent : undefined, // Explicitly pass if exists on root
                    meta_data: wooOrder.meta_data || [], // CRITICAL: Pass meta_data for RPC to find agent
                    customer: {
                        id: wooOrder.customer_id?.toString() || `guest-${wooOrder.billing?.email || wooOrder.id}`,
                        name: `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim() || 'Guest',
                        email: wooOrder.billing?.email || '',
                        phone: wooOrder.billing?.phone || '',
                        address: buildFullAddress(wooOrder.billing),
                    },
                    items: (wooOrder.line_items || []).map((item: any) => ({
                        name: item.name,
                        quantity: parseInt(item.quantity) || 1,
                        price: parseFloat(item.price) || 0,
                        specs: parseProductMeta(item.meta_data || []),
                    })),
                };

                // Import using RPC
                const { data: orderId, error: rpcError } = await supabase.rpc('import_wc_order', {
                    payload: orderPayload
                });

                if (rpcError) throw rpcError;

                // Sync metadata (Enrich)
                if (!existingOrder) {
                    await supabase.from('orders').update({
                        customer_name: orderPayload.customer.name,
                        customer_email: orderPayload.customer.email,
                        customer_phone: orderPayload.customer.phone,
                        customer_address: orderPayload.customer.address,
                        // Fix: use null as we don't know the assigned user yet (RPC decided it)
                        department_timeline: { sales: { status: 'active', assigned_to: null, timestamp: new Date().toISOString() } }
                    }).eq('id', orderId);

                    // Record import
                    await supabase.from('woocommerce_imports').insert({
                        woocommerce_order_id: wooOrder.id,
                        order_number: wooOrder.number || wooOrder.id.toString(),
                        sanitized_payload: wooOrder,
                        imported_at: new Date().toISOString(),
                    });
                }

                results.imported++;

            } catch (err: any) {
                const msg = err?.message || String(err);
                console.error(`[WooCommerce Auto-Import] Failed to process order ${wooOrder.id}:`, msg);
                results.errors.push(`Order ${wooOrder.id}: ${msg}`);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            results,
            timestamp: new Date().toISOString(),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('[WooCommerce Auto-Import] Cron job failed:', error);
        return new Response(JSON.stringify({
            success: false, error: error?.message || 'Unknown error'
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
