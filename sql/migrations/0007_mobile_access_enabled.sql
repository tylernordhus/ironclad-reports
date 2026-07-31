alter table public.organization_memberships
  add column if not exists mobile_access_enabled boolean not null default true;

comment on column public.organization_memberships.mobile_access_enabled is
  'Controls whether this org membership is allowed to use the mobile app.';
