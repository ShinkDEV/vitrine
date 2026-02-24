
-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule weekly portfolio reminder emails (every Monday at 10:00 UTC)
SELECT cron.schedule(
  'send-portfolio-reminders-weekly',
  '0 10 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://izvhamufbelljktfghsa.supabase.co/functions/v1/send-portfolio-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmhhbXVmYmVsbGprdGZnaHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Nzk1NTcsImV4cCI6MjA4NzQ1NTU1N30.e7R9wpa6MmTPBdqRsXyo-FF9yOtYV_BAUASpbkiEA3E"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
