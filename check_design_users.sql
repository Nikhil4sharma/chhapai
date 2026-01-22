-- Diagnostic: Check Design Users in Profiles vs User Roles

-- 1. Check Profiles for 'design' department
SELECT 'profiles' as source, id, user_id, email, role, department 
FROM public.profiles 
WHERE department ILIKE 'design' OR role ILIKE 'design';

-- 2. Check User Roles for 'design' role
SELECT 'user_roles' as source, id, user_id, role 
FROM public.user_roles
WHERE role ILIKE 'design';

-- 3. Check for any mismatches (Users in profiles but not in user_roles)
SELECT 
    p.user_id, 
    p.email, 
    p.department as profile_dept, 
    ur.role as user_role_role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
WHERE p.department ILIKE 'design';
