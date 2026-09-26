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
| 1 | `judgement` | Open the asset library on a full catalogue and read the shelves | Each shelf heading names a category and carries its count; an empty declared shelf reads as room rather than as clutter | §3.2's derived shelf list. **Kept at `judgement` for one clause alone**: the naming and counting halves are now closed by `assetLibraryRoot.test.ts`'s *draws every declared category in the build order, empty ones included* and `assetShelf.test.ts`'s *draws a collapsible header with the real count and a disclosure control* (see Automated below). "Reads as room rather than as clutter" is the one clause left — the capture says it looks right at 1280 and 460, and a themed vault is where the borders and the muted counts are actually legible |
| 2 | `browser` | Run an eye down the price column | Every amount's decimal point sits on one vertical line | **Fixed by Task A2** (commit `7f80a948`, price column alignment): the amount renders in its own right-aligned grid track with `font-variant-numeric: tabular-nums`, and Task A6 (commits `aa89abb7`, `23dbc269`) pinned the amount and unit tracks to fixed `11ch`/`6ch` widths at every container width, so an independent per-row grid can no longer disagree with its siblings. Measured (Task A6): amount right-edge spread is `0px` at 1440, 720 and 560 — was 22.3px, eight rows measured at 750.7, 764.7 and 773.0 |
| 3 | `judgement` | Look at the leading mark on every row of an OPEN shelf | Five distinguishable pictures across the catalogue: measured, unscaled, none, not-yet-read, unreadable | **The wiring gap is CLOSED (Task 17b)** — `outline-for` is bound and required, and `AssetLibraryBody.drawnAssetIds` feeds the batch. `asset-library-light.png` now draws four of the five states, across five rows of the two open shelves: a long thin bar (Oak plank floor, measured), a square (Porcelain tile, measured), a dashed square (Base cabinet, unscaled), an empty slot (Wall paint, none) and a struck box (Tile adhesive, unreadable). Read that as APPROXIMATE — the substitute Chromium, and not a vault. **Kept at `judgement` for one clause alone**: that five MECHANICALLY DISTINCT pictures exist is now closed by `assetMark.test.ts`'s *draws five states under five distinct classes*, including the one pair sharing a `<path>` (`measured`/`unscaled`) told apart by `stroke-dasharray` (see Automated below). What the row still has to settle is the JUDGEMENT no test can: whether those pictures are distinguishable at 20px to an eye that has not been told what to look for. *Not yet read* is the one state a resting capture cannot show, because the harness answers every outline at once |
| 4 | `suite` | Compare a shelf heading, the inspector's Category dropdown and the New asset dialog's Category dropdown for one asset | All three name the category the same way | **Fixed by Task A1** (commit `e1a27719`, unit symbols; commit `4e6e941c`, locale housing): the shelf row's unit now resolves through `MEASUREMENT_UNIT_SYMBOLS` via `tr` (m², m, m³, and localized words for piece, hour, day, fixed) instead of the raw `MeasurementUnit` key — was: the row printed the raw key `m2` beside `MEASUREMENT_UNIT_LABELS.m2`'s translated `Square metres` elsewhere. The category half of this row's original claim did not hold against the code at any commit on this branch: `optionLabel` in `AssetInspectorFields.vue` already resolved a declared category through `tr(ASSET_CATEGORY_LABELS[...])`, so the shelf, the inspector's `<select>` and `NewAssetForm` already named the category the same way; only the unit half was the real defect |
| 5 | `browser` | Tab from the search field through the toolbar, a shelf heading, a row, and into the inspector | Every stop shows a visible focus ring, and the ring is legible against what it sits on in BOTH colour schemes | 1.4.11's 3:1 floor. Obsidian's own `:focus { outline: none }` reaches every one of these controls and each opts its ring back in per control; nothing here measures whether the accent clears the floor against `--background-secondary` |
| 6 | `browser` | With focus on a row, press ↓ and ↑ repeatedly through a COLLAPSED shelf's position | Focus skips the collapsed shelf's rows entirely and lands on the next visible row | §6.2, and `shelfFocus.ts` filters rather than walks. jsdom lays nothing out, so *"is this row laid out"* is a question no test in this repository can ask honestly |
| 7 | `browser` | Point at a row, a shelf heading, and the inspector's Category and Unit dropdowns; measure each target **in Obsidian**, and compare the two dropdowns against the seven inputs beside them | Rows and shelf headings clear 24px, and whatever the two `<select>`s measure is the same height as the `<input>`s in the same grid | WCAG 2.5.8, which §9 binds by name. **The harness measurement is 30px for rows, shelf heads and inputs and 18px for the two dropdowns — and it is NOT settled**, which is why this step re-takes it rather than asserting it: `tests/harness/obsidian.css` declares the `--dropdown-*` variables and carries no `select` rule at all while it DOES pad `input[type='text']`, so the split may be the vendored sheet's gap rather than ours. That sheet's own header warns of exactly this. A vault is the only place the two causes come apart |
| 8 | `suite` | Type into the search field and watch the shelves | The flat *Results* list replaces the shelves, ordered by name across categories, and the count is written into the `role="status"` region | §6.1. The pass condition is deliberately DOM state and not *"is announced"*: whether a screen reader speaks it is settled by no instrument this repository has, so it sits in *Deliberately NOT checked* below rather than inside a `suite` verdict it would contradict |
| 9 | `browser` | With a search running, read the row layout | The result row's five slots line up with the shelved row's | §12 records a sixth child landing one column out of place in the mock; the shipped result list is the same `.rp-al-rows` element, and no capture in this repository has drawn it |
| 10 | `browser` | Narrow the leaf to a sidebar's width with an asset selected | The shelves withdraw, the inspector takes the pane and a **Back to library** control appears | §7's third rung. The capture confirms all three fire; a vault is where the container query is evaluated against a real leaf rather than a viewport |
| 11 | `judgement` | Widen the leaf slowly from a sidebar's width to a full pane, with an asset selected | The rail appears at 35rem and widens from 240px to 280px at 45rem, with no intermediate width at which the panel is unusable | §7's middle rung, which shipped MISSING once and was fixed without a picture. `asset-library-middle.png` is the first one. **Kept at `judgement` for one clause alone**: the rung widths themselves are now closed by `assetLibraryWalk.e2e.ts`'s *gives the selection the whole pane under 35rem, a 240px rail from 35rem and a 280px one from 45rem*, which walks the real container through all three rungs — under 35rem (no rail, the inspector IS the pane), 35–45rem (240px) and above 45rem (280px) — and measures each one in the real host (see Automated below). What a live drag still shows that no test does is whether anything LOOKS unusable in between, which is why this row stays a judgement |
| 12 | `browser` | At the 240px rail — the `AL10-560-dark.png` capture; at 460 the inspector owns the whole pane and there is no rail at all — read the *Used in* list for an asset a project holds a price override for | The project name and the override mark sit on one line, or the name wraps cleanly | **Fixed by Task A4** (commit `7099a030`) and corrected in the final review round: `.rp-al-used__project` carries `flex: 1 1 16ch; min-width: 14ch` (was `12ch` flex-basis with no minimum and `overflow: hidden`, which let the column shrink to about 77px beside the mark and clip it) and `.rp-al-used__name` carries `overflow-wrap: normal; word-break: normal` — the 14ch minimum is what forces `.rp-al-used__row`'s own `flex-wrap: wrap` to drop the mark onto its own line, not either of those two rules. Measured (`AL10-560-dark.png`): row heights `[60.59, 74.19, 44]`, was `[60.59, 61.39, 44]` before the minimum — taller because the mark now genuinely wraps clear of the project text instead of both being squeezed onto one clipped line, and no row clips a word mid-character |
| 13 | `browser` | Look at the **Delete** button in both colour schemes | It reads as destructive — a red border, a transparent fill, a legible label — rather than as a third plain button | The specificity question Task 15 reasoned about without a picture. Measured in a browser it computes `1px solid rgb(233, 49, 71)` over a transparent background, so the reasoning holds; a themed vault is where a theme's own `button` rule could still outrank it |
| 14 | `suite` | Press **Delete** on an asset two projects reference, and complete the dialog | The dialog names the asset in words, the deletion resolves, and focus lands on the row that took the deleted row's place | §3.5's chain. `assetDelete.test.ts` proves the focus rule against a jsdom tree; where the caret visibly goes is a vault question |
| 15 | `browser` | Read the repair strip's two kinds of row | The path, the reason and the action form columns down the strip | **Fixed by Task A5** (commit `7270982c`, repair strip columns): `.rp-al-repair li` is a grid `minmax(0, 1fr) max-content max-content`, so the reason's left edge is a column across the strip rather than following its own text — was: rows ending flush at the right with the reason's left edge ragged at 858.9 and 788.7, a 70px spread. Task A6 also found and fixed a cascade-order bug in the merged heading/waste block (the base `.rp-al-columns` rule sat after both `@container` blocks in source order and always won regardless of the query) and re-measured the shelf heading threshold to `19rem` while regenerating these captures |
| 16 | `e2e` | Collapse a shelf and select an asset, then close Obsidian entirely and reopen it | Both the selection and the expanded set come back | §6.3's write-back, now closed by `assetLibraryState.e2e.ts`'s *brings the selection and the expanded shelves back after Obsidian restarts* — real WebdriverIO driving a real restart, which `FakeLeaf` (records asks rather than behaving) could never check. **Finding**: this only holds once something else has already saved the layout — see Runs |
| 17 | `judgement` | Read the Notes field in the inspector for an asset with a long note | The whole note is readable, or it is obvious how to read it | §3.5 specifies an editable notes field; what shipped is a single-line `<input>` that truncated a 63-character note to `Traced from the supplier s` in the 280px rail. A judgement rather than a defect, and this is where it is made |
| 18 | `suite` | Read the **Back to library** control's label at a sidebar width | It matches what the spec asks for | **The spec was corrected, the copy stands** (Task C4, commit `c9d80ca6`). The chevron lived in `docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md` §7, not the delivery spec's interaction rules; §7 was the one of the two that disagreed with §6.2 and with the shipped copy, so §7 was amended to `Back to library` without the chevron rather than the code being changed to add one |

## Steps — the Grid view (AD18-R18)

**Added 2026-09-23 (AD18-R18, second parity round).** Most of this is now driven in real Obsidian by `tests/e2e/assetLibrary.e2e.ts`, `assetLibraryNarrow.e2e.ts`, `assetLibraryState.e2e.ts` and `assetLibraryWalk.e2e.ts` — see *Automated in Obsidian* below and the Runs table; steps 11 (in part), 17 and 31 remain unseen or open. A
`Grid | List` toggle sits beside the search field; **List stays the default and is unchanged** —
every step above still describes it. Grid draws board 01's tiles and its category sidebar as a
FILTER over the same shelves; §10's anti-goals (no sort control, no totals, no bulk edit, no
placement) stand over both views.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 19 | `suite` | Open the library fresh, then look at the toolbar's view toggle | Two buttons, **Grid** and **List**, each carrying its own icon and word; **List** is pressed | `libraryBrowse.ts`'s `DEFAULT_BROWSE`: List stays the default, unchanged by this round |
| 20 | `e2e` | Press **Grid** | The shelves are replaced by a tile grid: one tile per asset, each showing the SAME geometry mark the list row draws (at tile size), the asset's name, and its measured size in the SAME wording the list row uses (e.g. "800 × 400 mm") | The tile and the row share one rendering function (`markWords.ts`) for the mark and the size text, so the two surfaces cannot say two different things about one shape. Closed by `assetLibrary.e2e.ts`'s *replaces the shelves with one tile per asset, drawing the list row's own mark and size words* |
| 21 | `suite` | Select a tile | The SAME inspector opens that a list row's press would — same selected asset, same fields | Tile and row both emit the identical `select` event into the identical handler; two selection models would be two answers to "which asset did you mean" |
| 22 | `e2e` | Look at the new sidebar down the left of the grid | It lists **All** plus all seven DECLARED categories — a CLOSED vocabulary, not an open one — each with its own icon (a grid for All, layered sheets for material, an armchair for furniture, a bath for fixture, a sprout for plant, a hammer for equipment, a brick wall for a building element, a pencil for custom), whether this vault's assets use them or not; a category the build does not declare (e.g. `lighting`) never reaches this sidebar at all — the note it belongs to goes to the repair strip instead | **CONTRARY, rewritten under AD18-R27**: §1a describes an open vocabulary; the build shipped a closed one. `assetLibrary.e2e.ts`'s *lists All and every DECLARED category with its icon, and refuses a category the build does not declare* pins it — Plant, Building element and Custom hold nothing in this vault and are still listed. The generic-tag fallback is real but is reachable only at the component, never through the real note-parsing pipeline: `assetLibraryCategories.test.ts`'s *marks a category the build does not declare with the tag icon* drives `AssetCategoryNav` directly with `category: 'insulation'` |
| 23 | `e2e` | Click a category in the sidebar | Both the grid AND the shelves (switch to List to check) narrow to that category alone; the search count and the empty state (if the category is now empty of matches) follow the SAME filter | One filter reaching both views (§10) — not a Grid-only affordance. Closed by `assetLibrary.e2e.ts`'s *narrows the grid AND the shelves to the chosen category, and counts only what it draws* and *words each empty state for the narrowed set, and Show all categories clears only the filter, landing on All* |
| 24 | `e2e` | With no category active, type a search term with no matches, then pick a category with no matches for that term | The empty message reads differently for the two: a plain "No matches" versus "No matches in {category}" (or "No assets in {category}" with no search running), and a **"Show all categories"** action clears the filter (leaving any search term alone) | The count and the empty state are computed from the CATEGORY-NARROWED set, not the raw catalogue — a filter that left the count and the empty state reading the whole library would silently contradict what is on screen. Closed by `assetLibrary.e2e.ts`, whose "No matches in {category}" case needs a term matching an asset in ANOTHER category to be reached at all |
| 24a | `e2e` | With the category sidebar SHOWING (a wide leaf, or the funnel pressed open), reach the empty state from step 24 and press **"Show all categories"** | Focus lands on the **"All"** category button (`aria-pressed="true"`) | `onClearFilter`'s `focusAfterSwap('.rp-al-category[aria-pressed="true"]', …)` (`AssetLibraryRoot.vue:164-168`) finds the pressed "All" button inside a sidebar that IS laid out. Closed by `assetLibrary.e2e.ts`'s same case |
| 24b | `e2e` | Reach the same empty state with the sidebar NOT showing — below 35rem with the funnel closed — and press **"Show all categories"** | Focus lands on the **search field** instead | The same call's fallback: `focusWithin` (`shelfFocus.ts:177-183`) finds no laid-out `.rp-al-category` to focus and falls back to the search input — the one target guaranteed to exist in every layout. **This fallback is reached whenever the sidebar is not showing at all**, which is two different conditions, not one: below 35rem regardless of view (this step's own route), OR at ANY width in **List** with no category active and the funnel untouched — `useCategorySidebar.ts:29`'s `wanted` computed (`pressed ?? layout is grid or category is set`) answers `false` for an unfiltered List before the funnel is ever pressed, and the integrator measured `display: none` on the sidebar at 1280px in that exact state. Closed by `assetLibraryNarrow.e2e.ts`'s *puts the caret on the search field when Show all categories is pressed with the sidebar closed* |
| 25 | `browser` | Narrow the leaf below roughly 35rem | The sidebar withdraws on its own, and a **funnel** icon button takes its place, labelled to say whether a filter is active ("Filter by category" versus "Filter by category, {category}") | AD18-R18's narrow behaviour (spec §7): the funnel is the sidebar's replacement at a width too narrow to keep it open all the time |
| 26 | `e2e` | At that narrow width, press the funnel | The sidebar opens BESIDE the grid, narrowing it rather than covering it, and `aria-expanded` on the button follows it, both ways | **CONTRARY, rewritten under AD18-R27**: the case used to call this an overlay. `assetLibraryWalk.e2e.ts`'s *lays the funnel's sidebar beside the grid at a sidebar's width, narrowing the grid rather than covering it* pins the push-aside: at a 435px container the sidebar sits at 44–204 and the tiles at 204–455 (disjoint boxes) and the grid narrows from 435 to 251. The same filter, reached by a second door rather than a duplicated one. In CSS terms this is a plain flex column with no `position: absolute/fixed` and no `z-index` — that is the mechanism, but the e2e case measures the resulting boxes, not the declarations, so it is recorded here rather than as a separate asserted clause |
| 27 | `e2e` | At a leaf already narrower than 35rem, with nothing selected, look at the funnel button; then select a tile | **The funnel is showing, not hidden, before anything is selected** — it is the sidebar's replacement at this width, not something the container query hides — and selecting a tile hides the sidebar and the funnel TOGETHER; returning to the library (Back to library) brings the funnel back | **CONTRARY, rewritten under AD18-R27**: the case's premise that the funnel is "already hidden" at this width is wrong. `assetLibraryNarrow.e2e.ts`'s *withdraws the sidebar and the funnel together once a tile is selected, however the sidebar was showing* pins `{ sidebar: false, funnel: true }` before selecting and `{ sidebar: false, funnel: false }` after — the funnel's hide rule is selection-driven, not the `@container rp-al (width < 35rem)` query alone (`styles/asset-library-grid.css:324-335`) |
| 28 | `e2e` | Scroll to the end of the tile grid | A **"Create your own"** card sits there, with a pencil icon, a title and a hint, and a **New asset** button | AD18-R18's card, calling the EXISTING New asset door (`onCreateAsset`) rather than a second dialog. Closed by `assetLibrary.e2e.ts`'s *ends the grid with a Create your own card whose New asset opens the toolbar's own dialog* |
| 29 | `e2e` | Press that card's **New asset** button | The same dialog the toolbar's own **New asset** button opens, opens | One creation door, reached from a second place. Closed by the same case — the dialog markup is identical once per-mount ids are normalised |
| 30 | `e2e` | Switch to Grid, pick a category, close this leaf entirely, then reopen the library | **A restart of Obsidian keeps Grid and the category; closing this leaf entirely and reopening it through the command does NOT** — it comes back in List, with no category active (`{ assetId: '', expanded: [] }`), because closing a leaf discards its view state | **CONTRARY, rewritten under AD18-R27**: the case used to claim close-and-reopen keeps the state. `assetLibraryState.e2e.ts`'s *keeps Grid and the category across a restart, and forgets both when the leaf is closed and reopened* drives the step's own literal action (`leaf.detach()`, then reopening) and gets the opposite of the row as written; only a separate `restart()` (an Obsidian reload) keeps Grid and the category. AD18-R18's view-state design (§6.3) is real — the case named the wrong gesture for reaching it |
| 31 | `obsidian` | With the pane's back/forward history in mind (if this leaf has any), switch between Grid and List, and change the category a few times | None of it adds a step to the leaf's own back/forward history | Neither a layout change nor a category change is a navigation (§6.3) — only opening or leaving an asset is. **Kept at `obsidian`**: `assetLibraryState.e2e.ts`'s *adds nothing to the leaf's back history for a layout or a category change* asserts this, but a `history: true` mutation on the underlying `setViewState` call stays green — Obsidian 1.13.7 records no leaf history for this view at all, so the assertion cannot fail until the host starts recording one (AD18-R26 declined to build further here for that reason) |

## Steps — the Grid view's polish round (AD18-R20/R21 Task 8)

**Added 2026-09-24.** Steps 32 and 34 are now driven in real Obsidian by `assetLibrary.e2e.ts`; step 33's mechanical half is too, and its "noticeably" magnitude judgement stays open.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 32 | `e2e` | In the Grid view, run an eye down every tile's name and its size line | Every tile's name and its size share the same LEFT edge — a one-line name ("Sofa") and a two-line wrapped one both start flush left. **The mark does not share that edge**: it is centred against the tile's own width (`align-self: center`), not flush against the content edge, so there is no single left edge for the name and size to sit "above" | The alignment fix: `.rp-al-tile` gained `align-items: stretch`, so a one-line name's shrunk box no longer centres in the tile the way Obsidian's own `button { align-items: center }` used to leave it — a two-line name already read left-aligned, which is what made the two look inconsistent with each other before the fix. **RULING, rewritten under AD18-R27**: the case used to also claim the name/size share the mark's own left edge, which is dropped. `assetLibrary.e2e.ts`'s *starts every tile's name and size on the same left edge, one line or two* pins the name/size half in the real host; `assetTileMarkEdge.test.ts` and `assetTileStyles.test.ts`'s *keeps the mark centred against the now-stretched tile* pin the stylesheet fact that makes the mark clause unmeetable — `.rp-al-mark` and the design-less placeholder icon are the only two tile children carrying `align-self: center`, while the name and size inherit the tile's `align-items: stretch`, so the two groups cannot share one left edge except by coincidence at one exact tile width |
| 33 | `obsidian` | Find a tile for an asset with no design yet (an empty box before this round) | Where the mark used to be, a small, MUTED icon is drawn instead — matching that asset's category (e.g. a hammer for Equipment, an armchair for Furniture, layered sheets for Material) — noticeably fainter than a real design's own mark, at the SAME stroke weight, not thinner | Task 8, fix round 2: the placeholder reads quieter than a real design on purpose — the icon is about half the mark's box, at the mark's own stroke weight, in `var(--text-faint)` rather than `var(--text-muted)`; a design-less tile should not look MORE drawn than one with an actual shape. **RULING, rewritten under AD18-R27**: the case used to also claim the icon reads thinner. `assetLibrary.e2e.ts`'s *draws a design-less tile's category icon, faint and at half the mark's box, identical to the sidebar's* asserts `stroke: '1.5px'` for both the icon and the mark — identical, not thinner — so that half of the pass condition is dropped. "Noticeably fainter" (the colour difference alone) is the one magnitude judgement left, and it is why this step stays `obsidian` |
| 34 | `e2e` | Compare that tile's icon against the SAME category's row in the sidebar (switch to the category sidebar, or narrow the leaf to show the funnel) | The two icons match exactly | Both surfaces read the same `categoryIcon()` lookup (`src/presentation/library/categoryIcons.ts`) rather than two separate tables that could drift apart. Closed by the same case as step 33 — `expect(icon).toEqual(await lib.iconOf(lib.category(category)))`, the Lucide class and the svg markup equal |
| 35 | `browser` | Look at a tile whose outline HAS loaded yet is not `'none'` (a real design), then one whose outline has not been READ yet (freshly scrolled into view) | The real design draws its own mark; a not-yet-read tile still draws the pending-dots mark, never the category icon | The `'none'` branch is the only one that swaps to the icon — `outline === null` (not yet read) still takes the `AssetMark` branch, so a slow read never flashes the wrong placeholder |

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

## Automated in Obsidian

**Added 2026-09-25**, over `tests/e2e/assetLibrary.e2e.ts`, `assetLibraryNarrow.e2e.ts` and
`assetLibraryState.e2e.ts`, plus `tests/e2e/library.ts` (catalogue notes seeded through
`app.vault.create`, the window sized through Electron because chromedriver refuses
`setWindowSize`). **Extended 2026-09-26 (AD18-R26/R27)** with `assetLibraryWalk.e2e.ts` (steps 11
and 26, real host) and, for step 32's RULING, the node-environment stylesheet reads
`assetTileMarkEdge.test.ts` and `assetTileStyles.test.ts`. Every case was watched red against a
one-clause mutation of `src/` or `styles/`, except step 31's (see its row) and the two stylesheet
reads, which read parsed CSS rather than a mutated build. One row per clause, cited by the case's
name.

| Step | Clause | Discharged by |
| --- | --- | --- |
| 1 | each shelf heading names a category | `assetLibraryRoot.test.ts` *draws every declared category in the build order, empty ones included* |
| 1 | each shelf heading carries its count | `assetShelf.test.ts` *draws a collapsible header with the real count and a disclosure control* (and its zero-count sibling) |
| 1 | an empty declared shelf reads as room rather than as clutter | none — `judgement` |
| 3 | five mechanically distinct pictures exist | `assetMark.test.ts` *draws five states under five distinct classes*, plus its own CSS check for the `measured`/`unscaled` pair sharing a `<path>` |
| 3 | distinguishable to an eye at 20px | none — `judgement` |
| 11 | the rail appears at 35rem and widens 240→280px at 45rem | `assetLibraryWalk.e2e.ts` *gives the selection the whole pane under 35rem, a 240px rail from 35rem and a 280px one from 45rem* |
| 11 | no intermediate width at which the panel is unusable | none — `judgement` |
| 16 | the selection comes back after a restart | *brings the selection and the expanded shelves back after Obsidian restarts* — **finding**: only once something else saves the layout, see Runs |
| 16 | the expanded set comes back after a restart | same case |
| 17 | the whole note is readable, or it is obvious how to read it | none — `judgement` |
| 20 | the shelves are replaced by a tile grid, one tile per asset | *replaces the shelves with one tile per asset, drawing the list row's own mark and size words* |
| 20 | the tile draws the SAME mark the list row draws | same case — the path `d` equals the row's |
| 20 | the tile shows the asset's name | same case |
| 20 | the measured size uses the list row's wording | same case — `380 × 700 mm` is the row's text minus its prefix |
| 22 | lists All plus the categories, each with its own icon | *lists All and every DECLARED category with its icon, and refuses a category the build does not declare* |
| 22 | the vocabulary is CLOSED: all seven declared categories are listed whether the vault uses them or not | same case — **CONTRARY, rewritten under AD18-R27**: the case's row used to call this an open vocabulary |
| 22 | a generic tag for anything else | `assetLibraryCategories.test.ts` *marks a category the build does not declare with the tag icon* — drives `AssetCategoryNav` directly with `category: 'insulation'`; unreachable through the real note-parsing pipeline, which refuses an undeclared category before the sidebar ever sees it, but discharged at the component |
| 23 | the grid narrows to the category | *narrows the grid AND the shelves to the chosen category, and counts only what it draws* |
| 23 | the shelves (in List) narrow to the category | same case |
| 23 | the search count follows the same filter | same case — `2 matching assets` |
| 23 | the empty state follows the same filter | *words each empty state for the narrowed set, and Show all categories clears only the filter, landing on All* |
| 24 | a plain no-matches message with no category active | same case — the host's text is `No matching assets` |
| 24 | "No matches in {category}" | same case — **finding**: reached only when the term matches an asset in ANOTHER category |
| 24 | "No assets in {category}" with no search running | same case — `No assets in Plant` |
| 24 | Show all categories clears the filter and leaves the search term | same case — the value is still `plank` |
| 24a | focus lands on All with `aria-pressed="true"` | same case |
| 24b | with the sidebar not showing, focus lands on the search field | *puts the caret on the search field when Show all categories is pressed with the sidebar closed* |
| 26 | the funnel opens the sidebar at narrow width | *opens and closes the withdrawn sidebar from the funnel, aria-expanded following it* |
| 26 | `aria-expanded` follows it, both ways | same case |
| 26 | opens beside the grid, narrowing it, rather than as an overlay | `assetLibraryWalk.e2e.ts` *lays the funnel's sidebar beside the grid at a sidebar's width, narrowing the grid rather than covering it* — **CONTRARY, rewritten under AD18-R27**: the case's row used to call this an overlay |
| 27 | the sidebar stays hidden with a tile selected | *withdraws the sidebar and the funnel together once a tile is selected, however the sidebar was showing* |
| 27 | the funnel is showing (not hidden) before selection, and selecting a tile hides both sidebar and funnel together | same case — **CONTRARY, rewritten under AD18-R27**: the case's row used to call the funnel "already hidden" before the selection |
| 28 | the Create your own card ends the grid, with pencil icon, title, hint and New asset | *ends the grid with a Create your own card whose New asset opens the toolbar's own dialog* |
| 29 | the card's New asset opens the toolbar's own dialog | same case — the dialog markup is identical once per-mount ids are normalised |
| 30 | a restart keeps Grid and the category; closing the leaf and reopening it through the command does NOT | *keeps Grid and the category across a restart, and forgets both when the leaf is closed and reopened* — **CONTRARY, rewritten under AD18-R27**: the case's row used to claim close-and-reopen keeps them |
| 31 | no step is added to the leaf's back/forward history | *adds nothing to the leaf's back history for a layout or a category change* — **vacuous in 1.13.7**: a mutation setting `history: true` stays green, because the host records no leaf history here at all |
| 32 | a one-line name, a two-line name and the size line start on one left edge | *starts every tile's name and size on the same left edge, one line or two* |
| 32 | "the same edge the mark sits above" | dropped — **RULING, AD18-R27**: `assetTileMarkEdge.test.ts` and `assetTileStyles.test.ts`'s *keeps the mark centred against the now-stretched tile* pin `.rp-al-mark`'s `align-self: center` against the name/size's inherited `align-items: stretch` — two different alignment rules that cannot share one left edge except by coincidence, so this half of the pass condition is dropped rather than discharged |
| 33 | a design-less tile draws its category's icon, fainter (`--text-faint`), at half the mark's box, stroke 1.5px | *draws a design-less tile's category icon, faint and at half the mark's box, identical to the sidebar's* |
| 33 | thinner than the mark | dropped — **RULING, AD18-R27**: the same case asserts `stroke: '1.5px'` for both the icon and the mark, identical rather than thinner |
| 33 | "noticeably" fainter (colour alone) | none — `judgement` |
| 34 | the tile's icon matches the sidebar's exactly | same case as 33 — the Lucide class and the svg's markup are equal |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| 2026-09-26 | The `E2E` workflow on this branch — Obsidian 1.13.7 and latest, Linux under xvfb | **Step 16's finding (1) does not hold on Linux**: `.obsidian/workspace.json` already held the published state 3 s on, so when Obsidian saves the layout is platform timing rather than a fact about publishing. The case no longer pins the unsaved disk; it still restarts through a gesture that saves first. |
| 2026-09-26 | `npm run test:e2e -- tests/e2e/assetLibraryWalk.e2e.ts` on this branch — Obsidian 1.13.7 driven by WebdriverIO, Windows 11 | **2 passed.** Step 11: every rung (no rail under 35rem, the inspector taking the whole pane; 240px from 35rem; 280px from 45rem) was reached and measured by walking the real container, closing the rung-width half of the clause. Step 26: **CONTRARY** — at a 435px container the funnel's sidebar sits at 44–204px and the tiles at 204–455px (disjoint boxes), and the grid narrows from 435 to 251px; the sidebar pushes the grid rather than overlaying it. Both findings are pinned rather than fixed, per AD18-R27 — rewritten into steps 11 and 26 above. |
| 2026-09-25 | `npm run test:e2e -- tests/e2e/assetLibrary` on this branch — Obsidian 1.13.7 driven by WebdriverIO, Windows 11, `--lang=en` | **13 passed**, desktop leg (the library does not mount on mobile). Steps 16, 20, 22–24b, 26–34 discharged per the table above. **Findings, pinned as measured:** (1) step 16 — publishing view state never makes Obsidian SAVE the layout: `.obsidian/workspace.json` held the first shelf toggle's state 3 s after two more, and `reloadObsidian()` does not flush a save, so without an unrelated save first a restart restores `{assetId:'', expanded:[]}`; whether a user's graceful quit saves it is unsettled. (2) step 22 — the vocabulary is CLOSED: the sidebar lists all seven declared categories whether used or not, and a note with `category: lighting` goes to the repair strip. (3) step 24 — the route as written reaches only `No matching assets`; "No matches in {category}" needs a term that matches something in another category. (4) step 27 — below 35rem with nothing selected the funnel IS shown, and selecting a tile HIDES it; Back to library brings it back. (5) step 30 — closing every library leaf and reopening through the command loses Grid and the category; only a restart of a surviving leaf keeps them. (6) step 31 — 1.13.7 records no leaf history for this view, so the row cannot fail today. |
| — | — | **Not yet run in a vault.** Every row above is an expectation derived from the design spec, from the code, and — for the rows marked *Known to FAIL* — from a browser measurement taken with a Chromium that is not the pinned one. An unrun manual case is a plan to find out, not a finding. |

## Outcome

Written after the first walk: which steps passed, which of the five predicted failures a
vault confirms, and anything only a themed vault showed — the focus rings of step 5 and the
`Delete` button of step 13 in particular, since a theme's own `button` rule is the one thing
that can still outrank what was measured here.
