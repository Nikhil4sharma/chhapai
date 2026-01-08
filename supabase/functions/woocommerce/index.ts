// Deno types for Supabase Edge Functions
// @ts-ignore - Deno runtime provides these types
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore - Deno imports are resolved at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno imports are resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'content-type, content-length',
};

// In-memory credential cache (for runtime updates within same instance)
let runtimeCredentials: {
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  updatedAt?: Date;
} = {};

// Helper to parse product meta data from WooCommerce line items
function parseProductMeta(metaData: any[]): { specifications: Record<string, string>; rawMeta: any[] } {
  const specifications: Record<string, string> = {};
  const rawMeta: any[] = [];

  if (!Array.isArray(metaData)) {
    return { specifications, rawMeta };
  }

  // Keys to skip (internal WooCommerce meta)
  const skipKeys = ['_reduced_stock', '_restock_refunded_items', '_product_addons', '_qty'];

  for (const meta of metaData) {
    if (!meta.key || skipKeys.includes(meta.key) || meta.key.startsWith('_')) {
      continue;
    }

    // Store both display key and value
    const displayKey = meta.display_key || meta.key;
    const displayValue = meta.display_value || meta.value;

    if (displayValue && typeof displayValue === 'string' && displayValue.trim()) {
      specifications[displayKey] = displayValue.trim();
      rawMeta.push({
        key: meta.key,
        display_key: displayKey,
        value: meta.value,
        display_value: displayValue,
      });
    }
  }

  return { specifications, rawMeta };
}

// Helper to build full address from WooCommerce address object
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

serve(async (req: Request) => {
  // Handle CORS preflight requests FIRST - before any other processing
  // This MUST be the first thing we check
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Handling OPTIONS preflight request');
    return new Response(null, {
      status: 200, // OK status for CORS preflight
      headers: {
        ...corsHeaders,
        'Content-Length': '0',
      }
    });
  }

  try {
    // Get auth header for user verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client to verify user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safely parse request body - handle cases where body might be empty
    let body: any = {};
    try {
      const contentType = req.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const bodyText = await req.text();
        if (bodyText && bodyText.trim()) {
          body = JSON.parse(bodyText);
        }
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action } = body;
    console.log('WooCommerce action requested:', action);

    // Check if user is admin (for admin-only actions)
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    const isAdmin = !roleError && roleData;

    // Actions that require admin access
    const adminOnlyActions = ['sync-orders', 'update-credentials', 'test-connection', 'check-config'];
    if (adminOnlyActions.includes(action) && !isAdmin) {
      console.error('User is not admin:', roleError);
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get WooCommerce credentials (prefer runtime if recently updated, else from env)
    let storeUrl = runtimeCredentials.storeUrl || Deno.env.get('WOOCOMMERCE_STORE_URL');
    let consumerKey = runtimeCredentials.consumerKey || Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
    let consumerSecret = runtimeCredentials.consumerSecret || Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

    // Handle credential update from admin
    if (action === 'update-credentials') {
      const { store_url, consumer_key, consumer_secret } = body;

      if (!store_url || !consumer_key || !consumer_secret) {
        return new Response(JSON.stringify({
          error: 'All credentials are required: store_url, consumer_key, consumer_secret'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate URL format
      let normalizedUrl = store_url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      // Remove trailing slash
      normalizedUrl = normalizedUrl.replace(/\/$/, '');

      // Test the credentials before saving
      console.log('Testing new WooCommerce credentials for:', normalizedUrl);

      const testAuth = btoa(`${consumer_key}:${consumer_secret}`);
      const testUrl = `${normalizedUrl}/wp-json/wc/v3/system_status`;

      try {
        const testResponse = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${testAuth}`,
            'Content-Type': 'application/json',
          },
        });

        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          console.error('Credential validation failed:', testResponse.status, errorText);
          return new Response(JSON.stringify({
            success: false,
            error: `Invalid credentials or store URL. Status: ${testResponse.status}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Credentials are valid - store in runtime cache
        runtimeCredentials = {
          storeUrl: normalizedUrl,
          consumerKey: consumer_key,
          consumerSecret: consumer_secret,
          updatedAt: new Date(),
        };

        console.log('WooCommerce credentials validated and cached');

        return new Response(JSON.stringify({
          success: true,
          message: 'Credentials validated and saved successfully',
          storeUrl: normalizedUrl.replace(/^https?:\/\//, '').split('/')[0],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error: unknown) {
        console.error('Error testing credentials:', error);
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        return new Response(JSON.stringify({
          success: false,
          error: `Could not connect to store: ${errorMessage}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'check-config') {
      // Check if credentials are configured
      const isConfigured = !!(storeUrl && consumerKey && consumerSecret);
      console.log('WooCommerce configuration check:', isConfigured ? 'configured' : 'not configured');

      return new Response(JSON.stringify({
        configured: isConfigured,
        storeUrl: storeUrl ? storeUrl.replace(/^https?:\/\//, '').split('/')[0] : null,
        canUpdate: true, // Admin can always update
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!storeUrl || !consumerKey || !consumerSecret) {
      console.error('WooCommerce credentials not configured');
      return new Response(JSON.stringify({
        error: 'WooCommerce credentials not configured. Please update them in Settings.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'test-connection') {
      console.log('Testing WooCommerce connection to:', storeUrl);

      // Test connection by fetching store info
      const apiUrl = `${storeUrl}/wp-json/wc/v3/system_status`;
      const auth = btoa(`${consumerKey}:${consumerSecret}`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('WooCommerce connection test failed:', response.status, errorText);
        return new Response(JSON.stringify({
          success: false,
          error: `Connection failed: ${response.status}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('WooCommerce connection test successful');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'search-orders') {
      // Search WooCommerce orders by order number, email, name, or phone
      const { order_number, customer_email, customer_name, customer_phone } = body;

      if (!order_number && !customer_email && !customer_name && !customer_phone) {
        return new Response(JSON.stringify({
          error: 'At least one search parameter is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Searching WooCommerce orders:', { order_number, customer_email, customer_name, customer_phone });

      // Build search query
      let searchParams = new URLSearchParams();
      searchParams.append('per_page', '100'); // Get up to 100 results

      if (order_number) {
        searchParams.append('number', order_number.toString());
      } else {
        // Optimization: Use WC 'search' param for other fields
        // This matches matching ID, title, content excerpt, and customer info (name, email, phone)
        const query = customer_email || customer_name || customer_phone;
        if (query) {
          searchParams.append('search', query);
        }
      }

      // WooCommerce API doesn't support direct email/name/phone search in query params
      // We'll fetch all recent orders and filter client-side (or use search endpoint if available)
      // For now, fetch recent orders and filter
      const apiUrl = `${storeUrl}/wp-json/wc/v3/orders?${searchParams.toString()}`;
      const auth = btoa(`${consumerKey}:${consumerSecret}`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('WooCommerce search failed:', response.status, errorText);
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to search orders: ${response.status}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let wooOrders = await response.json();

      // Additional client-side filtering might be needed if multiple params provided, 
      // but 'search' is usually sufficient.
      // If we used strict filtering, we'd need to keep the filter logic, but for general "Search",
      // the API result is good enough.
      // We keep the filter ONLY if 'search' wasn't used or if we need exact match?
      // Actually, let's keep the filter as a fast secondary check, 
      // but since we used 'search', the dataset is small.
      if (!order_number) {
        wooOrders = wooOrders.filter((order: any) => {
          // If we searched by specific field, ensure it matches (API search is broad)
          if (customer_email && (!order.billing?.email || !order.billing.email.toLowerCase().includes(customer_email.toLowerCase()))) return false;
          if (customer_phone && (!order.billing?.phone || !order.billing.phone.includes(customer_phone))) return false;
          return true;
        });
      }

      // Format results for frontend
      const formattedOrders = wooOrders.map((order: any) => ({
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

      console.log(`Found ${formattedOrders.length} matching orders`);

      return new Response(JSON.stringify({
        success: true,
        orders: formattedOrders,
        count: formattedOrders.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'order-by-number') {
      // Fetch a single WooCommerce order by order number for autofill
      const { orderNumber } = body;

      if (!orderNumber) {
        return new Response(JSON.stringify({
          found: false,
          error: 'Order number is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[WooCommerce] Fetching order by number:', orderNumber);

      // Fetch order from WooCommerce by number
      const searchParams = new URLSearchParams();
      searchParams.append('number', orderNumber.toString());
      searchParams.append('per_page', '1');

      const apiUrl = `${storeUrl}/wp-json/wc/v3/orders?${searchParams.toString()}`;
      const auth = btoa(`${consumerKey}:${consumerSecret}`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WooCommerce] Order fetch failed:', response.status, errorText);
        return new Response(JSON.stringify({
          found: false,
          error: `Failed to fetch order: ${response.status}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const wooOrders = await response.json();

      if (!wooOrders || wooOrders.length === 0) {
        console.log('[WooCommerce] Order not found:', orderNumber);
        return new Response(JSON.stringify({
          found: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const wooOrder = wooOrders[0];

      // Parse product meta for specifications
      const parseProductSpecs = (lineItem: any) => {
        const { specifications } = parseProductMeta(lineItem.meta_data || []);
        return specifications;
      };

      // Format order for frontend autofill
      const formattedOrder = {
        found: true,
        order: {
          id: wooOrder.id,
          order_number: wooOrder.number || wooOrder.id,
          customer_name: `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim() || 'Unknown',
          customer_email: wooOrder.billing?.email || '',
          customer_phone: wooOrder.billing?.phone || '',
          billing_address: buildFullAddress(wooOrder.billing),
          billing_city: wooOrder.billing?.city || '',
          billing_state: wooOrder.billing?.state || '',
          billing_pincode: wooOrder.billing?.postcode || '',
          shipping_name: wooOrder.shipping?.first_name
            ? `${wooOrder.shipping.first_name} ${wooOrder.shipping.last_name || ''}`.trim()
            : `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim(),
          shipping_address: buildFullAddress(wooOrder.shipping) || buildFullAddress(wooOrder.billing),
          shipping_city: wooOrder.shipping?.city || wooOrder.billing?.city || '',
          shipping_state: wooOrder.shipping?.state || wooOrder.billing?.state || '',
          shipping_pincode: wooOrder.shipping?.postcode || wooOrder.billing?.postcode || '',
          order_total: parseFloat(wooOrder.total) || 0,
          tax_total: parseFloat(wooOrder.total_tax) || 0,
          payment_status: wooOrder.status || 'pending',
          currency: wooOrder.currency || 'INR',
          line_items: (wooOrder.line_items || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            quantity: parseInt(item.quantity) || 1,
            price: parseFloat(item.price) || 0,
            total: parseFloat(item.total) || 0,
            specifications: parseProductSpecs(item),
            meta_data: item.meta_data || [],
          })),
          date_created: wooOrder.date_created || wooOrder.date_created_gmt,
          date_modified: wooOrder.date_modified || wooOrder.date_modified_gmt,
        }
      };

      console.log('[WooCommerce] Order found:', formattedOrder.order.order_number);

      return new Response(JSON.stringify(formattedOrder), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'import-orders') {
      // Import selected WooCommerce orders into Supabase
      const { order_ids } = body; // Array of WooCommerce order IDs to import

      if (!Array.isArray(order_ids) || order_ids.length === 0) {
        return new Response(JSON.stringify({
          error: 'order_ids array is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Importing ${order_ids.length} WooCommerce orders for user ${user.id}`);

      // Get user's profile to determine department
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('department')
        .eq('user_id', user.id)
        .single();

      const userDepartment = userProfile?.department || 'sales';

      // Fetch orders from WooCommerce
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

      const importedOrders: any[] = [];
      const errors: string[] = [];

      // Helper function to process a single order
      const processOrder = async (wooOrderId: string | number) => {
        try {
          const idStr = wooOrderId.toString();
          // Fetch order from WooCommerce
          const apiUrl = `${storeUrl}/wp-json/wc/v3/orders/${idStr}`;
          const auth = btoa(`${consumerKey}:${consumerSecret}`);

          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            return { error: `Order ${idStr}: Failed to fetch from WooCommerce (${response.status})` };
          }

          const wooOrder = await response.json();

          // Check if order already exists in Supabase by woo_order_id
          const { data: existingOrder } = await adminSupabase
            .from('orders')
            .select('id, order_id')
            .eq('woo_order_id', idStr)
            .maybeSingle();

          if (existingOrder) {
            console.log(`Order ${idStr} already imported (ID: ${existingOrder.order_id})`);
            return { error: `Order ${idStr}: Already imported (Order ID: ${existingOrder.order_id})` };
          }

          // FIX: Use numeric order ID only (no WC- prefix)
          const orderId = idStr;

          // Auto-Import Customer
          let customerUuid: string | null = null;
          // Auto-Import Customer Logic (Robust Deduplication)
          // 1. Try to find by wc_id (Official ID)
          let customerRecord = null;
          const { data: byWcId } = await adminSupabase
            .from('wc_customers')
            .select('id')
            .eq('wc_id', wooOrder.customer_id)
            .maybeSingle();

          if (byWcId) {
            customerRecord = byWcId;
          } else if (wooOrder.billing?.email) {
            // 2. Try to find by Email (Shadow/Duplicate check)
            const { data: byEmail } = await adminSupabase
              .from('wc_customers')
              .select('id')
              .ilike('email', wooOrder.billing.email) // Case insensitive check
              .maybeSingle();

            if (byEmail) {
              customerRecord = byEmail;
              console.log(`Matched customer by email: ${wooOrder.billing.email} (ID: ${byEmail.id})`);
            }
          }

          // Fetch Avatar URL if customer_id exists
          let avatarUrl: string | null = null;
          if (wooOrder.customer_id && wooOrder.customer_id > 0) {
            try {
              const customerApiUrl = `${storeUrl}/wp-json/wc/v3/customers/${wooOrder.customer_id}`;
              const custResponse = await fetch(customerApiUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json',
                },
              });
              if (custResponse.ok) {
                const customerDetails = await custResponse.json();
                avatarUrl = customerDetails.avatar_url;
              }
            } catch (e) {
              console.warn(`Failed to fetch customer avatar for ID ${wooOrder.customer_id}`, e);
            }
          }

          const customerData = {
            wc_id: wooOrder.customer_id,
            email: wooOrder.billing?.email,
            avatar_url: avatarUrl,
            first_name: wooOrder.billing?.first_name,
            last_name: wooOrder.billing?.last_name,
            phone: wooOrder.billing?.phone,
            billing: wooOrder.billing,
            shipping: wooOrder.shipping,
            assigned_to: user.id, // Or keep existing? For now override to current importer
            updated_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString()
          };

          let custData;
          let custError;

          if (customerRecord) {
            // Update existing
            const { data, error } = await adminSupabase
              .from('wc_customers')
              .update(customerData)
              .eq('id', customerRecord.id)
              .select('id')
              .single();
            custData = data;
            custError = error;
          } else {
            // Insert new
            const { data, error } = await adminSupabase
              .from('wc_customers')
              .insert(customerData)
              .select('id')
              .single();
            custData = data;
            custError = error;
          }

          if (custData) customerUuid = custData.id;
          if (custError) console.error(`Error processing customer ${wooOrder.customer_id}:`, custError);

          // Check distinct order_id again (double check)
          const { data: existingOrderById } = await adminSupabase
            .from('orders')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle();

          if (existingOrderById) {
            return { error: `Order ${orderId} already exists (skipping duplicate)` };
          }

          const { data: newOrder, error: orderError } = await adminSupabase
            .from('orders')
            .insert({
              order_id: orderId,
              customer_id: customerUuid,
              woo_order_id: idStr,
              source: 'woocommerce',
              customer_name: `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim() || 'Unknown',
              customer_phone: wooOrder.billing?.phone || '',
              customer_email: wooOrder.billing?.email || '',
              customer_address: wooOrder.billing?.address_1 || '',
              billing_city: wooOrder.billing?.city || '',
              billing_state: wooOrder.billing?.state || '',
              billing_pincode: wooOrder.billing?.postcode || '',
              shipping_name: wooOrder.shipping?.first_name ? `${wooOrder.shipping.first_name} ${wooOrder.shipping.last_name || ''}`.trim() : null,
              shipping_email: wooOrder.shipping?.email || null,
              shipping_phone: wooOrder.shipping?.phone || null,
              shipping_address: wooOrder.shipping?.address_1 || null,
              shipping_city: wooOrder.shipping?.city || null,
              shipping_state: wooOrder.shipping?.state || null,
              shipping_pincode: wooOrder.shipping?.postcode || null,
              order_total: parseFloat(wooOrder.total) || 0,
              payment_status: wooOrder.status,
              order_status: wooOrder.status,
              created_by: user.id,
              imported_by: user.id,
              current_department: userDepartment,
              assigned_user: user.id,
              global_notes: wooOrder.customer_note || null,
              created_at: new Date(wooOrder.date_created).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (orderError || !newOrder) {
            if (orderError?.code === '23505') return { error: `Order ${orderId} already exists (unique constraint)` };
            throw orderError;
          }

          // Create Items Parallel
          const itemPromises = (wooOrder.line_items || []).map(async (lineItem: any) => {
            const itemId = `${orderId}-${lineItem.id}`;
            const { specifications } = parseProductMeta(lineItem.meta_data || []);
            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + 7);

            return adminSupabase.from('order_items').insert({
              item_id: itemId,
              order_id: newOrder.id,
              product_name: lineItem.name,
              quantity: lineItem.quantity,
              line_total: parseFloat(lineItem.total) || 0,
              specifications: specifications,
              woo_meta: { product_id: lineItem.product_id, variation_id: lineItem.variation_id },
              need_design: true,
              current_stage: 'sales',
              assigned_to: user.id,
              assigned_department: userDepartment,
              priority: 'blue',
              delivery_date: deliveryDate.toISOString(),
              created_at: new Date(wooOrder.date_created).toISOString(),
              updated_at: new Date().toISOString(),
            });
          });

          await Promise.all(itemPromises);

          // Timeline
          await adminSupabase.from('timeline').insert({
            order_id: newOrder.id,
            action: 'created',
            stage: 'sales',
            performed_by: user.id,
            performed_by_name: userProfile?.full_name || 'Unknown',
            notes: `Order imported from WooCommerce (WC Order #${idStr})`,
            is_public: true
          });

          return {
            success: true,
            data: { woo_order_id: idStr, order_id: orderId, supabase_id: newOrder.id }
          };

        } catch (error: any) {
          return { error: `Order ${wooOrderId}: ${error.message || 'Unknown error'}` };
        }
      };

      // Process in batches of 5 to avoid rate limits
      const BATCH_SIZE = 5;
      for (let i = 0; i < order_ids.length; i += BATCH_SIZE) {
        const batch = order_ids.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.ceil(i / BATCH_SIZE) + 1}/${Math.ceil(order_ids.length / BATCH_SIZE)}...`);

        const results = await Promise.all(batch.map((id: any) => processOrder(id)));

        results.forEach(res => {
          if (res.error) errors.push(res.error);
          if (res.success && res.data) importedOrders.push(res.data);
        });
      }

      return new Response(JSON.stringify({
        success: true,
        imported: importedOrders.length,
        errors: errors.length > 0 ? errors : undefined,
        orders: importedOrders
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }



    // --- NEW: Search Customers (for Manual Import) ---
    if (action === 'search_customers') {
      const { query } = body;
      if (!query || query.length < 3) {
        return new Response(JSON.stringify({ customers: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`Searching customers for: ${query}`);
      let storeUrl = runtimeCredentials.storeUrl || Deno.env.get('WOOCOMMERCE_STORE_URL');
      let consumerKey = runtimeCredentials.consumerKey || Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
      let consumerSecret = runtimeCredentials.consumerSecret || Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

      const auth = btoa(`${consumerKey}:${consumerSecret}`);

      // Search by generic 'search' param (matches name/email in WC)
      const searchParams = new URLSearchParams();
      searchParams.append('search', query);
      searchParams.append('per_page', '20'); // Limit results

      const apiUrl = `${storeUrl}/wp-json/wc/v3/customers?${searchParams.toString()}`;

      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`WC Search Failed: ${response.status}`);

        const customers = await response.json();

        // Map to simpler format for UI
        const results = customers.map((c: any) => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`.trim() || c.username,
          email: c.email,
          avatar_url: c.avatar_url,
          phone: c.billing?.phone || c.shipping?.phone,
          total_spent: c.total_spent,
          orders_count: c.orders_count,
          // Helper for UI to show location
          location: [c.billing?.city, c.billing?.country].filter(Boolean).join(', ')
        }));

        return new Response(JSON.stringify({ customers: results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err: any) {
        console.error('Search Error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // --- NEW: Import Single Customer (Assign to User) ---
    if (action === 'import_customer') {
      const { wc_id } = body;
      if (!wc_id) return new Response(JSON.stringify({ error: 'wc_id required' }), { status: 400, headers: corsHeaders });

      console.log(`Importing customer ${wc_id} for user ${user.id}`);

      let storeUrl = runtimeCredentials.storeUrl || Deno.env.get('WOOCOMMERCE_STORE_URL');
      let consumerKey = runtimeCredentials.consumerKey || Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
      let consumerSecret = runtimeCredentials.consumerSecret || Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');
      const auth = btoa(`${consumerKey}:${consumerSecret}`);

      try {
        // 1. Fetch from WC
        const response = await fetch(`${storeUrl}/wp-json/wc/v3/customers/${wc_id}`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!response.ok) throw new Error('Failed to fetch customer from WC');
        const c = await response.json();

        // 2. Upsert to DB with assigned_to = user.id
        const upsertData = {
          wc_id: c.id,
          email: c.email,
          first_name: c.first_name,
          last_name: c.last_name,
          phone: c.billing?.phone || c.shipping?.phone,
          billing: c.billing,
          shipping: c.shipping,
          avatar_url: c.avatar_url,
          total_spent: c.total_spent ? parseFloat(c.total_spent) : 0,
          orders_count: c.orders_count || 0,
          last_order_date: c.date_last_active_gwt,
          last_synced_at: new Date().toISOString(),
          assigned_to: user.id // <--- IMPORTANT: Assign to current user
        };

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

        const { error } = await adminSupabase
          .from('wc_customers')
          .upsert(upsertData, { onConflict: 'wc_id' });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, customer: upsertData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err: any) {
        console.error('Import Error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // --- NEW: Get Customer Orders (Moved from broken function) ---
    if (action === 'get_customer_orders') {
      const { customer_id } = body; // WC Customer ID

      let storeUrl = runtimeCredentials.storeUrl || Deno.env.get('WOOCOMMERCE_STORE_URL');
      let consumerKey = runtimeCredentials.consumerKey || Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
      let consumerSecret = runtimeCredentials.consumerSecret || Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');
      const auth = btoa(`${consumerKey}:${consumerSecret}`);

      try {
        const response = await fetch(`${storeUrl}/wp-json/wc/v3/orders?customer=${customer_id}&per_page=20`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!response.ok) throw new Error('Failed to fetch orders');
        const orders = await response.json();

        // Sanitize map
        const safeOrders = orders.map((o: any) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          date_created: o.date_created,
          total: o.total,
          customer_note: o.customer_note,
          shipping: o.shipping,
          billing: o.billing,
          meta_data: o.meta_data,
          line_items: o.line_items.map((i: any) => ({
            name: i.name,
            quantity: i.quantity,
            total: i.total,
            sku: i.sku,
            meta_data: i.meta_data
          }))
        }));

        return new Response(JSON.stringify({ orders: safeOrders }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Sync Customers Action
    if (action === 'sync_customers') {
      return new Response(JSON.stringify({ message: "Auto-sync is disabled. Please use manual import." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'sync-orders') {
      console.log('Syncing orders from WooCommerce with advanced safeguards:', storeUrl);

      // Fetch processing orders from WooCommerce
      const apiUrl = `${storeUrl}/wp-json/wc/v3/orders?status=processing&per_page=50`;
      const auth = btoa(`${consumerKey}:${consumerSecret}`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('WooCommerce order sync failed:', response.status, errorText);
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to fetch orders: ${response.status}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const wooOrders = await response.json();
      console.log(`Fetched ${wooOrders.length} processing orders from WooCommerce`);

      // Process and store orders with safeguards
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

      // Generate unique sync ID
      const syncId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const syncedAt = new Date().toISOString();

      // Extract WooCommerce order IDs from current sync
      const wooOrderIds = wooOrders.map((o: any) => o.id);

      let importedCount = 0;
      let updatedCount = 0;
      let restoredCount = 0;
      let archivedCount = 0;
      const errors: string[] = [];

      // STEP 1: Process all WooCommerce orders (with duplicate prevention by woo_order_id)
      // STEP 1: Process all WooCommerce orders (with duplicate prevention by woo_order_id)
      for (const wooOrder of wooOrders) {
        try {
          const wooOrderId = wooOrder.id;

          // FIX: Use numeric order ID only (no WC- prefix) for WooCommerce orders
          const orderId = wooOrderId.toString();

          // SAFEGUARD 8: Duplicate Prevention - Check by both order_id and woo_order_id
          // Check by order_id first (primary check for duplicates)
          const { data: existingByOrderId } = await adminSupabase
            .from('orders')
            .select('id, source, archived_from_wc, woo_order_id')
            .eq('order_id', orderId)
            .maybeSingle();

          // Also check by woo_order_id as fallback (in case order_id format changed)
          const { data: existingByWooId } = await adminSupabase
            .from('orders')
            .select('id, source, archived_from_wc, order_id')
            .eq('woo_order_id', wooOrderId)
            .maybeSingle();

          // Use existingByOrderId if found, otherwise use existingByWooId
          const existingOrder = existingByOrderId || existingByWooId;

          // SAFEGUARD 7: Manual Orders Protection - Never touch manual orders
          if (existingOrder && existingOrder.source === 'manual') {
            console.log(`Skipping manual order with order_id ${orderId} or woo_order_id ${wooOrderId} - manual orders are protected`);
            continue;
          }

          // Extract billing details
          const billing = wooOrder.billing || {};
          const customerName = `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Unknown Customer';
          const customerEmail = billing.email || null;
          const customerPhone = billing.phone || null;
          const billingAddress = buildFullAddress(billing);

          // Extract shipping details (fallback to billing if empty)
          const shipping = wooOrder.shipping || {};
          const hasShipping = shipping.first_name || shipping.last_name || shipping.address_1;
          const shippingName = hasShipping
            ? `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim()
            : customerName;
          const shippingAddress = hasShipping ? buildFullAddress(shipping) : billingAddress;
          const shippingCity = shipping.city || billing.city || null;
          const shippingState = shipping.state || billing.state || null;
          const shippingPincode = shipping.postcode || billing.postcode || null;

          // Extract order totals and tax
          const orderTotal = parseFloat(wooOrder.total) || 0;
          let taxCgst = 0;
          let taxSgst = 0;

          // Parse tax lines for CGST/SGST
          if (Array.isArray(wooOrder.tax_lines)) {
            for (const tax of wooOrder.tax_lines) {
              const taxLabel = (tax.label || '').toLowerCase();
              const taxAmount = parseFloat(tax.tax_total) || 0;
              if (taxLabel.includes('cgst')) {
                taxCgst += taxAmount;
              } else if (taxLabel.includes('sgst')) {
                taxSgst += taxAmount;
              }
            }
          }

          // Get delivery date from order meta if available
          let deliveryDate: string | null = null;
          if (Array.isArray(wooOrder.meta_data)) {
            const deliveryMeta = wooOrder.meta_data.find((m: any) =>
              m.key === 'delivery_date' || m.key === '_delivery_date' || m.key === 'expected_delivery'
            );
            if (deliveryMeta?.value) {
              const parsed = new Date(deliveryMeta.value);
              if (!isNaN(parsed.getTime())) {
                deliveryDate = parsed.toISOString();
              }
            }
          }

          let orderDbId: string;
          const isRestored = existingOrder && existingOrder.archived_from_wc === true;

          if (existingOrder) {
            // SAFEGUARD 1: Only update WooCommerce orders (source = 'woocommerce')
            // SAFEGUARD 3: Stage-agnostic - update regardless of current stage
            const { error: updateError } = await adminSupabase
              .from('orders')
              .update({
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                customer_address: billingAddress,
                billing_city: billing.city || null,
                billing_state: billing.state || null,
                billing_pincode: billing.postcode || null,
                shipping_name: shippingName,
                shipping_address: shippingAddress,
                shipping_city: shippingCity,
                shipping_state: shippingState,
                shipping_pincode: shippingPincode,
                shipping_email: shipping.email || billing.email || null,
                shipping_phone: shipping.phone || billing.phone || null,
                order_status: wooOrder.status,
                payment_status: wooOrder.payment_method_title || wooOrder.payment_method,
                order_total: orderTotal,
                tax_cgst: taxCgst,
                tax_sgst: taxSgst,
                delivery_date: deliveryDate,
                woo_order_id: wooOrderId,
                last_seen_in_wc_sync: syncedAt,
                archived_from_wc: false, // Restore if was archived
                updated_at: syncedAt,
              })
              .eq('id', existingOrder.id);

            if (updateError) {
              console.error(`Failed to update order ${orderId}:`, updateError);
              errors.push(`Update ${orderId}: ${updateError.message}`);
              continue;
            }

            orderDbId = existingOrder.id;

            // CRITICAL: If order_id doesn't match, update it to numeric format (migration fix)
            if (existingOrder.order_id && existingOrder.order_id !== orderId && existingOrder.order_id.startsWith('WC-')) {
              console.log(`Updating order_id from ${existingOrder.order_id} to ${orderId} (removing WC- prefix)`);
              await adminSupabase
                .from('orders')
                .update({ order_id: orderId })
                .eq('id', existingOrder.id);
            }

            if (isRestored) {
              restoredCount++;
              console.log(`Restored archived order ${orderId} (WC Order #${wooOrderId})`);

              // Create timeline entry for restoration
              await adminSupabase
                .from('timeline')
                .insert({
                  order_id: orderDbId,
                  action: 'note_added',
                  stage: 'sales',
                  performed_by: user.id,
                  performed_by_name: 'WooCommerce Sync',
                  notes: `Order restored from WooCommerce sync (was previously archived). WC Order #${wooOrderId}`,
                  is_public: true,
                });
            } else {
              updatedCount++;
              console.log(`Updated order ${orderId} with latest WooCommerce data`);
            }
          } else {
            // SAFEGUARD 5: Missing Order Logic - Create new order
            // CRITICAL: Double-check for duplicates before inserting (race condition protection)
            const { data: doubleCheckOrder } = await adminSupabase
              .from('orders')
              .select('id')
              .eq('order_id', orderId)
              .maybeSingle();

            if (doubleCheckOrder) {
              console.log(`Order ${orderId} was created by another process, skipping duplicate`);
              continue;
            }

            const { data: newOrder, error: orderError } = await adminSupabase
              .from('orders')
              .insert({
                order_id: orderId,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                customer_address: billingAddress,
                billing_city: billing.city || null,
                billing_state: billing.state || null,
                billing_pincode: billing.postcode || null,
                shipping_name: shippingName,
                shipping_address: shippingAddress,
                shipping_city: shippingCity,
                shipping_state: shippingState,
                shipping_pincode: shippingPincode,
                shipping_email: shipping.email || billing.email || null,
                shipping_phone: shipping.phone || billing.phone || null,
                order_status: wooOrder.status,
                payment_status: wooOrder.payment_method_title || wooOrder.payment_method,
                order_total: orderTotal,
                tax_cgst: taxCgst,
                tax_sgst: taxSgst,
                delivery_date: deliveryDate,
                woo_order_id: wooOrderId,
                source: 'woocommerce', // SAFEGUARD 1: Mark as woocommerce source
                priority: 'blue',
                last_seen_in_wc_sync: syncedAt,
                archived_from_wc: false,
                created_by: user.id,
              })
              .select()
              .single();

            if (orderError) {
              // Handle unique constraint violations (duplicate order_id) - race condition protection
              if (orderError.code === '23505' || orderError.message?.includes('duplicate') || orderError.message?.includes('unique')) {
                console.log(`Order ${orderId} already exists (unique constraint violation), skipping duplicate`);
                continue;
              }
              console.error(`Failed to create order ${orderId}:`, orderError);
              errors.push(`Create ${orderId}: ${orderError.message}`);
              continue;
            }

            orderDbId = newOrder.id;
            importedCount++;

            console.log(`Created new order ${orderId} (WC Order #${wooOrderId})`);

            // Create timeline entry for new order
            await adminSupabase
              .from('timeline')
              .insert({
                order_id: orderDbId,
                action: 'created',
                stage: 'sales',
                performed_by: user.id,
                performed_by_name: 'WooCommerce Sync',
                notes: `Order imported from WooCommerce (WC Order #${wooOrderId})`,
                is_public: true,
              });
          }

          // Process line items (products) - SAFEGUARD 3: Stage-agnostic, update items regardless
          for (const item of wooOrder.line_items || []) {
            const { specifications, rawMeta } = parseProductMeta(item.meta_data || []);
            const lineTotal = parseFloat(item.total) || 0;

            // Generate item_id for this line item (consistent with import-orders format)
            const itemId = `${orderId}-${item.id}`;

            // Check if this item already exists for this order by item_id (preferred) or SKU (fallback)
            let existingItem: any = null;

            // First try to find by item_id
            const { data: itemById } = await adminSupabase
              .from('order_items')
              .select('id, item_id')
              .eq('order_id', orderDbId)
              .eq('item_id', itemId)
              .maybeSingle();

            if (itemById) {
              existingItem = itemById;
            } else {
              // Fallback: try to find by SKU
              const sku = item.sku || `woo-${item.product_id}`;
              const { data: itemBySku } = await adminSupabase
                .from('order_items')
                .select('id, item_id')
                .eq('order_id', orderDbId)
                .eq('sku', sku)
                .maybeSingle();

              if (itemBySku) {
                existingItem = itemBySku;
              }
            }

            if (existingItem) {
              // Update existing item with latest meta (preserve stage/assignment)
              // Also ensure item_id is set if it wasn't before
              const updateData: any = {
                product_name: item.name || 'Unknown Product',
                quantity: item.quantity || 1,
                specifications: specifications,
                woo_meta: rawMeta,
                line_total: lineTotal,
                updated_at: syncedAt,
              };

              // Set item_id if it wasn't set before
              if (!existingItem.item_id) {
                updateData.item_id = itemId;
              }

              await adminSupabase
                .from('order_items')
                .update(updateData)
                .eq('id', existingItem.id);

              console.log(`Updated item ${item.name} for order ${orderId}`);
            } else {
              // Create new item with item_id
              const deliveryDate = new Date();
              deliveryDate.setDate(deliveryDate.getDate() + 7);

              const { error: itemError } = await adminSupabase
                .from('order_items')
                .insert({
                  item_id: itemId,
                  order_id: orderDbId,
                  product_name: item.name || 'Unknown Product',
                  quantity: item.quantity || 1,
                  sku: item.sku || `woo-${item.product_id}`,
                  specifications: specifications,
                  woo_meta: rawMeta,
                  line_total: lineTotal,
                  current_stage: 'sales',
                  assigned_department: 'sales',
                  priority: 'blue',
                  delivery_date: deliveryDate.toISOString(),
                  is_ready_for_production: false,
                  is_dispatched: false,
                  created_at: syncedAt,
                  updated_at: syncedAt,
                });

              if (itemError) {
                console.error(`Failed to create item for ${orderId}:`, itemError);
                errors.push(`Item ${orderId}/${item.name}: ${itemError.message}`);
              } else {
                console.log(`Created item ${item.name} with ${Object.keys(specifications).length} specs for order ${orderId}`);
              }
            }
          }

        } catch (orderError: unknown) {
          const errorMsg = orderError instanceof Error ? orderError.message : 'Unknown error';
          console.error(`Error processing WooCommerce order ${wooOrder.id}:`, orderError);
          errors.push(`Order ${wooOrder.id}: ${errorMsg}`);
        }
      }

      // STEP 2: SAFEGUARD 6 - Archive orders not found in current sync (but preserve them)
      // Only archive WooCommerce orders that are not in the current sync
      const { data: existingWooOrders } = await adminSupabase
        .from('orders')
        .select('id, order_id, woo_order_id, source, archived_from_wc')
        .eq('source', 'woocommerce')
        .not('woo_order_id', 'is', null);

      if (existingWooOrders) {
        for (const existingOrder of existingWooOrders) {
          // SAFEGUARD 7: Never archive manual orders
          if (existingOrder.source === 'manual') {
            continue;
          }

          // If Woo order ID not in current sync, archive it
          if (existingOrder.woo_order_id && !wooOrderIds.includes(existingOrder.woo_order_id)) {
            // Only archive if not already archived
            if (!existingOrder.archived_from_wc) {
              const { error: archiveError } = await adminSupabase
                .from('orders')
                .update({
                  archived_from_wc: true,
                  updated_at: syncedAt,
                })
                .eq('id', existingOrder.id);

              if (archiveError) {
                console.error(`Failed to archive order ${existingOrder.order_id}:`, archiveError);
                errors.push(`Archive ${existingOrder.order_id}: ${archiveError.message}`);
              } else {
                archivedCount++;
                console.log(`Archived order ${existingOrder.order_id} (WC Order #${existingOrder.woo_order_id}) - not found in current sync`);

                // Create timeline entry for archiving
                await adminSupabase
                  .from('timeline')
                  .insert({
                    order_id: existingOrder.id,
                    action: 'note_added',
                    stage: 'sales',
                    performed_by: user.id,
                    performed_by_name: 'WooCommerce Sync',
                    notes: `Order archived from WooCommerce sync (not found in current sync). Order preserved with full history.`,
                    is_public: true,
                  });
              }
            }
          }
        }
      }

      // STEP 3: SAFEGUARD 4 - Create sync log entry
      const syncStatus = errors.length > 0 ? (errors.length === wooOrders.length ? 'failed' : 'partial') : 'completed';

      const { error: logError } = await adminSupabase
        .from('order_sync_logs')
        .insert({
          sync_id: syncId,
          synced_at: syncedAt,
          woo_order_ids: wooOrderIds,
          sync_status: syncStatus,
          imported_count: importedCount,
          updated_count: updatedCount,
          archived_count: archivedCount,
          restored_count: restoredCount,
          errors: errors.length > 0 ? errors : [],
          performed_by: user.id,
        });

      if (logError) {
        console.error('Failed to create sync log:', logError);
      }

      console.log(`Sync complete: ${importedCount} imported, ${updatedCount} updated, ${restoredCount} restored, ${archivedCount} archived, ${errors.length} errors`);

      return new Response(JSON.stringify({
        success: true,
        sync_id: syncId,
        imported: importedCount,
        updated: updatedCount,
        restored: restoredCount,
        archived: archivedCount,
        total: wooOrders.length,
        errors: errors.length > 0 ? errors : undefined,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Edge Function] Unhandled error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    return new Response(JSON.stringify({
      error: errorMessage,
      details: errorDetails || 'No details'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});