# Fix CORS Error for WooCommerce Edge Function

## Problem
CORS error aa raha hai Edge Function se:
```
Access to fetch at 'https://hswgdeldouyclpeqbbgq.supabase.co/functions/v1/woocommerce' 
from origin 'http://192.168.1.30:8081' has been blocked by CORS policy
```

## Solution
Edge Function ko redeploy karna hoga with updated CORS headers.

## Steps to Deploy

### Option 1: Supabase Dashboard se
1. Supabase Dashboard kholo: https://app.supabase.com
2. Project select karo
3. Left sidebar se **Edge Functions** click karo
4. **woocommerce** function select karo
5. **Deploy** button click karo
6. Wait karo deployment complete hone tak

### Option 2: Supabase CLI se (agar installed hai)
```bash
# Supabase login (pehli baar)
supabase login

# Link your project
supabase link --project-ref hswgdeldouyclpeqbbgq

# Deploy function
supabase functions deploy woocommerce
```

### Option 3: Manual Upload
1. `supabase/functions/woocommerce/index.ts` file ko check karo
2. Supabase Dashboard → Edge Functions → woocommerce
3. Code copy karke paste karo
4. Deploy karo

## Changes Made
- ✅ OPTIONS request ke liye status code 200 set kiya (204 se)
- ✅ CORS headers properly set kiye:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
  - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
  - `Access-Control-Max-Age: 86400`

## Verification
Deployment ke baad:
1. Browser console check karo - CORS errors nahi aane chahiye
2. FetchOrdersPanel test karo - orders fetch hone chahiye
3. Network tab mein OPTIONS request check karo - 200 status aana chahiye

## Note
Agar abhi bhi CORS error aaye:
1. Browser cache clear karo
2. Hard refresh karo (Ctrl+Shift+R)
3. Edge Function logs check karo Supabase Dashboard mein

