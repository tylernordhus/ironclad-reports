create table if not exists public.schema_migrations (
  version text primary key,
  name text not null,
  applied_at timestamptz not null default now()
);

comment on table public.schema_migrations is
  'Tracks applied schema migrations for the Ironclad Reports app.';
