alter table public.pour_logs
  add column if not exists photo_labels text[];
