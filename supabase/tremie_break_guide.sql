-- Add persisted Tremie Break Guide settings/results to drilled-shaft pour logs.
--
-- Safe additive migration. Run this in Supabase before relying on database
-- autosave/persistence for the Tremie Break Guide.

alter table public.pour_logs
  add column if not exists tremie_break_guide jsonb;
