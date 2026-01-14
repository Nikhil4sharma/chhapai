-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cron job (every 5 minutes)
SELECT cron.schedule(
    'woocommerce-auto-import',
    '*/5 * * * *',
    $$
    SELECT
        net.http_post(
            url:='https://hswgdeldouyclpeqbbgq.supabase.co/functions/v1/woocommerce-auto-import',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- Verify schedule
SELECT * FROM cron.job;
