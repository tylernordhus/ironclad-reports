# Product Stabilization Log - 2026-07-19

Workspace initially open in IDE:

- `/Users/tylernordhus/ironclad-app`

Real production app source for this work:

- `/Users/tylernordhus/Library/Mobile Documents/com~apple~CloudDocs/Ironclad Construction/Inspection App 2026/ironclad-reports`

## Goal

Turn the currently working Inspector Gadget iOS app and web app into a cleaner, more seamless product where records can be started, edited, reviewed, and continued across mobile and web without confusion.

Near-term approach:

1. Preserve the currently working production state.
2. Document the live architecture and known transition risks.
3. Choose one high-value workflow as the first app/web unified editing path.
4. Refactor that workflow around one shared backend contract.
5. Add save-state and conflict-safety behavior before attempting real-time collaboration.

## Starting State

As reported by Tyler on 2026-07-19:

- Inspector Gadget iOS app works.
- Web app appears to work.

Important context from prior recovery:

- Production should be deployed from the full iCloud project, not `/Users/tylernordhus/ironclad-app`.
- `/Users/tylernordhus/ironclad-app/supabase/mobile_legacy_access.sql` is an emergency compatibility script for legacy/plural tables.
- That SQL should not be treated as the target long-term security architecture.

## Running Log

### 2026-07-19

- Confirmed the production source tree is the full iCloud app:
  - `/Users/tylernordhus/Library/Mobile Documents/com~apple~CloudDocs/Ironclad Construction/Inspection App 2026/ironclad-reports`
- Confirmed the production repo has existing documentation:
  - `DEVELOPER_HANDOFF.md`
  - `SELLABLE_ROADMAP.md`
  - `FUTURE_FEATURES.md`
  - `MIGRATIONS.md`
  - `docs/review/full-project-review-2026-06-03.md`
- Confirmed current roadmap direction:
  - stabilize before adding more features
  - unify mobile/web behavior through shared backend contracts
  - avoid real-time collaboration until save/update architecture is cleaner
- Confirmed the production repo has many modified and untracked files. Treating those as existing project state and not reverting them.
- Started this product stabilization log.
- Inventoried the Daily Report workflow as the first candidate for app/web unification.
- Found current Daily Report paths:
  - Web create page: `app/daily-report/page.js`
  - Web create API: `app/api/submit/route.js`
  - Web edit page: `app/reports/[id]/edit/page.js`
  - Web update API: `app/api/update/[id]/route.js`
  - Mobile create screen: `mobile/src/screens/native-flows.tsx`
  - Mobile create API client: `mobile/src/lib/api.ts`
  - Mobile create API route: `app/api/mobile/reports/create/route.js`
  - Mobile report detail API route: `app/api/mobile/reports/[id]/route.js`
- Found the main app/web mismatch:
  - Native mobile can create Daily Reports through `/api/mobile/reports/create`.
  - Native mobile reads Daily Report detail through `/api/mobile/reports/[id]`.
  - Native mobile edit currently opens the web edit page instead of saving through a native update contract.
  - Web create/update and mobile create each build report payloads independently.
- Staged a no-schema-change cleanup:
  - Added shared `lib/daily-reports.js` payload normalization/build helpers.
  - Updated web create API to use shared Daily Report payload logic.
  - Updated mobile create API to use shared Daily Report payload logic.
  - Updated web update API to use shared Daily Report payload logic and reject unauthenticated API calls.
  - Added mobile Daily Report update support to `app/api/mobile/reports/[id]/route.js`.
  - Added `updateDailyReport()` to `mobile/src/lib/api.ts` for the future native edit screen.
- Copied the staged files into the production app source tree.
- Ran production web build:
  - Command: `npm run build`
  - Result: passed.
  - Confirmed `/api/mobile/reports/[id]`, `/api/mobile/reports/create`, `/api/submit`, and `/api/update/[id]` all build.
- Ran mobile TypeScript check:
  - Command: `./node_modules/.bin/tsc --noEmit --pretty false` from `mobile/`
  - Result: stopped after 30 seconds with no diagnostics because this check appears to hang in the current project state, matching prior session notes.

## Files Changed In This Pass

- `lib/daily-reports.js`
- `app/api/submit/route.js`
- `app/api/update/[id]/route.js`
- `app/api/mobile/reports/create/route.js`
- `app/api/mobile/reports/[id]/route.js`
- `mobile/src/lib/api.ts`
- `docs/product-stabilization-2026-07-19.md`

## Product Impact

- Daily Report create/update payload handling now has a shared server helper instead of separate web/mobile implementations.
- Web Daily Report create now explicitly rejects unauthenticated API calls before writing data.
- Web Daily Report update now checks signed-in access before modifying a report.
- Mobile now has an API-supported Daily Report update path.
- The first iOS UI pass for native Daily Report editing is documented below.

## Open Decisions

- First workflow to unify:
  - Recommended: Daily Reports, because they are frequent, cross-device, and smaller than Pour Logs.
  - Alternative: Pour Logs, because they are central to field use but have a larger editing/photo/truck surface.

## Next Actions

1. Run a production-source inventory focused on Daily Reports and Pour Logs.
2. Identify current web routes, mobile routes, schema tables, and shared helpers for those workflows.
3. Pick the first workflow to standardize.
4. Document the proposed shared API contract before editing behavior.
5. Make a narrow implementation pass with build verification.

## Native Edit Implementation Target

Add a native Daily Report edit screen in the iOS app:

- reuse the existing report detail fetch
- prefill the native edit form from the saved report
- save through `updateDailyReport()`
- refresh cached report detail after save
- keep photo add/edit in the web flow for now unless a full native photo upload pass is started

## Native Daily Report Edit Pass

Implemented immediately after the shared Daily Report backend contract.

Files changed:

- `mobile/App.tsx`
- `mobile/app.json`
- `mobile/src/screens/native-flows.tsx`

Changes:

- Added `NativeDailyReportEditScreen`.
- Added a mobile `edit-report` route.
- Changed the Daily Report detail screen `Edit Report` action from opening `/reports/[id]/edit` in a web view to opening the native edit screen.
- Native edit now:
  - fetches the saved Daily Report through `fetchReportDetail()`
  - pre-fills report date, submitter, crew count, weather, work completed, equipment, safety/issues, weather delay, delay hours, and schedule status
  - saves through `updateDailyReport()`
  - returns to the native Daily Report detail screen after save
- Existing photo attachments remain attached. Adding new photos still stays in the web edit flow for now.

Verification:

- Parsed final mobile files with `@babel/parser`:
  - `mobile/App.tsx`
  - `mobile/src/screens/native-flows.tsx`
  - `mobile/src/lib/api.ts`
  - Result: passed.
- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

React checklist notes:

- Hooks are called at component top level.
- The edit screen keeps state local to the edit form.
- Existing native layout primitives are reused.
- No new broad abstraction was added beyond the screen needed for this workflow.

## Remaining Cleanup Plan

This is the recommended order before doing another iOS/TestFlight pass.

### Phase A - Preserve The Working Source State

Goal: make sure the working recovery/product state can be trusted and recovered.

Steps:

1. Audit the dirty production repo and group changes by feature.
2. Do not deploy from `/Users/tylernordhus/ironclad-app`.
3. Keep all production work in:
   - `/Users/tylernordhus/Library/Mobile Documents/com~apple~CloudDocs/Ironclad Construction/Inspection App 2026/ironclad-reports`
4. Commit the known-good production app once the current batch is verified.
5. Keep this stabilization log updated with every change.

### Phase B - Close Obvious Access Gaps

Goal: stop server-rendered pages and API routes from using service-role reads/writes without a signed-in user and row-access check.

Priority targets:

1. Daily Report detail/edit pages.
2. Reports listing page.
3. Project pages that directly query with the service key.
4. Upload/photo APIs.
5. Settings APIs.

## Daily Report Access Cleanup Pass

Implemented after the native Daily Report edit pass.

Files changed:

- `lib/report-access.js`
- `app/reports/[id]/page.js`
- `app/reports/[id]/edit/page.js`
- `app/api/update/[id]/route.js`
- `app/api/delete/report/[id]/route.js`
- `app/api/pdf/[id]/route.js`
- `app/api/resend-email/[id]/route.js`
- `app/api/mobile/reports/[id]/route.js`

Changes:

- Added `getAccessibleReportById()` as the shared report row-access helper.
- Report access now uses the existing organization/project assignment scope with `project_id` as the report project column.
- Web Daily Report detail page no longer directly reads any report by ID with only the service key.
- Web Daily Report edit page no longer directly reads any report by ID with only the service key.
- Web Daily Report update/delete now use the shared report-access helper.
- Daily Report PDF generation now requires a signed-in user and scoped report access.
- Daily Report resend-email route now requires a signed-in user and scoped report access.
- Mobile Daily Report detail/update now uses the shared report-access helper.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

Notes:

- Mobile PDF viewing should continue to work through the existing mobile web-auth bridge.
- The same access cleanup pattern should be repeated for Pour Logs, QA Forms, Contractor Evaluations, upload/photo routes, and settings routes.

## Pour Log Access Cleanup Pass

Implemented after the Daily Report access cleanup.

Files changed:

- `lib/pour-log-access.js`
- `app/pour-logs/[id]/page.js`
- `app/api/pour-log/get/[id]/route.js`
- `app/api/pour-log/update/[id]/route.js`
- `app/api/pour-log/update-flatwork/[id]/route.js`
- `app/api/delete/pour-log/[id]/route.js`
- `app/api/mobile/pour-logs/[id]/route.js`
- `app/api/pour-log/pdf/[id]/route.js`
- `app/api/pour-log/send-email/[id]/route.js`
- `app/api/pour-log/volume-plot/[id]/route.js`

Changes:

- Added `getAccessiblePourLogById()` as the shared pour-log row-access helper.
- Added `getPourLogChildren()` as the shared foundation/truck loader with consistent truck sorting.
- Web Pour Log detail no longer directly reads any pour log by ID with only the service key.
- Web Pour Log get/update/update-flatwork/delete APIs now use assignment-aware access through `project_id`.
- Mobile Pour Log detail now uses the same assignment-aware access helper.
- Pour Log PDF generation now requires a signed-in user and scoped pour-log access.
- Pour Log resend-email route now requires a signed-in user and scoped pour-log access.
- Pour Log volume plot route now requires a signed-in user and scoped pour-log access.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

Notes:

- This pass did not redesign Pour Log payload normalization yet.
- Native Pour Log edit still opens web edit screens; app/web unification for Pour Logs remains a larger follow-up.

## QA Form Access Cleanup Pass

Implemented after the Pour Log access cleanup.

Files changed:

- `lib/qa-form-access.js`
- `app/qa-forms/[id]/page.js`
- `app/qa-forms/[id]/edit/page.js`
- `app/api/qa-form/update/[id]/route.js`
- `app/api/mobile/qa-forms/[id]/route.js`
- `app/api/delete/qa-form/[id]/route.js`
- `app/api/qa-form/pdf/[id]/route.js`

Changes:

- Added `getAccessibleQaFormById()` as the shared QA form row-access helper.
- QA form access now uses the existing organization/project assignment scope with `project_id` as the QA form project column.
- Web QA form detail and edit pages no longer directly read any QA form by ID with only the service key.
- Web QA form update/delete now use the shared QA form access helper.
- Mobile QA form detail now uses the shared QA form access helper.
- QA form PDF generation now requires a signed-in user and scoped QA form access.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

Notes:

- This pass did not redesign QA form payload normalization.
- Native QA form edit remains a follow-up after the route-level access behavior is stable.

## Contractor Evaluation Access Cleanup Pass

Implemented after the QA Form access cleanup.

Files changed:

- `lib/contractor-eval-access.js`
- `app/contractor-evals/[id]/page.js`
- `app/api/contractor-eval/get/[id]/route.js`
- `app/api/mobile/contractor-evals/[id]/route.js`
- `app/api/contractor-eval/update/[id]/route.js`
- `app/api/delete/contractor-eval/[id]/route.js`
- `app/api/contractor-eval/pdf/[id]/route.js`

Changes:

- Added `getAccessibleContractorEvaluationById()` as the shared contractor evaluation row-access helper.
- Contractor evaluation access now uses the existing organization/project assignment scope with `project_id` as the evaluation project column.
- Web contractor evaluation detail no longer directly reads any evaluation by ID with only the service key.
- Web contractor evaluation edit data loading now goes through the scoped `/api/contractor-eval/get/[id]` endpoint.
- Web contractor evaluation update/delete now use the shared contractor evaluation access helper.
- Mobile contractor evaluation detail now uses the shared contractor evaluation access helper.
- Contractor evaluation PDF generation now requires a signed-in user and scoped evaluation access.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

Notes:

- This pass did not redesign contractor evaluation payload normalization.
- Native contractor evaluation edit remains a follow-up after the route-level access behavior is stable.

## Project API Access Cleanup Pass

Implemented after the Contractor Evaluation access cleanup.

Files changed:

- `app/api/projects/create/route.js`
- `app/api/projects/[id]/equipment/route.js`

Changes:

- Project creation now redirects unauthenticated form posts to `/login` instead of continuing toward organization/project creation without a signed-in user.
- Project equipment reads now use `getAccessScope()` and `getOwnedProjectById()` instead of only checking `projects.user_id`.
- Project equipment writes now use the same scoped project access check, so assigned organization users can use the equipment list consistently.
- Project equipment updates now return a clear API error if the update fails.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

Notes:

- Existing project list/detail/edit/update/delete paths were already using scoped project access.
- This pass did not change owner-only project administration rules.

## Photo Upload Access Cleanup Pass

Implemented after the Project API access cleanup.

Files changed:

- `app/api/upload-photos/route.js`
- `app/pour-log/page.js`
- `app/pour-log-flatwork/page.js`
- `app/pour-logs/[id]/edit/page.js`
- `app/components/QaFormEditor.js`
- `mobile/src/lib/api.ts`
- `mobile/src/screens/native-flows.tsx`

Changes:

- `/api/upload-photos` now accepts an optional `project_id`.
- When `project_id` is present, upload processing first verifies the signed-in user has scoped access to that project through `getAccessScope()` and `getOwnedProjectById()`.
- Web drilled-shaft Pour Log creation now sends `project_id` with photo uploads.
- Web flatwork Pour Log creation now sends `project_id` with photo uploads.
- Web Pour Log edit now keeps the saved log `project_id` in local form state and sends it with new photo uploads.
- Web QA form create/edit now sends `project_id` with photo uploads.
- Native mobile Pour Log photo uploads now send `project_id`.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.
- Parsed edited mobile files from the mobile package:
  - `mobile/src/lib/api.ts`
  - `mobile/src/screens/native-flows.tsx`
  - Result: passed.

Notes:

- Backward compatibility is preserved: upload callers that do not send `project_id` still require authentication and folder validation, but do not get project-level validation.
- A future stricter pass can require `project_id` for all report-related uploads after every caller is migrated.

## Settings Role Cleanup Pass

Implemented after the Photo Upload access cleanup.

Files changed:

- `app/settings/page.js`
- `app/api/settings/members/create/route.js`
- `app/api/settings/members/invite/route.js`
- `app/api/settings/members/[membershipId]/route.js`

Changes:

- Settings UI now checks owner/admin access with the full membership object instead of only `membership.role`.
- Add-existing-user, invite-user, and update-member routes now check owner/admin access with the full membership object.
- The last-owner guard now uses normalized membership access role logic instead of counting only legacy `role = owner` rows.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

Notes:

- This keeps compatibility with both legacy `role` and newer `access_role` membership fields.
- No settings UI layout or workflow behavior was changed.

## Project-Scoped Create Route Cleanup Pass

Implemented after the Settings role cleanup.

Files changed:

- `lib/project-access.js`
- `app/api/submit/route.js`
- `app/api/mobile/reports/create/route.js`
- `app/api/pour-log/create/route.js`
- `app/api/pour-log/create-flatwork/route.js`
- `app/api/mobile/pour-logs/create/route.js`
- `app/api/qa-form/create/route.js`
- `app/api/qa-form/update/[id]/route.js`
- `app/api/mobile/qa-forms/create/route.js`
- `app/api/contractor-eval/create/route.js`
- `app/api/mobile/contractor-evals/create/route.js`

Changes:

- Added `getCreateProjectContext()` as the shared create-time project authorization helper.
- Daily Report create routes now verify scoped project access before inserting against a provided `project_id`.
- Pour Log create routes now reject unauthenticated web creates and verify scoped project access before inserting against a provided `project_id`.
- QA Form create routes now verify scoped project access before inserting against a provided `project_id`.
- QA Form update now verifies scoped project access before moving a form to a provided `project_id`.
- Contractor Evaluation create now rejects unauthenticated creates and verifies scoped project access before inserting against a provided `project_id`.
- Mobile Contractor Evaluation create now verifies scoped project access before inserting against a provided `project_id`.
- No-project create compatibility is preserved by using the current user's default organization behavior.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

Notes:

- This closes the main create-side counterpart to the earlier read/update/delete access cleanup.
- A stricter future pass can decide whether no-project report creation should remain supported or be removed from production workflows.
- Follow-up inventory after this pass found no remaining `getOrganizationIdForProject()` route usage outside the legacy helper definition.

## Latest Report Access Cleanup Pass

Implemented after the Project-Scoped create route cleanup.

Files changed:

- `app/api/reports/latest/[projectId]/route.js`

Changes:

- Web latest-report lookup now rejects unauthenticated requests.
- Web latest-report lookup now uses `getAccessScope()` and `applyAccessScope()` instead of filtering only by `user_id`.
- This aligns the web endpoint with the existing mobile latest-report access behavior and supports assigned organization users.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

Notes:

- Main listing pages checked in this pass were already using scoped access.
- `git diff --name-only` was stopped because it hung in the already very dirty iCloud repo; build verification and targeted route scans completed.

## Pour Log UX And Draft Reliability Pass

Implemented on 2026-07-20 after Tyler identified two field-use problems:

- Truck entries need both a simple sequence number and the actual truck/unit ID.
- Pour Log entry has too much scrolling and drafts can be lost when a phone locks, refreshes, or backgrounds before the debounce finishes.

Files changed:

- `app/pour-log/page.js`
- `app/pour-logs/[id]/edit/page.js`
- `mobile/src/screens/native-flows.tsx`

Changes:

- Web drilled-shaft Pour Log create now shows truck sequence from row position:
  - `Truck 1`
  - `Truck 2`
  - `Truck 3`
- The saved truck identifier field is now labeled `Truck ID / Unit #`.
- Web drilled-shaft Pour Log create now has a compact truck jump list.
- Only the selected truck is expanded for editing, so users can jump between Truck 2, Truck 3, Truck 4, etc. without scrolling through every truck card.
- Added `Duplicate Test Fields` on web create to quickly create a new truck with repeated concrete test values.
- Web drilled-shaft Pour Log edit now uses the same active-truck/jump-list workflow.
- Web create/edit draft autosave debounce was tightened from roughly 700-800ms to 350ms.
- Web create/edit now force a draft write on `pagehide` and when the page becomes hidden.
- Existing before-unload warning now also attempts to flush the draft immediately.
- Native mobile drilled-shaft Pour Log truck summaries now display `Truck 1`, `Truck 2`, etc. and show the actual truck ID as detail text.
- Native mobile drilled-shaft Pour Log active truck field is now labeled `Truck ID / Unit #`.
- Native mobile drilled-shaft Pour Log now flushes the local draft when the app moves out of the active state through React Native `AppState`.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.
- Parsed edited mobile file:
  - `mobile/src/screens/native-flows.tsx`
  - Result: passed.

Notes:

- No database migration was required. The existing `pour_log_trucks.truck_number` field remains the stored truck/unit identifier.
- The displayed truck sequence is derived from truck row order.
- This pass covers drilled-shaft create/edit on web and drilled-shaft create on native mobile. Flatwork and true two-user simultaneous editing remain follow-ups.

## 2026-07-20 - Flatwork Pour Log Truck UX And Draft Reliability Pass

Goal: make flatwork truck entry faster and less fragile before the next iOS test batch.

Files changed:

- `app/pour-log-flatwork/page.js`
- `app/pour-logs/[id]/edit-flatwork/page.js`
- `mobile/src/screens/native-flows.tsx`

Steps completed:

1. Changed flatwork truck sequence display to row order: `Truck 1`, `Truck 2`, `Truck 3`, etc.
2. Kept the saved `truck_number` field as the real mixer/truck ID and relabeled it as `Truck ID / Unit #`.
3. Added a compact web truck switcher on flatwork create and edit so only one truck's full details are open at a time.
4. Added summary text to each web truck switcher button showing the truck ID plus arrival or completion time when available.
5. Added `Duplicate Test Fields` on flatwork web create/edit and native mobile create. This creates a new truck and carries forward concrete test values while leaving times, yards, notes, and truck ID blank.
6. Tightened flatwork web draft autosave from 700-800ms to 350ms.
7. Added web draft flushes on `pagehide`, `visibilitychange`, and `beforeunload` so closing, refreshing, or backgrounding the browser is less likely to lose recent edits.
8. Added native flatwork draft flushing when the app moves out of the active state.
9. Added active truck index persistence and clamping for flatwork drafts.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.
- Parsed edited mobile file:
  - `mobile/src/screens/native-flows.tsx`
  - Result: passed.

Notes:

- No database migration was required for this pass.
- This is still local-device/local-browser draft behavior, not true live collaboration.
- True two-person editing needs a server-backed draft/collaboration layer before it should be attempted in production.

Two-person editing requirements:

1. Add a server-backed draft table or form-session table for in-progress pour logs.
2. Add revision tracking, preferably per form section or per truck row, so updates can merge cleanly.
3. Add autosave API routes that patch a single draft section/truck instead of overwriting the full form.
4. Add Supabase Realtime presence so users can see who else is editing the same log.
5. Add a conflict rule: last-write can be acceptable for different fields, but same-field/same-truck edits need a warning or short lock.
6. Promote the draft into the final `pour_logs` records only when the user submits.
7. Add RLS policies for draft access once the route behavior is verified.

## 2026-07-22 - Existing Pour Log Edit Access And Compact Sections

Goal: make existing pour logs faster to edit from the web app.

Files changed:

- `app/pour-logs/[id]/page.js`
- `app/pour-logs/[id]/edit/page.js`
- `app/pour-logs/[id]/edit-flatwork/page.js`

Steps completed:

1. Added an `Edit Pour Log` button at the top of the existing pour-log detail page.
2. Kept the bottom edit action in place for users who scroll through the full log.
3. Changed drilled-shaft edit `Job Info` into a compact summary with an `Edit Job Info` toggle.
4. Changed drilled-shaft edit `Foundations Poured` into a switcher like the truck picker, so only one foundation is open at a time.
5. Changed flatwork edit `Job Info` and `Pour Info` into compact summaries with edit toggles.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

## 2026-07-22 - Pour Log Block Collapse Behavior

Goal: keep pour-log forms compact unless a specific foundation or truck is selected.

Files changed:

- `app/pour-log/page.js`
- `app/pour-log-flatwork/page.js`
- `app/pour-logs/[id]/edit/page.js`
- `app/pour-logs/[id]/edit-flatwork/page.js`

Steps completed:

1. Changed truck blocks on drilled-shaft create/edit and flatwork create/edit so no truck details show when no truck is selected.
2. Changed selected truck blocks to toggle closed when tapped again.
3. Changed drilled-shaft edit foundation blocks so no foundation details show when no foundation is selected.
4. Changed selected foundation blocks to toggle closed when tapped again.
5. Preserved local draft autosave behavior, including fast debounce and browser background/close draft flushes.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

## 2026-07-23 - Existing Pour Log Database Autosave And Keepalive

Goal: make existing pour-log edits usable in the field without relying only on the final Save button.

Files changed:

- `app/api/auth/keepalive/route.js`
- `app/api/pour-log/update/[id]/route.js`
- `app/api/pour-log/update-flatwork/[id]/route.js`
- `app/pour-logs/[id]/edit/page.js`
- `app/pour-logs/[id]/edit-flatwork/page.js`

Steps completed:

1. Added an authenticated keep-alive route so open edit forms can periodically refresh/check the session.
2. Added keep-alive pings on drilled-shaft and flatwork edit pages while the form is open.
3. Added database autosave to drilled-shaft edit after the user pauses typing.
4. Added database autosave to flatwork edit after the user pauses typing.
5. Added visible database save status next to the local draft status.
6. Kept local draft autosave in place as a fallback.
7. Skipped audit-log events for background autosaves so audit history is not flooded.
8. Kept normal audit events for the manual `Save Changes` button.

Notes:

- Existing pour-log edit pages now autosave to the database.
- New pour-log create pages still use local draft autosave until the first real log exists.
- New photo files are still uploaded by the manual `Save Changes` flow; database autosave covers existing photos/captions and form data.

Verification:

- Ran production web build:
  - Command: `npm run build`
  - Result: passed.

## 2026-07-23 - App Store iOS Build 15

Goal: bring the App Store/TestFlight version closer to the live website pour-log experience.

Files changed:

- `mobile/App.tsx`
- `mobile/src/screens/native-flows.tsx`
- `mobile/app.json`
- `mobile/package.json`
- `mobile/package-lock.json`
- `mobile/.easignore`

Steps completed:

1. Added a top `Edit Pour Log` action on native pour-log detail.
2. Matched native drilled-shaft create to the web block behavior for foundations and trucks.
3. Matched native flatwork create to the web block behavior for sections and trucks.
4. Changed native block selection so details are hidden until selected and tapping the selected block closes details.
5. Added drilled-shaft native `Duplicate Test Fields`.
6. Changed native drilled-shaft truck ID to stay blank by default while visible truck order remains `Truck 1`, `Truck 2`, etc.
7. Added `.easignore` so EAS does not package local dependency/cache folders.
8. Installed `expo-updates` because the app already uses `runtimeVersion.policy = appVersion`, which EAS requires to be backed by `expo-updates`.
9. Built iOS production build number `15` with EAS.
10. Scheduled App Store Connect/TestFlight submission for build `15`.

Build:

- EAS build ID: `d7dbb12a-c693-4b43-a818-8120dcabab2f`
- App version: `1.0.0`
- iOS build number: `15`
- Artifact: `https://expo.dev/artifacts/eas/EGFbjvCQbJxzPTu59QfE8kedaFnlIdM9yGh_j_ej4K4.ipa`
- Build status: finished.

Submission:

- EAS submission ID: `9e18bf49-514b-4c77-ba41-754fd76b1742`
- App Store Connect app ID: `6763749762`
- Local EAS wait was stopped after the server-side submission was scheduled because the CLI stopped emitting progress.

## 2026-07-23 - Tremie Break Guide Web Integration

Goal: add real-time tremie break/lift/hold guidance to drilled-shaft pour logs.

Files changed:

- `app/components/TremieBreakGuide.js`
- `app/pour-log/page.js`
- `app/pour-logs/[id]/edit/page.js`
- `app/api/pour-log/create/route.js`
- `app/api/pour-log/update/[id]/route.js`
- `sql/migrations/0012_tremie_break_guide.sql`
- `supabase/tremie_break_guide.sql`

Changes:

1. Added a reusable Tremie Break Guide panel for drilled-shaft pour logs.
2. Added editable setup inputs for shaft diameter, shaft depth, load size, minimum embedment, plug lift, lift ceiling, hopper height, and per-section pipe lengths.
3. Added live derived values for rise per load, shaft volume, estimated loads, and total pipe on hand.
4. Added a truck-by-truck recommendation table with `BREAK`, `LIFT`, or `HOLD`, concrete surface depth, pipe bottom depth, embedment, remaining sections, hopper position, and actual action logging.
5. Added a pipe-stack visual with broken sections dimmed, TOC marker, hopper, and concrete level marker.
6. Wired the guide into drilled-shaft create local draft autosave and create payloads.
7. Wired the guide into drilled-shaft edit local draft autosave, database autosave, and manual save payloads.
8. Added `sql/migrations/0012_tremie_break_guide.sql` and `supabase/tremie_break_guide.sql` to persist the guide as `pour_logs.tremie_break_guide jsonb`.
9. Added defensive API retries so create/update still work if the production database has not had the new JSON column applied yet.

Notes:

- Database persistence requires running `sql/migrations/0012_tremie_break_guide.sql` or `supabase/tremie_break_guide.sql` in Supabase.
- Until that migration is applied, web create/edit still function, but Tremie Break Guide data only survives in the local browser draft.
- Existing iOS WebView edit screens will get the web Tremie Break Guide after Vercel deployment. Native iOS create screens need a separate build if this panel should exist fully native before opening the web editor.

## 2026-07-23 - iOS Pour Log Create Uses Web Forms

Goal: make App Store/TestFlight pour-log creation match the web app without maintaining two separate heavy pour-log UIs.

Files changed:

- `mobile/App.tsx`

Changes:

1. Changed iOS `new-pour-log` routing to open the deployed web drilled-shaft or flatwork create form in the authenticated WebView.
2. This gives iOS pour-log create the same compact web layout, local draft behavior, and drilled-shaft Tremie Break Guide as production web after a new EAS build ships.
3. Kept the native pour-log detail screen and existing top `Edit Pour Log` WebView action.

Notes:

- A new iOS build is required for this routing change to reach TestFlight/App Store users.
- The existing build `15` will not get this native route change.

Build:

- EAS build ID: `f7ba6cd3-14b5-4ce8-91a0-ab0597c978c7`
- App version: `1.0.0`
- iOS build number: `16`
- Artifact: `https://expo.dev/artifacts/eas/KlRuJ-wEqV-Kyg6tJKxUpEcpcMfZQ6lbj_qQyb7eLmI.ipa`
- Build status: finished.

Submission:

- EAS submission ID: `08327be2-8966-44f7-89c9-37cb96fe71e0`
- Submission details: `https://expo.dev/accounts/tyler.nordhus/projects/ironclad-field/submissions/08327be2-8966-44f7-89c9-37cb96fe71e0`
- ASC App ID: `6763749762`
- Local EAS wait was stopped after the server-side submission was scheduled because this EAS CLI version did not expose a compatible submission status command.

## 2026-07-23 - Tremie Guide Toggle

Goal: let users hide the tremie pipe guide on drilled-shaft pour logs when it is not needed.

Files changed:

- `app/components/TremieBreakGuide.js`

Changes:

1. Added an on/off toggle at the top of the Tremie Break Guide panel.
2. New pour logs default the Tremie Break Guide to off.
3. Turning the guide off hides calculations, section stack, recommendations, and actual-action rows.
4. Existing entered guide data is preserved when toggled off.
5. Older saved guide records without an explicit toggle still open automatically if they contain non-default guide data.

## 2026-07-23 - Tremie Foundation-Driven Inputs

Goal: make the tremie guide calculate from the selected foundation instead of duplicate manual shaft inputs.

Files changed:

- `app/components/TremieBreakGuide.js`

Changes:

1. Replaced the shaft dropdown with foundation buttons so the user chooses which foundation the tremie calculation applies to.
2. Changed the calculation source so the selected foundation's actual depth drives shaft depth, falling back to design depth only when actual depth is blank.
3. Changed the calculation source so the selected foundation's shaft diameter drives concrete rise per truck.
4. Removed visible Tremie Guide controls for shaft diameter, shaft depth, max-one-break-per-truck, plug lift, and lift ceiling.
5. Kept load size, minimum embedment, hopper height, pipe sections, truck steps, and actual action logging visible.

## 2026-07-23 - Tremie Position Graphic Cleanup

Goal: make the tremie graphic show the calculated field position clearly.

Files changed:

- `app/components/TremieBreakGuide.js`

Changes:

1. Replaced the generic pipe stack graphic with a scaled tremie position diagram.
2. Added a fixed TOC line at zero depth.
3. Added calculated concrete level based on the selected truck step.
4. Added pipe top, pipe bottom, and hopper position tied to the calculated remaining pipe string.
5. Added a minimum embedment target band/line so the user can see whether the pipe bottom is safely embedded.
6. Added compact legend values for concrete level, current embedment, sections left, and broken sections.

## 2026-07-23 - Tremie Graphic Section Visibility

Goal: keep the tremie diagram readable while showing pipe sections.

Files changed:

- `app/components/TremieBreakGuide.js`

Changes:

1. Moved the concrete/embedment/section legend below the tremie diagram so it no longer covers the graphic.
2. Added visible pipe section segments to the diagram, labeled `S1`, `S2`, etc.
3. Kept the pipe bottom, hopper, TOC, concrete level, and minimum embedment markers visible above the section display.

## 2026-07-23 - Tremie Pipe Bottom Label Cleanup

Goal: keep the pipe-bottom indicator from covering the pipe section graphic.

Files changed:

- `app/components/TremieBreakGuide.js`

Changes:

1. Replaced the centered pipe-bottom label with a small dot at the actual pipe bottom.
2. Moved the `Pipe Bottom` depth label to the right side of the tremie diagram.
3. Added a thin pointer line from the pipe bottom to the side label.

## 2026-07-23 - Tremie Hopper Range And Break Controls

Goal: show how high the hopper can be while maintaining minimum embedment and let users model pipe breaks by truck.

Files changed:

- `app/components/TremieBreakGuide.js`

Changes:

1. Changed the initial-placement assumption so the pipe stays on bottom until concrete placed exceeds the minimum embedment value.
2. Added a calculated `Max Hopper` line that shows the highest hopper position allowed while preserving minimum embedment.
3. Added max-hopper measurements relative to current concrete level and relative to TOC.
4. Added a `Break Pipe` checkbox for each truck row; selecting it removes one top pipe section from that truck forward when embedment allows.
5. Changed recommendations so they report available lift by embedment instead of automatically breaking pipe.

## 2026-07-27 - Tremie Guide Reset Plan And Current Status

Goal: document the latest field-design discussion before more Tremie UI/math changes are made.

Current live/code state:

1. The drilled-shaft Tremie Break Guide exists in web create/edit through `app/components/TremieBreakGuide.js`.
2. The guide can be toggled on/off and defaults off for new logs.
3. The guide pulls shaft actual depth and diameter from the selected foundation, with design depth as the fallback.
4. The guide includes load size, minimum embedment, hopper height, pipe section lengths, per-truck steps, break-pipe checkboxes, and actual action logging.
5. The guide attempts to show TOC, concrete level, pipe bottom, hopper, min embedment, max hopper, and pipe sections in one graphic.
6. iOS build `16` routes pour-log creation into the web forms so iOS users can use the same compact web pour-log UI after the build reaches TestFlight/App Store.

Latest user feedback:

1. The current Tremie feature is still not usable enough in the field.
2. The issue is not just visual polish; the workflow and math model need to be simplified around real pour decisions.
3. Stop patching the current graphic incrementally until a real truck-by-truck field example is captured.

Recommended rebuild direction:

1. Rebuild the Tremie tool as a simple truck-by-truck calculator first, with the graphic secondary.
2. Each truck step should answer:
   - Where is concrete now?
   - Where is the pipe bottom now?
   - How much embedment exists now?
   - How high can the hopper be lifted before embedment is too low?
   - Can a pipe section be broken now?
   - If a section is broken, where will the hopper end up?
   - What should the crew do next?
3. Once those numbers match field expectations, rebuild the diagram around those exact answers.

Field example needed before the next Tremie rewrite:

1. Shaft depth.
2. Shaft diameter.
3. Minimum embedment rule.
4. Pipe sections on the string.
5. Truck 1 yards and what the crew would actually do after truck 1.
6. Truck 2 yards and what the crew would actually do after truck 2.
7. Truck 3 yards and what the crew would actually do after truck 3.
8. Continue as needed until the first pipe break decision happens.

Known blockers:

1. Database persistence for `tremie_break_guide` still depends on applying migration `0012_tremie_break_guide`.
2. Without that migration, the app can still create/edit pour logs because the API retries without the column, but Tremie data may only survive in local browser draft storage.
3. iOS build `16` was built and submitted through EAS, but App Store Connect/TestFlight processing still needs to be confirmed manually.
4. The repo has many uncommitted tracked and untracked changes; commit or backup before a larger Tremie rewrite.

### Phase C - Finish Daily Report App/Web Seamlessness

Goal: make Daily Reports feel consistent across web and iOS.

Steps:

1. Native iOS create: done.
2. Native iOS edit: first pass done.
3. Web/mobile shared create/update normalization: done.
4. Add native save-state/draft-state polish.
5. Add conflict protection once the database has a reliable `updated_at` or revision column on `reports`.
6. Decide whether native Daily Reports should support photo upload now or keep photos as a web-only edit for one more release.

### Phase D - Repeat For Pour Logs

Goal: make the heaviest field workflow seamless after Daily Reports are stable.

Steps:

1. Centralize Pour Log payload normalization.
2. Make mobile/web create use the same server rules.
3. Make mobile/web update use the same server rules.
4. Keep truck ordering and foundation/section payloads consistent.
5. Add native edit only after shared update behavior is solid.

### Phase E - Repeat For QA Forms And Contractor Evaluations

Goal: remove remaining mixed app/web behavior one workflow at a time.

Steps:

1. Centralize payload normalization.
2. Ensure create/update routes share access checks.
3. Add native edit screens where the mobile UX benefits from it.
4. Keep PDF generation web/server-side.

### Phase F - Database And Security Cleanup

Goal: get away from emergency compatibility mode.

Steps:

1. Inventory which legacy/plural tables are still actively read by production app and iOS.
2. Replace emergency `mobile_legacy_access.sql` dependence with scoped API access.
3. Add missing migration files for any needed timestamps/revision columns.
4. Tighten storage upload paths and permissions.
5. Move toward proper RLS only after route-level access behavior is verified.

### Phase G - Final iOS Test Batch

Only after the desired code changes are in place:

1. Build web.
2. Parse/check mobile code.
3. Run local simulator/device smoke test if available.
4. Build TestFlight.
5. Test iOS:
   - sign in
   - project list
   - project detail
   - create Daily Report
   - edit Daily Report
   - confirm web reflects iOS edits
   - create/edit Pour Log if included in batch
6. Deploy production web only from the full iCloud repo.
