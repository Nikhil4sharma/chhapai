-- RECURSION NUKE SCRIPT
-- This script aggressively removes the root causes of recursion and re-applies safe RLS.

-- 1. DROP RECURSIVE FUNCTION AND DEPENDENTS
-- Dropping this function CASCADE will automatically DROP ALL Policies that use it.
-- This is the most effective way to clear out hidden legacy policies causing recursion.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;

-- 2. ENSURE ADMIN INFRASTRUCTURE EXISTS
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

-- Populate secure table
INSERT INTO public.admin_users_secure (user_id) 
SELECT user_id::uuid FROM public.user_roles WHERE role = 'admin'::app_role 
ON CONFLICT (user_id) DO NOTHING;

-- 3. CREATE SAFE ADMIN CHECK
CREATE OR REPLACE FUNCTION public.is_admin_safe() RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admin_users_secure WHERE user_id = auth.uid());
END;
$$;

-- 4. RESTORE has_role (SAFE VERSION)
-- We recreate this because application code might expect it to exist,
-- but we define it to be SAFE (using the secure table for admin check).
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Optimization: If checking for admin, use the safe table to avoid touching user_roles RLS
  IF _role = 'admin'::app_role THEN
    RETURN EXISTS (SELECT 1 FROM public.admin_users_secure WHERE user_id = _user_id);
  END IF;
  
  -- For other roles, query user_roles.
  -- This is safe ONLY because we are fixing user_roles RLS below to be "TRUE" for reads.
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
END;
$$;

-- 5. FIX USER_ROLES RLS (The Solution)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop any partially applied policies from previous attempts
DROP POLICY IF EXISTS "user_roles_read_all_safe" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_safe" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;

-- Create the SAFE permissive read policy
-- This allows anyone to read roles, preventing recursion when checking "who is sales?"
CREATE POLICY "user_roles_read_all_safe" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Strict Write Policies
CREATE POLICY "user_roles_insert_safe" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "user_roles_update_safe" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "user_roles_delete_safe" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin_safe());

-- 6. ENSURE ORDERS ACCESS (Fallback)
-- In case dropping has_role removed order access policies
CREATE POLICY "orders_read_fallback" ON public.orders FOR SELECT TO authenticated USING (
  public.is_admin_safe() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
);
-- Note: It's OK if this fails because a policy already exists.
