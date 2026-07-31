create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid,
  entity_type text not null,
  entity_id text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_entity_type_check
    check (
      entity_type in (
        'project',
        'report',
        'pour_log',
        'contractor_evaluation',
        'qa_form'
      )
    )
);

create index if not exists audit_log_organization_id_idx
  on public.audit_log(organization_id);

create index if not exists audit_log_actor_user_id_idx
  on public.audit_log(actor_user_id);

create index if not exists audit_log_entity_type_entity_id_idx
  on public.audit_log(entity_type, entity_id);

create index if not exists audit_log_created_at_idx
  on public.audit_log(created_at desc);

comment on table public.audit_log is
  'Append-only operational audit trail for major create/update/delete actions.';
