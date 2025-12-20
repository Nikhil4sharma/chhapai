-- ============================================
-- FIX EMAIL CONFIRMATION AND LOGIN ISSUES
-- ============================================
-- Ye script run karo Supabase SQL Editor me
-- Sab existing users ki email confirm ho jayegi
-- Aur ab se new users ki email automatically confirm hogi
-- ============================================

-- Step 1: Confirm all existing users' emails
-- Ye query sab users ki email confirm kar dega jo abhi unconfirmed hain
-- Note: confirmed_at is a generated column, so we only update email_confirmed_at
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- Step 2: Create function for auto-confirming new users
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
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user_email();

-- Step 4: Verify - Check kitne users confirmed hain
SELECT 
  COUNT(*) as total_users,
  COUNT(email_confirmed_at) as confirmed_users,
  COUNT(*) - COUNT(email_confirmed_at) as unconfirmed_users
FROM auth.users;

-- Step 5: Show all users with their confirmation status
-- Note: confirmed_at is a generated column based on email_confirmed_at
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmed_at, -- This is automatically generated from email_confirmed_at
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Step 6: Verify trigger is created
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
-- 1. Ye script sab existing users ki email confirm kar dega
-- 2. Ab se jo bhi naya user banega, unki email automatically confirm ho jayegi
-- 3. Agar koi specific user ki email confirm nahi hui, toh manually kar sakte ho:
--    UPDATE auth.users 
--    SET email_confirmed_at = now()
--    WHERE email = 'user@example.com';
--    Note: confirmed_at is automatically generated from email_confirmed_at
-- 4. Test karo: Naya user banao aur check karo ki email confirmed hai ya nahi
-- ============================================

