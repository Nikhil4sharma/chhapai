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
      }));

      return createResponse({ success: true, orders: formattedOrders, count: formattedOrders.length }, 200, corsHeaders);
    }

    // Default: Unknown action
    return createResponse({ error: `Unknown action: ${action}` }, 400, corsHeaders);

  } catch (error: any) {
    console.error('[WooCommerce] Error:', error);
    return createResponse({ error: error?.message || 'Internal server error' }, 500, corsHeaders);
  }
});