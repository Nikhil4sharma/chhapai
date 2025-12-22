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

// CORS headers - CRITICAL for frontend access
// Must match what browser sends in preflight request
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'content-type, content-length',
};

// Standardized error codes
const ERROR_CODES = {
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_NUMBER_MISMATCH: 'ORDER_NUMBER_MISMATCH',
  ALREADY_IMPORTED: 'ALREADY_IMPORTED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  WOOCOMMERCE_ERROR: 'WOOCOMMERCE_ERROR',
} as const;

// Helper to parse product meta data from WooCommerce line items
function parseProductMeta(metaData: any[]): Record<string, string> {
  const specifications: Record<string, string> = {};
  
  if (!Array.isArray(metaData)) {
    return specifications;
  }
  
  // Keys to skip (internal WooCommerce meta)
  const skipKeys = ['_reduced_stock', '_restock_refunded_items', '_product_addons', '_qty'];
  
  for (const meta of metaData) {
    if (!meta.key || skipKeys.includes(meta.key) || meta.key.startsWith('_')) {
      continue;
    }
    
    // Store display key and value
    const displayKey = meta.display_key || meta.key;
    const displayValue = meta.display_value || meta.value;
    
    if (displayValue && typeof displayValue === 'string' && displayValue.trim()) {
      specifications[displayKey] = displayValue.trim();
    }
  }
  
  return specifications;
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

// Helper to normalize order numbers for comparison
function normalizeOrderNumber(orderNum: string | number | null | undefined): string {
  if (!orderNum) return '';
  const str = orderNum.toString().trim();
  // Remove WC- or MAN- prefix if present
  const withoutPrefix = str.replace(/^(WC|MAN)-/i, '');
  // Return just the numeric part
  return withoutPrefix.replace(/\D/g, '');
}

// Helper to sanitize order data
function sanitizeOrderData(wooOrder: any) {
  return {
    // Basic order info
    id: wooOrder.id,
    order_number: wooOrder.number || wooOrder.id,
    order_date: wooOrder.date_created || wooOrder.date_created_gmt,
    
    // Customer details (safe to expose)
    customer_name: `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim() || 'Unknown',
    customer_email: wooOrder.billing?.email || '',
    customer_phone: wooOrder.billing?.phone || '',
    
    // Address (safe to expose)
    billing_address: buildFullAddress(wooOrder.billing),
    billing_city: wooOrder.billing?.city || '',
    billing_state: wooOrder.billing?.state || '',
    billing_pincode: wooOrder.billing?.postcode || '',
    
    // Shipping address (if different from billing)
    shipping_name: wooOrder.shipping?.first_name 
      ? `${wooOrder.shipping.first_name} ${wooOrder.shipping.last_name || ''}`.trim() 
      : `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim(),
    shipping_address: buildFullAddress(wooOrder.shipping) || buildFullAddress(wooOrder.billing),
    shipping_city: wooOrder.shipping?.city || wooOrder.billing?.city || '',
    shipping_state: wooOrder.shipping?.state || wooOrder.billing?.state || '',
    shipping_pincode: wooOrder.shipping?.postcode || wooOrder.billing?.postcode || '',
    
    // Products (sanitized - only name, qty, sku, specifications)
    line_items: (wooOrder.line_items || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      quantity: parseInt(item.quantity) || 1,
      sku: item.sku || '',
      specifications: parseProductMeta(item.meta_data || []),
    })),
    
    // Payment status (safe to expose)
    payment_status: wooOrder.status || 'pending',
    
    // Order totals (safe to expose - already public info)
    order_total: parseFloat(wooOrder.total) || 0,
    currency: wooOrder.currency || 'INR',
  };
}

serve(async (req) => {
  // CRITICAL: Handle CORS preflight requests FIRST
  if (req.method === 'OPTIONS') {
    console.log('[woocommerce-fetch] Handling OPTIONS preflight request');
    return new Response(null, { 
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get auth header for user verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[woocommerce-fetch] No authorization header provided');
      return new Response(JSON.stringify({ 
        found: false,
        error: ERROR_CODES.UNAUTHORIZED,
        message: 'Unauthorized'
      }), {
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
      console.error('[woocommerce-fetch] User authentication failed:', userError);
      return new Response(JSON.stringify({ 
        found: false,
        error: ERROR_CODES.UNAUTHORIZED,
        message: 'Unauthorized'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CRITICAL: Check user role - ONLY admin and sales allowed
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'sales'])
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('[woocommerce-fetch] User is not admin or sales:', user.id);
      return new Response(JSON.stringify({ 
        found: false,
        error: ERROR_CODES.UNAUTHORIZED,
        message: 'Forbidden: Only Admin and Sales can fetch WooCommerce orders'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
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
      console.error('[woocommerce-fetch] Error parsing request body:', parseError);
      const contentType = req.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return new Response(JSON.stringify({ 
          found: false,
          error: 'Invalid request body' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { order_number } = body;
    
    if (!order_number || typeof order_number !== 'string' || !order_number.trim()) {
      return new Response(JSON.stringify({ 
        found: false,
        error: 'Order number is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestedOrderNumber = order_number.trim();
    const requestedNormalized = normalizeOrderNumber(requestedOrderNumber);

    // Get WooCommerce credentials
    let storeUrl = Deno.env.get('WOOCOMMERCE_STORE_URL');
    let consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
    let consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

    if (!storeUrl || !consumerKey || !consumerSecret) {
      console.error('[woocommerce-fetch] WooCommerce credentials not configured');
      return new Response(JSON.stringify({ 
        found: false,
        error: ERROR_CODES.WOOCOMMERCE_ERROR,
        message: 'WooCommerce service unavailable' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[woocommerce-fetch] Fetching WooCommerce order by number:', requestedOrderNumber);

    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    let wooOrders: any[] = [];
    
    // STEP 1: Try multiple search approaches
    // Approach 1: Search by number parameter (exact match)
    try {
      const searchParams1 = new URLSearchParams();
      searchParams1.append('number', requestedOrderNumber);
      searchParams1.append('per_page', '100'); // Get more results to filter
      
      const searchUrl1 = `${storeUrl}/wp-json/wc/v3/orders?${searchParams1.toString()}`;
      console.log('[woocommerce-fetch] Trying search by number parameter:', searchUrl1);
      
      const searchResponse1 = await fetch(searchUrl1, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (searchResponse1.ok) {
        const results = await searchResponse1.json();
        if (Array.isArray(results) && results.length > 0) {
          wooOrders = results;
          console.log('[woocommerce-fetch] Found', results.length, 'orders with number parameter');
        }
      } else {
        console.log('[woocommerce-fetch] Number parameter search returned:', searchResponse1.status);
      }
    } catch (error) {
      console.error('[woocommerce-fetch] Error in number parameter search:', error);
    }

    // Approach 2: If no results, try searching all recent orders and filter
    if (wooOrders.length === 0) {
      try {
        // Search recent orders (last 100) and filter by order number
        const searchParams2 = new URLSearchParams();
        searchParams2.append('per_page', '100');
        searchParams2.append('orderby', 'date');
        searchParams2.append('order', 'desc');
        
        const searchUrl2 = `${storeUrl}/wp-json/wc/v3/orders?${searchParams2.toString()}`;
        console.log('[woocommerce-fetch] Trying fallback search (recent orders):', searchUrl2);
        
        const searchResponse2 = await fetch(searchUrl2, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        if (searchResponse2.ok) {
          const results = await searchResponse2.json();
          if (Array.isArray(results) && results.length > 0) {
            // Filter by normalized order number
            wooOrders = results.filter((order: any) => {
              const orderNum = order.number?.toString().trim() || order.id?.toString().trim();
              const orderNormalized = normalizeOrderNumber(orderNum);
              return orderNormalized === requestedNormalized;
            });
            console.log('[woocommerce-fetch] Found', wooOrders.length, 'matching orders in recent orders');
          }
        } else {
          console.log('[woocommerce-fetch] Fallback search returned:', searchResponse2.status);
        }
      } catch (error) {
        console.error('[woocommerce-fetch] Error in fallback search:', error);
      }
    }

    // Approach 3: If order number is numeric, try direct ID fetch
    if (wooOrders.length === 0 && /^\d+$/.test(requestedOrderNumber)) {
      try {
        const orderId = parseInt(requestedOrderNumber, 10);
        const directUrl = `${storeUrl}/wp-json/wc/v3/orders/${orderId}`;
        console.log('[woocommerce-fetch] Trying direct ID fetch:', directUrl);
        
        const directResponse = await fetch(directUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        if (directResponse.ok) {
          const order = await directResponse.json();
          // Verify the order number matches
          const orderNum = order.number?.toString().trim() || order.id?.toString().trim();
          const orderNormalized = normalizeOrderNumber(orderNum);
          if (orderNormalized === requestedNormalized) {
            wooOrders = [order];
            console.log('[woocommerce-fetch] Found order via direct ID fetch');
          } else {
            console.log('[woocommerce-fetch] Direct ID fetch returned different order number');
          }
        } else {
          console.log('[woocommerce-fetch] Direct ID fetch returned:', directResponse.status);
        }
      } catch (error) {
        console.error('[woocommerce-fetch] Error in direct ID fetch:', error);
      }
    }
    
    if (!wooOrders || wooOrders.length === 0) {
      console.log('[woocommerce-fetch] Order not found after all search attempts:', requestedOrderNumber);
      return new Response(JSON.stringify({ 
        found: false,
        error: ERROR_CODES.ORDER_NOT_FOUND,
        message: `Order number ${requestedOrderNumber} not found in WooCommerce. Please verify the order number.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CRITICAL: WooCommerce API might return multiple orders or wrong order
    // Filter to find EXACT match by comparing normalized order numbers
    let wooOrderMetadata: any = null;
    for (const order of wooOrders) {
      const orderNum = order.number?.toString().trim() || order.id?.toString().trim();
      const orderNormalized = normalizeOrderNumber(orderNum);
      if (orderNormalized === requestedNormalized) {
        wooOrderMetadata = order;
        break;
      }
    }

    // If no exact match found, return error
    if (!wooOrderMetadata) {
      console.error('[woocommerce-fetch] ORDER_NUMBER_MISMATCH: No exact match found in results', {
        requested: requestedOrderNumber,
        requestedNormalized,
        returnedOrders: wooOrders.map((o: any) => ({
          id: o.id,
          number: o.number,
          normalized: normalizeOrderNumber(o.number || o.id)
        }))
      });
      return new Response(JSON.stringify({ 
        found: false,
        error: ERROR_CODES.ORDER_NUMBER_MISMATCH,
        message: `Order number ${requestedOrderNumber} not found. WooCommerce returned different order(s). Please verify the order number.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 2: Double-check exact match (safety check)
    const receivedOrderNumber = wooOrderMetadata.number?.toString().trim() || wooOrderMetadata.id?.toString().trim();
    const receivedNormalized = normalizeOrderNumber(receivedOrderNumber);
    
    if (receivedNormalized !== requestedNormalized) {
      console.error('[woocommerce-fetch] ORDER_NUMBER_MISMATCH (after filter):', {
        requested: requestedOrderNumber,
        requestedNormalized,
        received: receivedOrderNumber,
        receivedNormalized
      });
      return new Response(JSON.stringify({ 
        found: false,
        error: ERROR_CODES.ORDER_NUMBER_MISMATCH,
        message: `Order number mismatch: Expected ${requestedOrderNumber}, but WooCommerce returned ${receivedOrderNumber}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 3: Extract WooCommerce Order ID and fetch by ID (authoritative source)
    const wooOrderId = wooOrderMetadata.id;
    if (!wooOrderId) {
      console.error('[woocommerce-fetch] No order ID found in metadata');
      return new Response(JSON.stringify({ 
        found: false,
        error: ERROR_CODES.WOOCOMMERCE_ERROR,
        message: 'Invalid order data from WooCommerce'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[woocommerce-fetch] Order number verified, fetching by ID:', wooOrderId);

    // STEP 4: Fetch order by ID (authoritative fetch)
    const idFetchUrl = `${storeUrl}/wp-json/wc/v3/orders/${wooOrderId}`;
    const idFetchResponse = await fetch(idFetchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!idFetchResponse.ok) {
      const errorText = await idFetchResponse.text();
      console.error('[woocommerce-fetch] WooCommerce ID fetch error:', idFetchResponse.status, errorText);
      return new Response(JSON.stringify({ 
        found: false,
        error: ERROR_CODES.WOOCOMMERCE_ERROR,
        message: `Failed to fetch order details: ${idFetchResponse.status}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const wooOrder = await idFetchResponse.json();

    // STEP 5: Check cache for existing import
    const { data: cachedImport, error: cacheError } = await supabase
      .from('woocommerce_imports')
      .select('*')
      .eq('woocommerce_order_id', wooOrderId)
      .maybeSingle();

    if (cacheError && cacheError.code !== 'PGRST116') { // PGRST116 = not found, which is OK
      console.error('[woocommerce-fetch] Cache lookup error:', cacheError);
      // Continue with fetch even if cache lookup fails
    }

    // STEP 6: Sanitize order data
    const sanitizedOrder = sanitizeOrderData(wooOrder);

    // STEP 7: If cached, return cached data with flag
    if (cachedImport) {
      console.log('[woocommerce-fetch] Returning cached import for order:', wooOrderId);
      const cachedPayload = cachedImport.sanitized_payload;
      return new Response(JSON.stringify({
        found: true,
        cached: true,
        imported_at: cachedImport.imported_at,
        order: cachedPayload
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 8: Return fresh data (will be cached on import)
    console.log('[woocommerce-fetch] Returning fresh order data:', sanitizedOrder.order_number);
    
    return new Response(JSON.stringify({
      found: true,
      cached: false,
      order: sanitizedOrder
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[woocommerce-fetch] Unhandled error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const errorStack = error instanceof Error ? error.stack : String(error);
    console.error('[woocommerce-fetch] Error stack:', errorStack);
    
    return new Response(JSON.stringify({ 
      found: false,
      error: ERROR_CODES.WOOCOMMERCE_ERROR,
      message: 'WooCommerce service unavailable' 
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
      },
    });
  }
});
