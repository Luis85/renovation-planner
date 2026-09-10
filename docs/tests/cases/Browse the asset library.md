---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 86
sources:
  - docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md §3
  - docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md §4
  - docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md §6
  - docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md §7
  - docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md §9
status: Ready
---

# Browse the asset library

§3's whole surface walked in a real vault — the shelves, the row, the mark, the inspector,
§6's search and keyboard, §7's three widths — and the sibling of
[[Open the Asset Library]], which covers the view's Obsidian LIFECYCLE and deliberately
excludes all of this. This case is what that one's *Deliberately NOT checked* list defers.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a
library holding **at least fifteen assets across four or more categories**, at least one of
them priced in a currency other than the rest and at least one with neither a supplier nor an
SKU. A three-asset library cannot exercise a single row in the table below: every finding
`npm run harness-shot`'s own captures produced needed a full shelf to be visible at all.

**What this case is FOR, stated narrowly.** `tests/harness/accessibility.test.ts` grades
roles, accessible names, form labels, heading order and ARIA validity over `contentEl` in
jsdom. It grades **no** colour contrast, **no** focus-indicator visibility and **no**
hit-target size — jsdom has no rendering engine, and §9's closing paragraph says so in as
many words. `npm run harness-shot` closes part of that gap and its limits are their own: this
container holds no pinned Chromium, so the seven library captures were taken with the
provisioned build named through `RP_CHROMIUM_EXECUTABLE` and are **approximate**; and a
capture is a picture, so it cannot press a key, tab to a control or survive a restart. Every
row below is one of those three things.

## Steps

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `judgement` | Open the asset library on a full catalogue and read the shelves | Each shelf heading names a category and carries its count; an empty declared shelf reads as room rather than as clutter | §3.2's derived shelf list. The capture says it looks right at 1280 and 460; a themed vault is where the borders and the muted counts are actually legible |
| 2 | `browser` | Run an eye down the price column | Every amount's decimal point sits on one vertical line | **Fixed by Task A2** (commit `7f80a948`, price column alignment): the amount renders in its own right-aligned grid track with `font-variant-numeric: tabular-nums`, and Task A6 (commits `aa89abb7`, `23dbc269`) pinned the amount and unit tracks to fixed `11ch`/`6ch` widths at every container width, so an independent per-row grid can no longer disagree with its siblings. Measured (Task A6): amount right-edge spread is `0px` at 1440, 720 and 560 — was 22.3px, eight rows measured at 750.7, 764.7 and 773.0 |
| 3 | `judgement` | Look at the leading mark on every row of an OPEN shelf | Five distinguishable pictures across the catalogue: measured, unscaled, none, not-yet-read, unreadable | **The wiring gap is CLOSED (Task 17b)** — `outline-for` is bound and required, and `AssetLibraryBody.drawnAssetIds` feeds the batch. `asset-library-light.png` now draws four of the five states, across five rows of the two open shelves: a long thin bar (Oak plank floor, measured), a square (Porcelain tile, measured), a dashed square (Base cabinet, unscaled), an empty slot (Wall paint, none) and a struck box (Tile adhesive, unreadable). Read that as APPROXIMATE — the substitute Chromium, and not a vault. What the row still has to settle is the JUDGEMENT the capture cannot: whether those pictures are distinguishable at 20px to an eye that has not been told what to look for. *Not yet read* is the one state a resting capture cannot show, because the harness answers every outline at once |
| 4 | `suite` | Compare a shelf heading, the inspector's Category dropdown and the New asset dialog's Category dropdown for one asset | All three name the category the same way | **Fixed by Task A1** (commit `e1a27719`, unit symbols; commit `4e6e941c`, locale housing): the shelf row's unit now resolves through `MEASUREMENT_UNIT_SYMBOLS` via `tr` (m², m, m³, and localized words for piece, hour, day, fixed) instead of the raw `MeasurementUnit` key — was: the row printed the raw key `m2` beside `MEASUREMENT_UNIT_LABELS.m2`'s translated `Square metres` elsewhere. The category half of this row's original claim did not hold against the code at any commit on this branch: `optionLabel` in `AssetInspectorFields.vue` already resolved a declared category through `tr(ASSET_CATEGORY_LABELS[...])`, so the shelf, the inspector's `<select>` and `NewAssetForm` already named the category the same way; only the unit half was the real defect |
| 5 | `browser` | Tab from the search field through the toolbar, a shelf heading, a row, and into the inspector | Every stop shows a visible focus ring, and the ring is legible against what it sits on in BOTH colour schemes | 1.4.11's 3:1 floor. Obsidian's own `:focus { outline: none }` reaches every one of these controls and each opts its ring back in per control; nothing here measures whether the accent clears the floor against `--background-secondary` |
| 6 | `browser` | With focus on a row, press ↓ and ↑ repeatedly through a COLLAPSED shelf's position | Focus skips the collapsed shelf's rows entirely and lands on the next visible row | §6.2, and `shelfFocus.ts` filters rather than walks. jsdom lays nothing out, so *"is this row laid out"* is a question no test in this repository can ask honestly |
| 7 | `browser` | Point at a row, a shelf heading, and the inspector's Category and Unit dropdowns; measure each target **in Obsidian**, and compare the two dropdowns against the seven inputs beside them | Rows and shelf headings clear 24px, and whatever the two `<select>`s measure is the same height as the `<input>`s in the same grid | WCAG 2.5.8, which §9 binds by name. **The harness measurement is 30px for rows, shelf heads and inputs and 18px for the two dropdowns — and it is NOT settled**, which is why this step re-takes it rather than asserting it: `tests/harness/obsidian.css` declares the `--dropdown-*` variables and carries no `select` rule at all while it DOES pad `input[type='text']`, so the split may be the vendored sheet's gap rather than ours. That sheet's own header warns of exactly this. A vault is the only place the two causes come apart |
| 8 | `suite` | Type into the search field and watch the shelves | The flat *Results* list replaces the shelves, ordered by name across categories, and the count is written into the `role="status"` region | §6.1. The pass condition is deliberately DOM state and not *"is announced"*: whether a screen reader speaks it is settled by no instrument this repository has, so it sits in *Deliberately NOT checked* below rather than inside a `suite` verdict it would contradict |
| 9 | `browser` | With a search running, read the row layout | The result row's five slots line up with the shelved row's | §12 records a sixth child landing one column out of place in the mock; the shipped result list is the same `.rp-al-rows` element, and no capture in this repository has drawn it |
| 10 | `browser` | Narrow the leaf to a sidebar's width with an asset selected | The shelves withdraw, the inspector takes the pane and a **Back to library** control appears | §7's third rung. The capture confirms all three fire; a vault is where the container query is evaluated against a real leaf rather than a viewport |
| 11 | `judgement` | Widen the leaf slowly from a sidebar's width to a full pane, with an asset selected | The rail appears at 35rem and widens from 240px to 280px at 45rem, with no intermediate width at which the panel is unusable | §7's middle rung, which shipped MISSING once and was fixed without a picture. `asset-library-middle.png` is the first one; a live drag is what shows the transitions between them |
| 12 | `browser` | At the 240px rail — the `AL10-560-dark.png` capture; at 460 the inspector owns the whole pane and there is no rail at all — read the *Used in* list for an asset a project holds a price override for | The project name and the override mark sit on one line, or the name wraps cleanly | **Fixed by Task A4** (commit `7099a030`) and corrected in the final review round: `.rp-al-used__project` carries `flex: 1 1 16ch; min-width: 14ch` (was `12ch` flex-basis with no minimum and `overflow: hidden`, which let the column shrink to about 77px beside the mark and clip it) and `.rp-al-used__name` carries `overflow-wrap: normal; word-break: normal` — the 14ch minimum is what forces `.rp-al-used__row`'s own `flex-wrap: wrap` to drop the mark onto its own line, not either of those two rules. Measured (`AL10-560-dark.png`): row heights `[60.59, 74.19, 44]`, was `[60.59, 61.39, 44]` before the minimum — taller because the mark now genuinely wraps clear of the project text instead of both being squeezed onto one clipped line, and no row clips a word mid-character |
| 13 | `browser` | Look at the **Delete** button in both colour schemes | It reads as destructive — a red border, a transparent fill, a legible label — rather than as a third plain button | The specificity question Task 15 reasoned about without a picture. Measured in a browser it computes `1px solid rgb(233, 49, 71)` over a transparent background, so the reasoning holds; a themed vault is where a theme's own `button` rule could still outrank it |
| 14 | `suite` | Press **Delete** on an asset two projects reference, and complete the dialog | The dialog names the asset in words, the deletion resolves, and focus lands on the row that took the deleted row's place | §3.5's chain. `assetDelete.test.ts` proves the focus rule against a jsdom tree; where the caret visibly goes is a vault question |
| 15 | `browser` | Read the repair strip's two kinds of row | The path, the reason and the action form columns down the strip | **Fixed by Task A5** (commit `7270982c`, repair strip columns): `.rp-al-repair li` is a grid `minmax(0, 1fr) max-content max-content`, so the reason's left edge is a column across the strip rather than following its own text — was: rows ending flush at the right with the reason's left edge ragged at 858.9 and 788.7, a 70px spread. Task A6 also found and fixed a cascade-order bug in the merged heading/waste block (the base `.rp-al-columns` rule sat after both `@container` blocks in source order and always won regardless of the query) and re-measured the shelf heading threshold to `19rem` while regenerating these captures |
| 16 | `obsidian` | Collapse a shelf and select an asset, then close Obsidian entirely and reopen it | Both the selection and the expanded set come back | §6.3's write-back. `FakeLeaf` records asks rather than behaving, so whether Obsidian honours the state across a real restart is checkable nowhere in this repository |
| 17 | `judgement` | Read the Notes field in the inspector for an asset with a long note | The whole note is readable, or it is obvious how to read it | §3.5 specifies an editable notes field; what shipped is a single-line `<input>` that truncated a 63-character note to `Traced from the supplier s` in the 280px rail. A judgement rather than a defect, and this is where it is made |
| 18 | `suite` | Read the **Back to library** control's label at a sidebar width | It matches what the spec asks for | **The spec was corrected, the copy stands** (Task C4, commit `c9d80ca6`). The chevron lived in `docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md` §7, not the delivery spec's interaction rules; §7 was the one of the two that disagreed with §6.2 and with the shipped copy, so §7 was amended to `Back to library` without the chevron rather than the code being changed to add one |

## Acceptance criteria

1. Steps 1, 8, 9, 10 and 11 draw §3's composition correctly at all three of §7's widths.
2. **Step 5** clears WCAG 1.4.11 for every control on the surface. Step 7 is NOT here — see 5.
3. Steps 6, 14 and 16 behave — the keyboard skips what is not laid out, the caret lands
   where §3.5 says, and the view state survives a restart.
4. **Step 3 is expected to FAIL** against the build this case was written for. A run that finds
   it passing means somebody fixed it; a run that finds it failing has confirmed a finding
   rather than discovered one. **Steps 2, 4, 12 and 15 were previously in this list and are not
   any more**: Tasks A1, A2, A4 and A5 (2026-09-08, see the rows above) fixed each of them, so a
   run finding them passing now confirms the fix rather than discovering a gap.
5. **Steps 7 and 17 are expected to be OPEN rather than to pass or fail**, and each for its
   own reason, which is why they are not folded into 4:
   - **7** is a MEASUREMENT to re-take. The harness says 18px against 30px and the harness's own
     vendored sheet may be the cause; only a vault separates the two, and what the run records
     is which.
   - **17** is a JUDGEMENT with no pass condition an instrument could hold — is a single-line
     input the right control for a notes field — so a run records the decision, not a verdict.
   - **18 was previously here and is not any more**: Task C4 (commit `c9d80ca6`) corrected §7
     rather than the code, so step 18 now has a settled expectation like step 3 rather than an
     open question about which of two sources is right.

   This criterion exists because the first version of this case's own hand-off claimed all seven
   of Task 17's reported defects had an expected-failure step. Three did not: step 7 sat under
   criterion 2 asserting the opposite of what its own column measured, step 17 had no criterion
   at all, and the chevron had no step. A hand-off that over-claims turns three inherited
   findings into three discoveries, which is exactly what criterion 4 exists to prevent.

## Deliberately NOT checked

- **The geometry mark's FIFTH drawing, and the judgement about all five.** Task 17b closed the
  wiring gap, so step 3 now reaches the marks and four states draw in a capture — but *not yet
  read* is not among them, because every outline in the harness fixture answers immediately and
  a resting shot has nothing in flight to photograph. And whether the five glyphs are five
  DISTINGUISHABLE pictures at 20px — §12's own hardest finding on the prototype — is a judgement
  no capture and no gate settles; step 3 is where it is made, in a vault, and it has not been.
- **`mm` on a MEASURED footprint.** `AssetInspectorShape` appends the unit only for a
  non-pending extent, and the harness fixture's one designed asset is unscaled, so the
  suffixed form is drawn by no capture.
- **Whether a screen reader SPEAKS the search result count.** Step 8's `role="status"` region
  and its text are DOM state; that an assistive technology announces them is settled by nothing
  in this repository and by no capture. The step's pass condition is narrowed to the half that
  can be held, and this is where the other half is recorded.
- **The `New asset` dialog.** It is `NewAssetForm`, unchanged, with its own coverage.
- **Anything the harness can already photograph.** Layout at rest at 1280, 700 and 460 in
  both schemes is what `npm run harness-shot`'s seven library captures hold; this case exists
  for what a picture cannot do.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | **Not yet run in a vault.** Every row above is an expectation derived from the design spec, from the code, and — for the rows marked *Known to FAIL* — from a browser measurement taken with a Chromium that is not the pinned one. An unrun manual case is a plan to find out, not a finding. |

## Outcome

Written after the first walk: which steps passed, which of the five predicted failures a
vault confirms, and anything only a themed vault showed — the focus rings of step 5 and the
`Delete` button of step 13 in particular, since a theme's own `button` rule is the one thing
that can still outrank what was measured here.
