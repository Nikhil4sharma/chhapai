-- Migration: Fix Order Assignment FK to reference User ID with Data Migration
-- Description: Changes orders.assigned_user to reference profiles.user_id (Auth ID) instead of profiles.id.
-- Includes data migration to preserve existing assignments.

-- 1. Data Migration: Convert existing references from Profile ID to User ID
-- Only needed if they differ. If they are the same (synced), this does nothing.
UPDATE public.orders o
SET assigned_user = p.user_id
FROM public.profiles p
WHERE o.assigned_user = p.id
AND o.assigned_user IS NOT NULL; 
-- Note: If assigned_user was ALREADY a user_id (and somehow passed FK check or if FK was disabled), this is still safe if profiles.user_id = profiles.id is false.
-- Ideally, we match on ID.

-- 2. Drop the old FK constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_assigned_user_fkey;

-- 3. Add the new FK constraint referencing user_id
-- We assume profiles.user_id is UNIQUE (verified by previous error)
ALTER TABLE public.orders 
ADD CONSTRAINT orders_assigned_user_fkey 
FOREIGN KEY (assigned_user) 
REFERENCES public.profiles(user_id);
