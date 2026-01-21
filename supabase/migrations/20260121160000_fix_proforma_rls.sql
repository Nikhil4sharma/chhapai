-- Fix Proforma Invoice RLS to allow deletion
-- Ensure RLS is enabled
ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Allow users to view their own invoices or admins to view all
DROP POLICY IF EXISTS "proforma_invoices_select" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Allow select for owners" ON public.proforma_invoices;

CREATE POLICY "proforma_invoices_select" ON public.proforma_invoices
    FOR SELECT TO authenticated
    USING (
        created_by = (select auth.uid()) OR 
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
    );

-- 2. DELETE: Allow users to delete their own invoices or admins to delete any
DROP POLICY IF EXISTS "proforma_invoices_delete" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Allow delete for owners" ON public.proforma_invoices;

CREATE POLICY "proforma_invoices_delete" ON public.proforma_invoices
    FOR DELETE TO authenticated
    USING (
        created_by = (select auth.uid()) OR 
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
    );

-- 3. UPDATE: Allow users to update their own invoices or admins to update any
DROP POLICY IF EXISTS "proforma_invoices_update" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Allow update for owners" ON public.proforma_invoices;

CREATE POLICY "proforma_invoices_update" ON public.proforma_invoices
    FOR UPDATE TO authenticated
    USING (
        created_by = (select auth.uid()) OR 
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
    )
    WITH CHECK (
        created_by = (select auth.uid()) OR 
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
    );
