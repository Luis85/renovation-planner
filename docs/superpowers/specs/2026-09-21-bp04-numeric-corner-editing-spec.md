# Typing a zone corner's position — the interaction, reconciled with what shipped

Date: 2026-09-21 · Written against commit `0ad89aea3` · Branch `renovation-planner-beta-handoff-e80bb5`.

This is `docs/releases/first-beta-readiness/01-improvement-plan.md` BP-04 **Action 1**: *"write a
short interaction specification that reconciles the existing design decisions."* It is written
**from the code**, after slices A, A2 and B landed, so every clause below is a description with a
citation rather than a requirement waiting for an implementer. Where the code does not meet
BP-04's own wording, the clause says so in those words.

It uses the **existing dialog/form pattern** (`dialog-store`'s `FormDescriptor`, the shared
`OutlinePointsForm`) and specifies **no Inspector redesign** — Action 1 rules that out in its own
sentence, and the one presentation gap this document records (§8) is deliberately left unfixed.

**No claim here about appearance, device, screen reader or contrast.** Nothing on this branch has
been run in an Obsidian vault. Every citation is source text or a jsdom/headless result.

---

## 1. The interaction, as shipped

BP-04's contract line is *select one Room/Area → choose **Edit corners** → choose a numbered
corner → enter its position → preview → Apply or Cancel.* What ships:

| Step | Shipped | Citation |
| --- | --- | --- |
| Select one zone | Single selection, `select` tool, no dialog already open, writes not blocked | `src/presentation/editor/roomEditLifecycle.ts:43` (`available`) |
| **Edit corners** | Two doors, one function. Inspector button and canvas-menu entry both call `runtime.zoneOutline.editZoneOutline(id)` and neither builds a dialog or re-decides acceptance | `src/presentation/editor/resize/ZoneOutlineAction.vue:28`; `src/presentation/editor/selection/useCanvasMenuActions.ts:88` |
| Every zone type | `accepts: () => true` — a Garden takes the same path as a Room; "Room and Area" is the UI's pair of words for the whole `ZoneType` vocabulary | `src/presentation/editor/resize/zoneOutlineAction.ts:44` |
| Choose a numbered corner | One `<li>` per corner, each reading `Corner {n}: X {x} m, Y {y} m`, with an **Edit** control carrying `aria-label="Edit corner {n}"` and `aria-pressed`; a `role="status"` region names whichever is chosen | `src/presentation/editor/resize/CornerChooser.vue:44-70` |
| Enter its position | Every corner's X and Y fields are rendered at all times; choosing a corner moves focus into that corner's X field rather than hiding its siblings | `OutlinePointsForm.vue:57-61`, `:117-145` |
| Preview | `watchEffect` pushes the proposed polygon to the canvas on every keystroke | `OutlinePointsForm.vue:64` |
| Apply | One submit button reading **Save** / **Speichern** (`dialog.form.submit`, `src/presentation/i18n/locales/en.ts:291`, `de.ts:265`) | `OutlinePointsForm.vue:152-159` |
| Cancel | The dialog host's own control; unmount clears both the preview and the corner mark | `OutlinePointsForm.vue:44` |

**Corner numbers are transient.** The chosen index lives in the form (`chosen`,
`OutlinePointsForm.vue:45`) and in `render-state.ts:131`'s `highlightedVertex`, and is cleared on
unmount. Nothing persists a corner identity, which is what BP-04's contract line asks for.

**The perspective guard is asymmetric, deliberately.** The menu door carries it through
`GEOMETRY_ACTIONS` (`useCanvasMenuActions.ts:47`); the Inspector door carries none, because
`EntityInspector` routes Renovate and Review to `RenovationInspector`, so the button only mounts
in Plan (`ZoneOutlineAction.vue:10-13`). That is a difference in *reach*, not a second acceptance
decision — the one `accepts` lives in `zoneOutlineAction.ts:44`.

---

## 2. Coordinate system (BP-04 Action 2)

The convention users read is one string, in both locales, and it is the authority for what ships:

> `editor.area.coordinates-hint` — *"Positions in metres from the plan origin (0, 0), with X
> increasing to the right and y downwards. Zero and negative values are allowed. Use a decimal
> point or comma; input rounds to whole millimetres."*
> (`src/presentation/i18n/locales/en/editor.ts:193`; German at `de/editor.ts:172`.)

Reconciled against the code and against **ADR-0009** (`docs/development/adrs/0009-world-coordinates-in-millimeters.md`):

| Fact | Where it is decided | Where it is stated to the user |
| --- | --- | --- |
| **Unit**: 1 world unit = 1 millimetre, canonical and mandatory; a sidecar must carry `"unit": "mm"` and a loader fails closed on any other value | ADR-0009 (Decision) | The hint, as "metres" — the dialog's *display* unit. Field labels are `X position (m)` / `Y position (m)` (`en/editor.ts:194-195`) |
| **Origin**: the plan origin, `(0, 0)` | Not in ADR-0009 | The hint |
| **Positive axes**: +X right, +Y **down** | `worldToScreen` applies a positive scale with no Y flip (`src/presentation/editor/viewport/Viewport.ts:108-111`) | The hint |
| **Internal precision**: integer millimetres for a **typed** value — `Math.round(metres * 1000)`, refused when the result is not a safe integer | `src/presentation/editor/shell/formatLength.ts:107-112` | The hint's "rounds to whole millimetres" |
| **Internal precision of an untouched value**: whatever was loaded, sub-millimetre included | `outlineProposal.ts:9-19` — an axis with no edit is copied, never re-parsed | Not stated to the user, and correctly so: see §4 |
| **Display**: `en-US` grouping-free metres, round-trip safe | `formatMetres`, `formatLength.ts:60-72` | — |

**ADR-0009 defines the unit and nothing else.** Origin and axis directions are defined *only* in
the shipped string. This document does not change that; it records where each half lives so the
next reader does not look for the origin in the ADR and conclude it is undecided. **No amendment
to ADR-0009 is made here** — the brief forbids editing an ADR in place, and an appended amendment
restating a UI string would be a second authority for it.

**Relative movement** is optional in Action 2's own wording ("Absolute X/Y is the minimum path")
and is **not shipped**. Absolute is the only mode.

**Copy nit, EN only (reported, not fixed).** The hint writes `X` uppercase and `y` lowercase in
one clause, while both field labels in the same dialog are uppercase and the German string uses
`X` and `Y`. One character. German copy is not touched (L-15).

---

## 3. Choosing a corner, and the preview (Action 3)

- **Highlight is one corner.** `render-state.ts:131`'s `highlightedVertex` is an index into the
  zone's *saved* outline; `InteractionLayer` draws that one vertex handle larger than its
  siblings. Its docblock records why it is a second field rather than a richer `previewPolygon`
  (`SelectTool` is that field's other writer).
- **Preview is the adjacent geometry.** `previewPolygon` carries the whole proposed corner list;
  the layer joins it with the selected zone's saved bulges, so a curved zone previews as the shape
  it would save.
- **Opening the form saves nothing, and changing the chosen corner saves nothing.** `choose()`
  sets state and moves focus (`OutlinePointsForm.vue:57-61`); the only write is `form.submit()`.
- **A cancelled dialog leaves no mark.** `onBeforeUnmount` calls `preview(null)` and
  `highlight(null)` (`:44`).
- **The list and the highlight cannot arrive without each other**: passing the single optional
  `highlight` prop is what draws `CornerChooser` at all (`:111-116`, and the prop's docblock at
  `:25-42`). The same form is mounted without it by `elements/elementEditPresentation.ts`, which
  draws no list.

---

## 4. Input, and what is validated (Action 4)

**Untouched means untouched.** `outlineProposal` keys on `undefined`: an axis with no entry is
copied from the loaded point, never re-read from its rounded display
(`src/presentation/editor/resize/outlineProposal.ts:6`, `:9-19`). A retyped value is a new value
even when it equals what was displayed. Driven by
`tests/presentation/editor/resize/outlineProposal.test.ts:5-10` (`x` rounds to 1234 while the
neighbouring untouched `y: -765.4` passes through unrounded).

**Canonical validators, in order**, all reached through the default `accepts`
(`outlineProposal.ts:7` — BP-04's dialog is the one mount that passes none of its own):

1. `parseCoordinateMetres` — trims, maps the first comma to a point, refuses anything outside
   `/^(?:-?(?:\d+(?:\.\d+)?|\.\d+)|Infinity)$/`, rounds to millimetres, refuses a non-safe-integer
   result (`formatLength.ts:97-131`). Zero and negatives are accepted; this is not a side length.
   A per-field message renders through `FieldError` (`editor.area.coordinate-invalid`).
2. `createPolygon` / `validatePolygonPoints` — at least three vertices, finite coordinates, one
   predicate shared with every area and perimeter call (`src/core/geometry/Polygon.ts:26-46`).
3. `areaOutline` — the outline must enclose a measurable surface (`polygon-zero-area`)
   (`src/presentation/editor/add/areaOutline.ts:8-14`).
4. **`outlineCrosses` — since 2026-09-21, this dialog refuses a self-crossing outline.**
   `simpleAreaOutline` is `areaOutline` then the crossing rule
   (`src/presentation/editor/add/simpleOutline.ts:88-91`), and `outlineProposal`'s default
   `accepts` is `simpleAreaOutline(...).ok`, so typing a corner across the far edge yields no
   proposal and no write. Pinned by `outlineProposal.test.ts:16-20`.

   Read that check as narrowly as its own docblock writes it (`simpleOutline.ts:9-44`): it judges
   **proper crossings only** — every degenerate contact a real edit makes (shared corner,
   duplicated vertex, collinear midpoint, vertex on an edge) is accepted, because none of those
   makes the shoelace area lie. It judges **chords, not arcs**; a curved zone's bulges are
   re-attached downstream, and the silent-miss direction is caught at core by
   `validateCurvedBoundary`. And it is **write-only**: a vault already holding a crossing outline
   still loads and still draws.

**The refusal message is generic and is a copy defect (reported, not fixed).** When no proposal
exists, `OutlinePointsForm.vue:146-151` renders `editor.resize.invalid` — *"Enter valid dimensions
that can describe this room."* That sentence says **dimensions** in a dialog about coordinates,
says **room** in a dialog that also edits Gardens and Terraces, and is now also what a
self-crossing refusal shows. See §9.

---

## 5. Curved edges (Action 5)

**The policy is the one corner dragging already uses, because it is literally the same function
in the same command.**

- The form sends **points only** — `dispatch` builds `{ kind: 'geometry', forward: polygon, … }`
  from a bare `Polygon` (`zoneOutlineAction.ts:56`).
- `inspector-wiring.ts:104-109` turns that into a `ReversibleMoveZoneCommand`, the same reversible
  adapter a canvas gesture uses.
- `MoveSpatialObjectCommand` runs every incoming geometry — dragged or typed — through
  `preservePointCurves` (`src/application/commands/zone/MoveSpatialObject.ts:85`).

`preservePointCurves` (`src/core/geometry/CurvedPolygon.ts:48-52`) is three lines and the whole
policy:

1. If the caller supplied bulges, or the original has no curves, pass through unchanged.
2. If the **point count changed**, refuse with `curve-topology-ambiguous` — *"Straighten the
   curved edges before adding or removing corners."* That is Action 5's "specific explanation"
   rather than a silent conversion.
3. Otherwise re-attach the original bulges **by index**.

So a typed correction on a curved zone keeps its curves, and never flattens one. The
topology arm is **unreachable from this dialog**: `OutlinePointsForm` renders one fieldset per
loaded point and offers no add or remove, so the count cannot change here. It is driven end to end
by `tests/application/commands/curvedGeometry.test.ts`.

Winding is not normalized anywhere (`Polygon.ts:49-54` records that as deliberate), and
`MoveSpatialObjectCommand` writes geometry and optionally `labelOffset` and nothing else — so
independent walls are not reshaped and no other field moves.

---

## 6. The write (Action 6)

- **One guarded command against the captured baseline.** `createRoomEditLifecycle` loads the zone
  once, keeps its version, and passes `expected: version` to every commit
  (`roomEditLifecycle.ts:51-67`; `zoneOutlineAction.ts:56`). A peer edit between open and submit
  reaches the conflict arm rather than disk, and the version spans **both** of the zone's files —
  a sidecar edited out of band is a conflict too.
- **A stale draft is refused** and the dialog stays open with its text: `commit` returns
  `staleWriteRefusal()` when the generation moved (`roomEditLifecycle.ts:59`), and on a
  write-boundary code it refreshes and shows `editor.area.latest`.
- **Cancel creates no history**: there is no dispatch on unmount.
- **A no-op submission creates no history**: `changed` compares the proposed points against the
  loaded points, and `disabled` includes `!changed` (`OutlinePointsForm.vue:66-67`), with
  `submit()` returning early when disabled (`:77`).
- **Naming, references, group membership and ordering survive by construction**:
  `Zone.withGeometry` spreads the existing fields, and the command touches nothing else.
- **Undo** restores the prior geometry through the same `ReversibleMoveZoneCommand` the canvas
  uses; `inverse` is the loaded polygon.

---

## 7. Reconciliation with the 2026-09-12 side-panels design, §3

Resolved from **both** sides. The other side now carries Amendment 1 pointing here.

**What §3 says** (`docs/superpowers/specs/2026-09-12-plan-editor-side-panels-design.md:170`): the
Inspector's Actions region carries "stacked action rows (Rename room, Change room size, **Edit
outline coordinates**, curve and renovation entries)", under §3's opening invariant that
`data-rp-action` hooks, heading levels and every command path are **unchanged** (`:143-145`).

**Two narrowings of the controller's reading, measured:**

- §3 names the row by its **label**, not by `data-rp-action="edit-outline"`. That attribute is
  carried into §3 only by the blanket "hooks are unchanged" invariant. The component that existed
  on that date did wear it — `git show d77dff4bd^1:src/presentation/editor/resize/OutlineEditAction.vue`.
- The spec was committed at `35db38400`, **2026-09-12 00:20**; PR #149 (`d77dff4bd`,
  `claude/remove-edit-shape-feature`) merged **2026-09-12 13:51** and deleted
  `OutlineEditAction.vue`, `outlineEditAction.ts`, the menu entry, both locales' strings and two
  test files. So the spec specified a row that was removed about thirteen hours later.

**What shipped instead.** BP-04 slices A, A2 and B rebuilt the route rather than restoring it:

| §3, 2026-09-12 | Shipped, 2026-09-21 |
| --- | --- |
| Row labelled "Edit outline coordinates" | Row labelled **Edit corners** (`editor.area.outline`) |
| `OutlineEditAction.vue` → `runtime.outlineEdit.editOutline` | `ZoneOutlineAction.vue` → `runtime.zoneOutline.editZoneOutline` |
| Room-shaped (the row sat in the Room skeleton) | Every zone type; mounted for the `room` **and** `area` record kinds (`SpatialInspectorActions.vue:51-54`) |
| Inspector row only | Two doors: Inspector row **and** canvas-menu `edit-outline` entry |
| `data-rp-action="edit-outline"` | `data-rp-action="edit-outline"` — unchanged, which is why focus restoration and §3's invariant still hold |

**Verdict: §3 is the stale side**, on the label and on the ownership, and it is stale in a way that
reads as settled — a reader of §3 alone would go looking for `outlineEditAction.ts`. The `edit-outline`
hook it depends on is the one thing that did survive. Its Amendment 1 says this and points here.

**One pointer is owed in the other direction and is NOT written here.** Action 1's brief asks that
the shipped code carry a pointer back to the spec; this task may not modify `src/`. The three
modules that would carry it — `ZoneOutlineAction.vue`, `zoneOutlineAction.ts`,
`useCanvasMenuActions.ts` — already cross-reference each other and this document names them, so
the contradiction is now findable from both documents. The code-side pointer is an open item, not
a silent omission.

---

## 8. Acceptance and coverage — a prior finding, cited, not re-derived

`.superpowers/sdd/01-improvement-plan/s12-acceptance-audit-report.md` (session 12, read-only,
audited at `1f2cf7cf8`) is the authority for BP-04's acceptance and test-list grading. Its own
numbers:

- **Acceptance, six criteria: all six met. Five are checked by a gate**; A3's second half
  ("relationships remain unchanged") is true by construction and rests on reading (§1 of that
  report, and its closing "Net" line).
- **The twelve named tests: 8 covered, 3 partial, 1 absent** (its §2 "Net" line).
  - Partial — **rotated room**: covered at the pure-function level only; nothing drives the
    dialog or the command over an off-axis outline.
  - Partial — **one history entry**: undo and redo are checked; stack depth and
    "dispatched exactly once" are not, so two identical entries would pass.
  - Partial — **constrained-layout focus**: the 460 px *layout* half is reached by
    `tests/harness/zoneOutline.test.ts`; the *focus* half has no `document.activeElement` read at
    that width, and the *visual* half is ungradeable in jsdom (L-27).
  - Absent — **fresh repository reload**: every BP-04 case reads back through
    `InMemoryZoneRepository`, which serializes nothing, so no assertion has seen a typed
    coordinate survive the note-and-sidecar format.

**Two of that report's four headline items have since been settled and one has not:**

- Its §0.2, the submit button reading **"Apply name"**, was fixed on 2026-09-21 (`78b851ab2`);
  the button now reads `dialog.form.submit` — **Save** / **Speichern**.
- Its §0.4, "Action 1 has no artefact", is closed by this document.
- Its §0.1 — the menu-door assertion titled *"on every zone type"* driving only a `Room` — and
  its §0.3, the absent reload case, were not addressed by any commit on this branch and remain
  open. Neither is an unmet Action; both are coverage narrower than a claim.

**The brief that commissioned this document states "6/6 acceptance and 10 covered / 2 partial /
0 absent". That does not match the report.** The report's own totals are quoted above. Flagged
rather than reconciled: the report was not re-run.

---

## 9. Known gaps, carried rather than closed

1. **"Edit corners" has the weakest affordance in the Details panel.** Observed by the controller
   from the `plan-editor-selected-narrow` capture
   (`scripts/harness-shot.mjs:584`, which waits on
   `.rp-inspector-drawer [data-rp-action="edit-outline"]`), and corroborated in the stylesheet:
   `styles/editor-inspector-skeleton.css:51-68` gives every `.rp-inspector-action` a transparent
   32 px row with no border and no chevron, while `:85-101` gives
   `[data-rp-action='resize-room']` alone 44 px, semibold, a border and a filled accent-mix
   background. `SpatialInspectorActions.vue:35-54` renders `RoomSizeAction` immediately above
   `ZoneOutlineAction`, so BP-04's route sits directly beneath the panel's heaviest control and is
   its lightest. Each of three agents asked separately whether the filled button was correct said
   yes; the problem only appears with the whole panel in view.
   **Not fixed here.** A visual change is a slice of its own and Action 1 is not it.
2. **The dialog's own actions row is unphotographed.** The three `plan-editor-outline*` captures
   (`harness-shot.mjs:505-507`) show the corner list, but at both 1280 and 460 the list overflows
   and the actions row is below the fold. No picture shows the submit button. Anything about that
   row's appearance is unverified, in this document and everywhere else.
3. **`editor.resize.invalid` is the wrong sentence for this dialog** (§4). It names dimensions and
   rooms in a dialog about coordinates on any zone type, and it is now also the self-crossing
   refusal's text. EN copy may be changed; the German would need the owner (L-15).
4. **`editor.area.coordinates-hint` writes `X` and `y` in one clause, EN only** (§2).
5. **The dialog title is a borrowed key.** `editor.element.edit` ("Edit {name}") titles a zone
   dialog (`zoneOutlineAction.ts:51`); both locales are generic enough to be correct, and a
   purpose-built key is recorded as an owner copy item (controller ruling R-S10-1).
6. **Nothing here has been run in an Obsidian vault.**
   `docs/tests/cases/Edit a zone corner by typing its position.md` is the instrument, and its
   sixteen steps are unrun. That case predates §4's self-crossing refusal and has no step for it.

---

## Records

- `docs/superpowers/specs/2026-09-12-plan-editor-side-panels-design.md` gains Amendment 1 pointing
  here (§7).
- No ADR is edited; ADR-0009 stands as written (§2).
- No file under `src/`, `tests/`, `styles/` or `scripts/` is changed by this document.
