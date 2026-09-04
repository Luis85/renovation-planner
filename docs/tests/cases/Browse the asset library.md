---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 86
sources:
  - docs/user-experience/asset-library-overview-DESIGN-SPEC.md §3
  - docs/user-experience/asset-library-overview-DESIGN-SPEC.md §4
  - docs/user-experience/asset-library-overview-DESIGN-SPEC.md §6
  - docs/user-experience/asset-library-overview-DESIGN-SPEC.md §7
  - docs/user-experience/asset-library-overview-DESIGN-SPEC.md §9
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
| 2 | `browser` | Run an eye down the price column | Every amount's decimal point sits on one vertical line | **Known to FAIL as shipped.** `styles/asset-shelf.css`'s `.rp-al-row__amount` comment states this invariant and the layout does not keep it: measured in a browser, eight rows put the amount's right edge at 750.7, 764.7 and 773.0 — a 22.3px spread — because the unit word beside it varies in width. Confirm in a vault before deciding whether it reads as a defect |
| 3 | `judgement` | Look at the leading mark on every row | Five distinguishable pictures across the catalogue: measured, unscaled, none, not-yet-read, unreadable | **Known to FAIL as shipped.** Every mark draws the *not yet read* three-dot glyph, because `AssetLibraryBody.vue` mounts `<AssetShelves>` with no `outline-for` prop and `AssetLibraryStore.markFor` has no caller. Measured in a browser: 17 marks, one class. This row is what proves the fix when it lands |
| 4 | `suite` | Compare a shelf heading, the inspector's Category dropdown and the New asset dialog's Category dropdown for one asset | All three name the category the same way | **Known to FAIL as shipped.** The shelf says `Furniture` (through `ASSET_CATEGORY_LABELS`), the inspector's `<select>` says `furniture` (raw key), and `NewAssetForm` says `Furniture`. Same for the unit, where the row prints `m2` rather than a translated `m²` |
| 5 | `browser` | Tab from the search field through the toolbar, a shelf heading, a row, and into the inspector | Every stop shows a visible focus ring, and the ring is legible against what it sits on in BOTH colour schemes | 1.4.11's 3:1 floor. Obsidian's own `:focus { outline: none }` reaches every one of these controls and each opts its ring back in per control; nothing here measures whether the accent clears the floor against `--background-secondary` |
| 6 | `browser` | With focus on a row, press ↓ and ↑ repeatedly through a COLLAPSED shelf's position | Focus skips the collapsed shelf's rows entirely and lands on the next visible row | §6.2, and `shelfFocus.ts` filters rather than walks. jsdom lays nothing out, so *"is this row laid out"* is a question no test in this repository can ask honestly |
| 7 | `browser` | Point at a row, a shelf heading, and the inspector's Category and Unit dropdowns; measure or judge each target | Every one is at least 24px tall | WCAG 2.5.8, which §9 binds by name. Measured in a browser: rows and shelf heads are 30px and clear it; **the two `<select>`s are 18px and do not** — they also sit 12px shorter than the seven `<input>`s beside them in the same grid |
| 8 | `suite` | Type into the search field and watch the shelves | The flat *Results* list replaces the shelves, ordered by name across categories, and the result count is announced | §6.1. A screen reader is the only instrument for the announcement half |
| 9 | `browser` | With a search running, read the row layout | The result row's five slots line up with the shelved row's | §12 records a sixth child landing one column out of place in the mock; the shipped result list is the same `.rp-al-rows` element, and no capture in this repository has drawn it |
| 10 | `browser` | Narrow the leaf to a sidebar's width with an asset selected | The shelves withdraw, the inspector takes the pane and a **Back to library** control appears | §7's third rung. The capture confirms all three fire; a vault is where the container query is evaluated against a real leaf rather than a viewport |
| 11 | `judgement` | Widen the leaf slowly from a sidebar's width to a full pane, with an asset selected | The rail appears at 35rem and widens from 240px to 280px at 45rem, with no intermediate width at which the panel is unusable | §7's middle rung, which shipped MISSING once and was fixed without a picture. `asset-library-middle.png` is the first one; a live drag is what shows the transitions between them |
| 12 | `browser` | At the 240px rail, read the *Used in* list for an asset a project holds a price override for | The project name and the override mark sit on one line, or the name wraps cleanly | **Known to FAIL as shipped.** Seen in `asset-library-middle.png`: the override chip is `flex: 0 0 auto` and takes most of the row, and `.rp-al-used__name`'s `overflow-wrap: anywhere` then breaks the name one word — and one *character* — per line, `Flat / renovation — / 1 / requirement( / s)`. Measured beside it, that row is 51.8px tall against 19.6px for the row below it |
| 13 | `browser` | Look at the **Delete** button in both colour schemes | It reads as destructive — a red border, a transparent fill, a legible label — rather than as a third plain button | The specificity question Task 15 reasoned about without a picture. Measured in a browser it computes `1px solid rgb(233, 49, 71)` over a transparent background, so the reasoning holds; a themed vault is where a theme's own `button` rule could still outrank it |
| 14 | `suite` | Press **Delete** on an asset two projects reference, and complete the dialog | The dialog names the asset in words, the deletion resolves, and focus lands on the row that took the deleted row's place | §3.5's chain. `assetDelete.test.ts` proves the focus rule against a jsdom tree; where the caret visibly goes is a vault question |
| 15 | `browser` | Read the repair strip's two kinds of row | The path, the reason and the action form columns down the strip | **Partially FAILS as shipped.** Rows end flush at the right, but the reason's LEFT edge follows its own text: measured at 858.9 and 788.7 in one strip, a 70px ragged edge, under a comment in `styles/asset-library.css` promising the reason and the action "start in a COLUMN" |
| 16 | `obsidian` | Collapse a shelf and select an asset, then close Obsidian entirely and reopen it | Both the selection and the expanded set come back | §6.3's write-back. `FakeLeaf` records asks rather than behaving, so whether Obsidian honours the state across a real restart is checkable nowhere in this repository |
| 17 | `judgement` | Read the Notes field in the inspector for an asset with a long note | The whole note is readable, or it is obvious how to read it | §3.5 specifies an editable notes field; what shipped is a single-line `<input>` that truncated a 63-character note to `Traced from the supplier s` in the 280px rail. A judgement rather than a defect, and this is where it is made |

## Acceptance criteria

1. Steps 1, 8, 9, 10 and 11 draw §3's composition correctly at all three of §7's widths.
2. Steps 5 and 7 clear WCAG 1.4.11 and 2.5.8 for every control on the surface.
3. Steps 6, 14 and 16 behave — the keyboard skips what is not laid out, the caret lands
   where §3.5 says, and the view state survives a restart.
4. Steps 2, 3, 4, 12 and 15 are expected to FAIL against the build this case was written for.
   A run that finds them passing means somebody fixed them; a run that finds them failing has
   confirmed a finding rather than discovered one.

## Deliberately NOT checked

- **The geometry mark's own five drawings.** Step 3 cannot get past the wiring gap, so
  whether the five glyphs are five distinguishable pictures — §12's own hardest finding on
  the prototype — is unreachable from the shipped app and stays unverified.
- **`mm` on a MEASURED footprint.** `AssetInspectorShape` appends the unit only for a
  non-pending extent, and the harness fixture's one designed asset is unscaled, so the
  suffixed form is drawn by no capture.
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
