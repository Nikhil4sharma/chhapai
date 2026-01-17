// WooCommerce Edge Function - Optimized & Modular
// Handles all WooCommerce integration actions

// Deno types
// @ts-ignore
declare const Deno: { env: { get(key: string): string | undefined } };

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import {
  parseProductMeta,
  buildFullAddress,
  normalizeOrderNumber,
  formatWooOrder,
  createResponse,
  getWooCredentials,
  createWooAuth,
  verifyWebhookSignature
} from "./_shared/helpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'content-type, content-length',
};

// Runtime credential cache
let runtimeCredentials: {
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  updatedAt?: Date;
} = {};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { ...corsHeaders, 'Content-Length': '0' } });
  }

  try {
    // Parse request body securely
    let bodyText = '';
    let body: any = {};
    try {
      if (req.body) {
        bodyText = await req.text();
        if (bodyText && bodyText.trim()) {
          body = JSON.parse(bodyText);
        }
      }
    } catch (parseError) {
      console.error('Body parse error:', parseError);
      return createResponse({ error: 'Invalid request body' }, 400, corsHeaders);
    }

    // Webhook Handling (Bypass Auth Check)
    const hookTopic = req.headers.get('x-wc-webhook-topic');
    const hookSignature = req.headers.get('x-wc-webhook-signature');

    if (hookTopic && hookSignature) {
      console.log(`[Webhook] Received topic: ${hookTopic}`);

      const secret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');
      if (!secret) {
        console.error('[Webhook] Missing WOOCOMMERCE_CONSUMER_SECRET');
        return createResponse({ error: 'Server misconfiguration' }, 500, corsHeaders);
      }

      const isValid = await verifyWebhookSignature(bodyText, hookSignature, secret);
      if (!isValid) {
        console.error('[Webhook] Invalid signature');
        return createResponse({ error: 'Invalid signature' }, 401, corsHeaders);
      }

      if (hookTopic === 'order.created' || hookTopic === 'order.updated') {
        // Init Admin Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Process Order via RPC
        console.log(`[Webhook] Syncing order #${body.id || body.order_number}`);
        const { data, error } = await supabaseAdmin.rpc('sync_wc_order', { payload: body });

        if (error) {
          console.error('[Webhook] Sync failed:', error);
          return createResponse({ error: error.message }, 500, corsHeaders);
        }

        console.log(`[Webhook] Sync success. ID: ${data}`);
        return createResponse({ success: true, id: data }, 200, corsHeaders);
      }

      return createResponse({ received: true }, 200, corsHeaders);
    }

    // Standard App Request (Require Auth)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return createResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }


    const { action } = body;

    // Check admin access for admin-only actions
    const adminOnlyActions = ['sync-orders', 'update-credentials', 'test-connection', 'check-config'];
    if (adminOnlyActions.includes(action)) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        return createResponse({ error: 'Admin access required' }, 403, corsHeaders);
      }
    }

    // Get credentials
    const { storeUrl, consumerKey, consumerSecret } = getWooCredentials(runtimeCredentials);

    // Handle credential update
    if (action === 'update-credentials') {
      const { store_url, consumer_key, consumer_secret } = body;
      if (!store_url || !consumer_key || !consumer_secret) {
        return createResponse({ error: 'All credentials required' }, 400, corsHeaders);
      }

      let normalizedUrl = store_url.trim();
      if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl;
      normalizedUrl = normalizedUrl.replace(/\/$/, '');

      // Test credentials
      const testAuth = createWooAuth(consumer_key, consumer_secret);
      const testResponse = await fetch(`${normalizedUrl}/wp-json/wc/v3/system_status`, {
        headers: { 'Authorization': `Basic ${testAuth}`, 'Content-Type': 'application/json' }
      });

      if (!testResponse.ok) {
        return createResponse({ success: false, error: `Invalid credentials: ${testResponse.status}` }, 200, corsHeaders);
      }

      runtimeCredentials = { storeUrl: normalizedUrl, consumerKey: consumer_key, consumerSecret: consumer_secret, updatedAt: new Date() };
      return createResponse({ success: true, message: 'Credentials validated', storeUrl: normalizedUrl.replace(/^https?:\/\//, '').split('/')[0] }, 200, corsHeaders);
    }

    // Check config
    if (action === 'check-config') {
      return createResponse({
        configured: !!(storeUrl && consumerKey && consumerSecret),
        storeUrl: storeUrl ? storeUrl.replace(/^https?:\/\//, '').split('/')[0] : null,
        canUpdate: true
      }, 200, corsHeaders);
    }

    // Require credentials for other actions
    if (!storeUrl || !consumerKey || !consumerSecret) {
      return createResponse({ error: 'WooCommerce credentials not configured' }, 400, corsHeaders);
    }

    const auth = createWooAuth(consumerKey, consumerSecret);

    // Test connection
    if (action === 'test-connection') {
      const response = await fetch(`${storeUrl}/wp-json/wc/v3/system_status`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
      });
      return createResponse({ success: response.ok }, response.ok ? 200 : 500, corsHeaders);
    }

    // Sync Orders (Cron Job / Manual Trigger)
    if (action === 'sync-orders') {
      const lookbackMinutes = body.lookback_minutes || 60; // Default 1 hour safety window
      const afterTime = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();

      console.log(`[Sync] Fetching orders modified after ${afterTime}`);

      const searchParams = new URLSearchParams({
        modified_after: afterTime,
        per_page: '50', // Batch size
        order: 'asc', // Process oldest first
        orderby: 'modified'
      });

      const response = await fetch(`${storeUrl}/wp-json/wc/v3/orders?${searchParams}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      if (!response.ok) {
        throw new Error(`WooCommerce fetch failed: ${response.status} ${response.statusText}`);
      }

      const orders = await response.json();
      console.log(`[Sync] Found ${orders.length} orders to sync.`);

      const results = [];
      let successCount = 0;
      let failCount = 0;

      // Use Admin Client for RPC to ensure permission if not using Security Definer (but we are)
      // Re-creating client with service role key if available in env would be ideal for cron,
      // but current context uses 'supabase' client from request auth.
      // If called via Cron, it should have appropriate headers. 

      for (const order of orders) {
        try {
          // Call Atomic RPC
          const { data, error } = await supabase.rpc('sync_wc_order', { payload: order });

          if (error) {
            console.error(`[Sync] Failed to sync order #${order.id}:`, error);
            results.push({ id: order.id, success: false, error: error.message });
            failCount++;
          } else {
            console.log(`[Sync] Synced order #${order.id} -> UUID: ${data}`);
            results.push({ id: order.id, success: true, uuid: data });
            successCount++;
          }
        } catch (err: any) {
          console.error(`[Sync] Exception processing order #${order.id}:`, err);
          results.push({ id: order.id, success: false, error: err.message });
          failCount++;
        }
      }

      return createResponse({
        success: true,
        message: `Sync complete. Success: ${successCount}, Failed: ${failCount}`,
        results
      }, 200, corsHeaders);
    }

    // Sync Customers (Bulk Import)
    if (action === 'sync-customers') {
      console.log('[Sync] Starting Customer Sync...');
      let page = 1;
      const per_page = 50;
      let totalSynced = 0;
      let hasMore = true;

      while (hasMore) {
        console.log(`[Sync] Fetching customers page ${page}...`);
        const searchParams = new URLSearchParams({
          page: page.toString(),
          per_page: per_page.toString()
          // Removed all filters to see if defaults work
        });

        const response = await fetch(`${storeUrl}/wp-json/wc/v3/customers?${searchParams}`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!response.ok) {
          console.error(`[Sync] Customer fetch failed on page ${page}: ${response.status}`);
          break;
        }

        const customers = await response.json();
        console.log(`[Sync] Page ${page} fetched. Count: ${customers?.length}`);
        if (!customers || customers.length === 0) {
          hasMore = false;
          break;
        }

        const payload = customers.map((c: any) => ({
          wc_id: c.id,
          email: c.email,
          first_name: c.first_name,
          last_name: c.last_name,
          phone: c.billing?.phone || '',
          billing: c.billing,
          shipping: c.shipping,
          avatar_url: c.avatar_url,
          total_spent: parseFloat(c.total_spent) || 0,
          orders_count: parseInt(c.orders_count) || 0,
          last_synced_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('wc_customers').upsert(payload, { onConflict: 'wc_id' });
        if (error) {
          console.error('[Sync] DB Insert Error:', error);
          throw error;
        }

        totalSynced += customers.length;
        console.log(`[Sync] Synced ${customers.length} customers (Total: ${totalSynced})`);

        if (customers.length < per_page) {
          hasMore = false;
        } else {
          page++;
        }

        // Safety Break for Execution Time
        if (page > 200) {
          console.warn('[Sync] Hit safety limit of 200 pages (10k customers).');
          break;
        }
      }

      return createResponse({
        success: true,
        count: totalSynced,
        message: `Synced ${totalSynced} customers`,
        debug_url: `${storeUrl}/wp-json/wc/v3/customers?page=1&per_page=50` // Approximation
      }, 200, corsHeaders);
    }

    // Fetch order by number
    if (action === 'order-by-number') {
      const { orderNumber } = body;
      if (!orderNumber) {
        return createResponse({ found: false, error: 'Order number required' }, 400, corsHeaders);
      }

      const requestedNormalized = normalizeOrderNumber(orderNumber);
      let wooOrder = null;

      // Strategy 1: Exact number match
      const searchParams = new URLSearchParams({ number: orderNumber.toString(), per_page: '10' });
      let response = await fetch(`${storeUrl}/wp-json/wc/v3/orders?${searchParams}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      if (response.ok) {
        const orders = await response.json();
        wooOrder = orders.find((o: any) =>
          normalizeOrderNumber(o.number) === requestedNormalized ||
          normalizeOrderNumber(o.id) === requestedNormalized
        );
      }

      // Strategy 2: Direct ID fetch
      if (!wooOrder && /^\d+$/.test(requestedNormalized)) {
        response = await fetch(`${storeUrl}/wp-json/wc/v3/orders/${requestedNormalized}`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });
        if (response.ok) {
          const order = await response.json();
          if (normalizeOrderNumber(order.id) === requestedNormalized ||
            normalizeOrderNumber(order.number) === requestedNormalized) {
            wooOrder = order;
          }
        }
      }

      if (!wooOrder) {
        return createResponse({ found: false }, 200, corsHeaders);
      }

      const formatted = formatWooOrder(wooOrder);

      // Resolve Agent for UI Auto-Assignment
      let assigned_agent = null;
      if (formatted.order && formatted.order.meta_data) {
        try {
          // Fuzzy Logic (Must match useCreateOrder / RPC logic)
          const agentMeta = formatted.order.meta_data.find((m: any) => {
            const key = m.key?.toLowerCase() || '';
            if (!key) return false;
            if (key.includes('total_sales')) return false;
            if (key.includes('tax') || key.includes('date')) return false;
            return (
              ['sales_agent', 'agent', 'ordered_by', '_sales_agent', 'salesking_assigned_agent'].includes(key) ||
              key.includes('agent') ||
              key.includes('sales')
            );
          });

          if (agentMeta) {
            const rawAgentCode = agentMeta.value?.toString() || '';
            const v_clean_agent_code = rawAgentCode.toLowerCase().replace(/[\s.]/g, '');

            // 1. Check Mapping Table
            const { data: mapping } = await supabase
              .from('sales_agent_mapping')
              .select('user_email')
              .eq('sales_agent_code', v_clean_agent_code)
              .maybeSingle();

            let email = mapping?.user_email;

            // 2. Fallback: Check if value looks like a name and match profile
            if (!email) {
              // Try exact name match on profile just in case
              const { data: profileByName } = await supabase
                .from('profiles')
                .select('id, user_id, full_name, email')
                .or(`full_name.ilike.${v_clean_agent_code},full_name.ilike.${rawAgentCode}`)
                .limit(1)
                .maybeSingle();

              if (profileByName) {
                assigned_agent = {
                  id: profileByName.user_id || profileByName.id, // Prefer user_id
                  profile_id: profileByName.id,
                  name: profileByName.full_name,
                  email: profileByName.email,
                  source: 'profile_name_match'
                };
              }
            }

            if (email) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, user_id, full_name') // Fetch user_id (Auth ID)
                .eq('email', email)
                .maybeSingle();

              if (profile) {
                assigned_agent = {
                  id: profile.user_id || profile.id, // Prefer user_id (Auth ID) for consistency
                  profile_id: profile.id,
                  name: profile.full_name,
                  email,
                  source: 'mapping_table'
                };
              }
            }
          }
        } catch (e) {
          console.error('Agent Resolution Error:', e);
        }
      }

      return createResponse({ ...formatted, assigned_agent }, 200, corsHeaders);
    }

    // Search orders
    if (action === 'search-orders') {
      const { order_number, customer_email, customer_name, customer_phone } = body;
      if (!order_number && !customer_email && !customer_name && !customer_phone) {
        return createResponse({ error: 'At least one search parameter required' }, 400, corsHeaders);
      }

      const searchParams = new URLSearchParams({ per_page: '100' });
      if (order_number) {
        searchParams.append('number', order_number);
      } else {
        const query = customer_email || customer_name || customer_phone;
        if (query) searchParams.append('search', query);
      }

      const response = await fetch(`${storeUrl}/wp-json/wc/v3/orders?${searchParams}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      if (!response.ok) {
        return createResponse({ success: false, error: `Search failed: ${response.status}` }, 500, corsHeaders);
      }

      let orders = await response.json();

      // Filter results
      if (!order_number) {
        orders = orders.filter((order: any) => {
          if (customer_email && !order.billing?.email?.toLowerCase().includes(customer_email.toLowerCase())) return false;
          if (customer_phone && !order.billing?.phone?.includes(customer_phone)) return false;
          return true;
        });
      }

      const formattedOrders = orders.map((order: any) => ({
        id: order.id,
        order_number: order.number || order.id,
        customer_name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
        customer_email: order.billing?.email || '',
        customer_phone: order.billing?.phone || '',
        order_date: order.date_created || order.date_created_gmt,
        total: parseFloat(order.total) || 0,
        status: order.status,
        currency: order.currency || 'INR',
        line_items: order.line_items?.map((item: any) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          total: parseFloat(item.total) || 0,
        })) || [],
        meta_data: order.meta_data || [],
      }));

      return createResponse({ success: true, orders: formattedOrders, count: formattedOrders.length }, 200, corsHeaders);
    }

    // Search customers
    if (action === 'search_customers') {
      const { query } = body;
      if (!query || query.length < 3) {
        return createResponse({ error: 'Query string too short (min 3 chars)' }, 400, corsHeaders);
      }

      const searchParams = new URLSearchParams({ search: query, per_page: '20' });
      const response = await fetch(`${storeUrl}/wp-json/wc/v3/customers?${searchParams}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      if (!response.ok) {
        return createResponse({ success: false, error: `Search customers failed: ${response.status}` }, 500, corsHeaders);
      }

      const customers = await response.json();
      const formattedCustomers = customers.map((c: any) => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username,
        email: c.email,
        avatar_url: c.avatar_url,
        phone: c.billing?.phone || '',
        total_spent: c.total_spent,
        orders_count: c.orders_count,
        location: [c.billing?.city, c.billing?.state].filter(Boolean).join(', '),
      }));

      return createResponse({ success: true, customers: formattedCustomers }, 200, corsHeaders);
    }

    // Get customer orders (History)
    if (action === 'get_customer_orders') {
      const { customer_id } = body;
      if (!customer_id) {
        return createResponse({ error: 'Customer ID required' }, 400, corsHeaders);
      }

      // Fetch ORDERS for this customer with HIGH limit (History)
      const searchParams = new URLSearchParams({
        customer: customer_id.toString(),
        per_page: '50', // Fetch fast history
        status: 'any'
      });

      const response = await fetch(`${storeUrl}/wp-json/wc/v3/orders?${searchParams}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      if (!response.ok) {
        return createResponse({ success: false, error: `Fetch customer orders failed: ${response.status}` }, 500, corsHeaders);
      }

      let orders = await response.json();

      // Format orders for UI
      const formattedOrders = orders.map((order: any) => ({
        id: order.id,
        number: order.number || order.id.toString(),
        status: order.status,
        date_created: order.date_created,
        total: order.total,
        line_items: order.line_items,
        currency: order.currency,
        meta_data: order.meta_data, // Keep meta for assignment logic if needed
        shipping: order.shipping
      }));

      return createResponse({ success: true, orders: formattedOrders }, 200, corsHeaders);
    }
    // Get full order details for import
    if (action === 'get-order-details') {
      const { order_id } = body;

      if (!order_id) {
        return createResponse({ error: 'Order ID required' }, 400, corsHeaders);
      }

      const response = await fetch(`${storeUrl}/wp-json/wc/v3/orders/${order_id}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      if (!response.ok) {
        return createResponse({ success: false, error: `Fetch order failed: ${response.status}` }, 500, corsHeaders);
      }

      const order = await response.json();
      return createResponse({ success: true, payload: order }, 200, corsHeaders);
    }

    // Import customer
    if (action === 'import_customer') {
      const { wc_id } = body;
      if (!wc_id) {
        return createResponse({ error: 'Customer ID required' }, 400, corsHeaders);
      }

      const response = await fetch(`${storeUrl}/wp-json/wc/v3/customers/${wc_id}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      if (!response.ok) {
        return createResponse({ success: false, error: `Fetch customer failed: ${response.status}` }, 500, corsHeaders);
      }

      const customer = await response.json();

      // Upsert into wc_customers
      const { data, error } = await supabase
        .from('wc_customers')
        .upsert({
          wc_id: customer.id,
          email: customer.email,
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.billing?.phone,
          billing: customer.billing,
          shipping: customer.shipping,
          avatar_url: customer.avatar_url,
          total_spent: customer.total_spent,
          orders_count: customer.orders_count,
          last_order_date: customer.date_last_order, // Note: WC returns date_last_order
          updated_at: new Date().toISOString()
        }, { onConflict: 'wc_id' })
        .select()
        .single();

      if (error) {
        console.error('Upsert failed:', error);
        return createResponse({ success: false, error: error.message }, 500, corsHeaders);
      }

      return createResponse({ success: true, customer: data }, 200, corsHeaders);
    }

    // Default: Unknown action
    return createResponse({ error: `Unknown action: ${action}` }, 400, corsHeaders);

  } catch (error: any) {
    console.error('[WooCommerce] Error:', error);
    return createResponse({ error: error?.message || 'Internal server error' }, 500, corsHeaders);
  }
});