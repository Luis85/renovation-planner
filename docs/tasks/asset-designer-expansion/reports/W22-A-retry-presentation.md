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

`styles/designer.css` measured **399** lines (`wc -l`), one under the assembler's cap — no room for
a rule and its comment. Nothing in this card touches it. The partial's own header said that file
*"stands at the assembler's 400-line CAP"*, three lines above a paragraph insisting the argument is
the cap and never a figure; it now claims no room rather than a position, with no number at all
(review finding F3).

## The treatment, and the refusal with its losing side

`.rp-designer-retry` in the new partial:

- `align-self: flex-start` — the whole fix. It opts the one child out of the column's cross-axis
  stretch, so the control's inline size becomes its label's instead of the leaf's.
- `margin-block: 0 var(--size-4-1)` and `margin-inline: var(--size-4-2) 0` — the ASSOCIATION, and
  the notice's own padding restated rather than numbers picked here. The inline-start puts the
  button's box edge under the first character of the sentence it answers; the block-end keeps the
  strip's rhythm rather than letting the control touch whatever region follows. All four sides are
  stated because Obsidian's `button` rule declares no margin at all.
- `.rp-designer-retry:focus-visible` with the accent outline at `outline-offset: 2px` — **the
  consistent choice, not scope creep.** The first version of this report offered it for cutting on
  the strength of two siblings; the review found I had cited the two weakest precedents and missed
  the designer's own. Re-measured in THIS tree with an anchored grep (below): **13 declarations
  across 8 designer partials, of which 12 predate this card.** Without the rule, the designer's one
  recovery control would be the only one of that set left on Obsidian's default
  `button:focus-visible` box-shadow, which `styles/forms.css` records at **2.29:1** dark and
  **1.88:1** light — both under WCAG 1.4.11's 3:1 — against `--interactive-accent`'s 4.00:1 and
  3.43:1. So the "two different rings in one flow" risk runs the OTHER way (review finding F4).
  `outline-offset: 2px` is the minority spelling and is named as such: six of the twelve use `1px`
  and four use `-2px`; `2px` matches `designer-presets`, `designer-dimensions` and both siblings
  originally cited, and suits this control because its own margin insets it.

**Refused: giving the button the notice's own `--background-secondary`** so the tint runs unbroken
from strip to control. **Its losing side is real and is what was given up** — an L-shaped tinted
block reads as ONE unit, where a button on the plain background reads as a neighbour of one. It
loses because a `<button>` whose background is `--background-secondary` has given up
`--interactive-normal` and with it Obsidian's hover background and `--input-shadow`, the two things
on screen that say "pressable". On the surface a user meets when a read has failed, pressability is
worth more than adjacency — and neither arm is checkable here, which is why the trade is written
into the partial rather than merely taken.

**Refused: a wrapper making the two into one strip.** The first version of this report called it
*"not available at all"*, which understates the situation and is corrected here (review finding F5):
**it is the HOUSE SHAPE.** The Plan Editor's `PersistentWarningStrip` puts its retry INSIDE the
tinted item — verified at the component, `<p class="rp-warning-strip__item">` holding
`<span class="rp-warning-strip__content">` beside `.rp-warning-strip__actions`, laid out by
`styles/editor-status.css` and tinted by `styles/editor-shell-fidelity.css`. So the accurate
sentence is *the house shape, foreclosed by AD18-R15's settled sibling placement* (four test files
read `.rp-designer-notice`'s whole text as EQUAL to its sentence, so a control inside one would make
that class mean two things). Refusing it was correct; the divergence between the two surfaces is now
recorded in the partial so nobody rediscovers it as a defect.

**Refused: a negative `margin-block-start` butting the control against the tinted strip.** It
depends on paint order against a background this card cannot render, and it would be clever rather
than boring.

No colour literal anywhere; Obsidian variables only (SDD §84).

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `styles/designer-recovery.css` (NEW, **106 lines** after the fix round; 77 at the first commit) | The one rule and its `:focus-visible` companion, plus the account of the defect, the refusal, the divergence from the plan editor's house shape, and what no gate here can see | Yes — the new partial the lease names |
| `styles/index.css` | ONE `@import "./designer-recovery.css";`, after `designer-narrow.css` | Yes — the one line the lease names |
| `src/presentation/designer/AssetDesignerRoot.vue` | `class="rp-designer-retry"` on the retry button (+1 template line), and a paragraph in `onRetry`'s docblock | Yes — the sub-let, class attribute and docblock only |
| `tests/build/designerRecoveryStyles.test.ts` (NEW) | The stylesheet half: the declaration, the reader's own instrument, and both ends of the hook | Yes — "its own tests" |
| `tests/presentation/designer/designerStaleRetry.test.ts` | ONE case: the class is applied, and the three attributes the lease forbids touching are unchanged | Yes — "its own tests"; the file that already owns this control, so the rig is reused rather than cloned |

`git diff --name-only 9d146abbc..<sha>` prints **six** — those five plus this report. The first
version of this line said *"those five and nothing else"*, which is wrong by one and is exactly the
category the brief flags: an "only" claim written from the table instead of from the command. Fixed
in the fix round (review finding F2).

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
| The focus ring exists, uses the accent token, and its offset is positive | Pass **(added in the fix round; it was guarded by nothing before)** | `designerRecoveryStyles.test.ts` › "rings its own focus with the accent token, at a positive offset" — three assertions, each red under a different weakening | — |
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

### Fix round — F1: the `:focus-visible` rule was guarded by NOTHING

Confirmed before anything was written. With the whole rule deleted from the partial,
`designerRecoveryStyles`, `buttonFocusRing`, `focusReach` and `buttonSpecificity` were **all green —
`Test Files 4 passed (4) · Tests 282 passed (282)`**. The reviewer's account of why is the tree's:
`declaredBy` filters on the EXACT selector (deliberately, so the resting rule's declaration list can
be asserted as a list), `classesNamed` is satisfied off the surviving resting rule, and the two
focus scans only require a ring on a FLATTENED button — nothing here suppresses Obsidian's
`box-shadow`, so this is not one.

With the new case in place, the same deletion:

```
FAIL  |build| tests/build/designerRecoveryStyles.test.ts > the designer recovery partial > rings its own focus with the accent token, at a positive offset
AssertionError: expected [] to deeply equal [ 'outline', 'outline-offset' ]
- Expected
+ Received
- [
-   "outline",
-   "outline-offset",
- ]
+ []
 ❯ tests/build/designerRecoveryStyles.test.ts:92:36
```

Two further mutations, to show each assertion protects a different weakening rather than the same
one three times — `--interactive-accent` swapped for Obsidian's own `--background-modifier-border-focus`:

```
× rings its own focus with the accent token, at a positive offset
AssertionError: expected [ { …(2) } ] to deeply equal [ { …(2) } ]
```

and `outline-offset: 2px` turned to `-2px`:

```
× rings its own focus with the accent token, at a positive offset
AssertionError: expected [ { name: 'outline-offset', …(1) } ] to deeply equal [ { name: 'outline-offset', …(1) } ]
-           "value": 2,
+           "value": -2,
```

An earlier attempt at the token mutation passed, and that was the SED missing the line rather than
the assertion missing the swap — re-run against the right line, it reddens. Recorded because a
mutation that "passes" is a claim about the test and has to be checked as one.

### Fix round — a self-falsifying instrument, caught on the way out

The first draft of F4's sentence cited
`grep -c "outline: 2px solid var(--interactive-accent)" styles/designer*.css` and said 13. Run after
the paragraph was written, it printed **14**: the citation quoted the declaration verbatim, so the
comment matched its own grep. The header now cites the anchored form,
`grep -cE "^[[:space:]]*outline: 2px solid var\(--interactive-accent\)" styles/designer*.css`, which
prints 13 in this tree and cannot match prose, and the partial says why the anchor is there. Caught
only because the grep was re-run after the edit rather than before it.

## What the fix round checked and found WRONG in the instruction itself

- **F4's "ten designer rules" is TWELVE.** The coordinator corrected this before I wrote from it,
  and my own anchored grep reproduces the corrected figure independently: 12 pre-existing
  declarations across 7 designer partials, 13 across 8 in this worktree once this card's own rule is
  counted. The reviewer's enumeration — `designer.css` ×2, `designer-add` ×2, `designer-header` ×3,
  `designer-parts`, `designer-presets`, `designer-selection` ×2, `designer-dimensions` — itself sums
  to twelve while being called ten, so the arithmetic was wrong in the review and repeated twice
  after it. **Nothing further is wrong with the coordinator's correction**; the number, the file
  breakdown and the which-tree caveat all hold at the tree.
- **The `outline-offset` claim holds with a number attached.** "The designer more often uses 1px" is
  true: of the twelve, six are `1px`, four are `-2px` and two are `2px`. The two that match this
  card are `designer-presets` and `designer-dimensions`, exactly as stated.
- **F5's account of the plan editor is the component's.** Verified at
  `PersistentWarningStrip.vue` rather than inferred from the stylesheet: the item element holds both
  the content span and the actions container.
- **F1, F2 and F3 are all correct as stated**, each reproduced at the tree before being acted on.

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

Not fixed here: adding a main guard to `scripts/styles-assemble.mjs` is outside this lease.

**CONFIRMED independently in the review round, and the real gate mapped precisely**: `vite.config.ts`
registers `assembledStyles()` from `scripts/vite-assembled-styles.mjs`, whose `generateBundle` calls
`assembleStyles()` — so an unimported partial, an over-cap partial and a hard-coded colour each
still fail `npm run build`, which is step 1 of `npm run check`. `tests/helpers/buttonRules.ts`
throws at module load on the first of those as well. **The gate was never missing; it was never in
the command line**, and CLAUDE.md's `build` paragraph is therefore accurate about the BUILD. The
general shape is now recorded in CLAUDE.md: a command that exits 0 because it did nothing is
indistinguishable from one that exits 0 because everything passed.

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
| `wc -l styles/designer-recovery.css` | fix round | `106` | Well under the 400-line cap |
| `grep -cE "^[[:space:]]*outline: 2px solid var\(--interactive-accent\)" styles/designer*.css` | fix round, **this worktree** | 8 files, **13** declarations: `designer-add` 2, `designer-dimensions` 1, `designer-header` 3, `designer-parts` 1, `designer-presets` 1, `designer-recovery` 1, `designer-selection` 2, `designer.css` 2 | F4's sentence is written from this. **12 in a tree without this partial** — the coordinator's corrected figure, independently reproduced here |
| The same set counted through `lightningcss` rather than by text | fix round | `RULES = 13`, `FILES = 8` | The parsed count agrees with the text count, so no rule declares it twice and no selector list hides a second subject |
| `npx vitest run tests/build/designerRecoveryStyles.test.ts` | fix round | exit 0 | `Test Files 1 passed (1) · Tests 4 passed (4)` — three cases became four |
| `npx vitest run` over the six button/styles build tests | fix round | exit 0 **on re-run** | `Tests 362 passed (362)` with the five pre-existing files; the six-file run reported 2 failures, **both `Test timed out in 5000ms`, both the same two cases as the first round**, and `buttonFocusRing` (96), `focusReach` (66) and `designerRecoveryStyles` (4) each pass ALONE. Parallelism artifact; no budget raised |
| `npx vue-tsc -noEmit`, `npx oxlint`, `npx eslint` | fix round | `TSC=0 OX=0 ES=0` | — |
| `assembleStyles()` via `node -e` | fix round | exit 0 | `assembled OK` |
| `grep -rn "outline-offset" styles/designer*.css` | fix round | `1px` ×6, `-2px` ×4, `2px` ×2 (excluding this partial) | `2px` is the minority spelling and is named as one |

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
  measurement CITED, not re-measured on this control. The new third case asserts that the rule names
  `--interactive-accent`; it says nothing about what that resolves to in a themed vault, where the
  token is the user's accent and the ratio is theirs.
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
