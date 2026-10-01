# Task report — AD10, implement grouping, alignment, distribution and repeat

Outcome: **implemented, and corrected after review round 1** — all six operations the dispatch
listed landed, with the one shared-wiring line named below still owed by the integrator.
Owner / worktree / branch: AD10 worker ·
`.claude/worktrees/renovation-planner-asset-designer-bc5539/.worktrees/ad10` · `ad10-arrange`
Base commit / candidate commit: `13f82f82e` / **`0c818cb1c`** (first candidate) and the review-fix
commit on top of it, which is the one to read. The first draft of this report named `e5191bf3c`,
which was the pre-rebase sha and never existed on `ad10-arrange`; the correction is itself a review
finding.
Accepted contract revision: `r1`
Allowed scope and shared-file leases: AD01 §2 gives AD10 `domain/asset/detailEdits.ts` plus a new
grouping module; the dispatch widened that to two new `domain/asset/` modules, the two inspector
components plus new siblings, the two `assetArrange` locale modules, `styles/designer-selection.css`
and new files under `tests/`. **Every file in the diff is inside that lease.** No integrator-owned
file was taken, which is why the one binding this feature needs is a request rather than an edit.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/domain/asset/detailEdits.ts` | `detailBox` (the curve-aware box of a graphic of EITHER kind), `resolveParticipants` (canonical order, the four participant refusals, the `immovable` rule), `highestSuffix`/`highestDetailNumber` split out of `nextDetailId`, and `fitFootprintToDetails` re-pointed at `detailBox` | yes |
| `src/domain/asset/groupEdits.ts` | New. `groupDetails`, `ungroupDetails`, `moveGroupToEnd`, `groupOfDetail`, `nextGroupId`/`highestGroupNumber` | yes — the dispatch's grouping module |
| `src/domain/asset/arrangeDetails.ts` | New. `alignDetails`, `distributeDetails`, `moveDetails`, `rotateDetails`, `scaleDetails`, `repeatDetails`, `MAX_REPEAT_COPIES` | yes — the dispatch's arrange/repeat module |
| `src/presentation/designer/inspector/DesignerArrangePanel.vue` | New. The composition block: group/ungroup, the two group-order actions, the alignment reference select, six align and four distribute buttons, the refusal alert | yes |
| `src/presentation/designer/inspector/DesignerSetTransform.vue` | New. The four "by" fields — move across, move down, rotate, scale | yes |
| `src/presentation/designer/inspector/DesignerRepeatForm.vue` | New. Count, spacing, direction, spacing mode, the preview line and the one button that writes | yes |
| `src/presentation/designer/inspector/DesignerInspector.vue` | Mounts the panel as a sibling of the selected-part section; declares the optional `lockedGraphics` prop | yes |
| `src/presentation/i18n/locales/{en,de}/assetArrange.ts` | The labels, the preview and the error CODES these controls can raise. The review round added `asset.mixed-coordinate-spaces`, removed `designer.arrange.repeat.unmeasurable` with the unreachable guard it belonged to, and took the hard-coded `50` out of `asset.repeat-count-out-of-range` | yes — both were empty and already spread into `editor.ts` |
| `styles/designer-selection.css` | `.rp-designer-arrange`, the section's column and its separating rule | yes |
| `tests/helpers/arrangeShapes.ts` | New. `threeBoxes`, `awkwardParts` (a 45° square and a zero-width open line), `withCurvedPart`, `grouped`; the review round added `withPending` (ruling AD10-R1's input) and `requireDetail` (the throwing lookup that replaces an `as never`) | yes — new file under `tests/` |
| `tests/application/editor/reversibleAssetDesign.test.ts` | Review round only. One case: a repeat dispatched through `reversible.setShape`, undone and redone. Granted as a lease for exactly that | yes — granted in the review dispatch |
| `tests/domain/asset/groupEdits.test.ts`, `tests/domain/asset/arrangeDetails.test.ts`, `tests/presentation/designer/designerArrangePanel.test.ts` | New. 16 + 50 + 22 cases | yes |

## The decisions the card asked to be taken deliberately, and what each one is

1. **Distribution distributes what the BUTTON says.** Four buttons, not one with a hidden
   convention: *Even centres across/down* moves the interior parts so the distance between box
   CENTRES is uniform; *Even gaps across/down* makes the empty space BETWEEN boxes uniform. C06
   requires the choice be specified; a label is the only place a user can read it.
2. **Repeat spacing likewise**, through a *Spacing measures* select and a preview line that reports
   the step it resolved to — `centres` applies the typed number, `gaps` applies the selection's own
   extent plus it. The two show different numbers for the same input, which is what makes naming
   them worth anything.
3. **Alignment endpoints and the key object are exact by two different mechanisms**, and
   `shifted`'s docblock says so rather than claiming one covers both. Distribution gives its two
   extremes no map entry at all, so they never go through arithmetic; the key object gets an entry of
   exactly `(0, 0)`, and `x + 0 === x` for every finite double. Both are asserted with `toEqual`
   against the pre-edit detail, not with a tolerance.
4. **A LOCKED graphic reaches the domain as data, never as a lock.** `resolveParticipants` takes
   `immovable: ReadonlySet<string>`; the panel fills it from `PartView.locked`. A locked PARTICIPANT
   refuses the whole operation (`asset.locked-part`) rather than being dropped from it — dropping
   would rearrange the others around a part the user can see is pinned, which is the half-applied
   edit C06 refuses. A locked part that is not a participant is never written, so "must not move by
   implication" holds even for a lock nothing told the domain about.
5. **Step forward / step back for a group is NOT built**, per C06. `moveGroupToEnd` gives a group the
   two ends only; `groupEdits.ts`'s header carries the three incompatible readings of "one step" for
   a noncontiguous group that are the reason.
6. **An OPEN graphic composes like any other.** Every operation measures through `detailBox`, which
   answers for both kinds, so a line takes part in an alignment and a repeat. Nothing here routes
   through `outlineOf` or `partBox`, both of which are closed-only by design.

## Acceptance coverage

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Grouping and ungrouping produce no visual jump, geometry change or quantity change | met | `groupEdits.test.ts` "changes no coordinate, no order and none of the shape's other parts", "leaves interleaved members interleaved", "answers a design identical to the one it started from"; `designerArrangePanel.test.ts` "leaves every coordinate and the drawing order exactly as they were". `AssetShape` carries no quantity or price, so there is none to change | The quantity half is structural (the aggregate has no such field) rather than driven through a placement or requirement consumer |
| Any invalid participant refuses the whole edit; no half-aligned group is persisted | met | `arrangeDetails.test.ts` refuses a duplicate id, an unknown part, a locked participant and fewer than the minimum, on align, distribute, move and repeat; "refuses a locked participant, and moves nothing at all" and the panel's "refuses the arrangement and writes nothing" compare the whole shape against the pre-edit one | — |
| Undo/redo restores IDs, membership, order and geometry together | met, and now DRIVEN | `reversibleAssetDesign.test.ts` "restores ids, membership, order and geometry together, and redoes the very ids it minted": a grouped fixture is repeated, dispatched through `reversible.setShape`, undone (the copies and their remapped group gone, the document equal to the seed) and redone (the identical `detail-4`/`detail-5` and `group-2`). It is a LOCK on where the allocation lives, and its docblock says so: redo is id-stable because `repeatDetails` mints the whole run inside the pure edit and `ReversibleAssetEdit.runForward` re-dispatches `this.input`. Move the allocation into the command and redo starts minting a different identity graph per execution | The case passed on its first run — it is a missing verification closed, not a defect fixed. Its instrument was mutation-checked (`highestDetailNumber(shape) + 1` in `withCopies` turns it red); the REDO half specifically cannot be watched red without editing `SetAssetShape.ts` or the adapter, both outside this lease |
| A reference part chosen for alignment remains fixed | met | `arrangeDetails.test.ts` "leaves the reference exactly where it was and brings the others onto it" (`toEqual` on the whole detail, plus the two that DID move); `designerArrangePanel.test.ts` "holds the chosen key object still when the reference is switched to it". Both watched failing — see below | — |
| Repeat distinguishes centre spacing from edge gap and previews the intended result | met | `arrangeDetails.test.ts` "steps by the selection's own extent plus the GAP when that is what spacing means"; `designerArrangePanel.test.ts` "previews the step it will apply, and says a different one for each spacing mode" (20 mm becomes a 120 mm step for a 100 mm part) | The preview is a TEXT statement of the resolved step, not a ghost drawn on the canvas — `DesignerCanvas.vue` is not in this lease |
| Curved groups and mixed coordinate-space groups obey the contracts rather than bypassing geometry safety | met | Curved: "reads a CURVED part at the extent its arc reaches", "scales the set proportionally about that same centre, keeping a circular arc circular" (the bulge array is unchanged), and the rotated-square case. Scaling a set is PROPORTIONAL only, so C04's first sentence covers it with no approximation to declare. Mixed: ruling **AD10-R1** was taken after the first candidate, and the refusal is in `arrangeDetails.participants` under `asset.mixed-coordinate-spaces` — driven by a six-row `it.each` over align, distribute, move, rotate, scale and repeat, with a second six-row table asserting an ALL-pending selection still arranges, and two cases in `groupEdits.test.ts` asserting grouping and the block reorder stay allowed across the mix. Every operation ends in `validateAssetShape`, so nothing bypasses the aggregate | The check sits in `participants` and NOT in the shared `resolveParticipants`, which is what the first candidate's handoff proposed: `groupEdits.groupDetails` shares that function and the ruling explicitly permits grouping a mixed selection. `moveDetails` was re-routed through `participants` so there is one funnel rather than five of six |

### The card's implementation list

1. **Shallow group/ungroup** — `groupEdits.groupDetails` / `ungroupDetails`. Members stored in
   canonical order, `details` untouched, procurement semantics untouched (there are none on the
   shape). Grouping does not reorder.
2. **Alignment** — six edges, `bounds` or an explicitly named `key`, stable because participants come
   back in canonical order. Locked elements refuse.
3. **Distribution** — centres or gaps, both axes, endpoints retained by omission, refused below three
   participants. Tie-break is the canonical draw order, asserted by running the same distribution
   twice over parts with equal centres.
4. **Duplicate / repeat** — explicit count and spacing, count bounded to 1…`MAX_REPEAT_COPIES` (50)
   and rejected when fractional or non-finite, spacing rejected when non-finite, ids allocated once
   from the highest suffix the shape ever carried, group membership remapped per copy with the
   original's label.
5. **Bring group to front / back** — a stable block, internal order preserved, non-members' relative
   order preserved. Step-forward/back deliberately unavailable.
6. **Group move / rotate / proportional scale** — about the centre of the selection's shared box.

## Executed checks

All on the candidate tree `e5191bf3c`, `TEMP`/`TMP` pointed at `D:\tmp-claude` (the C: volume on
this box has 0 bytes free). No `npm run check`, no coverage, no analyze — two other workers share
this machine, per the dispatch.

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vue-tsc -noEmit` | candidate | **0** | Caught one real fixture defect first: `awkwardParts` spread an `AssetDetail` and handed the union back to a closed arm |
| `npx oxlint --deny-warnings` | candidate | **0** | Whole tree |
| `npx eslint src/domain/asset src/presentation/designer src/presentation/i18n tests/domain/asset tests/presentation/designer/designerArrangePanel.test.ts tests/helpers/arrangeShapes.ts --max-warnings 0` | candidate | **0** | The layer bans, the i18n literal ban and the Vue ruleset over everything this branch touched |
| `npm run build` | candidate | **0** | `dist/main.js` 1,963.02 kB, `dist/styles.css` 175.81 kB. The stylesheet assembler's colour check passes over the new partial block |
| `npx vitest run tests/domain/asset/groupEdits.test.ts` | candidate | **0** — 16 of 16 | |
| `npx vitest run tests/domain/asset/arrangeDetails.test.ts` | candidate | **0** — 50 of 50 | |
| `npx vitest run tests/presentation/designer/designerArrangePanel.test.ts` | candidate | **0** — 22 of 22 | |
| `npx vitest run tests/presentation/designer tests/domain/asset tests/presentation/i18n` | candidate | **0** — 67 files, 1045 cases | The whole designer, domain-asset and i18n surface, including `regionsReachable`, `designerInspector`, `designerSelectionInspector`, `detailEdits` and `strings` |
| `npx vitest run tests/build/libraryComponentStyles.test.ts tests/build/styles.test.ts tests/build/localeModuleSentenceCase.test.ts` | candidate | **0** | The new class is declared; the English module is under the sentence-case rule and passes |
| `npx vitest run tests/build/i18n-literal-boundary.test.ts` | candidate | **0** — 21 of 21 | First attempt inside a five-file batch hit the documented `beforeAll` ESLint-boot timeout (60 s) on this loaded box; **passed when re-run alone**, per `CLAUDE.md`'s own instruction. No budget was raised |
| `npx vitest run tests/build/buttonSpecificity.test.ts` | candidate | **mixed, and PRE-EXISTING** | Two cases exceeded vitest's 5 s per-case default in one run and every case passed in the next (worst case 4,209 ms). Measured against the base tree in the same worktree (`git checkout 13f82f82e -- src styles`, run, restore): the same case takes **4,303 ms at `13f82f82e`**, so it already sat on the budget before this branch. Nothing was changed to make it go away |
| Real Obsidian / `npm run test-build` | — | **not run** | See below |
| `npm run harness`, `harness-shot` | — | **not run** | See below |

### Review round 1, on the fix tree

| Command | Exit code | Evidence |
|---|---|---|
| `npx vitest run tests/domain/asset/arrangeDetails.test.ts tests/domain/asset/groupEdits.test.ts` (before the fixes) | **1** — 11 failed, 73 passed | The eleven reds B1 and B2 were written for, named above with what each said |
| `npx vitest run tests/presentation/designer/designerArrangePanel.test.ts` (before the fixes) | **1** — 9 failed, 26 passed | The nine reds for B2 at the panel, R2 and R8's stale alert |
| `npx vitest run tests/domain/asset/arrangeDetails.test.ts tests/domain/asset/groupEdits.test.ts` | **0** — 84 of 84 | |
| `npx vitest run tests/presentation/designer/designerArrangePanel.test.ts` | **0** — 36 of 36 | |
| `npx vitest run tests/application/editor/reversibleAssetDesign.test.ts` | **0** — 35 of 35 | R4's case passed on its first run. Mutation-checked: `highestDetailNumber(shape) + 1` in `withCopies` turns it red (`expected [ 'detail-1', 'detail-2', …(3) ] to deeply equal …`), reverted immediately. A weaker mutation — `shape.details.length` — does NOT turn it red on this fixture, which is worth recording: the two happen to agree at three contiguous details |
| `npx vitest run tests/domain/asset tests/presentation/designer tests/application/editor tests/presentation/i18n` | **0** — 72 files, 1162 cases | The whole domain-asset, designer, editor-adapter and i18n surface |
| `npx vue-tsc -noEmit` | **0** | Caught two real defects first: the panel test's fake `editShape` still narrowed to the non-null signature, and an import left unused by it |
| `npx oxlint --deny-warnings` | **0** | Caught one: the ALL-pending `it.each` had no `expect` (`vitest(expect-expect)`), which is a test that could not have failed |
| `npx eslint src/domain/asset src/presentation/designer/inspector src/presentation/i18n/locales tests/domain/asset tests/presentation/designer/designerArrangePanel.test.ts tests/helpers/arrangeShapes.ts tests/application/editor/reversibleAssetDesign.test.ts --max-warnings 0` | **0** | Caught one: `DispatchResult` left unused by the widened prop type |
| `npx vitest run tests/build/localeModuleSentenceCase.test.ts tests/build/i18n-literal-boundary.test.ts` | **1**, then **0** | The documented `beforeAll` ESLint-boot timeout at 60 s on this loaded box. `localeModuleSentenceCase` passed in the batch; `i18n-literal-boundary` timed out in the batch AND alone, and **passed under `--no-file-parallelism`** (21 of 21), which is the diagnostic `CLAUDE.md` names. No budget was raised |

### Which cases were WATCHED FAILING, and what the red said

- **"group then ungroup answers a design identical to the one it started from."** `groupDetails` was
  changed to gather members to the end of `details`. Three cases went red together — the identity
  one (`expected { …(10) } to deeply equal { …(10) }`), "changes no coordinate, no order…"
  (`expected [ { id: 'detail-3' … } ] to deeply equal [ { id: 'detail-1' … } ]`) and "leaves
  interleaved members interleaved" (`['detail-2','detail-1','detail-3']` against
  `['detail-1','detail-2','detail-3']`). Restored, 16 of 16 green. This is the invariant that passes
  trivially against an operation that does nothing, which is why the case asserting a group is
  actually written sits beside it.
- **"the key object does not move."** `referenceBox` was changed to answer the union box whatever the
  reference said. Four cases went red: the key-object case itself, the rotated-part and open-graphic
  cases (both of which use a key reference to make their measurement legible), and the
  `key-part-not-selected` refusal, which became unreachable. Restored, 50 of 50 green.
- **The locked-participant rule.** The panel's `selection()` was changed to pass an empty `immovable`
  set. `designerArrangePanel.test.ts` "refuses the arrangement and writes nothing" went red.
  Restored, 22 of 22 green. That red is exactly the state the product is in until the integration
  request below lands, which is why it is named there rather than buried here.

### Two defects found on the way

1. **`fitFootprintToDetails` refused every CURVED open graphic**, and nothing could see it.
   It handed `boundingBoxOf` an open path's own bulge array, which carries one value per SEGMENT
   where a `CurvedPolygon` needs one per POINT, so `validateBulges` answered `curve-edge-count` and
   the fit refused under `asset.invalid-detail`. Unreachable in the product today because AD11 has
   not built an authoring tool for a curved open graphic; live the moment it does. Fixed at the root
   — `detailBox` pads the absent wrap edge with a zero bulge, and `fitFootprintToDetails` now goes
   through it like everything else.
2. **`v-model` on `<input type="number">` destroys a raw draft.** Vue casts the bound value to a
   number, so the repeat form's `count` stopped being a string and the preview threw
   `count.value.trim is not a function`. Three cases caught it. Replaced with `:value` plus
   `@input`, which is C03's own rule ("numeric drafts stay raw text until committed") and the
   spelling the rest of this repository already uses; the two selects keep `v-model`, where the
   value is one of a closed set of strings.

### Coverage of the new code, read rather than inferred

Coverage cannot be run here (the dispatch forbids `test:coverage` on this box), so the new code was
read for arms nothing exercises. Every branch in `groupEdits.ts` and `arrangeDetails.ts` has a
named case above; the ones worth calling out because they are easy to miss:

- `referenceBox`'s two arms — the bounds table and the key-object pair.
- `edgeOf`'s five arms — the six-row `it.each` reaches all of them (`centre-x` and `centre-y` share
  the last).
- `detailBox`'s three readings — no bulges (`threeBoxes`), a closed bulge array (`withCurvedPart`),
  an open one padded (the open-graphic align and repeat cases).
- `withCopies`' group loop, both arms — "gives each copy of a group its own new group" and "makes no
  group at all where no participant was in one".
- `resolveParticipants`' four refusals, each driven at least once.
- `DesignerRepeatForm`'s `preview` is driven in both modes and in its absent state. Its
  `unmeasurable` arm is **GONE**: review round 1 established that both of `blockExtent`'s `null`
  sources were unreachable rather than merely uncovered — `detailBox` refuses only geometry
  `validateAssetShape` would have refused and `props.shape` is always a validated one, and the empty
  participant list is forbidden by the enclosing `v-if="graphics.length > 0"`. An unreachable guard
  costs a branch it can never pay back, so `blockExtent` answers a `number` through `unwrap` (the
  spelling `fitFootprintToDetails` uses at the same kind of position) and the template arm and its
  locale string went with it.

No guard was written that could not fire, and three were deliberately NOT written: a non-finite
angle on `rotateDetails`, a non-finite translation on `moveDetails`, and a non-finite distributed
step. All three are refused downstream by `validateAssetShape`, and a second copy here would be a
branch nothing could ever cover — `arrangeDetails.test.ts` "refuses a non-finite rotation through
the validator rather than through a guard of its own" is the case that pins that choice.

## Verification not performed

- **Real Obsidian.** No vault and no Obsidian in this environment; `npm run test-build` was not run
  and no manual case under `docs/tests/` was walked. **Nothing about how this block LOOKS in a
  themed vault is verified** — the panel adds up to fourteen buttons, four number fields and three
  selects to a sidebar inspector that already carries a selected-part section and the asset block,
  and whether that column is usable at a real leaf width is exactly what no gate here can answer.
- **Browser captures.** `npm run harness` and `npm run harness-shot` were not run — the dispatch
  forbids them on this machine and there is no pinned Chromium. So there is no picture of the block
  at 1280 or at 460, and the narrow-leaf behaviour of three stacked button rows is argued rather
  than seen. **This is the check most likely to find a defect in this task**, for the reason
  `CLAUDE.md` gives: layout is what a capture measures and no layout engine in this repository does.
- **`npm run check`, `npm run test:coverage`, `npm run analyze`.** All three forbidden by the
  dispatch (other workers on this box), in the review round as in the first. So: **no coverage figure
  exists for the new code**, and **fallow has not seen it** — the complexity budget over three new
  SFCs and two new domain modules, the duplication report and `private-type-leak` over the exported
  `ArrangeSelection` / `AlignReference` / `RepeatSpec` signatures are all unmeasured. AD09 found two
  SFC complexity findings in its own first run; this task ships three new SFCs and has not had that
  check. The review round removed one unreachable branch (`DesignerRepeatForm`) and added several
  reachable ones (the mixed-space refusal, the three identity returns, the `groupable` predicate),
  every one of which has a named case — but the direction of the net coverage movement is a
  measurement nobody here has taken.
- **Nothing was run against the other AD branches.** `lockedGraphics` is still optional, deliberately
  and on instruction; the integrator lands the required-prop change, the root binding and the test
  mounts in one commit after AD07 merges.
- **Accessibility.** `tests/harness/accessibility*.test.ts` does not scan the asset designer's
  inspector, so the new selects' labels and the refusal alert's live region are asserted by this
  task's own component cases and not by axe.
- **Undo and redo at the LEAF.** The adapter half is driven now
  (`reversibleAssetDesign.test.ts`, above), but nothing drives a repeat and then Ctrl+Z through
  `designerRig` — so the panel-to-runtime-to-history path for these operations specifically is still
  argued from the write path rather than walked.
- **Cross-leaf and version-conflict behaviour** for these operations specifically. They use the same
  `editShape` door `designerCrossLeaf.test.ts` and `designerRefresh.test.ts` already cover for other
  edits; no case drives a conflict through an arrange gesture.
- **`npm audit`.** Not run; it is its own CI job.

## Data and integration implications

**Schema/migration change:** none. `groups` is already schema v3 (AD04). This task is the first thing
in the product that writes one.

**Relevant renderer/export/revision consumers:** the three r1 names. The authoring canvas draws
`details`, which these operations rewrite in place — so it follows with no change. The library mark
(`ListAssetOutlines` → `AssetMark.vue`) is footprint-only and is untouched by any of them except
where a user then fits the footprint to the details. Plan placement reads the stored shape and is
likewise unaffected: nothing here changes the footprint, the clearance, the anchor, the facing or a
pending flag. **`groups` reaches no renderer at all** — it is editing metadata, and the Parts panel is
its only reader. There is no export subsystem (r1, C10).

**Undo/no-op/conflict/failure coverage:** every control goes through `editShape`, so it joins the
leaf's one write chain, dispatches one `SetAssetShape` conditional on the version its step read, and
pushes one undo entry. A refused edit dispatches nothing and pushes none.

**The first draft of this paragraph read "No control here can produce a no-op that still writes",
and that sentence was FALSE — its own next sentence contradicted it.** Four controls could:
pressing the same alignment twice, pressing the same distribution twice, Bring group to front on a
group already at the front, and any of the four "by" fields committed at its resting value (a move
of 0, a rotation of 0, a scale of 1), which is one blur away at all times because the resting value
is also the displayed one. Each cost a sidecar revision and an undo entry whose Ctrl+Z appears to do
nothing, because `SetAssetShapeCommand` compares nothing by design (`ALWAYS_CHANGED`) and
`CommandHistory` pushes for any ok result.

**It is closed at the root, in three places and for controls not yet written.** `shifted` and
`moveGroupToEnd` answer the very shape they were handed — by IDENTITY, not by equality — when every
shift is zero or the members already sit at that end; `DesignerArrangePanel.commit` compares that
identity and answers `editShape`'s `null`, which resolves `no-write` and dispatches nothing; and
`DesignerSetTransform.onNumber` returns early at the resting value, which is the one case identity
cannot see, since a rotation of zero builds fresh coordinate objects that are equal and not
identical. That is C05's rule (*"a cancelled/refused/no-op gesture is none"*) and the same shape AD02
already shipped for Edit dimensions, where typing back the numbers the form offered returns before
dispatching.

**Identity/unit/quantity/calibration invariants:** ids are never recycled — the batch allocator
counts from the highest suffix the shape ever carried, asserted against a design with a deleted
`detail-2`. Group ids number the same way. `name` is never written from anything here. No
measurement is displayed except the repeat preview's step, which is a distance the user typed (or
that distance plus an extent measured off the shape), so an unscaled design's placeholder pixels are
reported as the millimetres the rest of the designer already reports them as — see the pending-space
request below.

**Shared root/runtime/locales wiring still required:** the locales are in this candidate. **One line
of wiring is owed**, in a file this task may not touch:

> **Integration change request 1 — `src/presentation/designer/AssetDesignerRoot.vue` (integrator-owned).**
> In the `<DesignerInspector …>` mount, add `:locked-graphics="runtime.partView.locked.value"`.
> Why it cannot live in a file I own: `runtime.partView` is built in `runtime.ts` and reaches the
> inspector only through the root's own mount, and `AssetDesignerRoot.vue` and `runtime.ts` are both
> integrator-owned. `DesignerInspector` already declares the prop as optional with an empty default,
> so nothing breaks without it — but until it lands, a LOCKED graphic composes like any other and
> `designerArrangePanel.test.ts`'s locked case is the only thing proving the rule works. That is the
> state I watched red deliberately, and it is the single highest-value line in this handoff.

Two further requests, both genuine and neither blocking this candidate:

> **Integration change request 2 — CLOSED by ruling AD10-R1.** It asked for a ruling rather than an
> edit: should a spatial composition refuse a selection mixing `pending` and measured graphics? The
> ruling says yes for align, distribute, repeat and the group transform, no for grouping and no for
> the block reorder, and it is implemented in this commit. **The site the request proposed —
> `resolveParticipants` — was wrong**, and the ruling's own amendment says why: `groupDetails` shares
> that function, so a refusal there would have refused the one case the ruling permits. It lives in
> `arrangeDetails.participants`, with `moveDetails` re-routed through it so the rule holds at every
> door rather than at five of six.

> **Integration change request 4 — `src/presentation/designer/selection/partExtent.ts` (not in this
> lease), one sentence, no behaviour.** `outlineOf` answers `null` for an OPEN graphic, so every
> single-part gesture refuses a line, while a composition in `arrangeDetails.ts` measures the same
> line happily through `detailBox` and moves it. Both readings are deliberate where they are; the
> contradiction is between them and is AD11's to settle. `arrangeDetails.ts`'s header now carries a
> pointer at this, and the other end wants one too. Proposed sentence for `outlineOf`'s docblock:
>
> > **An OPEN graphic answers `null` here and is measurable elsewhere, deliberately and not yet
> > reconciled.** `domain/asset/detailEdits.detailBox` measures a path's extent — which is what lets
> > a line take part in an alignment, a distribution or a repeat (`arrangeDetails.ts`) — while this
> > function is about an outline a single-part gesture can resize, and a path has no interior to
> > resize against. So the same graphic is composable in a set and refused on its own. AD11 owns the
> > reconciliation, and the question it has to answer first is what a width field means for something
> > with no interior.

> **Integration change request 3 — `src/presentation/designer/parts/**` (AD09's directory).** These
> operations are reachable only from the inspector today. Two rows would earn a control there:
> `DesignerPartGroupRow.vue` could carry **Ungroup** and the two order actions beside its disclosure
> (the group id is already on that row, and `ungroupDetails` / `moveGroupToEnd` take exactly a group
> id and nothing else), and `DesignerPartControls.vue` could carry **Group** where the panel's own
> selected set has two or more graphics. Both would call the same `editShape` the panel calls; no
> second write path. I did not edit that directory.

**Rollback/recovery considerations:** reverting this task loses any groups a user made, since the
Parts panel draws group rows but nothing else creates one. The sidecar keeps them and an older build
reading schema 3 refuses the file rather than stripping them (`z.literal`), so the data survives the
code. Reverting also restores `fitFootprintToDetails`' curved-open-graphic refusal, which is
invisible today and would not be once AD11 lands — worth knowing if this branch is ever backed out
after AD11.

## Review round 1 — every finding, and what it got

The reviewer returned REQUEST CHANGES. Each finding below names what changed and which case was
watched failing for it.

**B1 — ruling AD10-R1, at the right site.** The refusal is in `arrangeDetails.participants` under
`asset.mixed-coordinate-spaces`, with `moveDetails` re-routed through `participants` (and its boxes
discarded) so there is one funnel rather than five doors and a back one. NOT in
`resolveParticipants`, which is what this task's own handoff proposed and which the ruling's
amendment names as the dangerous half of the mistake: `groupEdits.groupDetails` shares that
function. `moveGroupToEnd` is untouched, per the amendment. Six cases watched red —
*"refuses align/distribute/move/rotate/scale/repeat across the two spaces"*, each reading
`Expected error, got ok: {…the whole arranged shape…}`. The six ALL-pending cases beside them were
written in the same edit and passed from the start, which is the point of them: they are what a
check refusing every pending graphic would fail.

**B2 — a no-op composition writes no revision and pushes no undo entry.** Five cases watched red in
the domain (*"answers the very shape it was handed …"* for align, distribute, a move of zero, and a
group already at the front and at the back — each `expected { … } to be { … } // Object.is
equality`) and five at the panel (*"writes once for two presses of the same alignment"* →
`expected [ … ] to have a length of 1 but got 2`; the distribution pair; the group-front press →
`length of +0 but got 1`; and the four-row `it.each` over the by-fields at their resting values).

**The existing case this made wrong, deliberately rewritten:** `arrangeDetails.test.ts`'s *"moves
nothing when the chosen edges already agree"* asserted `toEqual`, which is exactly the defect
asserted as correct — an equal-but-fresh shape is precisely what gets written. It is now *"answers
the very shape it was handed once every chosen edge already agrees"* and asserts `toBe`. Its
docblock says what it used to say and why that was wrong.

**R1 — two docblocks claiming a category the code does not hold.** Both narrowed rather than
defended. `groupEdits.ts`'s header now says the six aggregate refusals are answered there **except
for two that are PRE-EMPTED**: `resolveParticipants` answers `asset.part-not-found` where
`validateGroups` would answer `dangling-group-member`, and `asset.duplicate-part` where it would
answer `overlapping-groups` for one graphic named twice. `en/assetArrange.ts`'s header splits its
"no control here can produce them" claim into the two different reasons it was conflating.

**R2 — Group offered where it can only refuse.** `groupable` requires every selected graphic to be
ungrouped, not merely two or more of them. Watched red as *"withholds Group where every selected
graphic is already in a group"* → `expected [ 'group', 'ungroup', …(9) ] to not include 'group'`.
**This made the panel's `overlapping-groups` case unreachable as written**, and rather than delete
it I re-sited it on the one window a withheld control cannot close: the shape an edit is handed is
read when the edit RUNS, so a peer leaf that grouped those parts since this render is a press whose
button was drawn correctly and is refused anyway. The locale header now says that is where the code
comes from.

**R3 — the two hand-written controls no test could catch.** `set-move-y` is driven to a written
shape (down 25 mm and NOT across), `group-front`/`group-back` are an `it.each` over both ends with
their two different orders, and `set-rotate-by` was judged to be in the same class and is driven
too — degrees at the field, radians at the domain, about the shared box's centre, all three pinned
in one press. **All three passed on their first run**: the gap was coverage, not a defect, and the
report says so rather than claiming a fix.

**R4 — the card's undo/redo verification.** Written, in the file the review dispatch granted. See the
acceptance row above for what it asserts and what its mutation check was.

**R5 — the unreachable guard deleted**, with its locale string and its template arm.
`DesignerRepeatForm.blockExtent` answers a `number` now.

**R6 — the repeat limit written twice, and the one finding I did NOT implement as prescribed.** See
the disagreement below.

**R8 — the two small ones.** `leftOf`'s `shape.details.find(...) as never` is gone;
`requireDetail` moved into `tests/helpers/arrangeShapes.ts` so the domain suite and the panel suite
share one throwing lookup rather than one throwing and one `as never`. And `refusal` is cleared by a
`watch`, so a stale alert cannot outlive the selection that raised it — watched red as
*"clears when the selection changes"* → `expected true to be false`. The watch is on the id LIST
rather than on the `graphics` computed itself: that computed depends on the design as well as on the
selection, so it answers a fresh array after any refresh, and watching the array would have cleared a
refusal on a peer leaf's write too. No case can see that difference today, and the comment says which
one it is.

### Where I disagree, and what I did instead

**R6 asked for `{max}` interpolation in `asset.repeat-count-out-of-range`. That spelling does not
work, and shipping it would have put a literal `{max}` in front of a user.** Measured rather than
assumed: an error's copy is produced by `toUserMessage`, which calls `t(language, error.code,
namedParams(error))`, and `namedParams` supplies exactly one key — `names`, from
`application/errors.NamedReferents`. `t` leaves an unmatched hole standing as `{max}` on purpose
("a visible hole is a bug report, an empty string is a silent one"). There is no second door: the
only interpolated error strings in the whole locale tree are the three `{names}` ones. Filling it
would mean either abusing `names` for a count (and the domain may not name an application-layer
interface) or editing `toUserMessage.ts`, which is not in this lease.

So I took the finding's actual complaint — the limit is written twice and the copies drift — and
removed the second copy instead of parameterising it: the refusal now reads *"That is more copies
than one repeat can add, or not a whole number of them."* and states no number at all. The number
the user needs is still on screen and still comes from the one place, through the count field's
`:max="MAX_REPEAT_COPIES"`. If the integrator would rather have the figure in the sentence, the
smallest honest way is a `{max}` hole plus a `max` param at `toUserMessage`, and that is an edit to
a shared file somebody has to own.

**One note on R2 that is agreement rather than disagreement, but changes what the fix looks like:**
the predicate the reviewer named ("also require every selected graphic to be ungrouped") makes
`overlapping-groups` unreachable from the button in every state the panel can DRAW, not only in the
all-grouped one. That is right, and it is why the refusal case moved to the render/press window
rather than being deleted — a code with no reachable path would be copy nobody has read, which is
exactly what the locale header refuses.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: **not verified by this worker.** The review-fix commit sits on `ad10-arrange` on top
of `0c818cb1c`, unpushed and unmerged. Nothing here is marked verified; the integrator and the
reviewer accept the integrated result.
