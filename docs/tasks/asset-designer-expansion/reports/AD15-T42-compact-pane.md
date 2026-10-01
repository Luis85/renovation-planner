# Task report — AD15-T42 (compact pane)

Outcome: implemented, with the row's claim NARROWED — see "What 'reachable' means" below. Row
T42 is re-graded by the coordinator as *partial — DOM/focus half closed, appearance half open*,
never `passed`.
Owner / worktree / branch: worker, `.worktrees/ad10`, `ad15-t42-compact`
Base commit / candidate commit: base `7edff8c4c` / first candidate `8c941c491`, plus one fix
round answering an independent review's five conditions (see "Review round" below)
Accepted contract revision: `docs/tasks/asset-designer-expansion/reports/AD15-validation-matrix.md` row T42
Allowed scope and shared-file leases: one new file,
`tests/presentation/designer/designerResponsiveShell.test.ts`, plus this report as the one
declared exception. No `src/` and no `styles/` file is modified by this branch.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/presentation/designer/designerResponsiveShell.test.ts` | New. Renders the mounted asset designer at 520, 900 and 1400 px and asserts a primary action, a failure with its retry, and the additive stale notice are reachable at each — and that the control set does not change across the 35rem threshold in either direction. | Yes — the leased file |
| `docs/tasks/asset-designer-expansion/reports/AD15-T42-compact-pane.md` | This report. | Yes — the declared exception |

## What "reachable" means in this test, and what it does not

This is the load-bearing paragraph of the report; the row must not be read as closed wider
than it is.

**It means, for a control:** the element is in the document (`isConnected`), it is enabled
(neither the `disabled` property nor `aria-disabled="true"`), it carries an accessible name
(text content or `aria-label`), and it takes focus when `.focus()` is called. Those four are
the whole of the `reachable()` predicate in the file and there is no other definition.

**It means, for the non-focusable status region** (`.rp-designer-notice`): present, keeping
`role="status"`, and saying the sentence it is supposed to say.

**It does NOT mean visible, on screen, unclipped, of a usable hit size, or legible.** jsdom has
no rendering engine: it lays nothing out, computes no used width, and applies no `@media` or
`@container` query. The `@container rp-designer (width < 35rem)` block in
`styles/designer-narrow.css` therefore has NO effect in any case in this file. A green run says
the compact layout removes nothing from the DOM and from the focus order; it says nothing about
what the compact layout LOOKS like. `tests/harness/accessibility*.test.ts` records the same three
limits (contrast, focus indicator, hit size) for the same reason, and
`npm run harness-shot -- --width=460` remains the only instrument in this repository that
measures a rendered layout at all — it was not available here (see "Verification not performed").

**Why the widths are nevertheless a live axis rather than decoration.** No module the designer
MOUNTS decides anything from a width. **The instrument for that claim is an import-graph walk
from `AssetDesignerView.ts`, not the grep** — a point the review round corrected and this
section had wrong: my grep was scoped to `src/presentation/designer/` (it printed nothing,
exit 1, against the restored tree) while the sentence after it was about the whole mounted
tree, so a reader who re-ran it tree-wide would get hits and read the claim as broken. Walked —
435 reached files, 0 unresolved — exactly two modules name a width term:

- `src/presentation/editor/surface/EditorSurface.vue`'s `ResizeObserver`, which measures its
  OWN container to size the Konva stage and decides no region and no control from it; and
- `src/presentation/editor/scene/followPixelRatio.ts`'s `matchMedia('(resolution: Ndppx)')`,
  which is a device-pixel-ratio query and not a width at all.

So the designer's compact behaviour is CSS-only, and the guarantee this file pins is
INVARIANCE: the primary actions and the error survive every width because no width-driven branch
exists to drop them. **Read that honestly: today the three widths produce an identical tree, so
the invariance case would also pass against a component that ignored width entirely.** That is
not the same as the case being unable to fail — the two channels such a branch would read a
width through are both supplied (`clientWidthFor` before `onMounted`, `resizeTo` with its
observer callback afterwards) and BOTH were watched red against a deliberately inserted width
branch (red-watches 4 and 5 below). The file's own header now carries this sentence too; it was
in the report only, which is the one place a future reader of the test would not look.

**Blind spots, stated because a check that cannot see them must not be read as if it could:** a
width read from `window.innerWidth`, `matchMedia` or `getBoundingClientRect` is invisible to both
channels; and a control hidden by `display: none` under the container query is invisible to every
case here, because jsdom resolves no CSS.

**That second blind spot is EMPTY today, which strengthens the claim and neither document said
so before this round.** Measured: the whole of `designer-narrow.css`'s
`@container rp-designer (width < 35rem)` block declares `flex-direction`, `flex`, `width`,
`border-top`, `border-right`, `border-bottom` and `border-left` — and `grep -n
"display\|visibility\|content-visibility" styles/designer-narrow.css` prints nothing (exit 1).
The narrow layout hides nothing, so the invariance this file asserts would hold in a real
browser today as well, not merely in jsdom. The blind spot stays named because it is a blind
spot about the FUTURE: the day a rule hides something there, nothing in this file notices.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| T42: something renders the designer at 520 / 900 / 1400 px | Met | `designerResponsiveShell.test.ts` mounts the real `designerRig` at each width via `clientWidthFor` (pre-mount) + `resizeTo` (post-mount); 10 cases, all green | jsdom applies no container query — the widths drive JS branches only |
| T42: a primary action is reachable at each width | Met, at the narrowed meaning above | `keeps every entry path on the no-shape state reachable at {520,900,1400}px` — the `.rp-empty-state__action` LABELS pinned as an exact ordered list (`empty.asset.no-shape.action`, `designer.inspector.start-preset`), each asserted connected/enabled/named/focusable | Says nothing about visibility or hit size. The first candidate asserted `length > 0` under a docblock claiming it asserted every path — fixed in the review round, see red-watch 6 |
| T42: an error is reachable at each width | Met, at the narrowed meaning above | `keeps a refused read's failure and its retry reachable at %ipx` (`.rp-view-failure` headline + `.rp-view-failure__action`) and `keeps the stale-refresh notice reachable at %ipx` (`.rp-designer-notice`, `role="status"`, `designer.refresh-failed`) | Both errors driven through the real `useAssetDesignStore().hydrate` door with a refusing query bundle |
| T42: the check would catch a width-driven regression | Met | Red-watches 4 and 5 — a temporary `ResizeObserver`-driven `v-if` on the root turned the invariance case red naming every dropped control, and the mount-time channel turned case 1 red at 520 px only | Only catches a branch reading `clientWidth` / a `ResizeObserver` |
| Not duplicating `designerStyles.test.ts` | Met | This file reads no stylesheet and imports no `selectors.ts` helper; `designerStyles.test.ts` remains the authority for what the narrow block DECLARES | — |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerResponsiveShell.test.ts` | first candidate `8c941c491`, restored tree | exit 0 — `Test Files 1 passed (1)`, `Tests 10 passed (10)`, 45.99s | `D:/tmp-claude/t42-green.log` |
| `npx vitest run tests/presentation/designer/designerResponsiveShell.test.ts` | fix round, restored tree | exit 0 — `Test Files 1 passed (1)`, `Tests 10 passed (10)`, 44.14s | `D:/tmp-claude/t42-final.log` |
| `npx oxlint tests/presentation/designer/designerResponsiveShell.test.ts` | both rounds | exit 0, no findings | the first draft's `Array#sort()` finding was reported by the edit-loop hook and fixed to `toSorted()` |
| `npx eslint tests/presentation/designer/designerResponsiveShell.test.ts` | both rounds | exit 0, no output | — |
| `npx vue-tsc -noEmit` | both rounds | exit 0 | `D:/tmp-claude/t42-tsc.log` (empty) |
| `git status --porcelain` after every temporary break was restored | both rounds | only this branch's own files | — |
| `git diff 7edff8c4c..HEAD -- src styles` | fix round | empty | no source or stylesheet change on this branch |

### Red-watch per case — every assertion watched failing

**Red-watch 1 — the entry-path reachability cases.** Break: `disabled` added to the
"Start from preset" button in `src/presentation/designer/DesignerEntryPaths.vue`.

```
 FAIL  |suite| tests/presentation/designer/designerResponsiveShell.test.ts > the asset designer rendered at a leaf’s width > keeps every entry path on the no-shape state reachable at 520px
 FAIL  |suite| tests/presentation/designer/designerResponsiveShell.test.ts > the asset designer rendered at a leaf’s width > keeps every entry path on the no-shape state reachable at 900px
 FAIL  |suite| tests/presentation/designer/designerResponsiveShell.test.ts > the asset designer rendered at a leaf’s width > keeps every entry path on the no-shape state reachable at 1400px
AssertionError: expected { connected: true, …(3) } to deeply equal { Object (connected, enabled, ...) }

- Expected
+ Received

  {
    "connected": true,
-   "enabled": true,
-   "focusable": true,
+   "enabled": false,
+   "focusable": false,
    "named": true,
  }

 ❯ tests/presentation/designer/designerResponsiveShell.test.ts:145:59
```

`Tests  3 failed | 7 passed (10)`. The invariance case stayed green, correctly: a disabled
button is filtered out of the compared set at every width alike.

**Red-watch 2 — the failure-and-retry cases.** Break: the `actionLabel` line deleted from the
retryable arm of `failure` in `src/presentation/designer/AssetDesignerRoot.vue`.

```
 FAIL  |suite| tests/presentation/designer/designerResponsiveShell.test.ts > the asset designer rendered at a leaf’s width > keeps a refused read’s failure and its retry reachable at 520px
 FAIL  |suite| tests/presentation/designer/designerResponsiveShell.test.ts > the asset designer rendered at a leaf’s width > keeps a refused read’s failure and its retry reachable at 900px
 FAIL  |suite| tests/presentation/designer/designerResponsiveShell.test.ts > the asset designer rendered at a leaf’s width > keeps a refused read’s failure and its retry reachable at 1400px
Error: no .rp-view-failure__action in the mounted designer
 ❯ one tests/presentation/designer/designerResponsiveShell.test.ts:105:28
```

`Tests  3 failed | 7 passed (10)`.

**Red-watch 3 — the stale-notice cases.** Break: `role="status"` changed to `role="note"` on
the `staleAfterRefresh` paragraph in `AssetDesignerRoot.vue`.

```
 FAIL  |suite| tests/presentation/designer/designerResponsiveShell.test.ts > the asset designer rendered at a leaf’s width > keeps the stale-refresh notice reachable at 520px
AssertionError: expected 'note' to be 'status' // Object.is equality
Expected: "status"
Received: "note"
 ❯ tests/presentation/designer/designerResponsiveShell.test.ts:184:39
```

`Tests  3 failed | 7 passed (10)`. This break exercises the role assertion specifically; the
PRESENCE half of the same case throws through the identical `one()` door that red-watch 2
already shows failing verbatim, so presence was not broken a second time.

**Red-watch 4 — the invariance case, and the `resizeTo` channel.** Break: a temporary
`ResizeObserver` added to `AssetDesignerRoot.vue` writing a `compact` ref from the shell root's
`clientWidth` (`< 560`), with `v-if="!compact"` on `<DesignerToolbar />`.

```
 FAIL  |suite| … > offers the same controls at every width, and across the threshold in both directions
AssertionError: expected { 'step 0: 520px': [ …(4) ], …(3) } to deeply equal { 'step 0: 520px': [ …(16) ], …(3) }
- Expected
+ Received
@@ -1,23 +1,11 @@
  {
    "step 0: 520px": [
-     "Calibrate",
-     "Draw circle",
-     "Draw line",
-     "Draw rectangle",
-     "Draw rounded rectangle",
-     "Pan",
-     "Select",
-     "Set anchor",
      "Set dimensions",
      "Set dimensions",
-     "Set facing",
      "Start from preset",
      "Start from preset",
-     "Trace clearance",
-     "Trace detail",
-     "Trace footprint",
    ],
    "step 1: 900px": [
…
    "step 3: 520px": [
-     "Calibrate",
…
```

`Tests  1 failed | 9 passed (10)`. It names every control the width branch dropped, and it fails
at BOTH the initial narrowing (step 0) and the return to 520 (step 3).

**Red-watch 5 — the mount-time (`clientWidthFor`) channel.** Same temporary branch, with the
`v-if="!compact"` moved onto `<DesignerEntryPaths>` so a case that MOUNTS at 520 px is the one
that can see it.

```
 FAIL  |suite| … > keeps every entry path on the no-shape state reachable at 520px
AssertionError: expected 0 to be greater than 0
 ❯ tests/presentation/designer/designerResponsiveShell.test.ts:144:26
 FAIL  |suite| … > offers the same controls at every width, and across the threshold in both directions
AssertionError: expected { 'step 0: 520px': [ …(14) ], …(3) } to deeply equal { 'step 0: 520px': [ …(16) ], …(3) }
```

`Tests  2 failed | 8 passed (10)`. The 900 px and 1400 px variants of the same case stayed
green, which is what makes this a width discrimination and not merely a missing button.

**Red-watch 6 — the review round's condition 2, on the fixed assertion.** Break: the
always-rendered "Start from preset" button deleted outright from `DesignerEntryPaths.vue`.

```
 FAIL  |suite| … > keeps every entry path on the no-shape state reachable at 520px
 FAIL  |suite| … > keeps every entry path on the no-shape state reachable at 900px
AssertionError: expected [ 'Set dimensions' ] to deeply equal [ 'Set dimensions', …(1) ]
- Expected
+ Received
  [
    "Set dimensions",
-   "Start from preset",
  ]
 ❯ tests/presentation/designer/designerResponsiveShell.test.ts:158:70
```

`Tests  3 failed | 7 passed (10)`, all three widths. **The candidate's original assertion would
have stayed GREEN against this exact mutation** — one surviving control still satisfies
`length > 0` — which is what made it a defect rather than a wording problem.

**Cases that could NOT be made to fail: none.** Every assertion in the file was watched red.

All six breaks were reverted with `git checkout -- <file>`; `git status --porcelain` afterwards
shows only this branch's own two files.

## Verification not performed

- **`npm run check`, `npm run test:coverage`, `npm run lint`, `npm run analyze`, and any bare
  `npx vitest run`.** Out of a worker's remit this wave: two other workers share this machine and
  a broad run produces a wrong red rather than a slow one. The integrator runs the full gate on
  the integration SHA. In particular the COVERAGE floors and `eslint .` over the whole tree were
  not exercised by me; only this one file was linted, by hand, with both linters.
- **`npm run harness` / `npm run harness-shot -- --width=460`.** Not run. There is no pinned
  Chromium on this machine and `npx playwright install chromium` is forbidden here (it emptied
  `node_modules` once). This is the significant one: a rendered capture at a sidebar's width is
  the ONLY instrument in this repository that could confirm the compact layout LOOKS right, and
  nothing in my file substitutes for it. The row T42 gap about appearance at width remains open;
  what I closed is the DOM/focus-order half.
- **A live Obsidian vault (`npm run test-build`) and any manual case under `docs/tests/`.**
  Obsidian cannot run here. Whether an Obsidian sidebar leaf at 460 px actually applies the
  `@container` block, and whether the stacked inspector is usable there, is unverified by this
  branch.
- **axe-core at width.** Considered and deliberately refused: `tests/harness/accessibility*.test.ts`
  scans a mounted surface, but since jsdom resolves no CSS, axe would report identically at all
  three widths. A scan repeated per width would LOOK like a width test and be none — exactly the
  failure the card warns against — so no axe case was added.
- **Whole-suite interaction.** The file was only ever run alone. Its four `designerRig` mounts
  are the same rig every other designer suite builds, so no new module-level state is introduced,
  but this was not measured under the full `--coverage` run.
- **Mutation testing of the new file.** Not run; the five red-watches above are the substitute
  and they cover every assertion.

## Data and integration implications

Schema/migration change: none. This branch adds one test file and one report.
Relevant renderer/export/revision consumers: none.
Undo/no-op/conflict/failure coverage: the two error paths are driven through the real
`useAssetDesignStore().hydrate` with a refusing `AssetDesignerQueryServices` bundle — the
retryable `vault.unexpected-failure` arm, once with `keepPreviousOnFailure` unset (the
`.rp-view-failure` panel) and once with it set (the additive `.rp-designer-notice` strip). No
command is dispatched and nothing is written.
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: none. Every string is read through
`t('en', …)` rather than spelled, so a copy change moves both ends at once.
Rollback/recovery considerations: reverting the commit removes one test file; nothing in `src/`
or `styles/` depends on it.

## Findings for the integrator — no `src/` or `styles/` change made

I believe **no** `src/` or `styles/` change is needed for this row, and I made none. Two
observations worth the integrator's attention, both offered as observations rather than as
proposed fixes:

1. **The designer has no JS width mechanism at all, by design** — unlike the plan editor, which
   has `ResponsiveEditorShell.vue`, a `layoutMode` and an unsupported-width floor. Nothing here
   argues it should acquire one; `designer-narrow.css`'s own header already refuses the drawer
   ("that is the plan editor's constrained answer … a second mechanism this surface does not
   need"). The consequence for the validation matrix is only that T42's "reachable at width"
   can be closed in jsdom at the DOM/focus-order level and no further.
2. **The appearance half of T42 is still open and needs a capture, not a test.** If the wave
   wants "a primary action and an error are reachable" in the stronger sense of visible and
   hittable at 460–520 px, that is `npm run harness-shot -- --width=460` against
   `?view=asset-designer`, on a machine with the pinned Chromium. I could not run it and did not
   pretend to.

## Review round — the five conditions, and what each one changed

An independent review returned APPROVE conditional on five changes. All five are in the fix
commit; nothing in `src/` or `styles/` was touched for any of them.

1. **"those buttons are the only way into a design at all" was false.** `grep -rn "start-preset"
   src/presentation/designer/` prints five lines: two prose mentions in
   `DesignerClearanceReview.vue` and `DesignerUsePlan.vue`, the `.rp-designer-start-preset`
   control and its label in `DesignerInspector.vue`, and `DesignerEntryPaths.vue`'s own. So the
   same door exists outside the empty state. The sentence is now scoped to the empty state and
   names the inspector's copy.
2. **A real defect, not prose.** `expect(actions.length).toBeGreaterThan(0)` sat under a
   docblock claiming it asserted EVERY entry path — and this rig has exactly two, so deleting
   either left it green. It now pins the two labels as an exact ordered list, and red-watch 6
   above quotes the mutation failing.
3. **"exactly the one nothing rendered until this file" was false.**
   `assetDesignerRoot.test.ts` already mounts this designer, renders `.rp-view-failure`, finds
   `.rp-view-failure__action`, clicks it and asserts the re-read. Narrowed to "nothing rendered
   AT A WIDTH", which is what is actually new.
4. **The header's grep did not establish the header's claim.** Corrected as described under
   "Why the widths are nevertheless a live axis" — the import walk is named as the instrument,
   and `followPixelRatio.ts`'s `matchMedia('(resolution: Ndppx)')` hit is named with why it is
   a device-pixel-ratio query rather than a width.
5. **520 is not the sidebar leaf's width.** 460 is — `designer-narrow.css`'s own header says so
   and it is the width `harness-shot -- --width=460` captures and that has already hidden a
   layout defect here. 520 is the matrix row's number. The `WIDTHS` comment now says both, and
   says why no sixth width was added: 460 and 520 are both below the 560 px threshold and are
   the same tree in an environment that applies no container query.

Plus one thing the review found that STRENGTHENS the file and neither document said: the
`display: none` blind spot is empty today (measured, under "Blind spots" above), so the
invariance holds in a real browser as well. And the header now carries the sentence that the
three widths produce an identical tree today — it was in this report only, which is the one
place a reader of the test would not look.

**Explicitly out of this round, by the coordinator's instruction:** no `src/` or `styles/`
change, no file rename, and NOT the container-query resolution the reviewer sketched (resolving
`designer-narrow.css`'s query by hand against the mounted tree's class list). That is larger
than this lease and is recorded as the next card.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.
