# MANUAL-PASS audit — what the automated suites discharge, clause by clause

**Date:** 2026-09-26. **Tree:** `4f918f8fd` (CI run 36230698423 and E2E run 36230698367 green).
**Method:** [`auditing-manual-test-cases`](../../../../.claude/skills/auditing-manual-test-cases/SKILL.md),
binding. Scope is every row [[MANUAL-PASS]]'s command counts — the `obsidian`, `desktop` and
`judgement` rows of the seven cases, **241 steps**, re-derived with that command on this tree.

## How this was measured

Eight read-only auditors (Design an Asset split at 71b/72) re-derived every step's clauses from the
case text and read the BODY of every test they cited, starting from W24-A's *Automated in Obsidian*
tables as claims rather than facts. An independent reviewer then read every B, C and D call, sampled
the A rows (all of Compose; about 15 of Design 1–71b's 84 and 17 of Design 72–129's 94; Recover's
over-claims and the whole of `assetDesignerRecovery.e2e.ts`), and ran **29 mutations, 13 of them in a
real Obsidian**: 20 went red on the clause, 2 red at a neighbouring assertion (a prerequisite, so not
a discharge), and **7 stayed green — each one a row that had read as covered and is not**. Every
auditor then applied the review at source and recounted from its rows with a tool. The per-case tables
are in `.superpowers/sdd/audit/` (gitignored); this file is their summary. **Unsampled A rows rest on
the auditor's reading, not on a mutation.**

Buckets, one per clause: **A** a named test asserts it · **B** needs a real Obsidian, no judgement,
not yet asserted · **C** no instrument settles it · **D** not asserted, and a vitest or browser-harness
test could. Flags: **CONTRARY** the test pins behaviour the case row contradicts (a ruling, not a
walk) · **OVERCLAIM** the case's own table cites a test that does not assert the clause · **UNRECORDED**
the case's table omits the clause · **RULING** case text and build disagree and neither is pinned.

## Counts

| Case | Steps | A | B | C | D | CONTRARY | OVERCLAIM | UNRECORDED | automated / human / open |
|---|---|---|---|---|---|---|---|---|---|
| Design an Asset 1–71b | 41 | 84 | 7 | 5 | 4 | 0 | 3 | 9 | 32 / 2 / 7 |
| Design an Asset 72–129 | 70 | 94 | 7 | 6 | 6 | 8 | 3 | 3 | 53 / 5 / 12 |
| Take an asset from the library into a plan | 19 | 45 | 0 | 1 | 8 | 0 | 1 | 10 | 12 / 1 / 6 |
| Compose an asset from parts | 23 | 53 | 0 | 0 | 0 | 7 | 0 | 0 | 23 / 0 / 0 |
| Calibrate a sheet and reserve space | 27 | 71 | 0 | 3 | 7 | 2 | 3 | 3 | 22 / 1 / 4 |
| Recover an asset design rather than lose it | 33 | 85 | 20 | 2 | 8 | 0 | 15 | 2 | 18 / 2 / 13 |
| Two designers on one asset | 8 | 30 | 1 | 1 | 1 | 1 | 0 | 3 | 5 / 1 / 2 |
| Browse the asset library | 20 | 36 | 1 | 5 | 3 | 3 | 0 | 5 | 12 / 4 / 4 |
| **Total** | **241** | **498** | **36** | **23** | **37** | **21** | **25** | **35** | **177 / 16 / 48** |

A step is **automated** when every clause is A, **human** when it holds a C and no B or D, **open**
when it holds a B or D. **177 of the 241 steps are fully discharged today.** If every B and D below
is built, the walk shrinks to the **21 steps that hold a C clause**, and only those clauses.

## The seven mutations that stayed green

| Case, step | Clause | What was broken | Now |
|---|---|---|---|
| Design 7 | the sheet appears | the raster's size zeroed | A via `assetDesignerRecoveryMore.e2e.ts` *lands a Remove reference…* (red under the same mutation); the case cites a test that keys on `design.background` |
| Design 8 | the `.rpgeo` is listed | `registerExtensions(['rpgeo'])` removed | B |
| Design 72 | icon before the words | icon moved after the label | D |
| Design 121 | Ctrl+Z claimed with nothing to undo | claim gated on `canUndo` | D (87 tests green) |
| Calibrate 32 | announced as "Mark clearance as reviewed" | `aria-label="Dismiss"` | D |
| Calibrate 12 | (evidence) calibration converts every pending group | `clearancePending` kept | row dropped as a precondition; the cited vitests do not hold it |
| Calibrate 9 | the anchor's pending line clears | `anchorPending` kept (138 files green) | D |

## (B) E2E-automatable, ranked by value

Ranked by what a failure would cost a user: data first, then host conflicts, then appearance.

1. **Recover 21** — after closing mid-history, the SECOND gesture persists and is drawn on reopen;
   Redo is dimmed; nothing warned before the tab closed. The body drives one nudge only.
2. **Design 24** — calibration, anchor, facing and height survive a plugin reload (the case's test
   uses a toilet preset with no calibration and reads the bowl only), and BOTH open designers reopen.
3. **Recover 37** — after a repair and a press, the notice, the Try again button and the header's
   "refresh needed" clear together, and the canvas shows the repaired file.
4. **Recover 2, 26, 29, 30** — the canvas and selection survive a refused write (2); the same shape
   and Inspector on reopen (26); no new tab of any type and no other leaf touched (29); after a
   trash, no notice, no offer to remove, and the sidecar's size recorded (30).
5. **Design 118, 121** — whether Obsidian's own binding also fires on Ctrl+Z inside a `<select>` or
   the slider (118) and on an exhausted Ctrl+Z (121); the Ctrl+G cases already show the pattern.
6. **Design 8** — the `.rpgeo` is listed in the file explorer (`.nav-file-title[data-path$=".rpgeo"]`).
7. **Design 7** — the sheet is drawn the right way up (sample the drawn image against the fixture's
   asymmetry).
8. **Design 87** — the thumbnail outline's contrast in both themes, read as computed styles.
9. **Recover 6, 8, 23, 25** — the early notice clears on its own (6); the stale notice arrives
   unprompted within about a second (8 — measured both ways on two machines, so a pin needs a
   tolerance first); no one-frame flash of the failure panel (23 — needs a frame sampler); the unload
   logs no error in general (25).
10. **Design 96, 97, 73; Two designers 1** — the cleared-selection Ctrl+G variant (96); the real
    ContextMenu key through CDP `Input.dispatchKeyEvent` (97); Obsidian's hover tooltip for an
    `aria-label` (73); dragging a tab into a new split through synthetic or CDP drag events (1 —
    moderate confidence; nobody has tried).
11. **Not buildable here:** Design 89 (Cmd+G needs a macOS leg; none exists) and Browse 31 (the host
    records no leaf history for this view, so the assertion cannot fail until it does).

## (D) Gaps a vitest or the browser harness can close (37)

- **Design 1–71b:** 27 the tank against the wall with a curved back (wall-snap and `backDepth` are
  tested apart, never together); 32b no selection change during the hold; 58 the canvas matches the
  preset card (both come from the built shape); 70 every dimension number clickable (`elementFromPoint`
  per label in the harness).
- **Design 72–129:** 72 icon before the words; 81 the scale bar's step matches the rulers'; 102a
  corners stay round through the whole drag (mid-drag sample); 107 not a plain stretch (needs an input
  where the two differ — the current one cannot fail); 120 Escape mid-gesture then Ctrl+Z undoes
  normally; 121 Ctrl+Z claimed with nothing to undo.
- **Recover:** 3 no notice, no panel, every tool live after a refusal; 5 the bowl springs back; 7 the
  bowl position, the selection and the Inspector after a failed read-back; 30 no diagnostic names the
  orphaned sidecar.
- **Calibrate:** 9 the anchor's and the detail's pending lines clear on calibration; 21f a press on a
  hidden-clearance edge starts a marquee, and the selection redraws unchanged; 21l the clearance is
  unaffected by an unrelated write; 32 the review button is reachable by Tab and named exactly.
- **Take:** 9 the duplicate's row joins the shelves; 14 the hand-off overrides the Add menu's last
  asset; 15 choosing between two open plans opens one with the banner and the asset; 16 Escape arms
  nothing; 21 the designer opens with the footprint drawn; 22 the menu item sits under the plans group.
- **Two designers 8:** no dialog appears on the conflict path.
- **Browse:** 11 the rail appears at 35rem and widens at 45rem (container queries run in the harness's
  Chromium); 26 the sidebar overlays the grid; 32 the category icon sits on the mark's edge (RULING,
  below).

## (C) The residue that stays a human walk (23 clauses, 21 steps)

- **Screen reader:** Design 88b, Calibrate 32. No instrument here drives assistive technology.
- **Native host UI:** Design 92 (Electron's native menu is not in the DOM).
- **Legibility and "reads as":** Design 7 (scale bar readable), 57 ×2, 70 (numbers readable), 103, 104,
  109; Browse 1, 3; Take 23.
- **Stated judgements with no pass condition:** Design 56, 121 (the Ctrl+Z/Ctrl+G inconsistency, by
  design checked by eye); Recover 20, 34; Calibrate 29 ×2; Two designers 10; Browse 11 ("unusable"),
  17, 33 (RULING).

## Rulings, not walks

**21 CONTRARY clauses** — a test pins what the build does, and the case row says otherwise. Each needs
a decision: the row is rewritten to the build, or the build is changed to the row.

- **Obsidian's Ctrl+G takes the chord in a default vault** (graph view): Compose 43, 49 ×2, 51;
  Design 90a, 90b, 95.
- **Focus after Group** lands on the row, not the canvas: Compose 48.
- **A duplicated or undone hidden part comes back shown**: Compose 7c ×2.
- **Edit dimensions on a traced, uncalibrated asset** does not scale the clearance and leaves Show
  clearance off: Calibrate 36a ×2.
- **The rounded rectangle loses its Corner radius row** through the asset's Edit dimensions: Design 102.
- **A pointer click draws no focus ring** (`:focus-visible`): Design 105.
- **One trace point placed does not block Ctrl+Z**: Design 120.
- **The basin's Width figure is covered** by the clearance offset and is reached only by keyboard:
  Design 125.
- **The Add rail is one column at the default leaf** before anything narrows: Design 76.
- **A drag held across a peer's write is dropped silently** (no Save error): Two designers 8.
- **The library's category vocabulary is closed, the funnel is hidden once a tile is selected, and a
  reopened library forgets Grid**: Browse 22, 27, 30.

**2 RULING clauses:** Browse 32 (the case says the category icon sits on the mark's edge; the build
centres it) and 33 (the case says "fainter and thinner", its own catch column says the same stroke
weight).

## Corrections the case files need (applied in the MANUAL-PASS rewrite, not here)

25 OVERCLAIM and 35 UNRECORDED rows, listed per case in the audit tables' section 4, plus three stale
passages: Design an Asset's *Deliberately NOT checked* says placing an asset on a plan does not exist
(it does — `assetPlacement.ts`, `assetLayer.test.ts`); Take's step-10 bullet says only opening the
plan can confirm a duplicate leaves the original alone (`assetHandoffMore.e2e.ts` compares the
`.rpgeo` byte for byte); and Browse's `none` rows at steps 1, 3 and 22 that plain vitests discharge.

## What this audit does not claim

- Unsampled A rows are the auditor's reading. Design's A rows were sampled at about one in six.
- Every e2e figure is from Obsidian 1.13.7 and latest on Linux (CI) and 1.13.7 on Windows (this
  machine); nothing ran on macOS.
- W24-A's own report says a drag behind a pending write is dropped when its window loses focus;
  several A rows over held drags depend on the window keeping focus for their duration.
