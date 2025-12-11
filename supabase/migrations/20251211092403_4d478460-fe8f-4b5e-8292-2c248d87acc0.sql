-- Fix 1: Make the order-files storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'order-files';

-- Fix 2: Replace the unrestricted timeline INSERT policy
DROP POLICY IF EXISTS "Authenticated users can add timeline entries" ON public.timeline;

CREATE POLICY "Users can add timeline entries to accessible orders"
ON public.timeline FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'sales') OR
  EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = timeline.order_id
    AND oi.assigned_department = get_user_department(auth.uid())
  )
);