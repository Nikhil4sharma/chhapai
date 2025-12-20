-- ============================================
-- CREATE VENDORS AND APP_SETTINGS TABLES
-- ============================================
-- Ye script run karo Supabase SQL Editor me
-- Vendors aur app_settings tables ban jayenge
-- ============================================

-- Step 1: Create vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  vendor_company TEXT,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 2: Enable RLS on vendors
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies for vendors
-- Admin can do everything
CREATE POLICY "Admin can manage all vendors"
ON public.vendors
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view vendors
CREATE POLICY "Users can view vendors"
ON public.vendors
FOR SELECT
USING (auth.role() = 'authenticated');

-- Step 4: Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 5: Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for app_settings
-- Admin can do everything
CREATE POLICY "Admin can manage app settings"
ON public.app_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view app settings
CREATE POLICY "Users can view app settings"
ON public.app_settings
FOR SELECT
USING (auth.role() = 'authenticated');

-- Step 7: Create function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Step 8: Create triggers for updated_at
DROP TRIGGER IF EXISTS update_vendors_updated_at ON public.vendors;
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Step 9: Insert default production stages if not exists
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES (
  'production_stages',
  '[
    {"key": "cutting", "label": "Cutting", "order": 1},
    {"key": "printing", "label": "Printing", "order": 2},
    {"key": "binding", "label": "Binding", "order": 3},
    {"key": "finishing", "label": "Finishing", "order": 4},
    {"key": "packing", "label": "Packing", "order": 5}
  ]'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. Vendors table ab Supabase me available hai
-- 2. App settings table ab Supabase me available hai
-- 3. Production stages default values me set hain
-- 4. Admin sab kuch manage kar sakta hai
-- 5. Regular users sirf view kar sakte hain
-- ============================================

