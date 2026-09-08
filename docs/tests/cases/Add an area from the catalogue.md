# Add an area from the catalogue (M02)

Scope: Phase 3, Increment A. The Area path extends PR #74 and retains its selection and
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
| Live Obsidian and complete assistive-technology audit | Not run. Corner placement currently requires a pointer; an accessible numeric corner route remains open. |

Browser artifacts: `harness-shots/area-verification/`. Regenerate with
`node scripts/editor-area-check.mjs`; `RP_CHROMIUM_EXECUTABLE` may name an installed browser
when the pinned Chromium is unavailable. The report records the browser version actually used.
