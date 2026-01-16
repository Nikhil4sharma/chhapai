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
  createWooAuth
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
    // Auth verification
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

    // Parse request body
    let body: any = {};
    try {
      const contentType = req.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const bodyText = await req.text();
        if (bodyText?.trim()) body = JSON.parse(bodyText);
      }
    } catch (parseError) {
      return createResponse({ error: 'Invalid request body' }, 400, corsHeaders);
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

      return createResponse(formatWooOrder(wooOrder), 200, corsHeaders);
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