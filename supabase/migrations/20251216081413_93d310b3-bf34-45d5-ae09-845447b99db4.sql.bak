-- Fix: Remove is_public bypass from timeline SELECT policy
-- Timeline entries should only be viewable based on department access, not public flag

DROP POLICY IF EXISTS "Users can view timeline for accessible orders" ON public.timeline;

CREATE POLICY "Users can view timeline for accessible orders"
ON public.timeline
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = timeline.order_id
    AND oi.assigned_department = get_user_department(auth.uid())
  )
);