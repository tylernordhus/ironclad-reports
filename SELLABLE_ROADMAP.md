# Sellable Product Roadmap

This is the recommended order for turning Ironclad Reports from a working owner-operated product into something easier to sell, hand off, and scale.

The rule for this roadmap is simple:

- prefer work that increases buyer confidence
- do not break the current working product
- introduce new structure in additive phases first

## Current State

The product already has real value:

- working production website
- working mobile app / TestFlight path
- project-based reporting workflows
- PDFs, photo upload, volume plots, QA forms
- standalone weekly reports with save + PDF flow
- smarter daily-report prefills for faster field entry
- quick-submit daily report mode for faster phone-friendly field use
- a simple submission-status dashboard so PMs can spot missing reports quickly
- a first centralized project photo gallery without forcing a risky storage redesign yet

The main issues for a buyer are not feature count. The issues are:

- single-user ownership assumptions
- manual database migration process
- limited auditability
- limited automated verification
- mixed native/web mobile architecture

## Phase 1: Foundation Without Breaking Current Behavior

Goal: add structure that future refactors can build on without changing the current UX yet.

### 1.1 Organization model

Add:

- `organizations`
- `organization_memberships`
- nullable `organization_id` columns to all major business tables

Why first:

- the app is currently mostly scoped by `user_id`
- a buyer will want multi-user company accounts
- adding org structure now makes later role/permission work possible

### 1.2 Role model

Support at least:

- `owner`
- `admin`
- `inspector`
- `viewer`

Do this first in schema and docs, then later in app enforcement.

### 1.3 Migration discipline

Replace “remember which SQL file to run” with a real migration workflow.

Success condition:

- every schema change becomes reproducible
- a new developer can rebuild the DB state confidently

Current progress:

- `public.schema_migrations` exists
- ordered migration files now exist in `sql/migrations/`
- repo scripts now exist for:
  - `db:migrations:list`
  - `db:migrations:status`
  - `db:migrations:bootstrap`
- historical top-level SQL files still remain during the transition

### 1.4 Operational documentation

Keep:

- [`DEVELOPER_HANDOFF.md`](./DEVELOPER_HANDOFF.md)
- this roadmap
- DB rollout notes

## Phase 2: Access Control and Account Management

Goal: make the product administratively usable by a company, not just one founder.

### 2.1 Organization-aware auth

Move app reads/writes from pure `user_id` ownership toward:

- `organization_id`
- membership lookup
- role-aware access checks
- active organization context / org switcher

Current progress:

- `user_profiles.active_organization_id` foundation is now defined in migration `0009`
- app scaffolding now supports an active-organization switcher with a safe fallback to the old “all accessible orgs” behavior until a selection is stored

### 2.2 User invites and lifecycle

Add:

- invite user flow
- active/inactive user status
- remove user from org
- role change UI

Current progress:

- basic member management now exists in `Settings`
- owner/admin users can change role, active status, and mobile access for existing memberships
- owner/admin users can add an already-signed-up account to the organization by email
- owner/admin users can also invite a brand-new account by email through Supabase Auth
- deeper invite lifecycle polish is still incomplete
- token-backed invite records are now being added as schema foundation through `organization_invites`

### 2.3 Project-level RBAC

Target role model:

- `owner`
- `member`
- `viewer`

Implementation direction:

- keep org membership at the company level
- add `project_memberships` for assigned-project access
- collapse legacy `admin` / `inspector` behavior into the new normalized `access_role` transition field before the final RLS cutover

Current progress:

- `organization_memberships.access_role` foundation is now defined in migration `0009`
- `project_memberships` foundation is now defined in migration `0009`

### 2.5 Project-level report availability

Low-risk feature direction:

- use a dedicated `project_report_types` table
- do not add one-off booleans to `projects`

Why:

- keeps report visibility data-driven
- supports future templates and structure-driven workflows
- pairs naturally with later dashboard and notification features

### 2.4 Mobile approval cleanup

Current status:

- primary mobile approval now uses `organization_memberships.mobile_access_enabled`
- legacy `MOBILE_APPROVED_EMAILS` remains as a transition fallback where org membership records are not present yet

Remaining work:

- add UI/admin controls to manage member mobile access
- remove the env fallback once org/member lifecycle is complete

## Phase 3: Auditability and Compliance Confidence

Goal: make the product defensible and easier to trust.

### 3.1 Audit log

Track at minimum:

- report created
- report edited
- report deleted
- PDF generated
- report emailed
- photo uploaded
- login / auth bridge events when important

Current progress:

- create/update/delete audit foundation is live
- main PDF generation and email-send paths are now partially covered
- generic auth bridge and upload events still need either schema expansion or a more explicit audit model

Recommended schema:

- `audit_log`
- actor user id
- organization id
- entity type
- entity id
- action
- metadata jsonb
- created_at

### 3.2 Immutable-ish history strategy

Do not rely only on “last saved state.”

For high-value records, consider:

- change snapshots
- or a compact revision trail

Current progress:

- `audit_log` exists
- append-only DB protection and before/after snapshot columns are now part of migration `0009`
- app helper support for richer audit payloads is being added before route-by-route adoption

### 3.3 Error monitoring

Add production observability so failures are visible without manual reproduction.

## Phase 4: Product Hardening

Goal: make the software easier to maintain and less risky.

### 4.1 Test coverage for critical flows

Start with a small but high-value suite:

- login
- project create/update
- daily report create/update
- pour log create/update
- QA form create/update
- PDF generation routes
- mobile API auth

### 4.2 Centralize business logic

Reduce duplicated logic spread across:

- page components
- route handlers
- mobile API routes

Target:

- shared service/helper layer for core data operations

### 4.3 Remove fragile fallbacks over time

Current code intentionally contains a few safe fallbacks to keep the app running:

- QA forms unavailable fallbacks
- mixed webview/native mobile handoffs

Those are okay for survival, but should be reduced as the product matures.

## Phase 5: Finish Native Mobile Experience

Goal: make the app feel like a real field product.

### 5.1 Native create/edit flows

Replace remaining webview-heavy flows with true native screens where it matters most:

- create/edit project
- create/edit daily report
- create/edit pour log
- create/edit contractor eval
- create/edit QA forms

### 5.2 Offline drafts

This is one of the biggest real-world field value adds.

### 5.3 Camera-first workflow

Improve:

- image capture
- upload retry
- labeling
- annotations if needed

## Phase 6: Commercial Product Features

Goal: increase business value and buyer appeal.

### 6.0 Billing foundation

Before wiring a payment provider, keep billing data org-scoped instead of user-scoped.

Current direction:

- `organization_subscriptions` becomes the source of truth for plan/status/customer IDs
- do not bake Stripe assumptions directly into the core org table
- keep plan gating separate from RBAC so subscriptions do not distort permission logic

### 6.1 Dashboard and management visibility

Add:

- recent activity
- missing reports
- open projects
- QA trends
- contractor quality trends

### 6.2 Search and filtering

Across:

- projects
- reports
- pour logs
- QA forms
- dates
- inspectors
- structure numbers

### 6.3 Subscription monetization

After RBAC and RLS are stable:

- choose provider (likely Stripe)
- map plans onto `organization_subscriptions`
- add owner-only billing UI
- add webhook-driven status updates
- gate paid features at the org level, not the individual user level

### 6.3 Export and retention

Add:

- project archive export
- report bundles
- CSV/PDF export options

### 6.4 White-label controls

A buyer may want:

- logo
- colors
- report header/footer text
- company email branding

## Recommended Execution Order

If this work is being done incrementally, do it in this order:

1. organization schema foundation
2. migration workflow
3. organization-aware auth and permissions
4. audit log
5. monitoring
6. high-value automated tests
7. native mobile completion
8. dashboards/search/export
9. white-labeling

## What Should Not Be Done First

Avoid starting with:

- billing
- public App Store polish
- large visual redesigns
- niche feature additions

Those can increase surface area without increasing buyer confidence as much as multi-tenant structure, migrations, roles, and auditability.

## Immediate Next Step

The safest next implementation step is:

- apply the organization foundation SQL
- then begin refactoring reads/writes to support `organization_id` while preserving current `user_id` behavior during transition

Current progress:

- organization foundation SQL added
- initial create/write paths now populate `organization_id` on new major records
- main list/detail read paths are partially org-aware now
- main update/delete access checks are partially org-aware now
- audit-log foundation code is ready, pending activation through `sql/audit-log.sql`
- full access-control cleanup, role enforcement, and remaining edge-route migration are still ahead
- project report toggles are live
- standalone weekly reports are live
- smart daily-report prefills and quick-submit mode are live
- submission dashboard is live
- project photo gallery is live
- project-assignment management is now live in Settings for current memberships
- tokenized organization invite acceptance is now wired through the app
