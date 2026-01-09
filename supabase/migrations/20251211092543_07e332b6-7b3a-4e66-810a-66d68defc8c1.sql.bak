-- Fix order_files INSERT policy to validate order access
DROP POLICY IF EXISTS "Authenticated users can upload files" ON public.order_files;

CREATE POLICY "Users can upload files to accessible orders"
ON public.order_files FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'sales') OR
  (
    order_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = order_files.order_id
      AND oi.assigned_department = get_user_department(auth.uid())
    )
  ) OR
  (
    item_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.id = order_files.item_id
      AND oi.assigned_department = get_user_department(auth.uid())
    )
  )
);