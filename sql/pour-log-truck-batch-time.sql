alter table public.pour_log_trucks
  add column if not exists batch_time text;

create or replace function public.update_pour_log_atomic(
  p_pour_log_id text,
  p_project_name text,
  p_log_date date,
  p_weather text default null,
  p_ambient_temp text default null,
  p_concrete_supplier text default null,
  p_submitted_by text default null,
  p_new_photo_urls text[] default array[]::text[],
  p_foundations jsonb default '[]'::jsonb,
  p_trucks jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_id_type text;
  v_existing_photo_urls text[];
  v_merged_photo_urls text[];
begin
  if coalesce(trim(p_project_name), '') = '' then
    raise exception 'Project name is required';
  end if;

  if p_log_date is null then
    raise exception 'Log date is required';
  end if;

  if coalesce(trim(p_submitted_by), '') = '' then
    raise exception 'Submitted by is required';
  end if;

  select format_type(a.atttypid, a.atttypmod)
  into v_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'pour_logs'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if v_id_type is null then
    raise exception 'Could not determine pour_logs.id type';
  end if;

  execute format(
    'select photo_urls from public.pour_logs where id = $1::%s for update',
    v_id_type
  )
  into v_existing_photo_urls
  using p_pour_log_id;

  if not found then
    raise exception 'Pour log % not found', p_pour_log_id;
  end if;

  v_merged_photo_urls :=
    coalesce(v_existing_photo_urls, array[]::text[]) ||
    coalesce(p_new_photo_urls, array[]::text[]);

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_foundations, '[]'::jsonb)) as f(
      foundation_id text,
      total_depth text,
      estimated_yards text,
      shaft_diameter text,
      anchor_bolt_projection text,
      notes text
    )
    where (
      coalesce(trim(foundation_id), '') <> '' or
      coalesce(trim(f.total_depth), '') <> '' or
      coalesce(trim(f.estimated_yards), '') <> '' or
      coalesce(trim(f.shaft_diameter), '') <> '' or
      coalesce(trim(f.anchor_bolt_projection), '') <> '' or
      coalesce(trim(f.notes), '') <> ''
    )
    and coalesce(trim(foundation_id), '') = ''
  ) then
    raise exception 'Each foundation row must include a foundation/shaft ID';
  end if;

  execute format(
    'update public.pour_logs
     set project_name = $1,
         log_date = $2,
         weather = $3,
         ambient_temp = $4,
         concrete_supplier = $5,
         submitted_by = $6,
         photo_urls = $7
     where id = $8::%s',
    v_id_type
  )
  using
    trim(p_project_name),
    p_log_date,
    nullif(trim(coalesce(p_weather, '')), ''),
    nullif(trim(coalesce(p_ambient_temp, '')), ''),
    nullif(trim(coalesce(p_concrete_supplier, '')), ''),
    trim(p_submitted_by),
    case
      when coalesce(array_length(v_merged_photo_urls, 1), 0) > 0 then v_merged_photo_urls
      else null
    end,
    p_pour_log_id;

  execute format(
    'delete from public.pour_log_foundations where pour_log_id = $1::%s',
    v_id_type
  )
  using p_pour_log_id;

  execute format(
    'insert into public.pour_log_foundations (
       pour_log_id,
       foundation_id,
       total_depth,
       estimated_yards,
       shaft_diameter,
       anchor_bolt_projection,
       notes
     )
     select
       $1::%s,
       trim(f.foundation_id),
       nullif(trim(coalesce(f.total_depth, '''')), ''''),
       nullif(trim(coalesce(f.estimated_yards, '''')), ''''),
       nullif(trim(coalesce(f.shaft_diameter, '''')), ''''),
       nullif(trim(coalesce(f.anchor_bolt_projection, '''')), ''''),
       nullif(trim(coalesce(f.notes, '''')), '''')
     from jsonb_to_recordset($2) as f(
       foundation_id text,
       total_depth text,
       estimated_yards text,
       shaft_diameter text,
       anchor_bolt_projection text,
       notes text
     )
     where
       coalesce(trim(f.foundation_id), '''') <> '''' or
       coalesce(trim(f.total_depth), '''') <> '''' or
       coalesce(trim(f.estimated_yards), '''') <> '''' or
       coalesce(trim(f.shaft_diameter), '''') <> '''' or
       coalesce(trim(f.anchor_bolt_projection), '''') <> '''' or
       coalesce(trim(f.notes), '''') <> ''''',
    v_id_type
  )
  using p_pour_log_id, coalesce(p_foundations, '[]'::jsonb);

  execute format(
    'delete from public.pour_log_trucks where pour_log_id = $1::%s',
    v_id_type
  )
  using p_pour_log_id;

  execute format(
    'insert into public.pour_log_trucks (
       pour_log_id, truck_number, batch_time, arrival_time, pour_start, pour_complete,
       yards, foundations_served, concrete_temp, slump,
       air_content, water_added, cylinders_cast, notes
     )
     select
       $1::%s,
       coalesce(nullif(trim(t.truck_number), ''''), t.rn::text),
       nullif(trim(coalesce(t.batch_time, '''')), ''''),
       nullif(trim(coalesce(t.arrival_time, '''')), ''''),
       nullif(trim(coalesce(t.pour_start, '''')), ''''),
       nullif(trim(coalesce(t.pour_complete, '''')), ''''),
       nullif(trim(coalesce(t.yards, '''')), ''''),
       nullif(trim(coalesce(t.foundations_served, '''')), ''''),
       nullif(trim(coalesce(t.concrete_temp, '''')), ''''),
       nullif(trim(coalesce(t.slump, '''')), ''''),
       nullif(trim(coalesce(t.air_content, '''')), ''''),
       nullif(trim(coalesce(t.water_added, '''')), ''''),
       nullif(trim(coalesce(t.cylinders_cast, '''')), ''''),
       nullif(trim(coalesce(t.notes, '''')), '''')
     from (
       select row_number() over () as rn, x.*
       from jsonb_to_recordset($2) as x(
         truck_number text,
         batch_time text,
         arrival_time text,
         pour_start text,
         pour_complete text,
         yards text,
         foundations_served text,
         concrete_temp text,
         slump text,
         air_content text,
         water_added text,
         cylinders_cast text,
         notes text
       )
     ) t',
    v_id_type
  )
  using p_pour_log_id, coalesce(p_trucks, '[]'::jsonb);
end;
$$;
