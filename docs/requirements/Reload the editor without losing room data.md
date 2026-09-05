---
type: PBI
parent: "[[Release hardening]]"
order: 10
status: Done
started: 2026-09-05
finished: 2026-09-05
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Draw and name a rectangular room]]"
---

# Reload the editor without losing room data

## Actor

The private renovator who has created a room and expects it to remain the same when they return.

## Main flow

1. The renovator creates and confirms a valid room.
2. The editor, leaf, or workspace is closed.
3. The renovator opens the same plan again.
4. The editor loads the room note and plan sidecar through the normal read path.
5. The room appears with the same identity, geometry, homeowner metadata, and derived area.

## Extensions

- **4a** — One half of the persisted room cannot be read. The room is reported as unreadable;
  the editor does not invent an empty room or silently repair the vault.
- **4b** — The stored shape is from an accepted older schema. A tested migration loads it
  without changing the stable room identity.
- **4c** — Selection or draft-only state no longer names a valid entity. The editor opens in
  safe Select state while preserving every valid room.

## Guarantee

Reload reconstructs the last successfully persisted room from canonical Markdown metadata and
sidecar geometry. It neither loses a valid room nor promotes transient UI state into vault data.

## Acceptance criteria

1. A confirmed room reloads with the same stable ID, name, type, points, and derived area.
2. Closing and reopening the editor does not write to the room merely to display it.
3. An unreadable room is distinguishable from a plan with no rooms.
4. Accepted migration fixtures preserve identity and user-owned Markdown.
5. The create/select/reload journey passes in a live Obsidian vault.

## Assumptions

- “Reload” includes closing and reopening a leaf and restoring the workspace after Obsidian
  restarts.
- Selection need not survive a restart; persisted room data must.
- The room-creation flow owns what constitutes a complete room. This item proves its round trip.

## Sources

VS-09, WP7, and Scenario C in the
[editor vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md);
Phase 12 in the
[editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md).

## Amendments

**2026-09-05** — advanced to Done by the trust path increment
(`docs/superpowers/specs/2026-09-04-plan-editor-trust-path-design.md`), with **criterion 5
outstanding and named below**. No schema changed, no write path moved and no event was added: the
round trip is the Add Room increment's, and what this increment added is the reopen half of the
proof. Which test holds each criterion:

1. **A confirmed room reloads with the same stable ID, name, type, points and derived area.**
   `tests/infrastructure/persistence/editorRoundTrip.test.ts`'s 'reopening over the same vault
   bytes reads the room back whole' — a SIBLING case rather than an extension of the existing one,
   because the reopen needs its own stack: a fresh `stackFoundation` over the SAME `FakeVault`, so
   a fresh `ReconcilingProjectIndex`, a fresh **`EchoWindow`** and a fresh `PlanGeometryStore`,
   plus the `rebuildIndex()` the plugin runs at load. The fresh echo window is the part a
   `rebuildIndex()` on the original stack would NOT have given: `frontmatterOf` falls back to what
   this plugin last wrote while the cache lags, so a read through the WRITING stack can be answered
   by our own memory of our own write. The presentation half is
   `tests/presentation/views/planEditorView.test.ts`'s 'reopening the same plan shows the same
   room', which mounts `PlanEditorView` twice over real in-memory repositories — a static fixture
   literal cannot tell a reopen that re-read from one that replayed a constant.
2. **Reopening does not write merely to display.** The round-trip case reads the note's own bytes
   back and no save runs on the read path; the view-level reopen dispatches nothing.
3. **An unreadable room is distinguishable from a plan with no rooms.** Pre-existing and unchanged:
   `findZonesByPlan` answers `ok({ zones, unreadable })` and the editor draws the count, which
   [[A note that cannot be read]]'s own increment closed. This increment neither widened nor
   narrowed it.
4. **Accepted migration fixtures preserve identity and user-owned Markdown.** Held by the migration
   runner's own suite, and NARROWED where it matters: **every migration table in this repository is
   still empty**, so `migrateNote` has never executed a non-empty chain outside a synthetic
   fixture. This increment changed no schema, so it neither pays that debt down nor adds to it —
   CLAUDE.md's `MIGRATION_SET` account is the authority and carries the grep that re-measures it.
5. **The create/select/reload journey passes in a live Obsidian vault. — OUTSTANDING.**
   [[Reload a room]] is written, is in the smoke census and carries the restart as its step 5, and
   it has **not been run**. A `Done` status on this PBI asserts that every automatable half is held
   and that the instrument for the rest exists; it does not assert that anyone has walked it, and
   this criterion is the one place that distinction bites. An unrun manual case is a plan to find
   out, not a finding. See [[Walk a room reload in a live vault]].

Extensions: **4a** is criterion 3's. **4b** is criterion 4's, with its narrowing.
**4c** — a selection or draft naming no valid entity opens in safe Select with every valid room
drawn — is `planEditorView.test.ts`'s 'a leaf reopened onto a floor whose room is gone opens in
Select with every remaining room drawn', written from the REOPEN side because a restored view state
carries a plan id and nothing else (see [[Undo and redo]]'s own amendment for the measurement), and
`selectionRetirement`'s suite for the within-a-leaf half. The draft half is asserted by reopening
and finding no draft: the room draft store is per leaf and dies with it.

Two fixture facts the reopen cases turned up, worth knowing before the next one is written:

- **`stack.metadataCache.catchUp()` before the reopen scan.** Without it the round-trip case fails
  at the lookup: `FakeVault.pendingParse` models the parse LAG after a write, and a scan with a
  fresh `EchoWindow` asking a cache that has not reached the note finds none of ours. That is a
  true statement about the milliseconds after a save and NOT about reopening a vault, so the
  fixture drains the queue and says why.
- **`unavailablePlanEditorCommands()` refuses `zoneInspector` too, and that is a READ.** Selecting
  a room in the view-level reopen drew an empty Inspector body until that one member was made real.
  It is `planEditorRig`'s own recorded "a fake HARSHER than the real thing" trap met from a second
  direction; the write side stays the refusal bundle.
