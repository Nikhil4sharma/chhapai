-- ============================================
-- CREATE WOOCOMMERCE CREDENTIALS TABLE
-- ============================================
-- Ye script run karo Supabase SQL Editor me
-- WooCommerce credentials table ban jayega
-- ============================================

-- Step 1: Create woocommerce_credentials table
CREATE TABLE IF NOT EXISTS public.woocommerce_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE DEFAULT 'config',
  store_url TEXT NOT NULL,
  consumer_key TEXT NOT NULL,
  consumer_secret TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 2: Enable RLS on woocommerce_credentials
ALTER TABLE public.woocommerce_credentials ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies for woocommerce_credentials
-- Only admin can manage credentials
CREATE POLICY "Admin can manage WooCommerce credentials"
ON public.woocommerce_credentials
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Step 4: Create function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_woocommerce_credentials_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Step 5: Create trigger for updated_at
DROP TRIGGER IF EXISTS update_woocommerce_credentials_updated_at ON public.woocommerce_credentials;
CREATE TRIGGER update_woocommerce_credentials_updated_at
  BEFORE UPDATE ON public.woocommerce_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_woocommerce_credentials_updated_at();

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. WooCommerce credentials table ab Supabase me available hai
-- 2. Sirf admin credentials manage kar sakta hai
-- 3. Credentials securely store honge
-- 4. Settings page se credentials add/edit kar sakte ho
-- ============================================

