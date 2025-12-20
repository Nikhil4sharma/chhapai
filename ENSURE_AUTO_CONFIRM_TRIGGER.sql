-- ============================================
-- ENSURE AUTO-CONFIRM TRIGGER IS ACTIVE
-- ============================================
-- Ye script run karo Supabase SQL Editor me
-- Ye ensure karega ki auto-confirm trigger properly setup hai
-- ============================================

-- Step 1: Drop existing trigger if exists (to avoid conflicts)
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;

-- Step 2: Create or replace function for auto-confirming new users
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-confirm email for new users created by admin
  -- Only confirm if email_confirmed_at is NULL (new user)
  -- Note: confirmed_at is a generated column, so we only set email_confirmed_at
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
    -- confirmed_at will be automatically generated from email_confirmed_at
  END IF;
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger for auto-confirming new users
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user_email();

-- Step 4: Confirm all existing unconfirmed users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- Step 5: Verify trigger is created and active
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created_auto_confirm';

-- Step 6: Verify all users are confirmed
SELECT 
  COUNT(*) as total_users,
  COUNT(email_confirmed_at) as confirmed_users,
  COUNT(*) - COUNT(email_confirmed_at) as unconfirmed_users
FROM auth.users;

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. Ye trigger ab se sab new users ki email automatically confirm kar dega
-- 2. Existing users ki email bhi confirm ho jayegi
-- 3. Test karo: Naya user banao aur check karo ki email confirmed hai ya nahi
-- 4. Agar trigger disable karna ho:
--    DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
-- ============================================

