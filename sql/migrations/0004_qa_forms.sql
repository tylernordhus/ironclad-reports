create table if not exists public.qa_forms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  project_name text not null,
  form_type text not null,
  work_date date,
  submitted_by text,
  form_data jsonb not null default '{}'::jsonb,
  photo_urls text[] default '{}'::text[],
  photo_labels text[] default '{}'::text[],
  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qa_forms_project_id_idx on public.qa_forms(project_id);
create index if not exists qa_forms_user_id_idx on public.qa_forms(user_id);
create index if not exists qa_forms_work_date_idx on public.qa_forms(work_date desc);
create index if not exists qa_forms_form_type_idx on public.qa_forms(form_type);

create or replace function public.set_qa_forms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists qa_forms_set_updated_at on public.qa_forms;

create trigger qa_forms_set_updated_at
before update on public.qa_forms
for each row
execute function public.set_qa_forms_updated_at();
