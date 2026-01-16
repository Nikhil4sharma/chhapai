-- Migration: Add extra fields to hr_profiles
-- Created: 2026-01-16
-- Purpose: Add details requested for Employee Profile view

ALTER TABLE public.hr_profiles
ADD COLUMN IF NOT EXISTS blood_group TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;
