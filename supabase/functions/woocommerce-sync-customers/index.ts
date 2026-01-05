
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // WooCommerce Configuration
        const wcUrl = Deno.env.get('WC_URL')
        const wcKey = Deno.env.get('WC_KEY')
        const wcSecret = Deno.env.get('WC_SECRET')

        // Add better logging for debugging
        console.log(`Sync Request Received. Config check: URL=${!!wcUrl}, Key=${!!wcKey}`)

        if (!wcUrl || !wcKey || !wcSecret) {
            throw new Error('Missing WooCommerce configuration (WC_URL, WC_KEY, WC_SECRET)')
        }

        const { action, customer_id } = await req.json()

        if (action === 'sync_all') {
            console.log('Fetching customers from WooCommerce...')
            const response = await fetch(`${wcUrl}/wp-json/wc/v3/customers?consumer_key=${wcKey}&consumer_secret=${wcSecret}&per_page=100`)

            if (!response.ok) {
                const errText = await response.text()
                throw new Error(`WooCommerce API Error (${response.status}): ${errText}`)
            }

            const customers = await response.json()
            console.log(`Fetched ${customers.length} customers. Syncing to DB...`)

            const upsertData = customers.map((c: any) => ({
                wc_id: c.id,
                email: c.email,
                first_name: c.first_name,
                last_name: c.last_name,
                phone: c.billing?.phone || c.shipping?.phone,
                billing: c.billing,
                shipping: c.shipping,
                avatar_url: c.avatar_url,
                total_spent: c.total_spent,
                orders_count: c.orders_count,
                last_order_date: c.date_last_active_gwt,
                last_synced_at: new Date().toISOString()
            }))

            const { error } = await supabaseClient
                .from('wc_customers')
                .upsert(upsertData, { onConflict: 'wc_id' })

            if (error) throw error

            return new Response(
                JSON.stringify({ success: true, count: upsertData.length }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (action === 'get_customer_orders' && customer_id) {
            console.log(`Fetching orders for customer ${customer_id}...`)
            const response = await fetch(`${wcUrl}/wp-json/wc/v3/orders?customer=${customer_id}&consumer_key=${wcKey}&consumer_secret=${wcSecret}`)

            if (!response.ok) {
                throw new Error(`WooCommerce Order Fetch Error: ${response.statusText}`)
            }

            const orders = await response.json()
            return new Response(
                JSON.stringify({ success: true, orders }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ error: 'Invalid action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('Edge Function Error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
