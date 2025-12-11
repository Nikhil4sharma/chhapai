-- Drop the existing policy
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

-- Create new policy with proper WITH CHECK clause
-- USING checks the OLD row (can they update items currently in their department?)
-- WITH CHECK allows any valid new values after the update
CREATE POLICY "Users can update items in their department" 
ON public.order_items 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (assigned_department = get_user_department(auth.uid())) 
  OR has_role(auth.uid(), 'sales'::app_role)
)
WITH CHECK (true);