-- Fix: allow Design/Prepress users to reassign items forward/backward within workflow by permitting department changes on UPDATE.
-- Existing policy likely blocks updates when assigned_department changes, causing: "new row violates row-level security policy for table order_items".

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

CREATE POLICY "Users can update items in their department"
ON public.order_items
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  OR (assigned_department = get_user_department(auth.uid()))
)
WITH CHECK (true);