-- ============================================
-- AUTO-CONFIRM NEW USERS EMAIL
-- ============================================
-- Ye script run karo Supabase SQL Editor me
-- Ab se jo bhi naye users banenge, unki email automatically confirm ho jayegi
-- ============================================

-- Step 1: Function banaye jo new users ki email auto-confirm kare
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

-- Step 2: Trigger create karo jo automatically email confirm kare
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user_email();

-- Step 3: Verify trigger
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created_auto_confirm';

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. Ye trigger ab se sab new users ki email automatically confirm kar dega
-- 2. Existing users ke liye CONFIRM_EXISTING_USERS_EMAIL.sql run karo
-- 3. Agar trigger disable karna ho:
--    DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
-- 4. Test karo: Naya user banao aur check karo ki email confirmed hai ya nahi
-- ============================================

