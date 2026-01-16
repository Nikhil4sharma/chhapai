-- Migration: Add is_paid to leave_types
-- Created: 2026-01-16
-- Purpose: Track if a leave type is paid or unpaid

ALTER TABLE public.leave_types 
ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT true;

-- Update specific types if known, otherwise default is true (Adjust manually in Admin UI later)
UPDATE public.leave_types SET is_paid = true WHERE is_paid IS NULL;
