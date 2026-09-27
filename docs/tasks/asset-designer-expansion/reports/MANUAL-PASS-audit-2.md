# MANUAL-PASS audit 2: the 26 human steps against new instruments

**Date:** 2026-09-27. **Tree:** `cecb332b7` (CI 36313125464 and E2E 36313125670 green on it).
**Method:** [`auditing-manual-test-cases`](../../../../.claude/skills/auditing-manual-test-cases/SKILL.md),
binding. Scope is the 26 steps the first audit
([`MANUAL-PASS-audit.md`](./MANUAL-PASS-audit.md)) left human or open: every case-file row matching
`^\| [0-9]+[a-z]? \| \`(obsidian|desktop|judgement)\` \|`. This round's question is sharper than the
first: for each clause still C or open, is there an instrument the first round did not try. Two
auditors split the scope (Design an Asset's 11 steps; the other five cases' 15 steps), a probe measured
four candidate instruments in a real Obsidian 1.13.7 on Windows, and a reviewer checked every B/P/D call
against the probe, the case files and `src/`, then ran nine mutations. The gitignored working files are
`.superpowers/sdd/audit2/{auditor-brief,design,others,probe,review}.md`; where the review disagrees with
the two auditors' first drafts, the review governs, and this file follows the review.

**Nothing here was built.** No case file, no test and no source file was edited by this audit or by the
sessions that fed it. Every verdict below is a reading, not a merge.

## The P bucket

**P (proxy-automatable)** is new this round. A proxy settles a **named part** of a clause with a
measurement (a contrast ratio, a bounding-rect distance, a live-region property read off Chromium's own
accessibility tree, a pixel diff) but not the clause as a person reads it: "legible", "reads as
detached", "distinguishable to an eye", "an action rather than a bar of chrome". **Whether a P
discharges its clause is a ruling for the user, not a call this audit makes.** Every P row below names
which part the proxy settles and which part stays with a person.

## Instruments measured (probe, real Obsidian 1.13.7, Windows)

| Instrument | Verdict | What it reads | Caveat |
|---|---|---|---|
| CDP `Accessibility.{getFullAXTree,getPartialAXTree,queryAXTree}` | works, poll-only | role, name, live-region properties, computed accessible name, at the moment of the read | `Accessibility.nodesUpdated` fired 0 times across two tries with the text changing underneath; no instrument observes the moment of a change or an actual announcement, only state before/after; `puppeteer-core` is not installed |
| Electron native menu (`Menu.prototype` hooks, `remote.Menu.buildFromTemplate`, `webContents` `context-menu` listener) | works | which branch opens on a right-click (a DOM `.menu`, a native Electron menu, or nothing), on both `nativeMenus` settings | renderer-side hooks only; the 1.13.7 main-process handler builds a menu only when `isEditable \|\| selectionText`; a footprint-outline point 11px outside a *selected* part still opened the designer's own menu (read as hit tolerance, not evidence against step 92) |
| Screenshots and pixels (WebDriver `takeScreenshot`, CDP `Page.captureScreenshot` incl. `clip`, `takeElementScreenshot`, Konva `toDataURL`, canvas `getImageData`) | works | PNG bytes; byte-identical across two back-to-back calls | determinism checked only **within one still, focused session**, not across sessions, machines or DPRs; output size depends on DPR, so any stored baseline image would be per-machine, never cross-machine |
| macOS leg (`wdio-obsidian-service` + `obsidian-launcher` darwin support) | works with caveat, **nothing run** | package-level support for a `macos-latest` runner (`.dmg` download, `hdiutil attach`, `xattr -cr`, no xvfb, no sandbox flag, a cache key per OS) | **macOS untested.** Gatekeeper/notarisation, `@electron/remote`'s `setSize`, focus-sensitive drags, `Input.dispatchKeyEvent`, and the macOS contextmenu-on-mousedown difference are all unverified. Obsidian's own `Mod` resolution is computed once from `process.platform` at bundle load, so Cmd cannot be emulated on Linux for the host's hotkey matching, only the plugin's own labels (`Platform.isMacOS`) can be flipped there |

## Per-case clause tables

Corrected buckets (review supersedes the first-pass auditor call where they differ; the auditor's
original call is not repeated here (see `others.md`/`design.md` in the gitignored working set for the
full before/after).

### Design an Asset (`docs/tests/cases/Design an Asset.md`)

| Step | Clause | Bucket | Instrument / evidence | Flag |
|---|---|---|---|---|
| 7 | the picker lists the chosen file | A | `assetDesigner.e2e.ts` *lists every image and PDF in a real picker, draws the chosen sheet and writes the sidecar* | |
| 7 | lists every other PNG/JPEG/PDF in the vault | A | `assetBackgroundPicker.test.ts` *offers only the files a background can be, not the whole vault* | |
| 7 | by full path | A | `assetBackgroundPicker.test.ts` *labels a row with the note path, not the basename* (M2, red) | |
| 7 | choosing it closes the picker | A | `assetDesigner.e2e.ts` same case, `.prompt` gone | |
| 7 | the sheet appears (a drawn raster) | A | `assetDesignerRecoveryMore.e2e.ts` *lands a Remove reference and its undo over a clearance the read-back cannot measure, and stays stale until repaired*, `drawnImages(browser) > 0` | |
| 7 | right way up | A | `assetDesignerWalkHost.e2e.ts` *draws the chosen sheet the right way up, and lists its sidecar in the file explorer* (E1, red) | |
| 7 | with its 1000mm scale bar readable | P | `scripts/background-fixture.mjs` draws the bar at a known region (x 400 to 1400, y 1870 of 3000x2000, 10px thick, `1000 mm` label at 64px); `designerCanvas.ts`'s `drawnSheet` maps sheet fractions to layer pixels; contrast and drawn-text-height are measurable against a floor. Settles rendered contrast/text height, not that a person reads the label | |
| 56 | whether the drawing still has enough room at a sidebar-width leaf | P | `getBoundingClientRect` on the canvas vs the two ruler strips; the case prose already discloses the figure ("18px per axis of occlusion, 272px of drawing in a 290px canvas at a 580px leaf"). Settles the named numeric remainder, not "enough" | |
| 57 | the card draws a cabinet outline, a basin and a tap hole, under Bathroom | A | `assetDesignerDimensionsRulers.e2e.ts` *offers the vanity under Bathroom with a wireframe card and lands it at 800 x 450, taking 1000 x 500 too* | |
| 57 | legible at thumbnail size | P | `styles/designer.css` `.rp-asset-preset-preview .rp-asset-preset-preview__footprint, __detail { stroke-width: 1.5px; vector-effect: non-scaling-stroke }` (matches the gallery card). Computed-style contrast + stroke width settle a floor, not "legible" | |
| 57 | recognisably not the Washbasin card | P | `Page.captureScreenshot` clip of both `.rp-preset-choice` cards, pixel-diffed. Settles that the rendered pixels differ, not that a person tells them apart at a glance | |
| 70 | whether every number is clickable | A | `assetDesignerInput.e2e.ts` *leaves every number of the vanity's All dimensions frame a point a click lands on*, walks 26 label boxes with `document.elementFromPoint`, unreachable set `[]` (E2, red) | |
| 70 | whether every number is readable | P | `getComputedStyle`/CDP CSS on each `[data-rp-dimension]` label: font-size + contrast against its composited background. Settles a font-size/contrast floor per label, not whether 15 overlapping pairs still read as legible when crowded | |
| 88b | the header is not a live region | A | `assetDesignerParity.e2e.ts` *reads Saved just now after an edit, in no live region, and names the day once the clock passes midnight*, ancestor walk on `.rp-save-state-label` | |
| 88b | the screen reader announces nothing | P | Probe Q1: `liveAncestors: []` for the header's `StaticText "Saved"` in the real AX tree, both before and after. Settles what a screen reader would receive, not what it speaks | |
| 89 | Group, Ungroup, one separator, Duplicate, Delete, each with its own shortcut text | A | `assetDesignerParityMenu.e2e.ts` *opens one menu from the canvas, a Parts row and Shift+F10, and withholds it over every non-graphic*, `MENU` array equality | |
| 89 | the menu shows the macOS modifier on macOS | D | Unasserted: `designerContextMenu.test.ts` pins only the Ctrl list, `platformModifier.test.ts` pins `modifierLabel` alone. A vitest with `Platform.isMacOS = true` over the menu rig would close it | CONTRARY: row says "Cmd+G", build draws "⌘+G" |
| 89 | a real Mac's Obsidian takes that arm | B | A `macos-latest` leg (probe Q4). Low value once the D test exists | |
| 92 | the designer's own menu is withheld over the footprint outline, anchor dot and facing arrow | A | `assetDesignerParityMenu.e2e.ts` same case, `parity.menu().isExisting()` false at all three points | |
| 92 | "Obsidian's own native menu opens each time (or nothing)" | B, pending ruling R3 | Probe Q2: nothing opens on both `nativeMenus` settings at the anchor/facing points (`webContents` `context-menu` fires, no `buildFromTemplate`, no `Menu.show*`, no DOM `.menu`). As worded the disjunct cannot fail apart from 92a; re-worded to "nothing opens" it is B | vacuous as worded |
| 103 | Object tab layout reads as compact/grouped like board 01 | C | Board exists (`docs/tasks/asset-designer-expansion/references/01-overall-look-and-feel.png`) but is a generated concept board, not a render of this scene; its own package README calls the boards "not screenshots of implemented functionality" | |
| 104 | Add rail / Arrange icons read on sight, without hovering | C | Icon-meaning recognition; no instrument | |
| 109 | where the overall width/depth labels sit relative to their own dimension line | P | `getBoundingClientRect` between the label's anchor and its dimension/extension line (same technique as steps 71a/55 elsewhere in the suite). Settles the pixel gap, not whether it "reads as detached" | |
| 121 | Ctrl+Z is still claimed (swallowed) with nothing left to undo | A | `designerHistoryKeysWalk.test.ts` *is still claimed and goes no further, though nothing changes*, `event.defaultPrevented === true` (M1, red) | |
| 121 | no Obsidian binding also fires for the exhausted chord | A | `assetDesignerWalkKeys.e2e.ts` *runs no host command for a Ctrl+Z once nothing is left to undo, which the designer still swallows*, `expectHostIdle`, `boundTo(HISTORY_CHORDS) === []` | |
| 121 | the comparative judgement itself ("by design... checked by eye") | C | The case's own "It exists to catch" text names this a deliberate design read, not a pass/fail | |

### Take an asset from the library into a plan (`docs/tests/cases/Take an asset from the library into a plan.md`)

| Step | Clause | Bucket | Instrument / evidence | Flag |
|---|---|---|---|---|
| 23 | "Edit shape" (library) vs "Open in designer" (plan) read as one destination under two names | C | No pass condition and no instrument; a naming-consistency impression is not a measurable proxy | |

### Calibrate a sheet and reserve space (`docs/tests/cases/Calibrate a sheet and reserve space.md`)

| Step | Clause | Bucket | Instrument / evidence | Flag |
|---|---|---|---|---|
| 29 | the notice reads as belonging to the Clearance block above it, or as a fourth unnamed block | C | No instrument | **RUNS**: 2026-09-19 walk on `ecae21ab2` answered "it belonged to Clearance" |
| 29 | whether the first-glance reading changed once the sentence was read | C | No instrument | RUNS 2026-09-19: "no separate answer" |
| 32 | the block is a `role="status"` live region | A | `assetReference.e2e.ts`, `.rp-designer-clearance [role="status"]` located, text matches | |
| 32 | the button is reachable by Tab from the control before it | A | `assetDesignerInput.e2e.ts` *reaches Mark clearance as reviewed with one Tab from the Inspector control before it*, real `browser.keys('Tab')` | |
| 32 | the button's computed accessible name is exactly "Mark clearance as reviewed" | A | `designerClearanceReviewName.test.ts`, axe `accessibleText` equality (M3, red) | |
| 32 | a screen reader announces it | P | Probe Q1: `role: status, live: polite, atomic: true`, review text in children, button name "Mark clearance as reviewed" from `contents`. Settles what a screen reader receives; caveat: the status element is inserted together with its text (`v-if`), the pattern screen readers announce least reliably | |

### Recover an asset design rather than lose it (`docs/tests/cases/Recover an asset design rather than lose it.md`)

| Step | Clause | Bucket | Instrument / evidence | Flag |
|---|---|---|---|---|
| 2 | the designer is unchanged (canvas, selection, no notice, header Saved) after the sidecar's read-only attribute is set | A (HOST-PIN) | `assetDesignerRecovery.e2e.ts` *refuses a write the OS forbids without a toast...* and `assetDesignerRecoveryWalk.e2e.ts` *draws the same canvas and selection through a read-only bit...*. No `src/` mutation can redden it: a chmod raises `raw` only, no sidecar is read | HOST-PIN, pending ruling R4 |
| 6 | the early notice clears within the plugin's own bound once the host reports the repair | A | `assetDesignerRecoveryWalk.e2e.ts` same case, `healed.pluginMs <= 2000` | |
| 6 | the host raises the repair unprompted ("on its own, before you drag") | B (host timing) | `recovery.ts`'s `noticeAfterEdit` records `hostMs` and never bounds it; measured 13-18ms and 1-5ms quiet, 15s with none under load (W23-A). No `src/` mutation reaches it | |
| 6 | the bowl moves and stays moved | A | `assetDesignerRecovery.e2e.ts` same case, revision 2, `centre-x` = `'10'` | citation corrected: not the RecoveryWalk case |
| 6 | header reads Saved | A | Same test, header polled to `'Saved just now'` | |
| 8 | the plugin raises the notice within its own bound, once told | A | `assetDesignerRecoveryWalk.e2e.ts` *raises the notice with no press...*, `arrived.pluginMs <= 2000` | |
| 8 | the host raises the write event unprompted at all, "within about a second" | B (host timing) | Same `hostMs` mechanism as step 6 (W23-A: 15s with no reconcile under load; W24-A: within 5s on a quiet, focused machine, 4/4 runs) | |
| 20 | would a user know, from what is on screen, that the undo half-succeeded and the vault is inconsistent | C | No pass condition, no instrument | |
| 34 | the button reads as an action belonging to the notice, or as a bar of chrome | P | The row names a measured defect (the button shipped 1024px wide, the full leaf, below the notice's tinted strip); only declared CSS pins the fix today (`designerRecoveryStyles.test.ts` *opts the retry out of the shell column's stretch...*). A rendered bounding-rect read settles width against the leaf and box-adjacency to the notice; "reads as an action" stays human | |

### Two designers on one asset (`docs/tests/cases/Two designers on one asset.md`)

| Step | Clause | Bucket | Instrument / evidence | Flag |
|---|---|---|---|---|
| 10 | while dragging in leaf B, would you have noticed the edit did not land | C | No pass condition, no instrument (a screenshot could confirm the badge's text/contrast, already separately measurable, but not whether a person's eye goes there) | |
| 10 | having noticed the badge, could you tell from the leaf alone what happened and what to do next | C | No instrument | |

### Browse the asset library (`docs/tests/cases/Browse the asset library.md`)

| Step | Clause | Bucket | Instrument / evidence | Flag |
|---|---|---|---|---|
| 1 | each shelf heading names a category | A | `assetLibraryRoot.test.ts` *draws every declared category in the build order, empty ones included* | |
| 1 | each shelf heading carries its count | A | `assetShelf.test.ts` *draws a collapsible header with the real count and a disclosure control* (M6, red) | |
| 1 | an empty declared shelf reads as room rather than as clutter | C | Visual-weight judgement; jsdom resolves no CSS, no capture shows a themed vault, no clutter baseline exists | |
| 3 | five mechanically distinct pictures exist, one per outline state | A | `assetMark.test.ts`'s per-state drawing cases (*draws three centred dots for "not yet read"...*, *draws a struck box for "unreadable", and only that state draws a box at all*, *draws the fitted outline...*, *draws the SAME outline for an unscaled footprint, under a different class*) | OVERCLAIM on the case's own citation of *draws five states under five distinct classes* (M4: stayed green when `unreadable` drew nothing; the per-state sibling went red) |
| 3 | the five pictures are distinguishable to an eye at 20px | P | Probe Q3: screenshots work, byte-identical within a session. A pixel diff of the five states at 20px settles "not pixel-identical", not "distinguishable to an eye that has not been told" | |
| 11 | the rail appears at 35rem and widens 240px to 280px at 45rem | A | `assetLibraryWalk.e2e.ts` *gives the selection the whole pane under 35rem, a 240px rail from 35rem and a 280px one from 45rem*, four target widths | |
| 11 | no intermediate width at which the panel is unusable | P | Clipping/overflow/overlap are measurable (`scrollWidth > clientWidth`, bounding rects); a finer width sweep than the existing four points settles "nothing clipped, overflowing or overlapping", not "unusable" | |
| 17 | the whole note is readable, or it is obvious how to read it | C | The case's own acceptance criterion 5 marks this open by design (single-line `<input>` truncates is a recorded decision, not a defect); no pass condition | |
| 31 | none of switching Grid/List or changing category adds a step to the leaf's own back/forward history | A (HOST-PIN) | `assetLibraryState.e2e.ts` *adds nothing to the leaf's back history for a layout or a category change*; vacuous against a `history: true` mutation (stays green), matching `renovationPlanner.e2e.ts`'s pin for the project view: 1.13.7 records no leaf history for this view type at all | HOST-PIN, pending ruling R4 |
| 33 | the placeholder icon is faint, half the mark's box, matches the sidebar's icon for that category | A | `assetLibrary.e2e.ts` *draws a design-less tile's category icon, faint and at half the mark's box, identical to the sidebar's* | |
| 33 | at the same stroke weight as the mark, not thinner | D | Unasserted: `paint.stroke` reads only the icon's first child against the literal `'1.5px'`; `assetTileStyles.test.ts` pins `--icon-stroke` against the literal `'1.5'`, never against the mark's own declared value. M5/E5 (mark `stroke-width: 2px`) left both AND the real-host e2e green | OVERCLAIM (case row says "asserts... for both the icon and the mark, identical") |
| 33 | "noticeably" fainter than a real design's mark | P | The cited case resolves `paint.faint` and `paint.muted` and asserts only that they differ, not that faint is the fainter. A relative-luminance/contrast calculation over the two settles direction and magnitude; "noticeably" stays human | |

## Corrected per-step verdicts and counts

| Case, step | Verdict | Deciding clause(s) |
|---|---|---|
| Design 7 | proxy | scale bar readable (P); six other clauses A |
| Design 56 | proxy | room at sidebar width (P) |
| Design 57 | proxy | legible (P), not the Washbasin (P); outline A |
| Design 70 | proxy | readable (P); clickable A |
| Design 88b | proxy | announces nothing (P); not a live region A |
| Design 89 | open | macOS label (D); real-Mac arm (B) |
| Design 92 | open, pending R3 | native-menu-or-nothing (B if reworded; drop it and 92 is automated) |
| Design 103 | human | reads as board 01 (C) |
| Design 104 | human | icons on sight (C) |
| Design 109 | proxy | label-to-line distance (P) |
| Design 121 | human | the "by design" comparison (C); both others A |
| Take 23 | human | C |
| Calibrate 29 | human, RUNS on clause 1 | clause 2 (C) |
| Calibrate 32 | proxy | announcement (P); three clauses A |
| Recover 2 | automated (host pin), pending R4 | A, HOST-PIN |
| Recover 6 | open | host raises the repair unprompted (B, host timing) |
| Recover 8 | open | host raises the write unprompted (B, host timing) |
| Recover 20 | human | C |
| Recover 34 | proxy | button width and placement (P) |
| Two designers 10 | human | C, C |
| Browse 1 | human | empty shelf reads as room (C) |
| Browse 3 | proxy | distinguishable at 20px (P) |
| Browse 11 | proxy | no unusable width (P) |
| Browse 17 | human | C |
| Browse 31 | automated (host pin), pending R4 | A, HOST-PIN |
| Browse 33 | open | same stroke weight (D); fainter (P) |

**Recount.** Re-derived from the clause tables above, not copied from `review.md`'s own summary.

Steps (26 total, the regex printing 11 for Design an Asset, 1 Take, 2 Calibrate, 5 Recover,
1 Two designers, 6 Browse):

| | Automated (host pin) | Human | Proxy | Open |
|---|---|---|---|---|
| Design an Asset | 0 | 3 | 6 | 2 |
| Other five cases | 2 | 6 | 4 | 3 |
| **Total** | **2** | **9** | **10** | **5** |

Clauses (56 total: 26 in Design an Asset, 30 across the other five cases):

| | A | B | C | D | P |
|---|---|---|---|---|---|
| Design an Asset | 13 | 2 | 3 | 1 | 7 |
| Other five cases | 14 (2 HOST-PIN) | 2 | 8 | 1 | 5 |
| **Total** | **27** | **4** | **11** | **2** | **12** |

This recount matches the brief's stated figures exactly (26 steps: 2/9/10/5; 56 clauses: 27A/4B/11C/2D/12P)
and matches `review.md`'s own totals exactly. No arithmetic disagreement was found between the two
auditors' clause tables (as corrected by the reviewer) and the reviewer's summary tables.

**Flags, counted from the tables above:** OVERCLAIM x3 (Design 7's full-path citation before M2 restored
it, Browse 3's class-case citation, Browse 33's stroke citation); CONTRARY x1 (Design 89, "Cmd+G" in the
row vs the built "⌘+G"); RUNS x1 (Calibrate 29 clause 1, 2026-09-19); HOST-PIN x2 (Recover 2, Browse 31);
"vacuous as worded" x1 (Design 92's disjunct).

## Mutation table (from `review.md`, nine mutations, all restored)

| # | Clause | Mutation | Test | Result |
|---|---|---|---|---|
| M1 | Design 121, exhausted Ctrl+Z still claimed | `historyShortcut.ts`: return false before `preventDefault` when `!canUndo`/`!canRedo` | `designerHistoryKeysWalk.test.ts` | red: `defaultPrevented` false |
| M2 | Design 7, by full path | `assetBackgroundPicker.ts` `getItemText` returns `file.name` | `assetBackgroundPicker.test.ts` | red: expected `'Specs/oven.pdf'`, got `''` |
| M3 | Calibrate 32, computed name | `aria-label="Dismiss"` on the review button | `designerClearanceReviewName.test.ts` | red: `'Dismiss'` != `'Mark clearance as reviewed'` |
| M4 | Browse 3, five distinct pictures | `AssetMark.vue`: `unreadable` template `v-if="false && ..."` | `assetMark.test.ts` | cited class case stayed **green**; the per-state sibling went red, exposing the OVERCLAIM |
| M5 | Browse 33, same stroke weight | `.rp-al-mark` `stroke-width: 2px` | `assetTileStyles.test.ts`, `gates/styles.test.ts` | **green**, 86/86, confirming the D gap |
| M6 | Browse 1, shelf count | collapsible header `{{ entries.length - 1 }}` | `assetShelf.test.ts` | red: `'1'` != `'2'` |
| E1 | Design 7, right way up | `BackgroundLayer.vue` `VImage`: mirrored in place (`scaleX: -1`, offset) | `assetDesignerWalkHost.e2e.ts -t "right way up"` | red on the clause's own mirror-margin assertion |
| E2 | Design 70, every number clickable | `designer-dimensions.css`: `pointer-events: none` on the dimension value/form | `assetDesignerInput.e2e.ts -t "a point a click lands on"` | red: 26 unreachable labels |
| E5 | Browse 33, same stroke weight (host) | same as M5 | `assetLibrary.e2e.ts -t "design-less"` | **green**, confirming the OVERCLAIM in the real host |

Seven of nine (M1, M2, M3, M6, E1, E2, and M4 via its sibling) went red on an assertion of the named
clause, not a prerequisite. M5 and E5 stayed green on purpose, to demonstrate the Browse 33 stroke gap.

## Ranked build list (every B, D and P clause, 18 total)

Ranked by (confidence the instrument works) x (how much of the step it closes).

| Rank | Case, step, clause | Bucket | Instrument | Narrowest `src/`/`styles/` mutation to turn it red |
|---|---|---|---|---|
| 1 | Design 89, macOS modifier label | D | vitest over `designerContextMenu.test.ts`'s rig with `Platform.isMacOS = true`, expect `['⌘+G','⌘+Shift+G','⌘+D','Del']` | replace `modifierLabel()` with `'Ctrl'` in `designerMenu.ts`'s `items` |
| 2 | Browse 33, same stroke weight | D | jsdom case reading both `declared(icon, '--icon-stroke')` and `declared(mark, 'stroke-width')` from the assembled sheet, asserting equal to each other | change `.rp-al-mark { stroke-width: 1.5px }` (`styles/asset-library-grid.css:249`) to `2px` |
| 3 | Design 70, readable | P | CDP CSS domain / `getComputedStyle` on each `[data-rp-dimension]` label already located by `assetDesignerInput.e2e.ts`'s clickability walk: font-size and contrast | drop the dimension label's font-size below a chosen floor in the styles partial owning `[data-rp-dimension]` |
| 4 | Design 109, label-to-line distance | P | `getBoundingClientRect` on the overall-width label and its own dimension/extension line, toilet preset, footprint selected | force `dimensionFigures.ts`'s `overallSlot` to skip its slide-along-line step |
| 5 | Recover 34, button reads as an action | P | Bounding-rect of the retry button vs the leaf width and vs the notice's box | drop the retry's stretch opt-out in `styles/designer-recovery.css` |
| 6 | Calibrate 32, screen reader announces it | P | `Accessibility.getFullAXTree`/`getPartialAXTree`, polled, over the clearance status node and the button, after `editDimensions` | none named beyond the existing DOM/axe checks; this P is confirmation, not a redder gate |
| 7 | Design 88b, announces nothing | P | `Accessibility.getFullAXTree` + the `liveAncestors` walk over `.rp-save-state-label`, after a commit and after the midnight rollover | add `role="status"` to the designer header's save-state wrapper (mirroring the Plan Editor's own) |
| 8 | Browse 33, noticeably fainter | P | relative-luminance/contrast calc over the already-computed `paint.faint` vs `paint.muted` in `assetLibrary.e2e.ts`'s `browser.execute` block | change `.rp-al-tile__category-icon { color: var(--text-faint) }` (`styles/asset-library-grid.css:277`) to `var(--text-muted)` |
| 9 | Browse 11, no unusable width | P | width sweep from 460px to full pane in small steps, `scrollWidth > clientWidth` plus overlap checks | fixed `min-width` on the rail |
| 10 | Design 57, legible at thumbnail size | P | contrast/stroke read (same technique as rank 3) over the preset card's paths | remove `vector-effect: non-scaling-stroke` from `.rp-asset-preset-preview__footprint, __detail` |
| 11 | Design 57, recognisably not the Washbasin | P | `Page.captureScreenshot` clip of both preset cards, pixel-diffed | force `presetThumbnail`'s vanity path data equal to the washbasin's |
| 12 | Design 7, scale bar readable | P | `drawnSheet` fraction-to-pixel mapping over the known bar region; contrast and drawn-text-height vs a floor | drop the background layer's opacity near zero, or shrink the drawn scale |
| 13 | Design 56, room at sidebar width | P | canvas `getBoundingClientRect()` minus the two ruler strips, leaf narrowed to ~580px | widen `RULER_SIZE_PX` (or the partial's equivalent) |
| 14 | Browse 3, distinguishable at 20px | P | `Page.captureScreenshot`/harness Chromium capture of the five `AssetMark` states at 20px, pixel-diffed | remove the `stroke-dasharray` rule distinguishing `measured` from `unscaled` (both share the same `<path d>`) |
| 15 | Design 92, "nothing opens" | B, pending R3 | the probe's three renderer hooks (`webContents` `context-menu`, `Menu.show*`, `remote.buildFromTemplate`) plus DOM `.menu`/`.rp-canvas-context-menu` absence, at a non-graphic point far from every part, selection cleared | over a non-graphic, open an Obsidian `Menu` instead of nothing |
| 16 | Recover 6, host raises the repair unprompted | B, host timing | `recovery.ts`'s `noticeAfterEdit`'s `hostMs`, asserted `!== null` and `<=` a chosen tolerance across N runs | none: this is host file-watcher timing, not a `src/` code path |
| 17 | Recover 8, host raises the write unprompted | B, host timing | same `hostMs` mechanism as rank 16 | none, same reason |
| 18 | Design 89, real Mac's Obsidian takes that arm | B | a `macos-latest` leg (probe Q4) | n/a (host leg, not a mutation); low value once rank 1's D test exists |

Ranks 16-17 have no `src/` mutation at all: `hostMs` measures Obsidian's own file-watcher, not plugin
code, so even a built assertion would pin an environment fact rather than close a code-path gap.

## Corrections to case files not yet applied (list only, not edited by this audit)

- **Design an Asset, step 89**: "Cmd+G" corrected to "⌘+G" (CONTRARY; the build draws the macOS glyph,
  not the ASCII "Cmd").
- **Design an Asset, step 7**: full-path citation already correct in the current case file (the earlier
  round's OVERCLAIM on this row is resolved, not live).
- **Calibrate a sheet and reserve space, step 29**: add the RUNS answer from the 2026-09-19 walk
  (`ecae21ab2`) to clause 1: "it belonged to Clearance."
- **Recover an asset design rather than lose it, step 6**: fix the "the bowl moves" citation from
  `assetDesignerRecoveryWalk.e2e.ts` (which never reads `centre-x`) to `assetDesignerRecovery.e2e.ts`
  (which does).
- **Browse the asset library, step 3**: fix the "five distinct pictures" citation from *draws five
  states under five distinct classes* (OVERCLAIM, stays green under M4) to `assetMark.test.ts`'s
  per-state drawing cases.
- **Browse the asset library, step 33**: split the folded row into "faint/half/matching" (A) and "same
  stroke weight" (D, unasserted, OVERCLAIM on the current citation); the current case row's "asserts
  `stroke: '1.5px'` for both the icon and the mark, identical" overstates what either cited test checks.
- **`MANUAL-PASS.md`**'s "kept human (26 by kind)" section flattens tier (`obsidian` = needs a walk) onto
  bucket (`human` = no B/D/P) for Recover 2, Recover 6, Recover 8 and Browse 31: none of the four is
  pure human. Recover 6 and Recover 8 each carry a B (host-timing) clause beside their A clauses;
  Recover 2 and Browse 31 are HOST-PIN A, asserted today with no C clause at all.

## Host pins cannot be reddened by any src mutation

**Recover 2** (the designer stays unchanged after the sidecar note's read-only attribute is set) and
**Browse 31** (no leaf-history step from a layout or category change) are each asserted today by a named
e2e case that sees exactly what a walker would see. Neither has a `src/` mutation that can turn its test
red: Recover 2's chmod raises `raw` only and the plugin never reads the sidecar in response, so the code
path the clause is nominally about never runs; Browse 31 is vacuous against a `history: true` mutation
because Obsidian 1.13.7 records no leaf back/forward history for this view type at all, independent of
anything the plugin does. **On this host version, no `src/` mutation reaches either clause.** Both stay
open in `MANUAL-PASS.md`'s current phrasing only because the mutation gate cannot close them; whether
that makes them discharged is ruling R4.

## Open ruling questions

- **R1: may a proxy discharge its clause?** 12 P clauses across three instrument families (AX tree over
  CDP: Design 88b, Calibrate 32; pixels and contrast: Design 7, 57 x2, 70, Browse 3, 33; geometry:
  Design 56, 109, Recover 34, Browse 11). Recommendation in `review.md`: 88b can be discharged; Calibrate
  32 should not be, because its status element is inserted together with its text, the pattern screen
  readers announce least reliably.
- **R2: a macOS leg for Design 89?** The D test (rank 1 above) closes the part that matters at low
  cost; a `macos-latest` leg adds only "a real Mac takes the macOS arm" and its unknowns (Gatekeeper,
  `setSize`, focus-sensitive drags) are unverified.
- **R3: step 92's wording.** Drop the "native menu (or nothing)" disjunct (step becomes automated,
  cost none); or reword it to "nothing opens" and build rank 15's three-hook case; or keep it as an
  unfalsifiable clause. Also: is a right-click 11px outside a *selected* part's footprint outline
  "directly on the footprint's outline"?
- **R4: host pins and host timing.** Count Recover 2 and Browse 31 as discharged and retire them from
  the walk (keeping the e2e cases as tripwires for a host change), or leave them open where a person
  re-observes a constant. For Recover 6/8's host half: assert a chosen tolerance on `hostMs` (risking a
  flaky red under CI load) or keep recording it as measured, not gated.
- **R5: judgement steps with a Runs answer.** Accept Calibrate 29 clause 1's 2026-09-19 "it belonged to
  Clearance" answer as final, or re-ask it since the clearance block has had rounds since. No other
  judgement step in the 26 has a Runs answer.

**Rulings: pending, recorded as AD18-R30 onward in DECISIONS.md.**
