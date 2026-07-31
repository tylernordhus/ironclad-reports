alter table public.pour_log_foundations
  add column if not exists actual_hole_depth text;

comment on column public.pour_log_foundations.actual_hole_depth is
  'Measured drilled hole depth, separate from design/plan depth.';
