-- Add push_enabled column to user_settings table
-- This column was missing but is being used in the application

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.user_settings.push_enabled IS 'Whether push notifications are enabled for the user';

