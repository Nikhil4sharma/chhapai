-- ============================================
-- CONFIRM ALL EXISTING USERS EMAIL
-- ============================================
-- Ye script run karo Supabase SQL Editor me
-- Sab existing users ki email automatically confirm ho jayegi
-- ============================================

-- Step 1: Confirm all existing users' emails
-- Ye query sab users ki email confirm kar dega jo abhi unconfirmed hain
-- Note: confirmed_at is a generated column, so we only update email_confirmed_at
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
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
-- 2. confirmed_at automatically generate hoga (generated column hai)
-- 3. Agar koi specific user ki email confirm nahi hui, toh manually kar sakte ho:
--    UPDATE auth.users 
--    SET email_confirmed_at = now()
--    WHERE email = 'user@example.com';
-- ============================================

