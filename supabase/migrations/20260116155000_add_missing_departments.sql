-- Add missing departments: Accounts and HR
-- Migration: 20260116155000_add_missing_departments.sql

-- First, ensure departments table has unique constraint on name
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'departments_name_key' 
        AND conrelid = 'public.departments'::regclass
    ) THEN
        ALTER TABLE public.departments ADD CONSTRAINT departments_name_key UNIQUE (name);
    END IF;
END $$;

-- Now insert departments with ON CONFLICT
-- Use gen_random_uuid() for UUID id generation
INSERT INTO public.departments (id, name, description)
VALUES 
  (gen_random_uuid(), 'accounts', 'Accounts department'),
  (gen_random_uuid(), 'hr', 'HR department')
ON CONFLICT (name) DO NOTHING;
