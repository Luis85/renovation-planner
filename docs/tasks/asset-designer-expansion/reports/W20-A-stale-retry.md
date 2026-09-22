# Task report — W20-A stale retry

Outcome: **implemented**
Owner / worktree / branch: W20-A / `.worktrees/ad10` / `w20a-stale-retry`
Base commit / candidate commit: `8efcf3b01` / this commit
Accepted contract revision: `docs/tasks/asset-designer-expansion/contracts/DECISIONS.md`, ruling
**AD18-R13**, contracts **C08** (*"a retry after an uncertain write must reconcile before repeating
it"*) and **C12**.
Allowed scope and shared-file leases: `AssetDesignerRoot.vue` (sub-let); `runtime.ts` **scoped to
three things** (extension granted in writing); `designerRefresh.test.ts` **one sentence only**
(granted); NEW `i18n/locales/{en,de}/designerRecovery.ts` plus the import and spread in
`{en,de}/editor.ts` (granted); this card's own tests.

## What shipped

The stale notice keeps its sentence and gains one control beside it: **Try again**, which re-reads
this leaf's design through `runtime.refresh`. A success retires the notice (and with it the
header's `Saved · refresh needed` qualifier, one expression behind both). A failure keeps the
canvas, keeps the notice and swaps its sentence for one that says the read failed **again**. The
control is `aria-disabled` while a read is in flight and the handler is what withholds the second
read.

`writesBlocked: () => false` is untouched, nothing is paused, and no `pausedReason` disclosure was
added — AD18-R13 refuses those together, and `designerRefresh.test.ts`'s pin on that member is
unchanged.

## The blocker this card was re-issued over, and what it turned into

The first candidate was **blocked**: `runtime.hydrate` is `read(false)` and blanks the canvas on
failure, so a retry wired to it would replace a valid design with the failure panel — the outcome
step 7 of [[Recover an asset design rather than lose it]] names as the defect. The integrator
granted the eight-line extension, and the shipped shape is the one the ruling describes:
`readingFor`'s `refresh` (keep-previous) is now a `DesignerRuntime` member, and the stale retry is
its third caller.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/AssetDesignerRoot.vue` | `retrying`/`retriesFailed` refs, the `staleMessage` computed, `onRetry`, and the notice's new sibling button | Yes (sub-let) |
| `src/presentation/designer/runtime.ts` | `refresh` on `DesignerRuntime` + docblock; `refresh,` in `buildRuntime`'s return; `readingFor`'s caller count rewritten from the grep; the `writesBlocked` comment's open-question sentence replaced by AD18-R13's answer | Yes (granted, and nothing else in the file is touched) |
| `src/presentation/i18n/locales/en/designerRecovery.ts` | NEW — `designer.refresh-failed.again`, `designer.refresh-failed.retry` | Yes (granted) |
| `src/presentation/i18n/locales/de/designerRecovery.ts` | NEW — the German half | Yes (granted) |
| `src/presentation/i18n/locales/en/editor.ts`, `de/editor.ts` | One import and one spread each | Yes (granted) |
| `tests/presentation/designer/designerRefresh.test.ts` | ONE docblock sentence: the open behaviour question AD18-R13 closed. **The assertion is untouched.** | Yes (granted, sentence only) |
| `tests/presentation/designer/designerStaleRetry.test.ts` | NEW — this card's three cases | Yes (own tests) |
| `docs/tasks/asset-designer-expansion/reports/W20-A-stale-retry.md` | This report | Yes |

No `styles/` change. `styles/designer.css` is **399 lines** (`wc -l`), one under the cap, and this
card needed none of that headroom: the control is an unclassed `<button>`, drawn by Obsidian's own
button chrome.

## The design decision, and the losing side

**Taken: a button beside the existing notice, not `PersistentWarningStrip`.** One control on a
surface that already has the message, no new CSS, no cross-surface model, and exactly the one
action AD18-R13 authorizes.

**The losing side, kept here so the next card can reverse it deliberately:** the two surfaces' stale
warnings stop looking alike, and the strip has four properties this shape does not get — focus
recovery across the re-render that removes the focused button
(`onBeforeUpdate`/`onUpdated`), a live region that exists in the DOM *before* its first content,
`aria-busy` on the row, and the severity mark-and-word pair `docs/components/Toast.md` asks for.
Reusing the strip would have brought severity ordering over five warning ids, the
`open-source-note` action this ruling does not authorize, an input demanding `refreshing`,
`retriesFailed` and `unrecoveredWrite` that `assetDesignStore` does not have, and `editor.*`-named
keys on a designer surface. A later card deciding the designer owes the strip should UNDO this, not
extend it.

**One sub-decision was forced by measurement and is worth reading before it looks arbitrary: the
button is a SIBLING of `.rp-designer-notice`, not a child of it.** Three cases in three files
(`assetDesignerRoot.test.ts`, `designerResponsiveShell.test.ts`, `designerSaveStateStale.test.ts`)
read that element's whole text as EQUAL to the sentence, and `designerBackground.test.ts` maps
every element wearing the class to its text. Across this suite the class means "a message"; a
control inside one of them would make it mean two things and would have taken three more files out
of the lease. The cost is that the control sits outside the live region, which `aria-describedby`
(a `useId()`, so two leaves cannot collide) answers for a reader who tabs to it without having read
the sentence.

## What a FAILED retry does

- The read is `runtime.refresh` — keep-previous — so `AssetDesignStore` holds `status === 'ready'`,
  the design and `stale`. **The canvas is not taken away and the notice does not vanish.**
- `retriesFailed` goes up, so the sentence becomes *"Re-reading this asset failed again; what you
  see may still be out of date."* A press that changed nothing on screen would be
  indistinguishable from a press that did nothing; this is what moves.
- The button is released (`finally`, so a THROWN read releases it too and counts as the failed
  retry it is) and is pressable again. There is no cap on attempts and no backoff: the door is the
  user's to keep trying, and the only thing that retires the notice is a read that succeeded.
- The failure panel is NOT drawn — asserted, because that is exactly what the `hydrate` wiring
  would have produced.

## Every branch introduced, and what drives each

Measured from `coverage-final.json`, not from a summary line: a designer-only coverage run
(`--coverage.reportsDirectory=D:/tmp-claude/w20a-cov`) reports `AssetDesignerRoot.vue` at
**123/124 statements, 25/25 functions, 115/117 branches** and
`src/presentation/designer/runtime.ts` at **94/94, 56/56, 21/21**.

| Branch | True arm driven by | False arm driven by |
|---|---|---|
| `if (retrying.value) return;` (`onRetry`) | case 3's second press while the read is held | every other press in all three cases |
| `retriesFailed.value > 0 ? '…again' : '…'` (`staleMessage`) | case 2, after the failed retry | cases 1 and 3, and the notice's first appearance |
| `stale.value ? retriesFailed + 1 : 0` (the `finally`) | case 2 | case 1, where the success resets the count |
| `retrying ? 'true' : undefined` (`:aria-disabled`) | case 3, in flight | case 2, asserted `toBeUndefined()` after release |
| `v-if="staleAfterRefresh"` over the notice **and** the button | every case, after `goStale` | the mount, and case 1 after the success |

**The file's only uncovered arm is not this card's**: statement and branch at
`AssetDesignerRoot.vue`'s `editDimensions` — `if (dialogs.current !== null) return;` — which this
diff does not touch. Read narrowly: that is a designer-directory run, so another suite may cover it;
what the run establishes is that **no arm this card added is uncovered**.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD18-R13 — the stale notice owes a retry that re-hydrates | Pass | `designerStaleRetry.test.ts` › `offers a retry that re-reads, and a read that succeeds retires the notice with it` | — |
| AD18-R13 / C08 — a retry must not cost the canvas | Pass | same file › `keeps the canvas and says the read failed AGAIN when the retry's own read fails` — asserts the again-sentence, the button, a non-null design and **no** `.rp-view-failure` | — |
| AD18-R13 — no write block, no pause disclosure | Pass | `designerRefresh.test.ts` › `answers false for writesBlocked…` unchanged and green; no `pausedReason`, no `:disabled`, no dimmed control in the diff | — |
| C08 — a retry cannot replay a write | Pass by construction | `onRetry` takes no command and calls a read door; §2.3's own argument for the Plan Editor | — |
| A retry already in flight | Pass | same file › `withholds a second read while the first is still in flight, and says so on the control` — one read for two presses, `aria-disabled="true"` between them | — |
| C12 — existing locales retained, copy through the existing mechanism | Pass | `tests/presentation/i18n` (8 files/130 tests) and `tests/build/localeModuleSentenceCase.test.ts` (85) green with the new pair | — |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerStaleRetry.test.ts` (before implementing) | working tree, Windows | `Test Files 1 failed (1) / Tests 3 failed (3)` | the intended red, quoted below |
| Mutation 1 — `runtime.refresh` → `runtime.hydrate` | working tree | 1 failed | quoted below |
| Mutation 2 — drop `if (retrying.value) return;` | working tree | 1 failed | quoted below |
| Mutation 3 — `staleMessage` never swaps | working tree | 1 failed | quoted below |
| `npx vitest run tests/presentation/designer` | after implementing | `77 passed (77) / 1063 passed (1063)` | terminal |
| `npx vitest run tests/presentation/i18n tests/harness/accessibilityDesigner{Add,Selection,Reference}.test.ts` | same | `8 passed (8) / 130 passed (130)` | terminal |
| `npx vitest run tests/build/localeModuleSentenceCase.test.ts` | same | `1 passed (1) / 85 passed (85)` | the new locale pair is inside that derived walk |
| `npx vitest run` over the seven-file blast radius, after the last `runtime.ts` edit | same | `7 passed (7) / 80 passed (80)` | terminal |
| `npx vue-tsc -noEmit` | same | exit 0 | whole program, `tests/**` included |
| `npx oxlint <8 changed files>` / `npx eslint <same>` | same | exit 0 / exit 0 | read the exit code — oxlint prints nothing when clean |
| `wc -l styles/designer.css` | same | `399` | the cap check the lease asked for |
| Coverage over `tests/presentation/designer` into a temp directory | same | `coverage-final.json` read per file | the branch table above |

### The reds, verbatim

Before implementing (all three cases, same error):

```
 FAIL  |suite| tests/presentation/designer/designerStaleRetry.test.ts > the stale notice’s way out > offers a retry that re-reads, and a read that succeeds retires the notice with it
Error: Cannot call trigger on an empty DOMWrapper.
 ❯ Object.get node_modules/@vue/test-utils/dist/vue-test-utils.cjs.js:1482:27
 ❯ tests/presentation/designer/designerStaleRetry.test.ts:135:29
```

Mutation 1 — the load-bearing one, `refresh` swapped for `hydrate`:

```
 FAIL  |suite| tests/presentation/designer/designerStaleRetry.test.ts > the stale notice’s way out > keeps the canvas and says the read failed AGAIN when the retry’s own read fails
AssertionError: expected [ Array(1) ] to include 'Re-reading this asset failed again; w…'
 ❯ tests/presentation/designer/designerStaleRetry.test.ts:165:28
```

(one notice left in the array, not two: the stale notice is gone entirely, because the store
blanked and the failure panel took the canvas — which is the defect, seen rather than argued.)

Mutation 2 — the in-flight guard removed:

```
 FAIL  |suite| tests/presentation/designer/designerStaleRetry.test.ts > the stale notice’s way out > withholds a second read while the first is still in flight, and says so on the control
AssertionError: expected 3 to be 2 // Object.is equality
 ❯ tests/presentation/designer/designerStaleRetry.test.ts:196:24
```

Mutation 3 — the sentence never moves:

```
 FAIL  |suite| tests/presentation/designer/designerStaleRetry.test.ts > the stale notice’s way out > keeps the canvas and says the read failed AGAIN when the retry’s own read fails
AssertionError: expected [ …(2) ] to include 'Re-reading this asset failed again; w…'
 ❯ tests/presentation/designer/designerStaleRetry.test.ts:165:28
```

**One red was the test's own defect and is recorded because it changed the test.** The first green
run left two cases failing on `expect(wrapper.find('.rp-designer-notice').exists()).toBe(false)`:
the fixture's default background reference names a file no vault here holds, so a BACKGROUND notice
wears the same class and outlives the stale one. The assertions are a list of notice texts now —
`designerSaveStateStale.test.ts` had already recorded that trap, and a bare `find` had turned "the
stale notice is gone" into an assertion about template order.

## Verification not performed

- **`npm run check`, `check:fast`, `test:coverage`, `analyze` — not run, by instruction.** They are
  the integrator's; two full gates at once thrash the machine. The coverage run above was narrow
  and wrote to a temp directory, so nothing in `coverage/` was touched.
- **`eslint .` over the whole tree — not run.** The eight changed files were linted individually
  with both linters.
- **`npm run harness` / `npm run harness-shot` — not run, and no browser was used at all.** So
  **no appearance claim is made anywhere in this report**: not the button's size or placement
  relative to the notice, not whether a full-width flex child looks right at a 460px sidebar leaf,
  not the focus ring Obsidian's own button chrome gives it, not contrast. `.renovation-asset-designer`
  is `display: flex; flex-direction: column`, so the button is a new flex item under the notice —
  **what that looks like is unverified.** It is the first thing to capture if a later card is taking
  pictures, and `npm run harness-shot` needs an entry id beside `-- --width=460` or `resolveShots`
  refuses it.
- **Real Obsidian (`npm run test-build`) — not run.** The manual case is the integrator's to rewrite
  and then walk.
- **The live region's announcement — not tested, and not testable here.** jsdom has no assistive
  technology, so nothing asserts that anything is spoken. See the next section for what that means.
- **`tests/harness/accessibility.test.ts` and the other non-designer axe suites — not run.** The
  three designer ones were. The notice is `contentEl`-scoped, which those scans do reach.

## The live region, decided rather than glossed

`role="status"` announces a CHANGE to a region that is already in the document. This notice is
`v-if`'d, so region and text arrive in the same tick and **the first appearance may not be
announced at all** — the property `PersistentWarningStrip` engineers by rendering its container
unconditionally, and one a paragraph with a `v-if` cannot have. That was already true before this
card; it is written into `onRetry`'s docblock now instead of being implied.

What this card adds is the one thing that does reliably announce: **the text changes** when a retry
fails, which is a change to an existing region. The button is deliberately OUTSIDE the region
(above), so `role="status"`'s atomic default does not re-read "Try again" on every swap, and
`aria-describedby` carries the association instead. `aria-busy` on the notice was considered and
REFUSED: on a live region it tells assistive technology to withhold announcements, which would risk
suppressing the very "again" sentence the retry exists to produce. The busy state is on the control,
where it belongs.

None of that is asserted. The honest statement is that the markup and the attributes are pinned and
the speech is not.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none — the control re-READS and dispatches no command,
so no `revision` moves and C08's "it cannot replay a write" holds by construction.
Undo/no-op/conflict/failure coverage: the failed-retry path is this card's second case; a retry
pressed while one is in flight is its third; a thrown read releases the control through `finally`
and counts as a failure (not separately asserted — the suite's query fake resolves a `Result`).
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: **none** — the locale pair is wired into both
aggregators in this commit.
Rollback/recovery considerations: reverting the commit restores the bare notice; the `refresh`
member would go with it, and it has no other caller.

## Prose elsewhere this card checked, and what it found

- `src/presentation/designer/runtime.ts`'s `writesBlocked` comment and
  `designerRefresh.test.ts`'s `writesBlocked` docblock both called the block an open behaviour
  question. **Both rewritten in this commit** (the second under the one-sentence extension), stating
  AD18-R13's answer and why `false` is now a decision rather than an absence.
- `readingFor`'s **"`refresh` has TWO callers"** is now three, written from
  `grep -rn "refresh" src/presentation/designer/runtime.ts` plus
  `grep -rn "runtime\.refresh" src/presentation/designer/` run AFTER the change: the post-command
  read-back, the cross-leaf subscription, and `AssetDesignerRoot`'s `onRetry`.
- `hydrate`'s own **"TWO callers — the mount and the failure state's retry"** was re-checked and is
  still true: the stale retry takes the other door.
- `grep -rn "no retry\|Try again\|bare \`<p>\`\|no children" src/ tests/` found nothing else this
  card falsifies. The three `docs/` mentions — step 10, **step 12** (*"there is no Try again on this
  surface"*) and the out-of-scope bullet *"no strip with buttons, no paused controls, no Try
  again"* — are the integrator's, untouched, and step 12 is the one AD18-R13 itself does not name.

## Something measured that is not in any guide

**`max-lines` does not skip HTML comments in an SFC template**, although `skipComments: true` is
set. Measured rather than assumed: the first version of this change put the sibling-vs-child
argument in a 19-line `<!-- -->` block and ESLint reported `File has too many lines (403)`;
replacing that block with a one-line comment cleared it with no code change at all. The reasoning
now lives in `onRetry`'s docblock, where comments are free, and the template carries a three-line
pointer. Worth knowing before the next card budgets an SFC.

`buildRuntime` hit its own 100-line budget on the single `refresh,` line this card adds to the
return object; the two read doors share one line, with a comment saying why.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this
field.
