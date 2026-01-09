-- Fix: Restrict order_files SELECT to department-based access

DROP POLICY IF EXISTS "Users can view files" ON public.order_files;

CREATE POLICY "Users can view files for accessible orders"
ON public.order_files
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  OR (order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = order_files.order_id
    AND oi.assigned_department = get_user_department(auth.uid())
  ))
  OR (item_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.id = order_files.item_id
    AND oi.assigned_department = get_user_department(auth.uid())
  ))
);