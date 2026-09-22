# Task report — W22-A retry presentation

Outcome: implemented
Owner / worktree / branch: W22-A · `.worktrees/ad14` · `w22a-retry-presentation`
Base commit / candidate commit: `9d146abbc` / see the hand-off line
Accepted contract revision: `r1` (AD18-R15; AD18-R13 read and not reopened)
Allowed scope and shared-file leases: `AssetDesignerRoot.vue` sub-let (the retry button's `class`
attribute and its docblock, nothing else), NEW `styles/designer-recovery.css` plus the ONE
`@import` line in `styles/index.css`, and this card's own tests.

## What was verified at the code before anything was built on it

`styles/designer.css`'s `.renovation-asset-designer-view, .renovation-asset-designer` rule reads
`display: flex; flex-direction: column; height: 100%; min-height: 0; color: var(--text-normal)`
and declares no `align-items` — so the initial `normal` behaves as `stretch`. `.rp-designer-notice`
in the same file is `margin: 0; padding: var(--size-4-1) var(--size-4-2)` with
`background-color: var(--background-secondary)` and a `border-top`. `AssetDesignerRoot.vue`'s
`v-if="staleAfterRefresh"` block holds a `<p class="rp-designer-notice" role="status">` and, as its
SIBLING, an unclassed `<button type="button" data-rp-action="retry">`. The card's reading of the
defect is the tree's.

`styles/designer.css` measured **399** lines (`wc -l`), one under the assembler's cap. Nothing in
this card touches it.

## The treatment, and the refusal with its losing side

`.rp-designer-retry` in the new partial:

- `align-self: flex-start` — the whole fix. It opts the one child out of the column's cross-axis
  stretch, so the control's inline size becomes its label's instead of the leaf's.
- `margin-block: 0 var(--size-4-1)` and `margin-inline: var(--size-4-2) 0` — the ASSOCIATION, and
  the notice's own padding restated rather than numbers picked here. The inline-start puts the
  button's box edge under the first character of the sentence it answers; the block-end keeps the
  strip's rhythm rather than letting the control touch whatever region follows. All four sides are
  stated because Obsidian's `button` rule declares no margin at all.
- `.rp-designer-retry:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px }`
  — the house rule rather than a choice, and the one thing here beyond the measured defect. Named
  explicitly so a reviewer can cut it: Obsidian's `button:focus-visible` box-shadow is what
  `styles/forms.css` records at **2.29:1** dark and **1.88:1** light, both under WCAG 1.4.11's 3:1,
  against `--interactive-accent`'s 4.00:1 and 3.43:1 on the same two surfaces.
  `.rp-empty-state__action` and `.rp-view-failure__action` each carry the identical override with
  that identical measurement, and each records that a flow with two different rings is the next
  finding. The moment this button stops being anonymous it joins that set.

**Refused: giving the button the notice's own `--background-secondary`** so the tint runs unbroken
from strip to control. **Its losing side is real and is what was given up** — an L-shaped tinted
block reads as ONE unit, where a button on the plain background reads as a neighbour of one. It
loses because a `<button>` whose background is `--background-secondary` has given up
`--interactive-normal` and with it Obsidian's hover background and `--input-shadow`, the two things
on screen that say "pressable". On the surface a user meets when a read has failed, pressability is
worth more than adjacency — and neither arm is checkable here, which is why the trade is written
into the partial rather than merely taken.

**Refused: a wrapper making the two into one strip.** Not available at all — AD18-R15 settles the
sibling placement, four test files read `.rp-designer-notice`'s whole text as EQUAL to its sentence.

**Refused: a negative `margin-block-start` butting the control against the tinted strip.** It
depends on paint order against a background this card cannot render, and it would be clever rather
than boring.

No colour literal anywhere; Obsidian variables only (SDD §84).

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `styles/designer-recovery.css` (NEW, **77 lines**) | The one rule and its `:focus-visible` companion, plus the account of the defect, the refusal and what no gate here can see | Yes — the new partial the lease names |
| `styles/index.css` | ONE `@import "./designer-recovery.css";`, after `designer-narrow.css` | Yes — the one line the lease names |
| `src/presentation/designer/AssetDesignerRoot.vue` | `class="rp-designer-retry"` on the retry button (+1 template line), and a paragraph in `onRetry`'s docblock | Yes — the sub-let, class attribute and docblock only |
| `tests/build/designerRecoveryStyles.test.ts` (NEW) | The stylesheet half: the declaration, the reader's own instrument, and both ends of the hook | Yes — "its own tests" |
| `tests/presentation/designer/designerStaleRetry.test.ts` | ONE case: the class is applied, and the three attributes the lease forbids touching are unchanged | Yes — "its own tests"; the file that already owns this control, so the rig is reused rather than cloned |

`git diff --name-only 9d146abbc..<sha>` is those five and nothing else.

## Behaviour: what did NOT change

`git diff` over `AssetDesignerRoot.vue` is **9 added lines, 0 removed** — eight comment lines in
`onRetry`'s docblock and one `class` attribute. `onRetry`, `retriesFailed`, `retrying`,
`staleMessage`, the `v-if`, `writesBlocked`, `aria-describedby`, `aria-disabled` and
`data-rp-action` are byte-identical. The four pre-existing cases in `designerStaleRetry.test.ts`
pass unchanged, and the new case re-asserts the accessible name, the describedby association (by
ID, against the notice that actually carries it — never `find('.rp-designer-notice')`, which that
file's own `notices` helper warns can answer the background notice) and the resting
`aria-disabled`, because an edit that added the class and dropped one of those in the same tag
would pass every existing case: each of them reads a different one.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| The retry is no longer stretched by the shell column | Declared, **not drawn** | `designerRecoveryStyles.test.ts` › "opts the retry out of the shell column's stretch, and sets all four margins" — the rule declares exactly `['align-self','margin-block','margin-inline']` and the parsed `align-self` is `{ type: 'self-position', overflow: null, value: 'flex-start' }` | **No test here proves the rendered box.** The integrator's probe is the only instrument |
| The control carries the class | Pass | `designerStaleRetry.test.ts` › "classes the control so the stylesheet can constrain it, and changes none of its semantics" | — |
| The rule reaches a real element | Pass | `designerRecoveryStyles.test.ts` › "declares one class, and it is one the project puts on a button" — `classesNamed` of the partial is exactly `['rp-designer-retry']`, and `buttonClasses()` (every `<button>` under `src/presentation` and `src/prototypes`) holds `.rp-designer-retry` | — |
| The partial and its `@import` cannot be separated | Pass | The assembler refuses (below), and `tests/helpers/buttonRules.ts` throws at module load | — |
| No hard-coded colour | Pass | `assembleStyles()` returns; `checkForHardcodedColors` runs per partial | — |
| Behaviour unchanged | Pass | 5/5 in `designerStaleRetry.test.ts`; 1065/1065 across `tests/presentation/designer` | — |

## Every red, watched and verbatim

**1. `align-self` deleted from the partial** — `tests/build/designerRecoveryStyles.test.ts`:

```
FAIL  |build| tests/build/designerRecoveryStyles.test.ts > the designer recovery partial > opts the retry out of the shell column’s stretch, and sets all four margins
AssertionError: expected [ 'margin-block', 'margin-inline' ] to deeply equal [ 'align-self', 'margin-block', …(1) ]
- Expected
+ Received
  [
-   "align-self",
    "margin-block",
    "margin-inline",
  ]
 ❯ tests/build/designerRecoveryStyles.test.ts:61:42
```

**2. `class="rp-designer-retry"` deleted from the template** — the jsdom case:

```
FAIL  |suite| tests/presentation/designer/designerStaleRetry.test.ts > the stale notice’s way out > classes the control so the stylesheet can constrain it, and changes none of its semantics
AssertionError: expected [] to include 'rp-designer-retry'
 ❯ tests/presentation/designer/designerStaleRetry.test.ts:278:28
```

**3. The same deletion, seen from the OTHER end** — the build test, which is why there are two
instruments rather than one:

```
FAIL  |build| tests/build/designerRecoveryStyles.test.ts > the designer recovery partial > declares one class, and it is one the project puts on a button
AssertionError: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ tests/build/designerRecoveryStyles.test.ts:89:44
```

**4. The `@import` line deleted** — the assembler, called as a function (see the finding below):

```
REFUSED: styles/index.css does not import: designer-recovery.css
EXIT=1
```

and, at module load, every test importing `tests/helpers/buttonRules.ts`:

```
FAIL  |build| tests/build/designerRecoveryStyles.test.ts [ tests/build/designerRecoveryStyles.test.ts ]
Error: styles/index.css imports styles/view.css, … ; the directory holds …, styles/designer-recovery.css
 ❯ tests/helpers/buttonRules.ts:142:8
```

Each mutation was restored immediately and `git diff` re-read afterwards.

## A FINDING about the brief's own instrument, reported rather than fixed

**`node scripts/styles-assemble.mjs` does nothing and exits 0 unconditionally.** That file has no
CLI entry: its only top-level export is `export function assembleStyles()`, there is no
`import.meta.url` main guard, no `process.argv` read and no top-level call
(`grep -n "^export" scripts/styles-assemble.mjs` prints one line, at 408; `grep` for
`process.argv|import.meta.url` prints nothing). Running it with an UNIMPORTED partial on disk still
exited 0 — measured, before the import line was added back. `package.json` never invokes it either;
`scripts/vite-assembled-styles.mjs` imports the function and both Vite surfaces call it.

So the card's instruction *"Run `node scripts/styles-assemble.mjs` and read its exit code"* is not
an instrument — it is CLAUDE.md's own *"an instruction nobody has run is a plan, not a procedure"*,
met on this card. What was run instead, and what this report's evidence rests on:

```
node -e "import('./scripts/styles-assemble.mjs').then(m => { const s = m.assembleStyles(); … })"
assembled OK, 12007 lines; recovery present: true
EXIT=0
```

Not fixed here: adding a main guard to `scripts/styles-assemble.mjs` is outside this lease, and the
sentence it would falsify is in the wave-22 card and in CLAUDE.md's `build` paragraph
(*"the build fails on a partial no entry file imports"* — true of the BUILD, which calls the
function, and not of that command line).

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `assembleStyles()` via `node -e` | candidate | exit 0 | `assembled OK, 12007 lines; recovery present: true` |
| `npx vitest run tests/build/designerRecoveryStyles.test.ts` | candidate | exit 0 | `Test Files 1 passed (1) · Tests 3 passed (3)` |
| `npx vitest run tests/presentation/designer/designerStaleRetry.test.ts` | candidate | exit 0 | `Test Files 1 passed (1) · Tests 5 passed (5)` |
| `npx vitest run tests/presentation/designer` | candidate | exit 0 | `Test Files 77 passed (77) · Tests 1065 passed (1065)` |
| `npx vitest run tests/harness` | candidate | exit 0 | `Test Files 34 passed (34) · Tests 400 passed (400)` |
| `npx vitest run` over `styles`, `buttonSpecificity`, `buttonFocusRing`, `focusReach`, `buttonBoxNeutralised`, `designerRecoveryStyles` | candidate | exit 0 | `Test Files 6 passed (6) · Tests 365 passed (365)` — **the first run of this set reported 3 failures, two of them `Test timed out in 5000ms`; re-run ALONE, the same tree is green.** A parallelism artifact, per CLAUDE.md; no budget was raised |
| `npx vitest run` over `encoding`, `libraryComponentStyles`, `prototype-styles`, `cssVars`, and the six `tests/presentation/views/*Styles*` | candidate | exit 0 | `Test Files 10 passed (10) · Tests 245 passed (245)` |
| `npx vue-tsc -noEmit` | candidate | exit 0 | no output |
| `npx oxlint` over all five changed files | candidate | exit 0 | oxlint prints nothing when clean; the exit code is the evidence |
| `npx eslint` over the SFC and both test files | candidate | exit 0 | no output |
| `npx eslint --rule '{"max-lines":[…,{"max":1,…}]}'` on the SFC | base `9d146abbc` / candidate | **391 → 392** counted lines | `File has too many lines (391)` at base, `(392)` after: exactly one counted line added (the template attribute); the eight docblock lines are script comments and are skipped. **8 of 400 headroom left.** |
| `grep -rln "rp-designer-retry" styles/` | candidate | `styles/designer-recovery.css` | Run AFTER the change; the partial's header sentence is written from what it printed |
| `wc -l styles/designer-recovery.css` | candidate | `77` | The new partial, well under the 400-line cap |

## Branches introduced

**None, in `src/`.** Measured rather than argued, from `coverage-final.json` at a scratch
`--coverage.reportsDirectory` (the shared `coverage/` was never written):

| | statements | functions | branches |
|---|---|---|---|
| `AssetDesignerRoot.vue` at `9d146abbc` | 128 | 26 | 59 |
| `AssetDesignerRoot.vue` at the candidate | 128 | 26 | 59 |

A static `class` attribute compiles to a constant in the vnode; there is no conditional to drive.
The floors (99/99/99/98) are therefore untouched by this card, and `npm run test:coverage` was NOT
run (see below).

## Verification not performed

- **The rendered box — the whole point of the card, and it cannot be drawn here.**
  `mountAssetDesignerHarness` takes `select`, `mode`, `draw`, `camera`, `pending`, `grid` and
  `viewMenu`; `tests/harness/page.ts` passes its `stale` knob to the PLAN EDITOR branch only. No
  fixture reaches this state, so `npm run harness-shot` has nothing to capture and **no appearance
  outcome is claimed anywhere in this report.** A harness knob would change that and is a card of
  its own (AD18-R15 says so in as many words).
- **`npm run check`, `check:fast`, `test:coverage` and `analyze`** — forbidden by the card while
  another agent works. CI on the pull request is where they run. In particular: `eslint .` over the
  whole tree, the coverage floors as floors, and fallow's dead-file/duplication pass have not run
  against this candidate.
- **A live vault (`npm run test-build`)** — not run. Appearance is verified nowhere else, and the
  manual case for this surface is `docs/tests/cases/Recover an asset design rather than lose it.md`.
- **Colour contrast, a visible focus indicator, and hit-target size** — jsdom measures none of the
  three, so the `:focus-visible` rule's 4.00:1 / 3.43:1 figures are `styles/forms.css`'s recorded
  measurement CITED, not re-measured on this control.
- **Whether the accent outline and Obsidian's surviving `box-shadow` look right together** — both
  draw (the rule suppresses no shadow). Every sibling action in this project has the same pairing;
  nothing here photographs it.
- **RTL** — `margin-inline` and `align-self: flex-start` are logical/flex-relative by construction,
  and no gate or capture in this repository exercises a right-to-left leaf.
- **`tests/build/lint-edited.test.ts`, `tests/release/**`, `tests/plugin/**`, `tests/application/**`,
  `tests/domain/**`, `tests/infrastructure/**`** — not run. Nothing in this diff reaches them; named
  rather than silently skipped.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none — this is one CSS rule and one class attribute.
Undo/no-op/conflict/failure coverage: unchanged; `onRetry`'s in-flight guard and episode counter are
byte-identical.
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: none. No new locale key; the button's text is
still `designer.refresh-failed.retry`.
Rollback/recovery considerations: reverting is the partial, its `@import` line and the class
attribute together. The `@import` and the partial may not be separated — the assembler refuses an
unimported partial (proven above) and `tests/helpers/buttonRules.ts` throws at load.

## What the integrator's re-capture must check

Inject the real markup from `AssetDesignerRoot.vue`'s `v-if="staleAfterRefresh"` block into the
rendered tree of `?view=asset-designer` at a **1024 px** leaf, exactly as AD18-R15's measurement was
taken, with the class attribute present, and report:

1. The button's **width**. It was `1024`; it must now be its label's intrinsic width plus Obsidian's
   `padding: var(--size-4-1) var(--size-4-3)` — far short of the leaf. This is the number the card
   turns on.
2. Its **`left`**. It was `0`; it must be `8` (`--size-4-2`), lining its box edge up with the first
   character of the notice's sentence above it.
3. Its **height**, which must still be `30` (`--input-height`). Nothing here touches it, and a
   change would mean the rule reached further than it claims.
4. That the **notice above is still full width** (`1024`) with its `background-secondary` and its
   1 px `border-top`. The card constrains the button and must not have moved the strip.
5. The gap below the button — `4` (`--size-4-1`) to whatever follows.
6. Whether it now reads as an ACTION rather than as a second toolbar. That is a judgement, not a
   number, and it is the reason the card exists; report it as a judgement.

If (1) still reads `1024`, the `@import` line is the first thing to check: the rule ships only
through the assembled sheet.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
