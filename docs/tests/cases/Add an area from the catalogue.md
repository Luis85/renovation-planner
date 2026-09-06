# Add an area from the catalogue (M02)

Scope: Phase 3, Increment A. The numeric path extends PR #75 and its complete PR #74 history, retaining selection and
Escape regression cases. This is not acceptance of the entire editor roadmap.

## Browser fixture

Run `npm run harness` and open `?view=plan-editor&area` (optionally `&lang=de` or
`&theme=light`). This prepares an outline through Add and real pointer events. The visual
fixture refuses writes; use the repository-backed tests below for successful completion.

1. Start in Select, open Add, search `garden` / `Terrasse`, and activate Area / Fläche.
   The menu closes, the canvas receives focus and no record has been written.
2. Place at least three non-collinear corners. The temporary dashed outline stays separate
   from persisted geometry. Create area / Fläche erstellen becomes available.
3. Use the first-corner target, Enter on the canvas, and the Create area button in separate
   runs. Each completion must dispatch once, select the created Area, and return to Select.
4. Undo the creation and redo it. The same ID, Custom type, name and geometry return.
5. Enable Keep adding areas using keyboard Space. A successful completion clears the outline
   and keeps the tool active. Uncheck it and complete again: Select returns. Cancel and reopen
   Area: the checkbox must be off. Room repetition remains independent.
6. Try an empty outline and collinear corners. No command/history entry is created. A refused
   write preserves the outline and reports the existing save error; retry may complete it.
7. Open Add while an outline exists. Escape closes only Add. Close a constrained Details/Layers
   drawer with Escape: focus returns to its rail and the outline remains. A fresh Escape
   discards the outline, the next leaves the tool, and the next clears the selection.
   Held repeats must not cascade. Check both single and multiple list selections.
8. Cancel directly while drawing: one action returns to Select and preserves selection. Cancel
   during a submitted write and start a new task: the already submitted write may finish,
   but its response must not clear the new draft, change tools or replace selection.
9. Enter/Delete/Space/zoom keys in native fields and Enter on the repeat checkbox must not
   invoke canvas actions. Enter during pan, composition, autorepeat or a Ctrl/Meta/Alt chord must
   not close the shape. Canvas Escape retains pan priority.
10. Inspect light, dark, custom accent and German at 460 px. Check visible labels, focus,
    outline/first-corner marks, wrapped task controls and absence of horizontal overflow.

## Evidence and limits

| Run | Result |
|---|---|
| 2026-09-05 — `scripts/editor-area-check.mjs`, Edge 152.0.4191.62 | Real keyboard activation/search, repeat, Escape, Cancel and focus checks passed in four scenarios; no page errors or editor overflow. Screenshots visually inspected. |
| `tests/presentation/editor/areaCreation.e2e.test.ts` | Real mounted editor, commands and in-memory repositories: completion, invalid/busy/refused states, cancellation, repetition, Undo/Redo and keyboard ownership. |
| `tests/presentation/editor/areaPersistence.test.ts` | Actual Obsidian repositories over a fake vault: existing Custom frontmatter and sidecar geometry reload as Area. |
| `tests/harness/areaCreation.test.ts` | Scenario and scoped axe checks at 1280 and 460 px. |
| Live Obsidian and complete assistive-technology audit | Not run. Numeric corner input is covered separately below; this does not close live-vault or assistive-technology acceptance. |

Browser artifacts: `harness-shots/area-verification/`. Regenerate with
`node scripts/editor-area-check.mjs`; `RP_CHROMIUM_EXECUTABLE` may name an installed browser
when the pinned Chromium is unavailable. The report records the browser version actually used.


## Numeric keyboard scenario and acceptance

`?view=plan-editor&area=numeric` prepares a numeric outline through the real controls and uses
real Create/Delete Zone commands with ephemeral in-memory repositories. It supports successful
creation and document history; it is not a vault and loses its changes on reload.

1. Cancel the prepared task. Using only the keyboard, Tab to Add and press Enter. Shift+Tab
   reaches search from the recommended Room item; type `garden` / `Terrasse`, then Enter.
   Canvas receives focus. Tab to the coordinate disclosure; Enter opens it; Tab reaches x.
2. Enter x, Tab, y, Enter. Repeat for `(0, 0)`, `(4, 0)`, `(4, 3)` in metres. After each pair,
   focus returns to x, the ordered list and dashed canvas outline agree, and nothing is saved.
3. Edit the first corner to x = `-1,25`, y = `0` using a decimal comma. Add `(-1.25, 3)`, remove a
   corner, and correct another. The first/last edge closes implicitly; no duplicate closing
   point is needed. Verify mouse points can also be read and edited by this same form.
4. Try blank, nonnumeric, unit-suffixed, exponential, too-large and duplicate coordinates.
   Errors must explain correction. Pending values block Finish/Enter/first-corner completion
   until applied or explicitly discarded. Removing down to two points or a collinear outline
   prevents completion. Test values below half a millimetre and a signed coordinate.
5. Tab through x → y → Apply → Discard → row Edit/Remove → repeat → Create area → Cancel.
   Focus is visible, errors are associated with fields, and no control is lost after removal.
   On narrow layouts the form scrolls to focused controls without horizontal overflow.
6. Enter in a field applies a pair; Enter on Create area completes it. Native Escape/Delete/
   Backspace/Space, chords, composition and held Enter must not perform canvas actions.
   Field Escape retains input. Button Escape clears the nearest applied draft; a subsequent
   press exits the tool — from a row's Edit/Remove too, where the clear removes the focused
   button and focus lands on Apply. Add and constrained drawers close before that route can
   discard work.
7. Create, undo and redo. One Area/ID/geometry is restored through the existing history.
   Enable repeat with Space, create again and check that only the outline/input resets.
   Leave and reopen: repeat is off and pending text is gone, even if no corner was applied.
8. Retest pointer Area completion and both pointer/numeric Room creation. Run the existing
   single/multiple selection, overlap, Inspector and Escape suites unchanged.

| Run | Result |
|---|---|
| 2026-09-05 — `scripts/editor-area-numeric-check.mjs`, Edge 152.0.4191.62 | Keyboard-only activation, coordinates, error correction, create, Undo/Redo, explicit repeat, cancellation and field/button Escape passed in light, dark, custom accent and German 460 px; no page errors or editor/form horizontal overflow. Mouse Room drag and Area first-corner completion also passed in each scenario. Screenshots inspected. |
| `areaNumeric.e2e.test.ts` / `add/areaCornerInput.test.ts` | Real editor/repositories plus focused numeric/tool tests for shared points, precision, pending/busy/refused input, cancellation, native keys and history. |
| `tests/harness/areaCreation.test.ts` | Numeric fixture at 1280/460 px, scoped axe, real in-memory create/Undo/Redo; original pointer fixture retained. |
| Live Obsidian, screen reader and full theme acceptance | Open; browser results above do not certify these environments. |

Artifacts: `harness-shots/area-numeric/`. Reproduce with
`node scripts/editor-area-numeric-check.mjs`; the report records the actual browser version.
