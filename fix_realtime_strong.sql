
BEGIN;

-- Remove from publication to be safe (ignore error if not exists)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.notifications;

-- Add to publication explicitly
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Ensure RLS allows the subscription (SELECT)
-- The policy "Users can view their own notifications" should handle this.
-- Re-verify the policy.
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Commit
COMMIT;
