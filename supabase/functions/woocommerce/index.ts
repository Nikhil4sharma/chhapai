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
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const wooOrder of orders) {
        try {
          const wooOrderId = wooOrder.id;
          const orderId = `WC-${wooOrderId}`;
          
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
          let deliveryDate = null;
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
          
          // Check if order already exists
          const { data: existing } = await adminSupabase
            .from('orders')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle();

          let orderDbId: string;

          if (existing) {
            // Update existing order with latest data
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
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            if (updateError) {
              console.error(`Failed to update order ${orderId}:`, updateError);
              errors.push(`Update ${orderId}: ${updateError.message}`);
              continue;
            }
            
            orderDbId = existing.id;
            updatedCount++;
            
            console.log(`Updated order ${orderId} with latest WooCommerce data`);
          } else {
            // Create new order
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
                source: 'woocommerce',
                priority: 'blue',
                created_by: user.id,
              })
              .select()
              .single();

            if (orderError) {
              console.error(`Failed to create order ${orderId}:`, orderError);
              errors.push(`Create ${orderId}: ${orderError.message}`);
              continue;
            }

            orderDbId = newOrder.id;
            importedCount++;
            
            console.log(`Created new order ${orderId}`);
          }

          // Process line items (products)
          for (const item of wooOrder.line_items || []) {
            const { specifications, rawMeta } = parseProductMeta(item.meta_data || []);
            const lineTotal = parseFloat(item.total) || 0;
            
            // Check if this item already exists for this order
            const { data: existingItem } = await adminSupabase
              .from('order_items')
              .select('id')
              .eq('order_id', orderDbId)
              .eq('sku', item.sku || `woo-${item.product_id}`)
              .maybeSingle();

            if (existingItem) {
              // Update existing item with latest meta
              await adminSupabase
                .from('order_items')
                .update({
                  product_name: item.name || 'Unknown Product',
                  quantity: item.quantity || 1,
                  specifications: specifications,
                  woo_meta: rawMeta,
                  line_total: lineTotal,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingItem.id);
                
              console.log(`Updated item ${item.name} for order ${orderId}`);
            } else {
              // Create new item
              const { error: itemError } = await adminSupabase
                .from('order_items')
                .insert({
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
                });

              if (itemError) {
                console.error(`Failed to create item for ${orderId}:`, itemError);
                errors.push(`Item ${orderId}/${item.name}: ${itemError.message}`);
              } else {
                console.log(`Created item ${item.name} with ${Object.keys(specifications).length} specs for order ${orderId}`);
              }
            }
          }

          // Create timeline entry only for new orders
          if (!existing) {
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
          
        } catch (orderError: unknown) {
          const errorMsg = orderError instanceof Error ? orderError.message : 'Unknown error';
          console.error(`Error processing WooCommerce order ${wooOrder.id}:`, orderError);
          errors.push(`Order ${wooOrder.id}: ${errorMsg}`);
        }
      }

      console.log(`Sync complete: ${importedCount} imported, ${updatedCount} updated, ${errors.length} errors`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        imported: importedCount,
        updated: updatedCount,
        skipped: skippedCount,
        total: orders.length,
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
    console.error('WooCommerce function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});