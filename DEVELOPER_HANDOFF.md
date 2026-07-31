# Developer Handoff

This document is the quickest way for a new developer to understand the current state of the Ironclad Reports codebase.

## What This App Is

This repo contains:

- a `Next.js` web app used in production at `https://app.ironcladks.com`
- an `Expo` / React Native mobile app under [`mobile/`](./mobile)
- a shared `Supabase` backend used by both

The web app is the primary product. The mobile app is real and usable, but still partly depends on web flows and mobile API routes.

## Main Product Areas

- `Projects`
- `Daily Reports`
- `Pour Logs`
  - drilled shaft
  - flatwork
  - PDF generation
  - volume plot generation
  - photo upload
- `Contractor Evaluations`
- `QA Forms`
  - `QA-009 Mono Pole / H-Frame / 3 Pole Framing`
  - `QA-010 Vibratory Caisson`
  - `QA-011 Pole Setting`
  - `QA-013 Grounding Resistance`
- `Weekly Summary`
- `Settings / Organization Member Management`

## High-Level Architecture

### Web

- App Router lives under [`app/`](./app)
- most pages render server-side
- many routes read/write Supabase directly using `@supabase/supabase-js`
- auth/session helpers live in [`lib/supabase-server.js`](./lib/supabase-server.js), [`lib/supabase-browser.js`](./lib/supabase-browser.js), and [`middleware.js`](./middleware.js)

### Mobile

- mobile app lives under [`mobile/`](./mobile)
- entry point is [`mobile/App.tsx`](./mobile/App.tsx)
- mobile auth client is [`mobile/src/lib/supabase.ts`](./mobile/src/lib/supabase.ts)
- mobile data is loaded from `/api/mobile/*` routes on the main web app
- some mobile actions are native screens, but many create/edit/PDF flows still open website routes inside the app

### Database

- Supabase is the source of truth
- schema changes are now tracked in ordered files under [`sql/migrations/`](./sql/migrations)
- historical top-level SQL files under [`sql/`](./sql) still exist for reference during the transition
- local migration helper commands are documented in [`MIGRATIONS.md`](./MIGRATIONS.md)
- sale-readiness roadmap lives in [`SELLABLE_ROADMAP.md`](./SELLABLE_ROADMAP.md)
- deferred high-risk goals live in [`FUTURE_FEATURES.md`](./FUTURE_FEATURES.md)

## Important Folders

- [`app/`](./app): web pages and route handlers
- [`app/api/`](./app/api): server endpoints for create/update/PDF/mobile/web auth bridge flows
- [`app/components/`](./app/components): shared UI components
- [`lib/`](./lib): auth, shared business logic, volume plot, truck sorting, QA helpers
- [`mobile/`](./mobile): Expo iPhone/iPad app
- [`sql/`](./sql): historical schema files plus the current migration set
- [`sql/migrations/`](./sql/migrations): ordered schema migration files
- [`scripts/schema-migrations.js`](./scripts/schema-migrations.js): migration list/status/bootstrap helper

## Most Important Files

### Auth

- [`middleware.js`](./middleware.js)
  - protects web pages
  - currently validates the real Supabase user session, not just cookie presence
- [`lib/supabase-server.js`](./lib/supabase-server.js)
  - server auth helper for reading the signed-in user from cookies
- [`lib/get-user-id.js`](./lib/get-user-id.js)
  - commonly used to scope web pages to the current user
- [`lib/mobile-auth.js`](./lib/mobile-auth.js)
  - validates bearer tokens for mobile API routes
  - enforces mobile access from `organization_memberships.mobile_access_enabled`
  - still supports `MOBILE_APPROVED_EMAILS` as a legacy fallback if org membership rows or columns are missing
- [`app/settings/page.js`](./app/settings/page.js)
  - company settings UI
  - now includes owner-only project admin entry points plus owner-only member access controls
- [`app/settings/projects/page.js`](./app/settings/projects/page.js)
  - owner-only project admin page
  - central place for project setup/edit access and assignment oversight
- [`app/components/OrganizationSwitcher.js`](./app/components/OrganizationSwitcher.js)
  - active-organization switcher UI component
  - posts to [`app/api/organizations/switch/route.js`](./app/api/organizations/switch/route.js)
  - defaults safely to “all accessible orgs” until the user has an explicit selection saved
  - currently not rendered in the global page header
- [`app/api/settings/members/[membershipId]/route.js`](./app/api/settings/members/[membershipId]/route.js)
  - owner-scoped member management route under the normalized access model
  - can change role, active status, and mobile access
  - blocks removal of the last active owner
- [`app/api/settings/members/create/route.js`](./app/api/settings/members/create/route.js)
  - owner-scoped route to add an existing signed-up account to the current organization by email
  - if the membership already exists, it reactivates and updates it
- [`app/api/settings/members/invite/route.js`](./app/api/settings/members/invite/route.js)
  - owner-scoped route to invite a brand-new user by email through Supabase Auth
  - creates the org membership immediately after invite so role/mobile access are already set when they accept
- [`app/api/mobile/web-auth-bridge/route.js`](./app/api/mobile/web-auth-bridge/route.js)
  - used when the mobile app opens website screens and needs website auth cookies set first

### Pour Logs

- [`app/pour-log/page.js`](./app/pour-log/page.js)
- [`app/pour-log-flatwork/page.js`](./app/pour-log-flatwork/page.js)
- [`app/pour-logs/[id]/edit/page.js`](./app/pour-logs/[id]/edit/page.js)
- [`app/pour-logs/[id]/edit-flatwork/page.js`](./app/pour-logs/[id]/edit-flatwork/page.js)
- [`app/api/pour-log/create/route.js`](./app/api/pour-log/create/route.js)
- [`app/api/pour-log/update/[id]/route.js`](./app/api/pour-log/update/[id]/route.js)
- [`app/api/pour-log/pdf/[id]/route.js`](./app/api/pour-log/pdf/[id]/route.js)
- [`app/api/pour-log/volume-plot/[id]/route.js`](./app/api/pour-log/volume-plot/[id]/route.js)
- [`lib/volume-plot.js`](./lib/volume-plot.js)
- [`lib/truck-order.js`](./lib/truck-order.js)
- [`lib/pour-log-trucks.js`](./lib/pour-log-trucks.js)

### Weekly Reports

- [`sql/migrations/0011_weekly_reports.sql`](./sql/migrations/0011_weekly_reports.sql)
  - creates `weekly_reports`
- [`lib/weekly-reports.js`](./lib/weekly-reports.js)
  - shared week bounds, saved weekly-report lookup, and daily-report source loading
- [`app/projects/[id]/weekly-summary/page.js`](./app/projects/[id]/weekly-summary/page.js)
  - weekly report editor
  - supports blank/manual weekly reports even when no daily reports exist
- [`app/api/reports/weekly-summary/[projectId]/route.js`](./app/api/reports/weekly-summary/[projectId]/route.js)
  - loads or saves the first-class weekly report record
  - can optionally auto-fill from daily reports
- [`app/api/reports/weekly-summary/[projectId]/pdf/route.js`](./app/api/reports/weekly-summary/[projectId]/pdf/route.js)
  - PDF export for the weekly report
- [`app/api/mobile/weekly-summary/[projectId]/route.js`](./app/api/mobile/weekly-summary/[projectId]/route.js)
  - mobile-friendly weekly report loader

### Smart Daily Reports

- [`app/daily-report/page.js`](./app/daily-report/page.js)
  - defaults the report date to today
  - tries to prefill crew count and submitter from the user’s most recent prior report on that project
  - tries device-GPS weather first, then falls back to project-location weather
  - supports `mode=quick` for a faster mobile-friendly submit flow with optional fields collapsed
- [`app/api/reports/latest/[projectId]/route.js`](./app/api/reports/latest/[projectId]/route.js)
  - supports `before=` so smart-prefill can target the prior report relative to the selected report date
- [`app/api/weather/[projectId]/route.js`](./app/api/weather/[projectId]/route.js)
  - supports optional `lat` / `lon` query params for device-based weather lookup
  - falls back to geocoding the project location when device coordinates are not available

### Submission Dashboard

- [`lib/submission-dashboard.js`](./lib/submission-dashboard.js)
  - shared daily-submission status logic for both web and mobile
  - currently tracks the last 7 days of daily-report submissions for daily-report-enabled projects
- [`app/page.js`](./app/page.js)
  - home page now includes the red/green daily submission dashboard
- [`app/api/mobile/projects/route.js`](./app/api/mobile/projects/route.js)
  - includes today submission summary plus per-project today status for the mobile app
- [`mobile/App.tsx`](./mobile/App.tsx)
  - project list now shows a top summary card and per-project today submission status

### Project Photo Gallery

- [`lib/project-photos.js`](./lib/project-photos.js)
  - aggregates project photos from daily reports, pour logs, and QA forms
- [`app/projects/[id]/photos/page.js`](./app/projects/[id]/photos/page.js)
  - project-level photo gallery page
  - first safe phase of the broader photo-storage direction
- [`app/projects/[id]/page.js`](./app/projects/[id]/page.js)
  - now links to the project photo gallery
  - owner-only project edit/delete controls are hidden for non-owner users
- [`mobile/App.tsx`](./mobile/App.tsx)
  - project detail now includes a quick action to open the project gallery in the web view
  - project edit shortcut was removed so project administration stays in owner-only web settings flows

### QA Forms

- [`sql/qa-forms.sql`](./sql/qa-forms.sql)
  - creates `qa_forms`
- [`lib/qa-forms.js`](./lib/qa-forms.js)
  - form definitions, labels, sections, summaries
- [`app/qa-form/page.js`](./app/qa-form/page.js)
- [`app/qa-form-select/page.js`](./app/qa-form-select/page.js)
- [`app/components/QaFormEditor.js`](./app/components/QaFormEditor.js)
- [`app/qa-forms/[id]/page.js`](./app/qa-forms/[id]/page.js)
- [`app/qa-forms/[id]/edit/page.js`](./app/qa-forms/[id]/edit/page.js)
- [`app/api/qa-form/create/route.js`](./app/api/qa-form/create/route.js)
- [`app/api/qa-form/update/[id]/route.js`](./app/api/qa-form/update/[id]/route.js)
- [`app/api/qa-form/pdf/[id]/route.js`](./app/api/qa-form/pdf/[id]/route.js)

### Shared Form UI

- [`app/components/FormUi.js`](./app/components/FormUi.js)
  - shared form layout layer used to reduce spacing/layout drift across large forms

## What Is Working Well

- web app builds cleanly with `npm run build`
- production website is live and in active use
- projects, reports, pour logs, contractor evals, QA forms, and weekly summary all exist end-to-end
- weekly reports can now exist as standalone saved records instead of only being derived from daily reports
- daily reports now open with smarter prefills for date, weather, and prior-report crew info
- quick-submit mode now exists for daily reports from both web and mobile launch points
- home page and mobile project list now show daily submission status at a glance
- project-level photo gallery now exists using the current attached-photo data model
- pour logs support:
  - drilled shaft and flatwork
  - PDF output
  - volume plot output
  - photo upload
  - mobile access
- QA forms now have a dedicated data model instead of being shoved into pour logs
- mobile app has a working TestFlight pipeline
- mobile auth supports optional approval gating
- Safari stale-cookie login loops were reduced by moving middleware to real session validation

## What Is Still Messy / Technical Debt

### 1. Migration workflow exists, but adoption is still transitional

The repo now has:

- ordered migration files in [`sql/migrations/`](./sql/migrations)
- a database tracking table: `public.schema_migrations`
- helper commands:
  - `npm run db:migrations:list`
  - `npm run db:migrations:status`
  - `npm run db:migrations:bootstrap`

Important nuance:

- historical top-level SQL files under [`sql/`](./sql) still exist for reference
- future schema changes should go into [`sql/migrations/`](./sql/migrations)
- this is still a repo-level discipline improvement, not a full automatic apply system

### 2. Mixed native/web mobile approach

The mobile app is not fully native yet.

- list/detail screens are more native
- many create/edit/PDF flows still hand off to web routes
- this is acceptable for now, but it means mobile behavior can still depend heavily on website pages

### 3. A lot of direct Supabase usage in pages

Many web pages instantiate a service-role Supabase client inline and query tables directly.

That makes shipping fast, but:

- business logic is spread across pages and route handlers
- auth/data access patterns are not very centralized
- future refactors should prefer shared access helpers where practical

### 4. Ownership is still mostly `user_id`-based

The current product primarily scopes data by `user_id`.

The first sale-readiness schema foundation for organization support is now in:

- [`sql/phase-1-organizations.sql`](./sql/phase-1-organizations.sql)

That migration is intentionally additive and non-breaking:

- creates `organizations`
- creates `organization_memberships`
- adds nullable `organization_id` columns to major business tables

Current code status:

- new `projects` are assigned an `organization_id`
- new `reports`, `pour_logs`, `contractor_evaluations`, and `qa_forms` also write `organization_id`
- main web/mobile list and detail reads now support either:
  - legacy `user_id` ownership
  - or org-scoped ownership through `organization_id`
- main update/delete flows for projects, reports, pour logs, contractor evals, and QA forms now perform org-aware ownership checks too
- settings now includes a minimal org-member management UI for existing memberships
- settings also includes an existing-account add flow by email
- owner/admin users can toggle:
  - role
  - active status
  - mobile access
- organization switching is now scaffolded through `user_profiles.active_organization_id`
- schema foundation is now in place for:
  - normalized `owner/member/viewer` access roles
  - project-level assignments
  - token-backed invite records
  - org-level subscription/billing records
- some remaining edge routes and admin-style operations may still need migration, so this is still a partial transition

Relevant helper:

- [`lib/organizations.js`](./lib/organizations.js)

Additional schema foundation:

- [`sql/migrations/0009_rbac_subscription_foundation.sql`](./sql/migrations/0009_rbac_subscription_foundation.sql)
  - adds:
    - `organization_memberships.access_role`
    - `user_profiles`
    - `project_memberships`
    - `organization_invites`
    - `organization_subscriptions`
    - richer audit columns plus append-only audit triggers

Application code has not been fully migrated to org-aware reads/writes yet.

### 5. QA forms permissions can still be misconfigured in Supabase

The app now handles QA-form permission failures more gracefully, but a backend permission mistake can still make QA forms unavailable.

The fallback behavior now is:

- project pages keep loading
- reports pages keep loading
- mobile project routes stay usable
- UI/API now exposes QA availability instead of pretending empty data means “no QA forms exist”

Relevant helper:

- [`lib/supabase-errors.js`](./lib/supabase-errors.js)

### 6. RBAC / RLS transition is not complete yet

The repo is now prepared for the next permission phase, but DB-enforced RLS is not live yet.

What is ready:

- active-organization context
- normalized access-role foundation
- project assignment table
- invitation table
- subscription table
- richer audit schema

What still needs to happen:

- project/member/viewer assignment UI
- token acceptance flow
- owner-edit snapshot auditing in the update routes
- RLS policies on business tables
- removal of legacy `admin` / `inspector` assumptions once the new model is fully adopted

### 7. Project report toggles are now a first-class low-risk feature direction

The current preferred pattern for per-project report visibility is:

- `project_report_types` table
- not boolean columns on `projects`

This keeps:

- report availability data-driven
- future templates easier to add
- later AI-assisted checklist/report routing more flexible

When this feature is active:

- disabled report types should disappear from project-specific UI
- select-project flows should only show projects where that report type is enabled

## Known Special Cases

### Website auth vs mobile auth

There are two auth paths:

- website session cookies
- mobile bearer token auth

Bridging them is necessary when the mobile app opens website flows. That is what [`app/api/mobile/web-auth-bridge/route.js`](./app/api/mobile/web-auth-bridge/route.js) does.

### Service-role usage

A large part of the app uses `SUPABASE_SECRET_KEY` directly in server code. That is intentional for now, but it means:

- RLS is not the only thing controlling access
- server-side code must always scope queries by `user_id` correctly

### Mobile biometrics

The mobile app supports biometric unlock, but it is an app-level unlock convenience, not a full secure-token redesign.

Relevant files:

- [`mobile/App.tsx`](./mobile/App.tsx)
- [`mobile/src/lib/supabase.ts`](./mobile/src/lib/supabase.ts)

## Fast Debugging Guide

### If website login acts weird

Check:

- [`middleware.js`](./middleware.js)
- [`lib/supabase-server.js`](./lib/supabase-server.js)
- browser cookies / Supabase session behavior

### If mobile API calls fail

Check:

- [`lib/mobile-auth.js`](./lib/mobile-auth.js)
- the `/api/mobile/*` route being called
- whether the user has an active `organization_memberships` row
- whether `mobile_access_enabled` is `true` on at least one active membership
- whether legacy `MOBILE_APPROVED_EMAILS` fallback is blocking the account

### If QA forms disappear

Check:

- `qa_forms` table exists
- grants were applied in Supabase
- any RLS policies on `qa_forms`
- [`lib/supabase-errors.js`](./lib/supabase-errors.js)
- [`app/api/mobile/projects/[id]/route.js`](./app/api/mobile/projects/[id]/route.js)

### 6. Audit log foundation is best-effort until SQL is applied

Audit logging helper:

- [`lib/audit-log.js`](./lib/audit-log.js)

The logger is intentionally non-breaking:

- if `audit_log` does not exist yet, writes no-op
- once [`sql/audit-log.sql`](./sql/audit-log.sql) is applied, create/update/delete events start recording

Current coverage is focused on major CRUD routes, not every possible read-only action.

Recent audit expansion also covers:

- daily report PDF generation
- daily report email send
- pour log PDF generation
- pour log email send
- QA form PDF generation
- contractor evaluation PDF generation
- weekly summary PDF generation (tracked against the project)

### If volume plot fails

Check:

- [`lib/volume-plot.js`](./lib/volume-plot.js)
- [`app/api/pour-log/volume-plot/[id]/route.js`](./app/api/pour-log/volume-plot/[id]/route.js)
- whether the pour log has enough structured shaft/truck data to calculate the plot

### If photo upload fails

Check:

- [`app/api/upload-photos/route.js`](./app/api/upload-photos/route.js)
- Supabase storage permissions
- whether client-side image resizing happened
- returned `publicUrl` / generated fallback public URL

## Commands Usually Used

From repo root:

```bash
npm run build
```

From `mobile/`:

```bash
npx tsc --noEmit
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

## What A New Developer Should Read First

1. [`DEVELOPER_HANDOFF.md`](./DEVELOPER_HANDOFF.md)
2. [`README.md`](./README.md)
3. [`mobile/README.md`](./mobile/README.md)
4. [`lib/qa-forms.js`](./lib/qa-forms.js)
5. [`lib/volume-plot.js`](./lib/volume-plot.js)
6. [`mobile/App.tsx`](./mobile/App.tsx)
7. [`middleware.js`](./middleware.js)

## Current Access Model Notes

- organization switching is live through [`app/components/OrganizationSwitcher.js`](./app/components/OrganizationSwitcher.js) and [`app/api/organizations/switch/route.js`](./app/api/organizations/switch/route.js)
- owners/admins still have organization-wide visibility
- inspectors/viewers are now moving toward project-level access through `project_memberships`
- current transition behavior is intentional:
  - if an inspector/viewer has explicit `project_memberships`, their web/mobile project visibility is restricted to those projects
  - if they do not have any `project_memberships` yet, they temporarily keep legacy org-wide visibility so existing users do not suddenly lose access
- the project-assignment management UI currently lives in [`app/settings/page.js`](./app/settings/page.js)

## Invite Flow Notes

- new-user invites now use `organization_invites` plus a tokenized link, not only Supabase Auth admin invite emails
- accept page:
  - [`app/invite/accept/page.js`](./app/invite/accept/page.js)
- accept route:
  - [`app/api/invites/accept/route.js`](./app/api/invites/accept/route.js)
- owners can choose project access at invite time
- login and signup now preserve `next` and prefilled `email` query params so invite acceptance can continue after auth
- invite email sending depends on `RESEND_API_KEY`

## Recommended Future Cleanup Order

1. stop adding new one-off top-level SQL files and use `sql/migrations/` only
2. reduce duplicate create/edit form logic
3. move more mobile webview flows to true native screens
4. centralize common server-side data access logic
5. add a small test layer around the most important report and API flows
