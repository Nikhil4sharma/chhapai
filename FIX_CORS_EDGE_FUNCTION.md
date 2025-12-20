# Fix CORS Error for Supabase Edge Function

## Issue
CORS preflight requests are failing with error: "Response to preflight request doesn't pass access control check: It does not have HTTP ok status."

## Solution

The edge function has been updated to properly handle CORS preflight requests. You need to **redeploy the edge function** for changes to take effect.

### Steps to Redeploy:

1. **Using Supabase CLI:**
   ```bash
   supabase functions deploy woocommerce
   ```

2. **Or using Supabase Dashboard:**
   - Go to Supabase Dashboard → Edge Functions
   - Find the `woocommerce` function
   - Click "Redeploy" or update the code manually

### What Was Fixed:

1. **OPTIONS Request Handling:**
   - Added explicit handling for OPTIONS preflight requests
   - Returns status 200 with proper CORS headers
   - Added `Content-Length: 0` header for OPTIONS response

2. **CORS Headers:**
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
   - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
   - `Access-Control-Max-Age: 86400`

3. **Error Handling:**
   - All error responses now include CORS headers
   - Better logging for debugging

### Important Notes:

- **The edge function MUST be redeployed** for CORS fixes to work
- After redeployment, clear browser cache and try again
- Check browser console for any remaining CORS errors

### Testing:

After redeployment, test the function by:
1. Opening browser DevTools → Network tab
2. Making a request to the edge function
3. Check that OPTIONS preflight request returns 200 OK
4. Check that actual request succeeds
