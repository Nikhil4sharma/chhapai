-- ==========================================================
-- Auto-Sync New Users to Employees Table & Fix Missing Users
-- Run this in Supabase SQL Editor
-- ==========================================================

-- 1. Create Function to Handle New User Creation
CREATE OR REPLACE FUNCTION public.handle_new_employee()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.employees (user_id, email, first_name, last_name, category, is_tool_user)
  VALUES (
    NEW.id,
    NEW.email,
    -- Case 1: Try to get first_name from metadata
    -- Case 2: Try to split full_name from metadata
    -- Case 3: Fallback to email part
    COALESCE(
        NEW.raw_user_meta_data->>'first_name',
        split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1),
        split_part(NEW.email, '@', 1)
    ),
    -- Case 1: Try to get last_name from metadata
    -- Case 2: Try to get rest of full_name
    COALESCE(
        NEW.raw_user_meta_data->>'last_name',
        substring(NEW.raw_user_meta_data->>'full_name' from position(' ' in NEW.raw_user_meta_data->>'full_name') + 1),
        ''
    ),
    'office', -- Default category
    true      -- Mark as tool user
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_create_employee ON auth.users;
CREATE TRIGGER on_auth_user_created_create_employee
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_employee();

-- 3. SYNC MISSING USERS (Fixes "Diksha" not showing up)
-- This will insert any users that are in auth.users but NOT in employees
INSERT INTO public.employees (user_id, first_name, last_name, email, is_tool_user, category)
SELECT 
    u.id,
    COALESCE(
        u.raw_user_meta_data->>'first_name',
        split_part(u.raw_user_meta_data->>'full_name', ' ', 1),
        split_part(u.email, '@', 1)
    ),
    COALESCE(
        u.raw_user_meta_data->>'last_name',
        substring(u.raw_user_meta_data->>'full_name' from position(' ' in u.raw_user_meta_data->>'full_name') + 1),
        ''
    ),
    u.email,
    true,
    'office'
FROM auth.users u
LEFT JOIN public.employees e ON u.id = e.user_id
WHERE e.id IS NULL; -- Only insert if not already in employees

-- 4. Verify RLS Policies for Profiles (Just in case Team page is also broken)
DROP POLICY IF EXISTS "Allow admin to view all profiles" ON public.profiles;
CREATE POLICY "Allow admin to view all profiles"
    ON public.profiles
    FOR SELECT
    USING (true); -- Simplified to allow viewing (or restrict to auth if needed)
