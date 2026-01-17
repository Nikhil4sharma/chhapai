-- Sync All Customer Details from WooCommerce
-- This will update phone numbers and other missing details

-- Add this action to woocommerce Edge Function
-- File: supabase/functions/woocommerce/index.ts

/*
Add this case in the switch statement:

case 'sync-all-customers-details':
  // Fetch all customers from database
  const { data: localCustomers } = await supabaseClient
    .from('wc_customers')
    .select('id, wc_id, email')
    .gt('wc_id', 0); // Only sync WooCommerce customers, not CSV/Guest

  if (!localCustomers) {
    return new Response(JSON.stringify({ error: 'No customers found' }), { status: 404 });
  }

  let updated = 0;
  let failed = 0;

  for (const customer of localCustomers) {
    try {
      // Fetch customer details from WooCommerce
      const wcCustomer = await fetch(
        `${WC_URL}/wp-json/wc/v3/customers/${customer.wc_id}`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`${WC_KEY}:${WC_SECRET}`)}`
          }
        }
      );

      if (!wcCustomer.ok) {
        failed++;
        continue;
      }

      const wcData = await wcCustomer.json();

      // Update customer in database
      await supabaseClient
        .from('wc_customers')
        .update({
          first_name: wcData.first_name,
          last_name: wcData.last_name,
          email: wcData.email,
          phone: wcData.billing?.phone || wcData.phone,
          billing: wcData.billing,
          shipping: wcData.shipping,
          avatar_url: wcData.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);

      updated++;
    } catch (err) {
      console.error(`Failed to sync customer ${customer.wc_id}:`, err);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: `Synced ${updated} customers, ${failed} failed` 
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
*/

-- After adding the above code, call it from frontend:
-- const { data } = await supabase.functions.invoke('woocommerce', { 
--   body: { action: 'sync-all-customers-details' } 
-- });
