-- Migration: Add duration_type to leave_requests
-- Created: 2026-01-16
-- Purpose: Support Short Leave and Half Day requests

ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS duration_type text DEFAULT 'full_day' 
CHECK (duration_type IN ('full_day', 'half_day_first', 'half_day_second', 'short_morning', 'short_evening'));

-- Update existing records to be full_day
UPDATE public.leave_requests SET duration_type = 'full_day' WHERE duration_type IS NULL;
