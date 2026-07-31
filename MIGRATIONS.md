# Schema Migrations

This repo now treats `sql/migrations/` as the ordered source of truth for schema changes.

## Current Commands

From repo root:

```bash
npm run db:migrations:list
npm run db:migrations:status
npm run db:migrations:bootstrap
```

## What They Do

- `db:migrations:list`
  - prints the ordered local migration files
- `db:migrations:status`
  - compares local migration files to the `public.schema_migrations` table in Supabase
- `db:migrations:bootstrap`
  - marks the current local migration files as already applied in `public.schema_migrations`
  - use this only once when adopting this migration workflow on an existing database

## Environment Needed For Status / Bootstrap

These commands require:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

## Adoption Rule

The historical one-off SQL files under `sql/` remain for reference, but new schema work should go into:

- `sql/migrations/`

with an ordered prefix like:

- `0009_some_change.sql`
- `0010_another_change.sql`

## Current Bootstrap Set

The existing migration chain represented in `sql/migrations/` is:

1. `0001_drilled_shaft_foundation_fields.sql`
2. `0002_pour_log_photo_labels.sql`
3. `0003_pour_log_actual_hole_depth.sql`
4. `0004_qa_forms.sql`
5. `0005_phase_1_organizations.sql`
6. `0006_audit_log.sql`
7. `0007_mobile_access_enabled.sql`
8. `0008_schema_migrations.sql`
9. `0009_rbac_subscription_foundation.sql`
10. `0010_project_report_types.sql`
11. `0011_weekly_reports.sql`

## Practical Workflow

For future schema changes:

1. create the next ordered file under `sql/migrations/`
2. run that SQL in Supabase
3. record it in `schema_migrations`
   - either manually
   - or via the repo script once you are ready to use it in your environment
4. run `npm run db:migrations:status`
5. update `DEVELOPER_HANDOFF.md` if the change materially affects architecture or operations

## Current Non-Migration Features Built On Existing Schema

The following recent features did not require new SQL because they were implemented on top of existing tables introduced earlier:

- project photo gallery from existing report photo fields
- project assignment management UI using `project_memberships`
- tokenized invite acceptance using `organization_invites`
