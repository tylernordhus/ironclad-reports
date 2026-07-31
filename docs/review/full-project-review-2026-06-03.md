# Full Project Review - 2026-06-03

## Scope

Reviewing the production Ironclad Reports project at:

`/Users/tylernordhus/Library/Mobile Documents/com~apple~CloudDocs/Ironclad Construction/Inspection App 2026/ironclad-reports`

The goal is to review every project file that is part of the source system, including web app, mobile app, API routes, Supabase/database code, scripts, configuration, and documentation.

Generated folders and dependency folders are excluded from source review:

- `.git`
- `.next`
- `node_modules`
- `mobile/.expo`
- `mobile/node_modules`

## Running Log

- Created review log.
- Inventory pass started.
- Source file count excluding generated/dependency folders: 179.
- Existing git worktree has many modified and untracked files. I am treating these as existing project/user changes and will not revert them.
- Main source areas identified:
  - `app/` Next.js routes, pages, API handlers, and components.
  - `lib/` server/client helpers for Supabase, organizations, auth, reports, QA forms, pour logs, audit logging, and PDF/data utilities.
  - `mobile/` Expo/TestFlight app for Inspector Gadget.
  - `sql/` direct SQL scripts and numbered migrations.
  - root config/docs/scripts.
- Reviewed root docs/config:
  - `README.md`
  - `DEVELOPER_HANDOFF.md`
  - `MIGRATIONS.md`
  - `next.config.js`
  - `middleware.js`
  - `jsconfig.json`
- Reviewed shared auth/access helpers:
  - `lib/supabase-server.js`
  - `lib/supabase-browser.js`
  - `lib/mobile-auth.js`
  - `lib/get-user-id.js`
  - `lib/organizations.js`
  - `lib/audit-log.js`
- Reviewed migration workflow and SQL migration set:
  - `scripts/schema-migrations.js`
  - `sql/migrations/0001_drilled_shaft_foundation_fields.sql`
  - `sql/migrations/0002_pour_log_photo_labels.sql`
  - `sql/migrations/0003_pour_log_actual_hole_depth.sql`
  - `sql/migrations/0004_qa_forms.sql`
  - `sql/migrations/0005_phase_1_organizations.sql`
  - `sql/migrations/0006_audit_log.sql`
  - `sql/migrations/0007_mobile_access_enabled.sql`
  - `sql/migrations/0008_schema_migrations.sql`
  - `sql/migrations/0009_rbac_subscription_foundation.sql`
  - `sql/migrations/0010_project_report_types.sql`
  - `sql/migrations/0011_weekly_reports.sql`

## Findings

### High - Supabase service-role fallback in session clients

Files:

- `middleware.js`
- `lib/supabase-server.js`

Both create Supabase SSR/session clients using:

`NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_SECRET_KEY`

That fallback is risky. Middleware and cookie-backed session clients should use the public anon/publishable key only. Service-role keys should be restricted to explicit trusted server routes where every query is manually scoped.

Recommended fix:

- require `NEXT_PUBLIC_SUPABASE_ANON_KEY` for SSR/session clients
- fail closed if it is missing
- keep `SUPABASE_SECRET_KEY` only in explicit admin/server data clients

### Medium - Transitional authorization model is complex

Files:

- `lib/organizations.js`
- `lib/mobile-auth.js`
- many API routes still to be reviewed individually

The code supports legacy `user_id`, organization membership, active organization selection, and project assignment fallback behavior. This is pragmatic during migration, but the access model is easy to misapply in routes.

Recommended fix:

- centralize common row-access checks for each entity type
- add tests for owner/admin/member/viewer/project-assigned cases
- remove the legacy org-wide fallback once project assignments are fully managed

### Medium - Mobile approval fallback can silently allow all mobile users

File:

- `lib/mobile-auth.js`

If `organization_memberships` is unavailable or empty, mobile access falls back to `MOBILE_APPROVED_EMAILS`. If that environment variable is empty, all authenticated users are approved by fallback.

Recommended fix:

- once memberships are stable, remove the permissive fallback
- or require explicit `MOBILE_APPROVED_EMAILS` when fallback mode is active

### High - Migration workflow tracks status but does not apply migrations

Files:

- `scripts/schema-migrations.js`
- `MIGRATIONS.md`

The migration helper can list, status-check, and bootstrap migration records, but it does not execute SQL migration files. This is acceptable if intentional, but it is a production operations risk because the database can be marked as bootstrapped without the SQL actually having been applied.

Recommended fix:

- either add a controlled `apply` command that executes pending migrations in order
- or rename/document `bootstrap` more defensively so it cannot be mistaken for applying schema

### High - No RLS policy migration coverage for core business tables

Files:

- `sql/migrations/*.sql`
- server API routes, still under review

The current migration set creates tables and access-model foundations, but does not enable row-level security policies for the main business tables. The app therefore depends heavily on server route scoping and service-role discipline.

Recommended fix:

- design and ship RLS policies for projects, reports, pour logs, QA forms, contractor evaluations, weekly reports, project memberships, and organization memberships
- first add tests/diagnostics so policies can be validated before enabling enforcement

### Critical - Settings update endpoint is unauthenticated

File:

- `app/api/settings/update/route.js`

The route creates a service-role Supabase client and accepts `POST` form data without calling `getUserId()`, `requireMobileUser()`, `supabase.auth.getUser()`, or any organization/admin check. It can update company name/email/phone and upload a logo to storage.

Because `middleware.js` excludes `/api`, this endpoint needs to authenticate and authorize itself.

Recommended fix:

- require a signed-in user
- require organization owner/admin permission
- scope settings updates to the active organization, not a singleton row
- reject unauthenticated requests with `401` and unauthorized users with `403`

### Critical - Photo upload endpoint is unauthenticated and accepts arbitrary folders

File:

- `app/api/upload-photos/route.js`

The route creates a service-role Supabase client and accepts uploaded files without authentication or project/report authorization. It also trusts the submitted `folder` value and writes to the public `report-photos` bucket path built from that folder.

This allows unauthenticated storage writes and could place images under report/project-looking paths without proving access to the related record.

Recommended fix:

- require a signed-in user
- require project/report access before upload
- derive the storage path server-side from authorized `projectId`/`reportId`
- enforce file count, file size, and content-type limits

## Fix Log

### 2026-06-03 - Pour log mobile draft and truck workflow

Files changed:

- `mobile/src/screens/native-flows.tsx`
- `app/pour-log/page.js`
- `app/pour-log-flatwork/page.js`
- `app/pour-logs/[id]/edit/page.js`
- `app/pour-logs/[id]/edit-flatwork/page.js`

Changes:

- added local draft helpers for native mobile pour log flows
- added draft status states: `Saved`, `Unsaved changes`, `Saving`, and `Draft saved`
- added local draft restore for native drilled-shaft pour logs
- added local draft restore for native flatwork pour logs
- clears the native local draft after successful manual submit
- added a guarded Back action when latest changes have not finished saving locally
- changed native concrete truck entry so only one truck is expanded at a time
- completed/non-active trucks now show compact summary cards and can be tapped to edit
- added local draft autosave/restore to the web drilled-shaft new pour log form
- added local draft autosave/restore to the web flatwork new pour log form
- added draft status and before-unload warning to web new forms
- tightened drilled-shaft edit draft restore so older local drafts do not overwrite newer saved data without confirmation
- converted flatwork edit form fields to controlled state and added local draft autosave/restore
- clears local web drafts after successful manual save

Verification:

- `npx tsc --noEmit` inside `mobile/` hung without diagnostics and was stopped
- direct single-file TypeScript check also hung without diagnostics and was stopped
- `@babel/parser` syntax parse passed for changed web pour-log files and `mobile/src/screens/native-flows.tsx`

### 2026-06-03 - Login convenience

Files changed:

- `mobile/App.tsx`

Changes:

- confirmed the native app already persists Supabase sessions and starts/stops auth auto-refresh with app state
- confirmed Face ID/Touch ID/device unlock already exists as an app unlock layer after sign-in
- improved login input hints for iPhone autofill/password managers
- added submit-on-done for the password field

Decision:

- did not implement passkeys or a major auth rewrite; this should be planned separately after the current email/password + Supabase flow is stable

### 2026-06-03 - Critical API endpoint hardening

Files changed:

- `app/api/settings/update/route.js`
- `app/api/upload-photos/route.js`
- `lib/supabase-server.js`
- `middleware.js`
- `mobile/src/lib/api.ts`
- `mobile/src/screens/native-flows.tsx`

Changes:

- `settings/update` now requires an authenticated user
- `settings/update` now requires organization owner-level access before changing settings
- `upload-photos` now requires an authenticated user from either a web session cookie or a mobile bearer token
- native mobile photo uploads now send the Supabase access token
- upload folder values are restricted to known app folders
- upload count and file size limits are enforced
- removed service-role fallback from cookie/session Supabase clients
- middleware now fails closed if public Supabase session env vars are missing

Verification:

- `npm run build` passed successfully
- `@babel/parser` syntax parse passed for changed API, mobile, and web files

Note:

- the repository already had a large dirty worktree before this pass; global `git diff --stat` includes existing changes outside this fix set
