# Pour Log Collaboration - Project Plan

## The Goal

Two inspectors work one concrete pour at the same time. One is at the testing station (slump, air, temperature, cylinders, truck tickets). One is at the hole watching the pour (shaft depth, pour progress, truck sequence, observations). They need to fill out ONE shared pour log together, each owning their own section, without overwriting each other. It must also work when only one person does the whole form, and must adapt mid-pour if someone leaves or hands off.

## Design Decisions (do not re-litigate these)

This is NOT Notion-style same-field co-editing. It is two people writing DIFFERENT sections of one record. Simpler and more reliable. Do not build conflict-resolution or operational-transform.

One pour log record, owned by the primary inspector. All sections always exist on the record. "Solo vs. split" is just how many sections currently have someone attached - not a separate mode.

Saves must be SECTION-SCOPED, not whole-record, so simultaneous edits and handoffs never clobber data. This is the linchpin.

Live sync between the two screens uses Supabase Realtime (each screen listens for the other section's updates). Local-draft autosave stays as the offline cushion for spotty Starlink signal.

Second inspector joins by picking the pour from a short "active pours today" list - no codes, no links. Must be stupid-simple for non-technical older inspectors.

A light per-section status indicator ("someone is on testing" vs. "nobody's on testing") - not full presence.

## Build Order (one step at a time, test each before the next)

[DONE] Back up production repo locally and confirm on GitHub.

Make pour-log saves section-scoped (testing group vs. hole group). No multi-user features yet.

Add Supabase Realtime so each screen reflects the other's section live.

Add the "join from active pours today" list flow.

Add section claim / handoff (someone leaves, section becomes available).

Add per-section status indicator.

## Long-Term Vision (not now, just recorded)

Overall feel modeled loosely on Procore (clean, native, role-aware) - as a north star for polish, NOT a build target.

Recreate the paper forms so screens match the paper old-timers know.

Photo-capture path, staged: (1) attach a photo of a handwritten form to the pour log, (2) digitize form layouts to match paper, (3) only much later, auto-extract handwriting from the photo as a draft the inspector confirms. Build reliable value first, magic trick last.

## Known Risks (from prior project notes)

mobile_legacy_access.sql is emergency legacy access, NOT permanent architecture - retire it during security cleanup.

Database migrations are applied manually; verify columns exist before relying on features.

Automated tests are limited; no regression safety net yet.

Folder /Users/tylernordhus/ironclad-app is an OLD prototype archive, not production. Do not work there.

## Current Health Check

Static review only. No application code was changed while making this checklist.

- [ ] Current pour-log edit saves are whole-record saves, not section-scoped saves. This is the biggest blocker for two-person work because one person's autosave can overwrite the other person's section.
- [ ] Drilled-shaft update currently deletes and reinserts all foundations and all trucks on every save. That is workable for one editor, but risky for collaboration.
- [ ] Flatwork update also replaces all trucks on every save. Same collaboration risk.
- [ ] Existing database autosave exists on edit pages, but it sends the full current form payload after a delay. It is not safe for two people until the API is split by section.
- [ ] New pour-log create pages still rely on local browser draft autosave until the first real pour log record exists. For collaboration, a shared record or server-backed draft needs to exist early.
- [ ] No Supabase Realtime channel/listener was found in the pour-log pages. Live reflection between two screens has not been built yet.
- [ ] No "active pours today" join list was found. The second-inspector join flow has not been built yet.
- [ ] No section claim, section handoff, or per-section status model was found. Those need new data and UI.
- [ ] New photo files are still handled by manual save/upload flow. Current autosave covers form data and existing photo references, not fresh unsaved photo files.
- [ ] Tremie Break Guide persistence depends on `pour_logs.tremie_break_guide`. The code has a fallback if the column is missing, but that means Tremie data may not persist until migration `0012_tremie_break_guide.sql` is applied.
- [ ] The Tremie guide exists but is not field-approved. Prior notes say to stop patching it until a real truck-by-truck pour example is captured.
- [ ] The edit pages compare local draft time to `data.log.updated_at`, but current migration files do not clearly add or maintain `updated_at` on `pour_logs`. If production lacks this column or trigger, stale-draft warnings may be unreliable.
- [ ] Flatwork update route ignores the delete result when replacing trucks. If the delete fails and insert succeeds, duplicate or stale truck rows could be possible.
- [ ] Flatwork update route returns plain text on failure instead of a JSON error. That makes troubleshooting harder from the UI.
- [ ] Current local-draft behavior is useful as an offline cushion, but it is device-local only. It does not let another inspector see unsaved work.
- [ ] Access checks exist through `getAccessiblePourLogById()`, but the future collaboration feature still needs clear rules for who can join an active pour and who owns the final record.
- [ ] There is no automated regression test coverage for this pour-log collaboration path yet.

## Triage Notes (2026-07-31)

Biggest structural issue: pour-log saves currently delete and reinsert ALL foundations and trucks on every save (both drilled-shaft and flatwork). For two-person collaboration this must become surgical, section-scoped updates instead of delete-and-rebuild. This is the core of the section-save work.

Small bug A: the flatwork update route replaces trucks but ignores whether the delete succeeded before inserting, which could leave duplicate or stale truck rows.

Small bug B: the flatwork update route returns plain text on failure instead of a JSON error, making failures hard to diagnose from the UI.

To verify in the database later: confirm the pour_logs table actually has an updated_at column, since the draft-staleness logic depends on it.
