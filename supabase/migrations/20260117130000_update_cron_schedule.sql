-- Migration: Update Cron Schedule
-- Description: Updates the 'woocommerce-auto-import' cron job to target the correct Edge Function and action.

-- 1. Unschedule old job
SELECT cron.unschedule('woocommerce-auto-import');

-- 2. Schedule new job
-- Note: Requesting to the 'woocommerce' function with 'sync-orders' action
SELECT cron.schedule(
    'woocommerce-auto-import',
    '*/5 * * * *', -- Every 5 minutes
    $$
    SELECT
        net.http_post(
            url:='https://hswgdeldouyclpeqbbgq.supabase.co/functions/v1/woocommerce',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
            body:='{"action": "sync-orders", "lookback_minutes": 10}'::jsonb
        ) as request_id;
    $$
);
-- NOTE: The Authorization header relies on a setting or hardcoded value. 
-- The previous one had a hardcoded token.
-- To be safe and avoid breaking Auth if 'app.settings.service_role_key' isn't set, 
-- I will use a placeholder or the PREVIOUS token if I can't be sure.
-- But using the previous token (which might be Anon) to call a function relying on Admin access (via RPC Security Definer) might be okay
-- IF the function code allows Anon (it does, it checks headers but Supabase Gateway handles it).
-- The previous token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI
-- (Decoded: role: anon, exp: 2081711660 - valid for long time).
-- So I will re-use the hardcoded token for safety to ensure immediate continuity.

SELECT cron.unschedule('woocommerce-auto-import');

SELECT cron.schedule(
    'woocommerce-auto-import',
    '*/5 * * * *',
    $$
    SELECT
        net.http_post(
            url:='https://hswgdeldouyclpeqbbgq.supabase.co/functions/v1/woocommerce',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI"}'::jsonb,
            body:='{"action": "sync-orders", "lookback_minutes": 10}'::jsonb
        ) as request_id;
    $$
);
