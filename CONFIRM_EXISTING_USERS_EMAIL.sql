-- ============================================
-- CONFIRM EXISTING USERS EMAIL
-- ============================================
-- Ye script run karo Supabase SQL Editor me
-- Sab existing users ki email automatically confirm ho jayegi
-- ============================================

-- Step 1: Confirm all existing users' emails
-- Ye query sab users ki email confirm kar dega jo abhi unconfirmed hain
-- Note: confirmed_at is a generated column, so we only update email_confirmed_at
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- Step 2: Verify - Check kitne users confirmed hain
SELECT 
  COUNT(*) as total_users,
  COUNT(email_confirmed_at) as confirmed_users,
  COUNT(*) - COUNT(email_confirmed_at) as unconfirmed_users
FROM auth.users;

-- Step 3: Show all users with their confirmation status
-- Note: confirmed_at is a generated column based on email_confirmed_at
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmed_at, -- This is automatically generated from email_confirmed_at
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. Ye script sab existing users ki email confirm kar dega
-- 2. New users ke liye: Admin user banane ke baad, ye query run karo ya manually confirm karo
-- 3. Agar koi specific user ki email confirm nahi hui, toh manually kar sakte ho:
--    UPDATE auth.users 
--    SET email_confirmed_at = now()
--    WHERE email = 'user@example.com';
--    Note: confirmed_at is automatically generated from email_confirmed_at
--
-- 4. New users banane ke baad automatically confirm karne ke liye:
--    Option A: Ye query regularly run karo (recommended)
--    Option B: Supabase Dashboard > Authentication > Users me manually confirm karo
--    Option C: Supabase Edge Function banao jo automatically confirm kare
-- ============================================

-- Step 4: Auto-confirm new users (Optional - agar regularly run karna ho)
-- Ye function banaye jo automatically new users ki email confirm kare
CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-confirm email for new users
  -- Note: confirmed_at is a generated column, so we only set email_confirmed_at
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
    -- confirmed_at will be automatically generated from email_confirmed_at
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger create karo (Optional - agar automatically confirm karna ho)
-- DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
-- CREATE TRIGGER on_auth_user_created_confirm
--   BEFORE INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_users();

-- Note: Trigger use karna safe nahi hai kyunki ye sab users ki email auto-confirm kar dega
-- Better hai ki manually ya query se confirm karo
-- ============================================

