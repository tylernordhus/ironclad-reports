create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid,
  week_start date not null,
  week_end date not null,
  summary text not null default '',
  submitted_by text,
  report_count integer not null default 0,
  generated_from_daily_reports boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_reports_project_week_key unique (project_id, week_start, week_end)
);

create index if not exists weekly_reports_project_id_idx
  on public.weekly_reports(project_id);

create index if not exists weekly_reports_organization_id_idx
  on public.weekly_reports(organization_id);

create index if not exists weekly_reports_user_id_idx
  on public.weekly_reports(user_id);

create index if not exists weekly_reports_week_start_idx
  on public.weekly_reports(week_start desc);

create or replace function public.set_weekly_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists weekly_reports_set_updated_at on public.weekly_reports;

create trigger weekly_reports_set_updated_at
before update on public.weekly_reports
for each row
execute function public.set_weekly_reports_updated_at();

comment on table public.weekly_reports is
  'Standalone weekly project reports that can be created manually or prefilled from daily reports.';
