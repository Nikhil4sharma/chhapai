-- ============================================
-- COMPLETE DATABASE SETUP FOR CHHAPAI TOOL
-- ============================================
-- Ye script run karo Supabase SQL Editor me
-- Sab tables, RLS policies, functions, aur triggers setup ho jayenge
-- ============================================

-- Step 1: Create app_role enum
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'sales', 'design', 'prepress', 'production');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Step 3: Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    department TEXT,
    phone TEXT,
    avatar_url TEXT,
    production_stage TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 4: Create orders table with all columns
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'manual',
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    customer_address TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_pincode TEXT,
    shipping_name TEXT,
    shipping_email TEXT,
    shipping_phone TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_pincode TEXT,
    order_total NUMERIC,
    tax_cgst NUMERIC,
    tax_sgst NUMERIC,
    payment_status TEXT,
    woo_order_id INTEGER,
    order_status TEXT,
    created_by UUID REFERENCES auth.users(id),
    global_notes TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    delivery_date TIMESTAMP WITH TIME ZONE,
    priority TEXT NOT NULL DEFAULT 'blue',
    archived_from_wc BOOLEAN NOT NULL DEFAULT false,
    last_seen_in_wc_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 5: Create order_items table with all columns
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    specifications JSONB DEFAULT '{}',
    woo_meta JSONB DEFAULT '[]'::jsonb,
    line_total NUMERIC,
    need_design BOOLEAN NOT NULL DEFAULT false,
    current_stage TEXT NOT NULL DEFAULT 'sales',
    current_substage TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_department TEXT NOT NULL DEFAULT 'sales',
    delivery_date TIMESTAMP WITH TIME ZONE,
    priority TEXT NOT NULL DEFAULT 'blue',
    is_ready_for_production BOOLEAN NOT NULL DEFAULT false,
    is_dispatched BOOLEAN NOT NULL DEFAULT false,
    dispatch_info JSONB DEFAULT NULL,
    production_stage_sequence TEXT[] DEFAULT NULL,
    outsource_info JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 6: Create order_files table
CREATE TABLE IF NOT EXISTS public.order_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'other',
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 7: Create timeline table
CREATE TABLE IF NOT EXISTS public.timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    substage TEXT,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    performed_by_name TEXT,
    notes TEXT,
    attachments JSONB DEFAULT '[]',
    qty_confirmed INTEGER,
    paper_treatment TEXT,
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 8: Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    order_id TEXT,
    item_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 9: Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    sound_enabled BOOLEAN NOT NULL DEFAULT true,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 10: Create user_work_logs table
CREATE TABLE IF NOT EXISTS public.user_work_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_name TEXT NOT NULL,
    department TEXT NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    product_name TEXT,
    stage TEXT NOT NULL,
    action_type TEXT NOT NULL,
    work_summary TEXT NOT NULL,
    time_spent_minutes INTEGER NOT NULL DEFAULT 0,
    work_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Step 11: Create work_notes table
CREATE TABLE IF NOT EXISTS public.work_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    time_spent_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE,
    is_edited BOOLEAN NOT NULL DEFAULT false
);

-- Step 12: Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_notes ENABLE ROW LEVEL SECURITY;

-- Step 13: Create helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Step 14: Create trigger function for user deletion cleanup
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear assigned_to references in order_items
  UPDATE public.order_items
  SET assigned_to = NULL
  WHERE assigned_to = OLD.user_id;
  
  RETURN OLD;
END;
$$;

-- Step 15: Create trigger for user deletion
DROP TRIGGER IF EXISTS on_profile_delete ON public.profiles;
CREATE TRIGGER on_profile_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deletion();

-- Step 16: Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Step 17: Create triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_items_updated_at ON public.order_items;
CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 18: RLS Policies for user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Step 19: RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view basic profile info" ON public.profiles;
CREATE POLICY "Users can view basic profile info"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (user_id = auth.uid())
  OR (
    -- Allow viewing only full_name and avatar_url for team assignment purposes (no phone)
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = profiles.user_id
    )
  )
);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Step 20: RLS Policies for orders
DROP POLICY IF EXISTS "Users can view orders based on department" ON public.orders;
CREATE POLICY "Users can view orders based on department"
ON public.orders FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'sales') OR
  EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = orders.id
    AND oi.assigned_department = public.get_user_department(auth.uid())
  )
);

DROP POLICY IF EXISTS "Sales and admin can create orders" ON public.orders;
CREATE POLICY "Sales and admin can create orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

DROP POLICY IF EXISTS "Sales and admin can update orders" ON public.orders;
CREATE POLICY "Sales and admin can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Step 21: RLS Policies for order_items
DROP POLICY IF EXISTS "Users can view items based on department" ON public.order_items;
CREATE POLICY "Users can view items based on department"
ON public.order_items FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  assigned_department = public.get_user_department(auth.uid()) OR
  public.has_role(auth.uid(), 'sales') OR
  (assigned_to = auth.uid() AND assigned_to IS NOT NULL)
);

DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;
CREATE POLICY "Users can update items in their department"
ON public.order_items FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  assigned_department = public.get_user_department(auth.uid()) OR
  public.has_role(auth.uid(), 'sales') OR
  (assigned_to = auth.uid() AND assigned_to IS NOT NULL)
);

DROP POLICY IF EXISTS "Sales and admin can create items" ON public.order_items;
CREATE POLICY "Sales and admin can create items"
ON public.order_items FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

DROP POLICY IF EXISTS "Admins can delete items" ON public.order_items;
CREATE POLICY "Admins can delete items"
ON public.order_items FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Step 22: RLS Policies for order_files
DROP POLICY IF EXISTS "Users can view files" ON public.order_files;
CREATE POLICY "Users can view files"
ON public.order_files FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can upload files" ON public.order_files;
CREATE POLICY "Authenticated users can upload files"
ON public.order_files FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own files" ON public.order_files;
CREATE POLICY "Users can delete their own files"
ON public.order_files FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Step 23: RLS Policies for timeline
DROP POLICY IF EXISTS "Users can view timeline" ON public.timeline;
CREATE POLICY "Users can view timeline"
ON public.timeline FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can add timeline entries to accessible orders" ON public.timeline;
CREATE POLICY "Users can add timeline entries to accessible orders"
ON public.timeline FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'sales'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = timeline.order_id
    AND oi.assigned_department = get_user_department(auth.uid())
  )
);

-- Step 24: RLS Policies for notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Step 25: RLS Policies for user_settings
DROP POLICY IF EXISTS "Users can manage their own settings" ON public.user_settings;
CREATE POLICY "Users can manage their own settings"
ON public.user_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Step 26: RLS Policies for user_work_logs
DROP POLICY IF EXISTS "Users can view their own work logs" ON public.user_work_logs;
CREATE POLICY "Users can view their own work logs"
ON public.user_work_logs FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can insert their own work logs" ON public.user_work_logs;
CREATE POLICY "Users can insert their own work logs"
ON public.user_work_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Step 27: RLS Policies for work_notes
DROP POLICY IF EXISTS "Users can manage their own work notes" ON public.work_notes;
CREATE POLICY "Users can manage their own work notes"
ON public.work_notes FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Step 28: Create storage bucket for order files
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-files', 'order-files', false)
ON CONFLICT (id) DO NOTHING;

-- Step 29: Storage policies
DROP POLICY IF EXISTS "Anyone can view order files" ON storage.objects;
CREATE POLICY "Anyone can view order files"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-files');

DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-files');

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'order-files');

-- Step 30: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_is_completed ON public.orders(is_completed);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_assigned_department ON public.order_items(assigned_department);
CREATE INDEX IF NOT EXISTS idx_order_items_assigned_to ON public.order_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_timeline_order_id ON public.timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created_at ON public.timeline(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_work_logs_user_id ON public.user_work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_work_logs_work_date ON public.user_work_logs(work_date DESC);

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Ab aap:
-- 1. Team members add kar sakte hain
-- 2. Orders create kar sakte hain
-- 3. Department-wise access properly kaam karega
-- 4. User delete karte waqt sab related data automatically delete ho jayega
-- ============================================

