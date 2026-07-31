create table if not exists public.project_report_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_type text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_report_types_project_report_type_key unique (project_id, report_type),
  constraint project_report_types_report_type_check
    check (
      report_type in (
        'daily_report',
        'pour_log',
        'qa_009',
        'qa_010',
        'qa_011',
        'qa_012',
        'qa_013',
        'contractor_evaluation'
      )
    )
);

create index if not exists project_report_types_project_id_idx
  on public.project_report_types(project_id);

create index if not exists project_report_types_report_type_idx
  on public.project_report_types(report_type);

create or replace function public.set_project_report_types_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_report_types_set_updated_at on public.project_report_types;

create trigger project_report_types_set_updated_at
before update on public.project_report_types
for each row
execute function public.set_project_report_types_updated_at();

comment on table public.project_report_types is
  'Per-project report availability toggles used to control which report types appear in project workflows.';
