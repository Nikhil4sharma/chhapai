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

serve(async (req) => {
  // CRITICAL: Handle CORS preflight requests FIRST
  // This MUST be the first thing we check - before any other processing
  if (req.method === 'OPTIONS') {
    console.log('[woocommerce-fetch] Handling OPTIONS preflight request');
    return new Response(null, { 
      status: 200, // OK status for CORS preflight
      headers: corsHeaders,
    });
  }

  try {
    // Get auth header for user verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[woocommerce-fetch] No authorization header provided');
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
      console.error('[woocommerce-fetch] User authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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
      return new Response(JSON.stringify({ error: 'Forbidden: Only Admin and Sales can fetch WooCommerce orders' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body - handle empty or invalid JSON gracefully
    // This follows the same pattern as the existing woocommerce function
    let body: any = {};
    try {
      const contentType = req.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const bodyText = await req.text();
        if (bodyText && bodyText.trim()) {
          body = JSON.parse(bodyText);
        }
        // If bodyText is empty, body remains {}
      }
      // If content-type is not JSON, body remains {}
    } catch (parseError) {
      console.error('[woocommerce-fetch] Error parsing request body:', parseError);
      // Return error only if we actually received JSON content-type
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
      // If not JSON content-type, continue with empty body
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

    // Get WooCommerce credentials from environment variables
    // These must be set in Supabase Dashboard > Edge Functions > Secrets
    let storeUrl = Deno.env.get('WOOCOMMERCE_STORE_URL');
    let consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
    let consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

    if (!storeUrl || !consumerKey || !consumerSecret) {
      console.error('[woocommerce-fetch] WooCommerce credentials not configured in environment variables');
      console.error('[woocommerce-fetch] Store URL configured:', !!storeUrl);
      console.error('[woocommerce-fetch] Consumer Key configured:', !!consumerKey);
      console.error('[woocommerce-fetch] Consumer Secret configured:', !!consumerSecret);
      return new Response(JSON.stringify({ 
        found: false,
        error: 'WooCommerce service unavailable' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[woocommerce-fetch] Fetching WooCommerce order by number:', order_number);

    // Fetch order from WooCommerce by number
    const searchParams = new URLSearchParams();
    searchParams.append('number', order_number.trim());
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
      console.error('[woocommerce-fetch] WooCommerce API error:', response.status, errorText);
      
      // Return not found for 404, server error for 500
      if (response.status === 404) {
        return new Response(JSON.stringify({ 
          found: false 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        found: false,
        error: `WooCommerce service error: ${response.status}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const wooOrders = await response.json();
    
    if (!wooOrders || wooOrders.length === 0) {
      console.log('[woocommerce-fetch] Order not found:', order_number);
      return new Response(JSON.stringify({ 
        found: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const wooOrder = wooOrders[0];
    
    // CRITICAL: Sanitize and return ONLY safe data
    // NEVER expose: WooCommerce keys, internal margins, costs, user IDs
    const sanitizedOrder = {
      found: true,
      order: {
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
      }
    };

    console.log('[woocommerce-fetch] Order found and sanitized:', sanitizedOrder.order.order_number);
    
    return new Response(JSON.stringify(sanitizedOrder), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[woocommerce-fetch] Unhandled error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const errorStack = error instanceof Error ? error.stack : String(error);
    console.error('[woocommerce-fetch] Error stack:', errorStack);
    
    // Return user-friendly error message
    return new Response(JSON.stringify({ 
      found: false,
      error: 'WooCommerce service unavailable' 
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
      },
    });
  }
});

