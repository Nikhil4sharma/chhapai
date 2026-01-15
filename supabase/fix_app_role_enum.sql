-- ==========================================
-- Fix App Role Enum - Complete
-- Adds 'hr', 'outsource', 'dispatch' to app_role
-- ==========================================

DO $$
BEGIN
  -- Add 'hr' if not exists
  BEGIN ALTER TYPE public.app_role ADD VALUE 'hr'; EXCEPTION WHEN duplicate_object THEN null; END;
  
  -- Add 'outsource' if not exists
  BEGIN ALTER TYPE public.app_role ADD VALUE 'outsource'; EXCEPTION WHEN duplicate_object THEN null; END;

  -- Add 'dispatch' if not exists (proactive fix)
  BEGIN ALTER TYPE public.app_role ADD VALUE 'dispatch'; EXCEPTION WHEN duplicate_object THEN null; END;
  
   -- Add 'accounts' if not exists (proactive fix)
  BEGIN ALTER TYPE public.app_role ADD VALUE 'accounts'; EXCEPTION WHEN duplicate_object THEN null; END;
END $$;
