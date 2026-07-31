alter table public.organization_memberships
  add column if not exists access_role text;

update public.organization_memberships
set access_role = case
  when role in ('owner', 'admin') then 'owner'
  when role = 'viewer' then 'viewer'
  else 'member'
end
where access_role is null;

alter table public.organization_memberships
  alter column access_role set default 'member';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_memberships'
      and column_name = 'access_role'
      and is_nullable = 'YES'
  ) then
    alter table public.organization_memberships
      alter column access_role set not null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_memberships_access_role_check'
  ) then
    alter table public.organization_memberships
      add constraint organization_memberships_access_role_check
      check (access_role in ('owner', 'member', 'viewer'));
  end if;
end;
$$;

create table if not exists public.user_profiles (
  user_id uuid primary key,
  active_organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_active_organization_id_idx
  on public.user_profiles(active_organization_id);

create table if not exists public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  access_role text not null,
  assigned_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_memberships_access_role_check
    check (access_role in ('member', 'viewer'))
);

create unique index if not exists project_memberships_project_user_idx
  on public.project_memberships(project_id, user_id);

create index if not exists project_memberships_organization_id_idx
  on public.project_memberships(organization_id);

create index if not exists project_memberships_user_id_idx
  on public.project_memberships(user_id);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  access_role text not null,
  token_hash text not null unique,
  status text not null default 'pending',
  mobile_access_enabled boolean not null default true,
  invited_by_user_id uuid,
  invited_user_id uuid,
  project_ids uuid[] not null default '{}'::uuid[],
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invites_access_role_check
    check (access_role in ('owner', 'member', 'viewer')),
  constraint organization_invites_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

create index if not exists organization_invites_organization_id_idx
  on public.organization_invites(organization_id);

create index if not exists organization_invites_email_idx
  on public.organization_invites(lower(email));

create index if not exists organization_invites_status_idx
  on public.organization_invites(status);

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text,
  plan_code text not null default 'free',
  status text not null default 'free',
  billing_email text,
  provider_customer_id text,
  provider_subscription_id text,
  seat_limit integer,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_status_check
    check (status in ('free', 'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid'))
);

create unique index if not exists organization_subscriptions_org_idx
  on public.organization_subscriptions(organization_id);

create unique index if not exists organization_subscriptions_provider_customer_idx
  on public.organization_subscriptions(provider, provider_customer_id)
  where provider is not null and provider_customer_id is not null;

create unique index if not exists organization_subscriptions_provider_subscription_idx
  on public.organization_subscriptions(provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;

alter table public.audit_log
  add column if not exists subject_user_id uuid;

alter table public.audit_log
  add column if not exists before_state jsonb not null default '{}'::jsonb;

alter table public.audit_log
  add column if not exists after_state jsonb not null default '{}'::jsonb;

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

create or replace function public.set_project_memberships_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_memberships_set_updated_at on public.project_memberships;

create trigger project_memberships_set_updated_at
before update on public.project_memberships
for each row
execute function public.set_project_memberships_updated_at();

create or replace function public.set_organization_invites_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_invites_set_updated_at on public.organization_invites;

create trigger organization_invites_set_updated_at
before update on public.organization_invites
for each row
execute function public.set_organization_invites_updated_at();

create or replace function public.set_organization_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_subscriptions_set_updated_at on public.organization_subscriptions;

create trigger organization_subscriptions_set_updated_at
before update on public.organization_subscriptions
for each row
execute function public.set_organization_subscriptions_updated_at();

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only and cannot be modified';
end;
$$;

drop trigger if exists audit_log_block_update on public.audit_log;
drop trigger if exists audit_log_block_delete on public.audit_log;

create trigger audit_log_block_update
before update on public.audit_log
for each row
execute function public.prevent_audit_log_mutation();

create trigger audit_log_block_delete
before delete on public.audit_log
for each row
execute function public.prevent_audit_log_mutation();

comment on column public.organization_memberships.access_role is
  'Normalized RBAC role used by the new owner/member/viewer access model.';

comment on table public.user_profiles is
  'Per-user app preferences, including the active organization selection used by the org switcher.';

comment on table public.project_memberships is
  'Project-level assignments for member/viewer access inside an organization.';

comment on table public.organization_invites is
  'Token-backed invitation records for owner-managed org and project access onboarding.';

comment on table public.organization_subscriptions is
  'Billing/subscription foundation for charging organizations without tying the app to one provider too early.';

comment on column public.audit_log.subject_user_id is
  'The user whose record or access was acted on, when different from the actor.';

comment on column public.audit_log.before_state is
  'Snapshot of the prior record state for sensitive updates.';

comment on column public.audit_log.after_state is
  'Snapshot of the new record state for sensitive updates.';
