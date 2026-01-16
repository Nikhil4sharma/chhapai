-- Fix overly permissive RLS policies
-- Migration: 20260116170000_tighten_rls_policies.sql

-- ============================================
-- WC_CUSTOMERS: Restrict to Sales, Accounts, Admin
-- ============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.wc_customers;

-- Create role-based policies
CREATE POLICY "Sales and Admin can view customers"
ON public.wc_customers FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('sales', 'admin', 'accounts')
  )
);

CREATE POLICY "Sales and Admin can create customers"
ON public.wc_customers FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('sales', 'admin')
  )
);

CREATE POLICY "Sales and Admin can update customers"
ON public.wc_customers FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('sales', 'admin', 'accounts')
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('sales', 'admin', 'accounts')
  )
);

CREATE POLICY "Admin can delete customers"
ON public.wc_customers FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role = 'admin'
  )
);

-- ============================================
-- PAYMENT_LEDGER: Restrict to Accounts, Admin
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can insert ledger entries" ON public.payment_ledger;
DROP POLICY IF EXISTS "Authenticated users can view ledger entries" ON public.payment_ledger;

CREATE POLICY "Accounts and Admin can view payments"
ON public.payment_ledger FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('accounts', 'admin')
  )
);

CREATE POLICY "Accounts and Admin can create payments"
ON public.payment_ledger FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('accounts', 'admin')
  )
);

CREATE POLICY "Accounts and Admin can update payments"
ON public.payment_ledger FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('accounts', 'admin')
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('accounts', 'admin')
  )
);

CREATE POLICY "Admin can delete payments"
ON public.payment_ledger FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role = 'admin'
  )
);

-- ============================================
-- Add audit logging trigger
-- ============================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admin can view audit logs"
ON public.audit_log FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role = 'admin'
  )
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, operation, user_id, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_payment_ledger ON public.payment_ledger;
CREATE TRIGGER audit_payment_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.payment_ledger
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
