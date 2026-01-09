-- Tighten UPDATE policy: allow department changes only within workflow rules (while still permitting edits within same department).

DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

CREATE POLICY "Users can update items in their department"
ON public.order_items
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (assigned_department = get_user_department(auth.uid()))
  OR has_role(auth.uid(), 'sales'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    get_user_department(auth.uid()) = 'sales'
    AND assigned_department IN ('sales', 'design', 'prepress')
  )
  OR (
    get_user_department(auth.uid()) = 'design'
    AND assigned_department IN ('design', 'prepress', 'production')
  )
  OR (
    get_user_department(auth.uid()) = 'prepress'
    AND assigned_department IN ('prepress', 'production', 'design')
  )
  OR (
    get_user_department(auth.uid()) = 'production'
    AND assigned_department IN ('production')
  )
  OR (
    has_role(auth.uid(), 'sales'::app_role)
    AND assigned_department IN ('sales', 'design', 'prepress')
  )
);