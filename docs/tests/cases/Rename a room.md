---
type: Test case
parent: "[[Smoke Test the Editor]]"
sources:
  - M03-add-room
  - ADR-0016
  - ADR-0018
  - SDD sections 27, 42, 59, 82, 83, 101
status: Ready
---

# Rename a room

Scope: Phase 4 / Increment B's existing-room naming gap. Start with a saved Room and a linked
requirement; repeat with an irregular Room and a second Room using the same name. The browser
fixture is `npm run harness` → `?view=plan-editor&rename=room`. It uses real commands with
ephemeral in-memory repositories; reloading resets it. `node scripts/editor-room-naming-check.mjs`
runs the keyboard/theme/layout matrix. `RP_CHROMIUM_EXECUTABLE` can explicitly name an installed
Chromium-family executable when the pinned browser is absent.

| Reachable by | Action | Expected result |
|---|---|---|
| suite + browser | Select Kitchen from the persistent list using Tab/Enter, then Rename room; repeat selection by canvas (suite) | Same selected ID; contextual Rename room action; name input receives focus |
| suite + browser | Type a name, then Tab through Apply name and Cancel | Text remains local; Tab wraps to Name; blur does not write |
| suite + browser | Submit whitespace-only text | Inline translated error, first invalid field focused, raw text retained, no write/history |
| suite + browser | Submit the original name with outer whitespace | No dispatch or history; identical after the existing trim rule |
| suite | Use the same name as another Room, punctuation and an irregular/triangular Room | Allowed; stable IDs, geometry and classification preserved; no filename restrictions introduced |
| suite + browser | Use Space, Delete, Backspace and arrows in Name; plain Enter to Apply | Native input edits; one submission; no canvas action; modified/composed/held Enter does not resubmit |
| suite + browser | Escape or Cancel with a dirty draft, then reopen | Original persisted name, selection intact, focus restored to opener |
| suite + browser | Apply a new name, Undo, Redo | Exactly one reversible change; local list/Inspector and canvas labels update; the Room ID stays the same |
| suite | Rename and move/resize, then Undo both and Redo both | The shared ledger supplies current expectations; name and geometry reverse independently |
| suite | Change the Room elsewhere while the form is open | Apply refuses; draft/baseline retained; current saved name or unavailability shown; Cancel/reopen required for a new baseline |
| suite | Repeat Apply/Enter and Cancel/Escape while saving | One save; readonly field; controls remain focusable but inoperative; no text loss |
| suite | Refuse/throw a save, fail readback, delay the initial read, dispose or replace a dialog during submission | Failure retains text; confirmed write plus failed refresh pauses writes; refresh never replays the write; retired responses do not open/resolve another task |
| suite + browser | Reflow full ↔ 460 px while typing; close the form | Draft/input focus survives; closing returns focus to replacement action or Details rail |
| suite + browser | Light, dark, custom accent, German 460 px | Readable labels and controls, no dialog overflow or browser page errors; scoped axe violations absent in suite |
| suite | Save through Obsidian repositories over FakeVault, then rebuild with fresh index/echo/store/repository objects | Same note path and Zone ID, new name, unchanged geometry entries and v1 metadata keys; user body retained; reads cause no write |
| suite | External note edit / sidecar write failure | Expected-observation refusal / existing compensating transaction restores the original note |
| obsidian | Repeat Apply/Undo/Redo on disk, inspect linked requirements and manually authored links | Only name and existing revision bookkeeping change; no renamed file, rewritten link, new ID or format; linked quantities/costs unchanged |
| obsidian | Close/reopen the editor, then fully restart Obsidian | Renamed Room returns once under the same ID/path; read alone changes no revision |
| obsidian | Resize/rebind/close the actual leaf during typing and saving | Layout preserves the draft; forced disposal may allow an already submitted write to finish, as for other forms |
| desktop | Complete with a screen reader in English and German | Baseline, field label, validation, conflict and busy announcements understandable; Tab/focus restoration usable |

## Runs

| Date | Environment | Outcome |
|---|---|---|
| 2026-09-06 | Real Edge 152.0.4191.62, memory harness | Keyboard matrix passed in light/dark/custom accent and German 460 px; four captures visually inspected; no page errors or dialog overflow |
| 2026-09-06 | Automated editor/command/harness and FakeVault repository suites | See the implementation ledger for exact checks and coverage; this is not a live-vault run |
| — | Live Obsidian and screen reader | Not run; acceptance remains open |

Existing Room/Area creation, dimensions and multi-selection retain their regression suites.
The open #76 Area corner-row Escape focus finding is inherited and separate from this form.
Phase 4, Increment A/B and the overall implementation plan remain open.
