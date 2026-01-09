-- FINAL CONSOLIDATED FIX (Run this ONE script)
-- Combines: Nuke Recursion, Clean Legacy Policies, Fix Departments RLS

-- ============================================================================
-- 1. NUKE RECURSIVE DEPENDENCIES
-- ============================================================================
-- Drop functions cascading to remove attached policies automatically
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;

-- Explicitly DROP lingering policies mentioned in analysis
DROP POLICY IF EXISTS "User Roles: View (Self or Admin)" ON public.user_roles;
DROP POLICY IF EXISTS "User Roles: Manage (Admin)" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;

-- ============================================================================
-- 2. SETUP SECURE ADMIN LOOKUP
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users_secure ( user_id UUID PRIMARY KEY );
REVOKE ALL ON public.admin_users_secure FROM PUBLIC, authenticated, anon; 

CREATE OR REPLACE FUNCTION public.sync_admin_users_secure() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND OLD.role = 'admin'::app_role) THEN
    DELETE FROM public.admin_users_secure WHERE user_id = OLD.user_id::uuid;
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.role = 'admin'::app_role) OR 
     (TG_OP = 'UPDATE' AND NEW.role = 'admin'::app_role) THEN
    INSERT INTO public.admin_users_secure (user_id) VALUES (NEW.user_id::uuid) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_admin_users ON public.user_roles;
CREATE TRIGGER trigger_sync_admin_users AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.sync_admin_users_secure();

-- Sync now
INSERT INTO public.admin_users_secure (user_id) 
SELECT user_id::uuid FROM public.user_roles WHERE role = 'admin'::app_role 
ON CONFLICT (user_id) DO NOTHING;

-- Safe Admin Check
CREATE OR REPLACE FUNCTION public.is_admin_safe() RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admin_users_secure WHERE user_id = auth.uid());
END;
$$;

-- ============================================================================
-- 3. RESTORE has_role (SAFE VERSION)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _role = 'admin'::app_role THEN
    RETURN EXISTS (SELECT 1 FROM public.admin_users_secure WHERE user_id = _user_id);
  END IF;
  -- Safe because user_roles RLS will be TRUE for select
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
END;
$$;

-- ============================================================================
-- 4. FIX USER_ROLES RLS
-- ============================================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- Cleanup again just in case
DROP POLICY IF EXISTS "user_roles_read_all_safe" ON public.user_roles;

-- Allow all authenticated users to read roles (Prevents recursion loop)
CREATE POLICY "user_roles_read_all_safe" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Strict Write Policies using is_admin_safe
CREATE POLICY "user_roles_insert_safe" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "user_roles_update_safe" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "user_roles_delete_safe" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin_safe());

-- ============================================================================
-- 5. FIX DEPARTMENTS RLS (Missing RLS detected)
-- ============================================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.departments;
DROP POLICY IF EXISTS "Allow write access to admins only" ON public.departments;

CREATE POLICY "Allow read access to authenticated users" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access to admins only" ON public.departments FOR ALL TO authenticated USING (public.is_admin_safe()) WITH CHECK (public.is_admin_safe());

-- ============================================================================
-- 6. ENSURE ORDERS ACCESS
-- ============================================================================
-- Ensure at least one policy exists if others were dropped
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders') THEN
        CREATE POLICY "orders_read_fallback" ON public.orders FOR SELECT TO authenticated USING (
          public.is_admin_safe() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
        );
    END IF;
END $$;
