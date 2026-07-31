create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_slug_idx
  on public.organizations(slug)
  where slug is not null;

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'inspector',
  is_active boolean not null default true,
  invited_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_role_check
    check (role in ('owner', 'admin', 'inspector', 'viewer'))
);

create unique index if not exists organization_memberships_org_user_idx
  on public.organization_memberships(organization_id, user_id);

create index if not exists organization_memberships_user_id_idx
  on public.organization_memberships(user_id);

alter table public.projects
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.reports
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.pour_logs
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.contractor_evaluations
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.qa_forms
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists projects_organization_id_idx
  on public.projects(organization_id);

create index if not exists reports_organization_id_idx
  on public.reports(organization_id);

create index if not exists pour_logs_organization_id_idx
  on public.pour_logs(organization_id);

create index if not exists contractor_evaluations_organization_id_idx
  on public.contractor_evaluations(organization_id);

create index if not exists qa_forms_organization_id_idx
  on public.qa_forms(organization_id);

create or replace function public.set_organizations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;

create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_organizations_updated_at();

create or replace function public.set_organization_memberships_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_memberships_set_updated_at on public.organization_memberships;

create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row
execute function public.set_organization_memberships_updated_at();

comment on table public.organizations is
  'Top-level tenant/company record for multi-user, multi-organization support.';

comment on table public.organization_memberships is
  'Maps users into organizations with role-based access.';

comment on column public.projects.organization_id is
  'Nullable transition column for future org-scoped access control.';

comment on column public.reports.organization_id is
  'Nullable transition column for future org-scoped access control.';

comment on column public.pour_logs.organization_id is
  'Nullable transition column for future org-scoped access control.';

comment on column public.contractor_evaluations.organization_id is
  'Nullable transition column for future org-scoped access control.';

comment on column public.qa_forms.organization_id is
  'Nullable transition column for future org-scoped access control.';
