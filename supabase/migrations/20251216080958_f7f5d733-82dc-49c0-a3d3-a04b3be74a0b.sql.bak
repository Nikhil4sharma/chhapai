-- Fix: Restrict timeline SELECT to department-based access

DROP POLICY IF EXISTS "Users can view timeline" ON public.timeline;

CREATE POLICY "Users can view timeline for accessible orders"
ON public.timeline
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  OR (is_public = true)
  OR EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = timeline.order_id
    AND oi.assigned_department = get_user_department(auth.uid())
  )
);