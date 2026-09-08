---
type: Test case
parent: "[[Smoke Test the Editor]]"
sources:
  - M03-add-room
  - ADR-0018
  - SDD sections 20–26, 59, 101
status: Ready
---

# Resize a room

Scope: Phase 4 / Increment B's existing four-corner axis-aligned Room dimensions. Start from a
saved Room; test with a linked area-based requirement as well. Browser reproduction is
`npm run harness` → `?view=plan-editor&resize=room` (ephemeral memory, no vault files).
Use `node scripts/editor-room-resize-check.mjs` for the real keyboard matrix; set
`RP_CHROMIUM_EXECUTABLE` to an installed Chromium-family executable if the pinned browser is absent.

| Reachable by | Action | Expected result |
|---|---|---|
| suite + browser | Tab to Kitchen in the persistent list, Enter, then Change room size. Also select by canvas | Same Room ID and Inspector action; Width receives focus |
| suite + browser | Enter `bad` / `0`, then submit | Text retained, both fields described as invalid, first invalid field focused, no write |
| suite + browser | Type width `4,2`, Tab, depth `3.5`, Tab | Apply follows Depth; preview reports 4.2 × 3.5 m and 14.7 m², original persisted geometry/figures untouched |
| suite + browser | Tab through Apply, Cancel and back; type Space, arrows, Delete/Backspace in a field | Native form navigation/editing, no canvas gesture, modal focus trapped |
| suite + browser | Cancel or Escape before submission; reopen | No history/write; original dimensions; selection intact and focus on opener |
| suite + browser | Apply once; Undo and Redo | One reversible write; same ID/type/name/selection; geometry and area follow the change |
| suite | Link an area-based asset, preview, Apply, Undo/Redo | Quantity/cost unchanged during preview, recalculated after each persisted geometry change |
| suite | Repeat Apply/Enter, try Cancel during a deferred write | One dispatch, readonly fields, focusable inoperative actions; busy Escape cannot cancel |
| suite | Cause refusal, unexpected fault, peer version change or failed readback | Draft/error retained on failed write; no peer overwrite; success plus failed readback pauses writes, refresh never replays Apply |
| suite | Close the leaf or change selection while a baseline read is pending | Late read opens no retired dialog; a late submit does not resolve a new task |
| suite | Reverse winding/change first corner; use sub-mm original sides; try rotated/irregular outlines | Supported rectangles retain winding/order/min corner and untouched precision; unsupported shapes are explained, never boxed |
| suite + browser | Repeat in light/dark/custom accent and German at 460 px | Labels/controls readable, no dialog overflow, existing root dialog retained across panel placement |
| obsidian | Repeat on real files; inspect Markdown and `.rpgeo`, then close/reopen and restart | One Room ID and one sidecar entry, updated points, no new width/depth/area/type fields; read alone does not bump revisions |
| suite + browser | Change between full and constrained layouts with a dirty form, then Cancel/Escape | Text retained; focus returns to the replacement action or Details rail if the original opener was removed |
| obsidian | Resize the leaf while the form is dirty; rebind settings/close leaf during saving | Normal layout change preserves form; forced disposal has the documented limit (an already submitted write may complete) |
| desktop | Repeat with a screen reader | Current size, units, errors, preview, busy state and restored focus are understandable; announcements are not excessive |

## Runs

| Date | Environment | Outcome |
|---|---|---|
| 2026-09-06 | Automated suites and actual Edge browser, in-memory harness / fake-vault repository stack | Automated and browser results are recorded in the implementation ledger; these are not live-vault acceptance |
| — | Live Obsidian / screen reader | Not run; manual acceptance remains open |

Creation, repeat, selection and Area regressions retain their existing tests. The outstanding
#76 Escape-on-removed-corner-row focus issue belongs to that base PR and remains disclosed.

Existing-room naming has its own bounded case, [[Rename a room]]. Its checks do not complete this
case's outstanding live-vault or assistive-technology acceptance.
