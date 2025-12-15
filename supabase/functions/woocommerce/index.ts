import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory credential cache (for runtime updates within same instance)
let runtimeCredentials: {
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  updatedAt?: Date;
} = {};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Verify user is authenticated and is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('User is not admin:', roleError);
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;
    console.log('WooCommerce action requested:', action);

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

    if (action === 'sync-orders') {
      console.log('Syncing orders from WooCommerce:', storeUrl);
      
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

      const orders = await response.json();
      console.log(`Fetched ${orders.length} processing orders from WooCommerce`);

      // Process and store orders
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

      let importedCount = 0;
      let skippedCount = 0;

      for (const wooOrder of orders) {
        // Check if order already exists
        const { data: existing } = await adminSupabase
          .from('orders')
          .select('id')
          .eq('order_id', `WC-${wooOrder.id}`)
          .single();

        if (existing) {
          skippedCount++;
          continue;
        }

        // Create order
        const { data: newOrder, error: orderError } = await adminSupabase
          .from('orders')
          .insert({
            order_id: `WC-${wooOrder.id}`,
            customer_name: `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim() || 'Unknown Customer',
            customer_email: wooOrder.billing?.email || null,
            customer_phone: wooOrder.billing?.phone || null,
            customer_address: wooOrder.billing?.address_1 || null,
            source: 'woocommerce',
            priority: 'blue',
            created_by: user.id,
          })
          .select()
          .single();

        if (orderError) {
          console.error('Failed to create order:', orderError);
          continue;
        }

        // Create order items
        for (const item of wooOrder.line_items || []) {
          await adminSupabase
            .from('order_items')
            .insert({
              order_id: newOrder.id,
              product_name: item.name || 'Unknown Product',
              quantity: item.quantity || 1,
              sku: item.sku || null,
              current_stage: 'sales',
              assigned_department: 'sales',
              priority: 'blue',
            });
        }

        // Create timeline entry
        await adminSupabase
          .from('timeline')
          .insert({
            order_id: newOrder.id,
            action: 'Order imported from WooCommerce',
            stage: 'sales',
            performed_by: user.id,
            performed_by_name: 'WooCommerce Sync',
            is_public: true,
          });

        importedCount++;
      }

      console.log(`Sync complete: ${importedCount} imported, ${skippedCount} skipped`);
      return new Response(JSON.stringify({ 
        success: true, 
        imported: importedCount,
        skipped: skippedCount,
        total: orders.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('WooCommerce function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
