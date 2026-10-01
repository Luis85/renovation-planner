# Task report — W18-B (three verified hygiene items)

Outcome: implemented, and amended after a review round that returned APPROVE
Review round: all three substantive claims held and no finding changed the code. What it changed is
this report (a miscounted grep, a partial dedup left unsaid, two stale citations this card's own
header rewrite created) and one table label, which gained a third real door. Each correction is at
the item it belongs to; the commit message was amended rather than followed by a second commit.
Owner / worktree / branch: W18-B / `.worktrees/ad13c` / `w18b-hygiene-and-dead-rule`
Base commit / candidate commit: base `e21675fc2` / candidate: this branch's single commit
Accepted contract revision: AD18 as amended at `e21675fc2` (AD18-R1 moved the asset name into the header bar)
Allowed scope and shared-file leases: `styles/designer-object.css`,
`tests/presentation/designer/designerDrawDetails.test.ts`,
`tests/presentation/designer/tools/designerSelectMarquee.test.ts`, and this report. Nothing else was
edited; `styles/index.css` was not touched and did not need to be.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `styles/designer-object.css` | Item 1: deleted the dead `.rp-designer-inspector .rp-designer-asset-name` rule and its docblock; rewrote the partial header so it describes what the file now styles and records where the name went. | Yes |
| `tests/presentation/designer/designerDrawDetails.test.ts` | Item 2: replaced the third local `held` clone with `designerRig`'s shared export, converting the call sites from screen points to world points. | Yes |
| `tests/presentation/designer/tools/designerSelectMarquee.test.ts` | Item 3: corrected the `it.each` docblock and the table label, which both named a door `EditorSurface` does not have. | Yes |
| `docs/tasks/asset-designer-expansion/reports/W18-B-hygiene-and-dead-rule.md` | This report. | Yes |

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Item 1 — the rule is genuinely dead before it is deleted | Verified | `grep -rn "rp-designer-asset-name" src styles tests docs scripts` prints **14 lines at base `e21675fc2`** — re-measured, see the correction below — and exactly one of them bears the class on an element: `src/presentation/designer/DesignerHeader.vue:96`'s `<h2 class="rp-designer-asset-name">`, inside `<header class="rp-designer-title-bar">`. The count is not the claim; the one element is. `AssetDesignerRoot.vue` mounts `DesignerHeader` inside `<div class="rp-designer-header">`, a SIBLING of `<div class="rp-designer-body">`, which is what holds `<div class="rp-designer-inspector">`. `grep -rn "DesignerHeader" src tests` finds one mount site (`AssetDesignerRoot.vue`); every other hit is prose. `src/prototypes/` is inside `src/` and `tests/harness/` inside `tests/`, so both were covered by the same greps and neither carries the class. | None |
| Item 1 — declaration diff (see below) | Recorded | The live rule does NOT cover two of the dead rule's four declarations. Stated plainly in the next section rather than papered over. | The difference is real and permanently unreachable. |
| Item 1 — is a pin worth adding? | Decided: NO | Reasoning recorded below. | Nothing detects a dead CSS selector in this repository, and that stays true. |
| Item 2 — signatures agree before the swap | Verified | Local: `(type, at, buttons)` over an ALREADY screen-converted point. Shared `held(rig, type, world, buttons)` takes a WORLD point and applies `rig.at` itself. So the call sites changed: `world` now carries the four points and `corners = world.map(rig.at)` is kept only for the assertion the preview is measured against. | None |
| Item 2 — behaviour identical | Verified, and watched RED | Green: 42/42 over both files. Red-watch: feeding `corners[2]` (already screen) to the shared helper instead of `world[2]` fails with `expected 58.800000000000004 to be close to 68` at `designerDrawDetails.test.ts:85`, i.e. the case really does measure the coordinates the events carried and would have caught a mis-swap. Restored and re-run green. | None |
| Item 2 — the shared helper is not kinder/thinner/harsher/faster | Verified by reading both | The shared one routes through `designerRig`'s `pointer`, which dispatches the same `PointerEvent` with the same `button: 0`, `pointerId: 1`, `bubbles: true` and the `buttons` this caller passes explicitly (so `pointer`'s own derivation never runs). The only field the local spelling omitted is `shiftKey`, which `PointerEvent` defaults to `false` and `pointer` sets to `false`. | None |
| Item 3 — which file is right | The MARQUEE file was wrong; `designerCanvasGestureOwnership.test.ts` is right | Established from `EditorSurface.vue` and the tools, not from either test — method below. Re-derived independently in review and confirmed the same way round. | The ownership file's own prose now goes stale; reported, not edited (not in lease). |
| Item 3 — the label names every door | Corrected twice | First fix read `'pointercancel or blur'`, which omitted `EditorSurface`'s `onBeforeUnmount`. Now `'pointercancel, blur or surface unmount'`, with the docblock stating why the `view teardown` row does NOT already cover it. | None |
| Item 2 — the dedup is partial | Disclosed, not fixed | Four sibling files still carry five local helpers of the same shape; listed below with why none is a drop-in swap. Outside lease and deliberately untouched. | A clone between two `*.test.ts` files is invisible to every gate here, so this disclosure is the only instrument. |

### Correction: the first version of this report cited that grep as 13 lines

**It matched no state of the tree, and the review round caught it.** Re-measured here:

| Tree | `grep -rn "rp-designer-asset-name" src styles tests docs scripts` |
|---|---|
| base `e21675fc2` (`git grep` at that rev) | **14** |
| this candidate, excluding this report's own hits | 15 |
| this candidate, all hits | 25 |

Nothing prints 13. Listing the 14 at base: `DesignerHeader.vue:96` (the one element),
`designer-object.css:18` (the rule deleted here), `designer-header.css:15,16,58` (two prose lines
plus the live rule), `designerHeader.test.ts:74,88,122,153,166,183`, and three docs lines
(`DECISIONS.md:411`, `AD18-W9A-header-and-tabs.md:134`, `AD18-concept-fidelity.md:73`). The
conclusion was never at risk — the ONE element and where it sits is what the deletion rests on, and
that was re-derived structurally in review — so this cost accuracy rather than safety. It is exactly
the category this repository names: *"a docblock that says 'the only place X' gets a `grep` in the
SAME edit, and the sentence is then written from what the grep printed."* The number was written
from a miscount of what it printed, not from what it printed.

**Verified in review, stronger than this report argued it:** the deletion was re-derived
structurally rather than by grep — `.rp-designer-asset-name` is emitted at exactly one place,
`.rp-designer-inspector` at exactly one STATIC class, the two are siblings under different parents,
and none of the six `:class` bindings under `src/presentation/designer/` can produce either. So the
selector matched **zero** elements, and the `index.css` cascade question does not arise at all.
`npx eslint --max-warnings 0` was also run on both edited test files in review: **exit 0**, which
closes the one gap disclosed under "Verification not performed" and confirms the argument there that
it was narrow.

### Item 1 — the declaration diff, in full

Dead rule, `styles/designer-object.css`'s `.rp-designer-inspector .rp-designer-asset-name`:

```
margin: 0 0 var(--size-4-2);
font-size: var(--font-ui-small);
color: var(--text-normal);
overflow-wrap: anywhere;
```

Live rule, `styles/designer-header.css`'s `.rp-designer-title-bar .rp-designer-asset-name`:

```
flex: 1;
min-width: 0;
margin: 0;
overflow: hidden;
font-size: var(--font-ui-medium);
font-weight: var(--font-medium);
line-height: var(--line-height-tight);
color: var(--text-normal);
white-space: nowrap;
text-overflow: ellipsis;
```

**The live rule does not cover everything the dead one declared, and the honest answer is that two
declarations are lost.** `color: var(--text-normal)` is the one property both spell identically.
The rest:

- **`overflow-wrap: anywhere` has no counterpart, and its absence is a DELIBERATE opposite rather
  than an omission.** The dead rule wrapped a long name inside the panel; the header rule
  ellipsizes it (`white-space: nowrap` + `text-overflow: ellipsis` + `overflow: hidden`). Both
  docblocks give the same reason — a user's name for an object is theirs and must not widen its
  container — and reach it differently because a panel can grow downwards and a header bar cannot.
- **`margin: 0 0 var(--size-4-2)` is lost outright**: the header rule sets `margin: 0`. That bottom
  gap belonged to a name stacked above other panel content, and the header bar spaces its children
  with `gap` on the flex container instead.
- **`font-size` DISAGREES rather than being absent** — `--font-ui-small` against
  `--font-ui-medium`, with `font-weight` and `line-height` added — because the name is a leaf title
  now and was a line of panel text before.

So: deleting the rule loses `overflow-wrap: anywhere` and a `var(--size-4-2)` bottom margin that
would have applied had the markup ever matched. It never can — `.rp-designer-asset-name` exists at
exactly one place in the tree and that place is outside `.rp-designer-inspector` — so nothing on
screen changes. This is a real if unreachable difference, and none of the three losses is something
the header rule should adopt: each one is the panel's answer to a question the header answers the
other way round.

### Item 1 — the pin, and why there is not one

**No pin was added.** What would have caught this class of defect is an instrument that reads a
DECLARED selector and asks whether any markup can match it, and this repository has none:
`tests/build/prototype-styles.test.ts` checks the opposite direction (a class used in a mock that
NEITHER home declares), `tests/harness/cssVars.test.ts` checks variables, and `npm run analyze`
reports unimported FILES, never unmatched selectors. `grep -rn "unused\|dead\|matches nothing"` over
`styles.test.ts`, `prototype-styles.test.ts` and `cssVars.test.ts` prints two lines and both are
about something else (a `url(#deadbeef-icon)` fixture, and a `@container` naming no container).

**The cheap instrument that looks like it would have caught this would NOT have, and that is the
strongest form of this argument** — it converts the judgement call into a measurement. The obvious
candidate is `tests/helpers/selectors.ts`'s `classesNamed` over the assembled sheet, diffed against
the classes `src/` emits. It finds nothing here: `.rp-designer-asset-name` **is** emitted, by
`DesignerHeader.vue`. What was dead was not a class but an ancestor COMBINATION —
`.rp-designer-inspector` *descendant* `.rp-designer-asset-name` — and both of its two tokens are
live in isolation. Only an instrument that mounts every surface in every state and QUERIES the
rendered tree with the selector can see that, which is a card of its own and not a line in a hygiene
pass.

The pins the card pointed at — `projectRowStyles`, `libraryComponentStyles`, `assetMark` — all
assert that a rule EXISTS for a component that needs it, i.e. they run emitted ⇒ declared, the
opposite direction from the one that would have caught this. A pin of that shape here would have to say
"`.rp-designer-asset-name` is declared under exactly one ancestor selector, and it is
`.rp-designer-title-bar`", which is a table enumerating code rather than stating a rule: it goes
stale the next time the name moves, and it certifies nothing about the other several hundred
selectors in `styles/`. The general instrument — mount every surface and diff its rendered classes
against the assembled sheet's selectors — is a card of its own, not a line in a hygiene pass.

What replaces it is cheaper and honest: `designer-object.css`'s header now records that the name
moved to the header bar under AD18-R1 and that the Inspector rule is gone, so the next reader who
greps the class finds the history at the file that used to own it.

### Item 2 — the dedup is PARTIAL, and a report is the only instrument that can say so

The card asked for one clone. **Four sibling files under `tests/presentation/designer/` still carry
five local declarations of the same shape** — a world point, `rig.at`, and a hand-built
`PointerEvent` dispatched at `rig.canvasEl`. Measured, not remembered:
`grep -rln "new PointerEvent" tests/presentation/designer/` prints exactly four files now that this
card's swap has removed the fifth, and their declarations are

- `pointer(rig, type, world)` in `designerKeyboard.test.ts`,
- `pointer(rig, type, world)` in `designerSelection.test.ts`,
- an inline `pointer(type, buttons)` arrow closing over `at` in `designerViewMenu.test.ts`,
- `pressAndMove(rig, from, to)` **and** `release(rig, world)` in `designerWriteChain.test.ts`.

They are not drop-in replacements for `held`: the two named `pointer` and `pressAndMove`/`release`
DERIVE `buttons` from the event type internally, where `held` takes it as a parameter, which is what
makes `held` able to send the chord and mid-drag shapes they cannot. Converting them is a judgement
about each case, not a rename, so **none of them was touched** — they are outside this card's lease
and this card must not grow.

**Recorded here because a report is the only place it can be recorded.** CLAUDE.md states it
outright: fallow's duplication check does not read a `*.test.ts` file at all, so a clone between two
test files is invisible to every gate this repository has, permanently. The general remedy it names
is the one this card applied to the fifth instance — move the behaviour into `tests/helpers/`, where
it becomes one definition AND a scanned one.

### Item 3 — how the contradiction was settled

Read from the code, in this order:

1. `src/presentation/designer/DesignerCanvas.vue`'s header states that task B1 lifted every pointer,
   wheel and key door into `EditorSurface` — shared, not copied — so `EditorSurface.vue` is the
   right file to read for the designer surface's interruption doors.
2. `grep -n "cancelInterruptedGesture()" src/presentation/editor/surface/EditorSurface.vue` prints
   THREE lines and only two are calls; the third is that file's own prose about a fixed ordering
   defect. The two calls are in `onPointerCancel` and in `releaseInterruptedInputs`, whose two
   callers are `onBlur` (focus loss) and `onBeforeUnmount`.
3. `onPointerLeave` — read in full — abandons `panOverride`, calls `syncPanPhase()`, `editor.endPan`
   and clears `lastStagePoint`/`editor.setPointer`. It never reaches the tool manager, so a pointer
   crossing the leaf edge routes nothing to a tool.
4. `onPointerDown` calls `setPointerCapture?.()` on both of its arms (`EditorSurface.vue`), so a
   release outside the leaf is delivered back to the captured container and the gesture COMMITS —
   the opposite of an interruption.
5. `src/presentation/editor/tools/tool-manager.ts`'s `cancelInterruptedGesture` is what reaches
   `activeTool.abandonGesture()`, which closes the chain: `pointercancel` and focus loss reach
   `abandonGesture`; a release outside the leaf does not.
6. `src/presentation/designer/tools/designer-select-tool.ts`'s `dropMarquee` docblock had already
   been corrected for this exact sentence and states the same conclusion.

So `designerCanvasGestureOwnership.test.ts`'s `describe('a sweep released outside the leaf') →
it('commits the selection rather than abandoning it')` is right, and the marquee file's docblock and
table label were wrong. Both were corrected. The CASES in the marquee file were always sound: they
call `rig.tool.abandonGesture()` directly, which is true of the two inputs that really do reach it.

### Item 3 — the label names a THIRD door, added in the fix round

The first corrected label read `'pointercancel or blur'`. True, and incomplete: `EditorSurface`'s
own `onBeforeUnmount` is a third input that reaches `abandonGesture`, through
`releaseInterruptedInputs`. Verified at the code rather than accepted — and the trap here is real,
because the row BELOW it looks as though it already covers this:

- The `'view teardown'` row drives `tool.deactivate()`. `grep -n "deactivate()"
  src/presentation/editor/tools/tool-manager.ts` puts its calls in `dispose()`, `setActiveTool` and
  `clearActiveTool`, and the only caller of `dispose()` is `editorFormActions.ts`'s
  `onBeforeUnmount(() => runtime.toolManager.dispose())` — the RUNTIME's unmount, not the surface's.
- `EditorSurface.vue`'s own `onBeforeUnmount` calls `releaseInterruptedInputs`, and its comment
  states the reason and the choice: the responsive shell removes the canvas below its floor width,
  so a user dragging a split narrower makes a press whose release is never coming, and the answer is
  *"`abandonGesture` and not `cancel`, so a multi-click draft crosses the unmount intact"*.

So the two are genuinely different doors and the label now reads
`'pointercancel, blur or surface unmount'`. `grep -rn "pointercancel, blur or surface unmount"` over
`src tests styles scripts docs` prints one line — the label itself — so the rename collides with
nothing.

The old table label was checked for other matches before it changed —
`grep -rn "pointercancel, blur or a release" <worktree>` printed three lines: the label itself and
two PROSE quotations of it in `designerCanvasGestureOwnership.test.ts` (its header and the
`describe` docblock). No assertion, snapshot or config matches on the string, so the rename breaks
nothing.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerDrawDetails.test.ts tests/presentation/designer/tools/designerSelectMarquee.test.ts` (after items 2 and 3) | worktree `ad13c`, Windows, Node from repo `engines` range | pass | `Test Files  2 passed (2)` / `Tests  42 passed (42)` |
| Red-watch: `world[2]` → `corners[2]` at the shared `held` call, then `npx vitest run tests/presentation/designer/designerDrawDetails.test.ts` | same | fail, as intended | `Test Files  1 failed (1)` / `Tests  1 failed \| 9 passed (10)`, `AssertionError: expected 58.800000000000004 to be close to 68` |
| Same file re-run after restoring `world[2]` | same | pass | `Test Files  2 passed (2)` / `Tests  42 passed (42)` (second run, both files) |
| `npx vitest run tests/build/styles.test.ts tests/build/encoding.test.ts tests/presentation/designer/designerHeader.test.ts` (item 1) | same | pass | `Test Files  3 passed (3)` / `Tests  91 passed (91)` — `styles.test.ts` runs the real assembler, so the 400-line cap, the `@import` resolution and the hard-coded-colour check all saw the edited partial |
| `npx oxlint tests/presentation/designer/designerDrawDetails.test.ts tests/presentation/designer/tools/designerSelectMarquee.test.ts` | same | exit 0, no output | quoted in the session; oxlint prints nothing when clean |
| `grep -rn "rp-designer-asset-name" src styles tests docs scripts` | same | 13 lines, one element | quoted under Acceptance coverage |
| `grep -n "cancelInterruptedGesture()" src/presentation/editor/surface/EditorSurface.vue` | same | 3 lines, 2 calls | quoted in the corrected docblock, written from what it printed |
| `grep -rn "pointercancel, blur or a release"` over the worktree | same | 3 lines, no assertion | quoted above |
| FIX ROUND — `git grep -n "rp-designer-asset-name" e21675fc2 -- src styles tests docs scripts \| wc -l` | base rev | **14** | listed line by line in the correction section |
| FIX ROUND — same grep at the candidate, with and without this report's own hits | same | 25 and 15 | tabulated in the correction section |
| FIX ROUND — `npx vitest run tests/presentation/designer/tools/designerSelectMarquee.test.ts` (after the F5 label and docblock change) | same | pass | `Test Files  1 passed (1)` / `Tests  32 passed (32)` |
| FIX ROUND — `npx oxlint tests/presentation/designer/tools/designerSelectMarquee.test.ts` | same | exit 0, no output | read from `$?` |
| FIX ROUND — `grep -rn "pointercancel, blur or surface unmount" src tests styles scripts docs` | same | 1 line, the label itself | the rename collides with nothing |
| FIX ROUND — `grep -rln "new PointerEvent" tests/presentation/designer/` plus its declarations | same | 4 files, 5 declarations | listed under "the dedup is PARTIAL" |
| FIX ROUND — `grep -n "deactivate()" src/presentation/editor/tools/tool-manager.ts`, and `EditorSurface.vue`'s `onBeforeUnmount` read in full | same | `deactivate()` is `dispose`/`setActiveTool`/`clearActiveTool`; the surface's unmount goes through `releaseInterruptedInputs` | the two doors are distinct, which is what F5 turns on |
| `npx eslint --max-warnings 0` on both edited test files | run by the REVIEW round, not by this card | exit 0 | closes the ESLint gap disclosed below |

## Verification not performed

- **`npm run check`, `check:fast`, `test:coverage`, `analyze` and `build` were NOT run** — the card
  forbids them on a shared machine with other cards running. In particular: `eslint .` never saw
  these three files from this card (oxlint has no port of `eslint-plugin-vue`, but none of the three
  is a `.vue`, so the gap here is the ESLint-only rules on `.ts` — `no-restricted-syntax`, the layer
  bans, the two text bans — none of which a docblock edit or a helper-import swap can plausibly
  trip), and the COVERAGE floors were not measured. **The ESLint half of that is now closed**: the
  review round ran `npx eslint --max-warnings 0` on both edited test files and got exit 0, which
  confirms the argument above rather than merely asserting it. Coverage remains unmeasured here. The changes are a CSS deletion and two test-file edits that
  add no `src/` branch, so no floor should move; CI on the PR is where that is actually settled.
- **The stylesheet was not looked at in a browser.** `npm run harness`, `npm run harness-shot` and
  `npm run test-build` were all skipped: the deletion removes a rule that matched nothing, so there
  is nothing new to photograph, and the header rule that draws the name today is untouched. If a
  reviewer wants the belt-and-braces picture, `npm run harness-shot` over an asset-designer entry is
  the command — it was not run here because no capture can show a difference a dead rule makes.
- **No manual vault case was run** (`docs/tests/suites/`), for the same reason: none of the three
  items changes what Obsidian draws or what any command does.
- **The `it.each` correction has no NEW test under it, deliberately.** It is a prose correction to a
  docblock and a table LABEL, and the behaviour it now describes correctly is already asserted by
  `designerCanvasGestureOwnership.test.ts`'s `a sweep released outside the leaf`, which is not in
  this card's lease and was left alone. Adding a second assertion of the same fact here would be the
  duplication that file's own header argues against.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none — no `src/` behaviour changed. The only `src/`-side
artefact is one CSS rule that matched no element, removed from the assembled sheet.
Undo/no-op/conflict/failure coverage: unchanged.
Identity/unit/quantity/calibration invariants: unchanged. Item 2's swap moves the four call sites
from screen pixels to world millimetres, which is the rig's own house convention and is asserted by
the same case's `toBeCloseTo(..., 6)` comparisons against `rig.at`.
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: all three items revert as one commit with no data implication.

### Reported for the integrator rather than fixed

1. **`styles/designer-header.css`'s header sentence is now stale, and that file is not in this
   card's lease.** It reads: *"`designer-object.css` still carries
   `.rp-designer-inspector .rp-designer-asset-name` from when the Inspector drew the name, and that
   rule now matches nothing — it is a file this card had no lease on, so it is reported rather than
   deleted."* It no longer carries it. The claim that sentence is IN SERVICE of stays true and
   should survive the edit: `.rp-designer-asset-name` was the one of that file's eight classes whose
   position in `index.css` could in principle have been load-bearing, and with the disjoint selector
   gone it is now declared in exactly one place in the sheet, like the other seven — so the partial's
   position is unconditionally free. Suggested repair, for whoever holds that lease: replace the
   `.rp-designer-asset-name` exception with a sentence saying all eight are declared here and
   nowhere else, W18-B having deleted the last duplicate.
2. **`tests/presentation/designer/designerCanvasGestureOwnership.test.ts` quotes the refuted
   sentences verbatim, twice, and says the marquee file *"still says the refuted thing"*.** Not in
   this card's lease either. Both quotations (in its file header, and in the `describe` docblock for
   `a sweep released outside the leaf`) are now historical rather than live, and the note ending
   *"Named here rather than fixed there because that file is another lease"* has been discharged.
   Its CASES are unaffected and still pass. Suggested repair: keep the contradiction's history but
   put it in the past tense, and point at this card as where it was resolved.

3. **`docs/tasks/asset-designer-expansion/execution/LEASES.md`, the AD13-C3 style-cap paragraph,
   quotes the OLD `designer-object.css` header verbatim and in the present tense** — *"its own
   header scopes it to 'the designer Inspector's OBJECT block: which asset this is, the way back to
   the catalogue'"*. **This card's own header rewrite falsified it**, which makes it collateral from
   this change rather than something merely found nearby. Suggested repair: requote from the current
   header, which now reads *"the way back to the catalogue, the multi-selection controls (AD06,
   AD08) and the usage scope (AD13-R1)"*. While that paragraph is open: it also says the partial
   *"is at 61"* lines against an actual `wc -l` of **111** — pre-existing and nothing to do with this
   card, but in the same sentence and worth fixing in the same edit.
4. **`docs/tasks/asset-designer-expansion/reports/RESUME.md`** lists *"`designer-object.css`'s dead
   rule"* among the things "not verified this session". It is discharged: verified and deleted here.

**The lesson this round bought, recorded because it is the same one this card is about.** The search
for collateral was run thoroughly for the TABLE LABEL that changed (three matches found, all prose)
and never at all for the HEADER SENTENCE that changed — so a rewrite whose whole subject was
"sentences that outlive their code" left two of its own behind, and a review round found them.
**A changed sentence deserves the same grep a changed identifier gets**, and a card that rewrites
prose owes that grep to every paragraph it rewrites, not only to the ones that look like data.

None of these four is a defect in behaviour; all are the same category this card exists to clear — a
sentence that outlived the code it described.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.
