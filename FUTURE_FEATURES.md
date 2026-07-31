# Future Features

This document tracks the larger or higher-risk product goals that should be reviewed before making architectural changes.

Rule:

- if a change touches auth, project workflows, reports, media, realtime, or billing, review this file first
- use it to avoid making short-term changes that block long-term goals

## High-Risk / Deferred Features

### 1. Real-Time Collaborative Pour Logs

Goal:

- two inspectors editing the same pour log at once
- live presence indicator
- field-level last-write-wins conflict handling

Why deferred:

- needs a more deliberate save model and autosave strategy
- should be built with Supabase Realtime after the form/update architecture is cleaner

### 2. Full Photo Storage Layer

Goal:

- centralized project photo storage
- report/field tagging
- project gallery
- in-app annotation
- no automatic save to personal camera roll

Why deferred:

- large subsystem
- best done in phases
- annotation and export behavior are more native/mobile-heavy than the current stack

### 3. Push Notifications

Goal:

- daily reminder for missing daily reports
- PM/owner submission notifications
- notify users when owners edit their submitted reports

Why deferred:

- depends on clean submission-status rules
- depends on assignments, org roles, and notification preferences
- owner-edit notification also depends on richer audit snapshot work

### 4. Full Subscription Billing

Goal:

- charge organizations on a recurring subscription
- gate paid features by organization plan

Current foundation:

- `organization_subscriptions` schema is the right direction

Why deferred:

- actual billing should wait until permissions and org/member workflows settle
- avoid coupling pricing logic to unstable auth or project-assignment rules

### 5. Full DB-Level RLS and Final RBAC Cutover

Goal:

- enforce `OWNER / MEMBER / VIEWER` at the database layer
- remove remaining legacy role assumptions

Why deferred:

- still in transition
- easier to finish after project assignment flows are in place

### 6. AI-Assisted Print / Checklist Population

Goal:

- auto-populate checks from selected structure types and eventually reviewed prints
- reduce manual data entry for newer inspectors

Important design rule:

- keep checklist definitions and report availability data-driven
- do not hardcode structure/report logic deeply into forms
- future AI logic should map into structured templates, not freeform page hacks

## Medium-Risk / Next-Later Features

### 1. Standalone Weekly Report Expansion

Current direction:

- weekly reports should eventually be their own first-class record type
- they should not depend on daily reports existing

### 2. Submission Status Dashboard

Goal:

- PM/owner landing view showing missing daily submissions by project/day

Dependency:

- works best once project report toggles and project-level assignments are stable

### 3. Smart Daily Reports

Goal:

- GPS/project weather prefill
- previous-day crew size prefill

Dependency:

- good mobile daily report flow
- graceful handling of missing location permission

### 4. Quick-Submit Daily Report Mode

Goal:

- ultra-fast glove-friendly phone flow

Dependency:

- should reuse the same daily report data model, not fork it

## Current Low-Risk Focus

These are the kinds of features we should prefer in the near term:

- project-level report toggles
- visibility rules that hide disabled report types
- standalone weekly report foundation
- smart defaults for existing report flows
- dashboard/reporting features that do not destabilize the core data model
