# Migration Instructions - Fix order_items INSERT Policy

## Option 1: Supabase Dashboard (Easiest)

1. Supabase Dashboard me jao: https://supabase.com/dashboard
2. Apna project select karo
3. Left sidebar me **SQL Editor** click karo
4. New query create karo
5. Neeche diya hua SQL copy-paste karo:

```sql
-- Fix order_items INSERT policy to ensure it works correctly
DROP POLICY IF EXISTS "Sales and admin can create items" ON public.order_items;

-- Recreate the INSERT policy with explicit role enum casting
CREATE POLICY "Sales and admin can create items"
ON public.order_items 
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'sales'::app_role)
);
```

**Important:** Agar error aaye to ye simpler version try karo (original format):

```sql
DROP POLICY IF EXISTS "Sales and admin can create items" ON public.order_items;

CREATE POLICY "Sales and admin can create items"
ON public.order_items 
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'sales')
);
```

6. **Run** button click karo
7. Success message check karo

## Option 2: Install Supabase CLI

### Windows (PowerShell):
```powershell
# Scoop se install (recommended)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Ya phir npm se
npm install -g supabase
```

### After installation:
```bash
# Supabase login
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

## Verification

Migration apply hone ke baad, test karo:
1. App me order create karo
2. Browser console me error check karo
3. Agar success ho, to order items create ho jayenge

