# Task report — W14-B (AD15 rows T07, T21, T41: designer presentation)

Outcome: partially implemented — **two rows closed with tests, one reported `structural` and deliberately left untested**. Fix round applied after review: §6's observer metric was restored (it had been dropped on a false reading of the source), the lifecycle case re-sited, and four over-wide claims narrowed.
Owner / worktree / branch: W14-B / `.worktrees/ad10` / `w14b-designer-presentation`
Base commit / candidate commit: `7069a3d8b` / see the commit on this branch
Accepted contract revision: wave 14 base, `r1`
Allowed scope and shared-file leases: EDIT `tests/presentation/designer/designerArrangePanel.test.ts`,
`tests/presentation/designer/layers.test.ts`, `tests/presentation/designer/designerCrossLeaf.test.ts`;
CREATE any test file under `tests/`; EDIT any existing test file or harness fixture this change turns red.
**No `src/` change.** None was made — `git diff --name-only 7069a3d8b..HEAD` names no path under `src/`.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/presentation/designer/designerArrangePanel.test.ts` | T07's missing GESTURE half: a mixed-space selection driven through the panel, at two of its three selection-spec assemblers, plus the ruling's grouping carve-out | yes — named in the lease |
| `tests/presentation/designer/designerCrossLeaf.test.ts` | T41's missing REPEATED half: ten open/close cycles asserted on the bus's subscriptions, `Konva.stages` and `connectedObservers()`, in its own `describe` | yes — named in the lease |
| `docs/tasks/asset-designer-expansion/reports/W14-B-designer-presentation.md` | this report | yes — the deliverable |

`tests/presentation/designer/layers.test.ts` is leased and **deliberately unchanged**; the T21 section below is why.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| **T07** mixed-space composition refused | propose **passed** | `designerArrangePanel.test.ts` → `a mixed-space selection (ruling AD10-R1)`: `it.each(['align-left', 'set-move-x'])('refuses the arrangement at %s and writes nothing')` asserts `[role="alert"]` is `t('en', 'asset.mixed-coordinate-spaces')`, `writes` is empty and the shape is `toEqual` its before-value; `still groups a mixed selection, since a group carries no coordinates` asserts the carve-out at the panel | none. The domain half was already exhaustive; this is the gesture half the row asked for |
| **T21** group/ungroup does not move or reorder | propose **structural** | Argument and greps below, matching the matrix's own definition of that grade verbatim | The row should be regraded on the argument, not on a case |
| **T41** repeated mount/unmount releases resources | propose **passed** | `designerCrossLeaf.test.ts` → `the designer’s own lifecycle` → `stacks nothing across repeated open and close cycles`: ten real open/close cycles, each asserting `stagesBefore + 1` and `observersBefore + 1` while mounted, then `expect(reads).toEqual([])`, `expect(Konva.stages.length).toBe(stagesBefore)` and `expect(connectedObservers()).toBe(observersBefore)` | Only the cycle COUNT is revised (50 → 10, on linearity). Every resource §6 names is asserted |

### T07 — what was actually missing, and what closes it

The matrix was right that `designerArrangePanel.test.ts`'s `refuses the arrangement and writes nothing`
is the LOCKED-participant refusal: read at the assertion, it expects `t('en', 'asset.locked-part')` and
its `describe` is `a locked participant`. Nothing drove a mixed selection through the panel.

`DesignerArrangePanel.vue` withholds nothing for a mixed selection — deliberately, by the same rule that
makes `overlapping-groups` reachable: which parts a control NEEDS decides whether it is drawn, and whether
those parts share a coordinate space is a fact about the shape the step reads when it RUNS. So the refusal
is reachable from the panel and the row is a genuinely missing test, not a structural one.

Driven at **two** controls — and the first revision of this report called them "two `commit` paths",
which is wrong. There is exactly ONE `commit`. Grepping this panel and its two child forms for the
declaration and the calls prints **one declaration and eight call sites** — six in the panel, one in
each child — every one reaching that single function, which `DesignerArrangePanel` passes to the
children as a prop.

What genuinely differs is the **selection-spec assembly**, and there are THREE of those: the panel's
own `selection()` (align and distribute), `DesignerSetTransform`'s (built from the `ids` and `locked`
it is passed) and `DesignerRepeatForm`'s. `align-left` and `set-move-x` drive the first two, so the
stated failure mode — a filter applied in one assembler and not the other — holds; only the noun was
wrong. `DesignerRepeatForm` is **not** driven at the panel, and the docblock now says so rather than
letting "two controls" read as "every path": `repeat` is covered by the domain's own
`it.each(spatial)` arm.

### T21 — STRUCTURAL: groups do not reach anything that draws

The rendering half of "grouping does not move or reorder" cannot be asserted, because the renderer cannot
see grouping at all. Measured, not assumed:

```
$ grep -rn "group" src/presentation/designer/layers/
(no output)
```

- `layers/detailsLayer.ts`'s `detailOutlines(shape, tokens, worldPerPixel, hidden)` maps `shape.details`
  in array order, filtered only by `hidden` (a set of GRAPHIC ids). `shape.groups` is never read.
- `DesignerCanvas.vue` is the only caller
  (`grep -rn "detailOutlines\|footprintEdge" src/` names `DesignerCanvas.vue` and the defining module and
  nothing else) and passes `partView.hidden.value`.
- `parts/partView.ts` holds group ids only as `collapsed`, a Parts-panel fold state (`toggleGroup`), and
  `DesignerPartGroupRow.vue` has no `hidden` handling at all, so no group id ever enters the set
  `detailOutlines` filters against.

So the drawn z-order is a function of `shape.details` order alone, and `groupEdits.groupDetails` /
`ungroupDetails` not touching `details` — already asserted by `groupEdits.test.ts`'s *changes no coordinate,
no order and none of the shape's other parts* — is the whole of the claim. A `layers.test.ts` case
comparing a grouped shape's configs against an ungrouped one's would pass for every future build in which
`detailsLayer` keeps ignoring `shape.groups`, which is the unreachable guard CLAUDE.md names: it costs a
branch it can never pay back and certifies a gap rather than closing one.

**Proposed regrade: `structural`**, in the matrix's own vocabulary and matching its own definition of
that grade word for word — *"the property holds by construction: the type or the pipeline carries
nothing that could violate it. No case exists and adding one would assert the absence of something
already impossible."* Here the pipeline is `detailOutlines`, which carries no group input at all. T31
is the precedent already graded that way, for the same reason on a DTO. The one thing that WOULD change the drawn order, `moveGroupToEnd`, reorders `shape.details`
itself and is already asserted at the panel (`moves a noncontiguous group with %s, as a block`) and in the
domain; it is a different claim from T21's.

### T41 — closed, and the first revision of this section was WRONG about what §6 asks

**Correction, recorded rather than quietly fixed.** The first revision of this report and of the
case's docblock said *"§6's 'monotonic growth over 50 cycles' is a HEAP measurement and no gate here
can take one"*, and cited `npm run perf`'s absence. That is false about the thing the row names.
`ACCEPTANCE-AND-QA.md` §6, quoted:

```
| Lifecycle | No monotonic retained-listener/observer growth | 50 repeated open/close cycles after warm-up; document collection/measurement limits. |
```

**Retained listeners and observers** — both countable here, and both counted routinely in this
repository. So the metric was never out of reach and dropping it was a mischaracterisation, not a
narrowing. §6's own preamble says *"Approve or revise these with evidence rather than silently
weakening them"*; revising 50 cycles to 10 is a revision with evidence, waiving the observer half
was a weakening.

**How it happened, which is the part worth keeping.** I worked from `AD15-validation-matrix.md`'s
paraphrase of the row and never opened §6 — while, in the same report, correcting my brief by
citing that matrix. The correction was right and stopped one rung short of the source, on the
sentence that decides the row's grade. The house rule ("a docblock that says X gets the grep in the
SAME edit") applies to a cited requirement exactly as it does to a cited count.

The case now asserts all three resources this view acquires, each as a delta:

| Resource | Instrument | Result |
|---|---|---|
| bus subscriptions | the vault read a still-subscribed closed leaf would issue | `expect(reads).toEqual([])` — passes |
| Konva stages | `Konva.stages.length` | `toBe(stagesBefore)` — passes |
| **resize observers** | `connectedObservers()` from `tests/helpers/layout.ts`, whose own docblock calls it *"the leak check for a repeated mount"* | `toBe(observersBefore)` — **passes** |

**The observer assertion PASSES, so there is no `src/` finding to report.** `EditorSurface`
constructs one `ResizeObserver` at mount and disconnects it at unmount, and a probe across the ten
cycles measured the count going `1, 0, 1, 0, …` — one per live leaf, none retained. Had it failed
it would have been reported as the defect and left in place; it did not.

**Found-something-at-all, added inside the loop** (`scene.test.ts`'s `the editor own lifecycle` is
the in-house precedent): `expect(Konva.stages.length).toBe(stagesBefore + 1)` and
`expect(connectedObservers()).toBe(observersBefore + 1)` while the leaf is open. Without them a rig
that stopped mounting a canvas, or a `ResizeObserver` fake that stopped registering, would reduce
every delta to zero-against-zero — green and vacuous.

**Ten cycles, not fifty**, argued in the docblock: a per-cycle leak is linear in the cycles, so ten
discriminates it exactly as fifty would. Measured cost of the loop: **0.7–2.0 s** against vitest's
5 s per-case budget (no budget was raised); fifty would spend most of that budget on a slower CI leg
for no extra discrimination. `scene.test.ts`'s equivalent case runs **three**.

**What the case still cannot see**, and this is the whole of the honest limit: a detached DOM
subtree still referenced, a closure retained by a timer, and bytes. §6 names listeners and observers
and those are asserted; it does not name bytes.

**Re-sited.** The case first sat under `describe('two designer leaves and one bus')` and never opens
two. That is the same defect as the one that earned T07 its partial grade — a case read at its
`describe` — so it now has its own block, `the designer’s own lifecycle`, and the rig
(`open`/`openViews`/`afterEach`) moved to module scope to serve both. It deliberately takes
`scene.test.ts`'s case name and idiom rather than inventing a second spelling for one subject.

**Why a delta and not zero**, corrected: the first revision said the registry is process-global *"so
an absolute expectation would be an assertion about which file ran first in this worker"*. That
reason is wrong under per-file isolation, which the same paragraph then asserted — `scene.test.ts`
uses an absolute `toBe(0)` for observers today. The real reason is the **four sibling cases in this
same file**, which run first and whose leak would otherwise be charged here; watch 4 measured exactly
that as `expected 17 to be 7`.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerArrangePanel.test.ts tests/presentation/designer/designerCrossLeaf.test.ts tests/domain/asset/arrangeDetails.test.ts` | candidate, Windows, Node per worktree | **0** | `Test Files 3 passed (3) / Tests 108 passed (108)` |
| `npx oxlint <the two edited test files>` | candidate | **0** | no output, which is oxlint's clean answer |
| `npx eslint <the two edited test files>` | candidate | **0** | no output |
| Red watch 1 — T07, both arms | mutation: the `mixed-coordinate-spaces` block deleted from `arrangeDetails.participants` | **2 failed of 39**, and only the two new arms | verbatim below |
| Red watch 2 — T07, carve-out | mutation: that same refusal moved into the shared `detailEdits.resolveParticipants` | **1 failed of 39**, only the carve-out case | verbatim below |
| Red watch 3 — T41, subscription arm | mutation: `AssetDesignerView.unmount` skipping `this.vueApp?.unmount()` after the first close | **3 failed of 5** | verbatim below |
| Red watch 4 — T41, stage arm | mutation: a `new Konva.Stage(...)` built in `DesignerCanvas`'s `onMounted` and never destroyed | **1 failed of 5**, the new case alone | verbatim below |
| Red watch 5 — T41, observer arm | mutation: `EditorSurface`'s `observer?.disconnect()` removed at unmount | **1 failed of 5**, the new case alone, at the IN-LOOP assertion | verbatim below |
| `git status --short` after every mutation | candidate | only the two test files modified | every mutation restored with `git checkout <src path>` |

### Verbatim red — watch 1 (T07, the refusal deleted)

```
 ❯ |suite| tests/presentation/designer/designerArrangePanel.test.ts (39 tests | 2 failed) 464ms
     × refuses the arrangement at align-left and writes nothing 13ms
     × refuses the arrangement at set-move-x and writes nothing 7ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerArrangePanel.test.ts > a mixed-space selection (ruling AD10-R1) > refuses the arrangement at align-left and writes nothing
 FAIL  |suite| tests/presentation/designer/designerArrangePanel.test.ts > a mixed-space selection (ruling AD10-R1) > refuses the arrangement at set-move-x and writes nothing
Error: Cannot call text on an empty DOMWrapper.
 ❯ Object.get node_modules/@vue/test-utils/dist/vue-test-utils.cjs.js:1482:27
 ❯ tests/presentation/designer/designerArrangePanel.test.ts:284:40
    282|   if (name === 'align-left') await press(wrapper, name);
    283|   else await commitNumber(wrapper, name, '25');
    284|   expect(wrapper.find('[role="alert"]').text()).toBe(t('en', 'asset.mi…
       |                                        ^
 Test Files  1 failed (1)
      Tests  2 failed | 37 passed (39)
```

### Verbatim red — watch 2 (T07, the refusal at the wrong site)

```
 ❯ |suite| tests/presentation/designer/designerArrangePanel.test.ts (39 tests | 1 failed) 571ms
     × still groups a mixed selection, since a group carries no coordinates 14ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerArrangePanel.test.ts > a mixed-space selection (ruling AD10-R1) > still groups a mixed selection, since a group carries no coordinates
AssertionError: expected true to be false // Object.is equality
- Expected
+ Received
- false
+ true
 ❯ tests/presentation/designer/designerArrangePanel.test.ts:300:51
    298|   expect(names(wrapper)).toContain('group');
    299|   await press(wrapper, 'group');
    300|   expect(wrapper.find('[role="alert"]').exists()).toBe(false);
       |                                                   ^
 Test Files  1 failed (1)
      Tests  1 failed | 38 passed (39)
```

### Verbatim red — watch 3 (T41, release-once)

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerCrossLeaf.test.ts > two designer leaves and one bus > does not refresh a leaf that has been closed
AssertionError: expected [ …(2) ] to deeply equal [ 'asset-01M3266CGTZN4PE6Z8KA2WG3YY' ]
 FAIL  |suite| tests/presentation/designer/designerCrossLeaf.test.ts > two designer leaves and one bus > leaves nothing subscribed once every leaf is closed
AssertionError: expected [ …(2) ] to deeply equal []
 FAIL  |suite| tests/presentation/designer/designerCrossLeaf.test.ts > two designer leaves and one bus > stacks nothing across repeated open and close cycles
AssertionError: expected [ …(20) ] to deeply equal []
```

**This red corrected a claim I had already written**: the docblock first said this mutation would leave the
four existing cases green and redden the new one alone. It does not — the static survives across cases in
one file, so two existing cases redden with **2** leaked reads while the new one reddens with **20**. The
docblock now says that, and says that what the new case adds on this arm is the ACCUMULATION rather than
the detection. The sentence was rewritten from the output, not the output explained to fit the sentence.

### Verbatim red — watch 4 (T41, a leaked stage)

```
 ❯ |suite| tests/presentation/designer/designerCrossLeaf.test.ts (5 tests | 1 failed) 3360ms
     × stacks nothing across repeated open and close cycles 1625ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerCrossLeaf.test.ts > two designer leaves and one bus > stacks nothing across repeated open and close cycles
AssertionError: expected 17 to be 7 // Object.is equality
- Expected
+ Received
- 7
+ 17
 ❯ tests/presentation/designer/designerCrossLeaf.test.ts:226:31
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```

The `7` is itself evidence for the delta design: those were stages leaked by this file's EARLIER cases
under the same mutation. An expectation of `0` would have failed for the wrong reason.

**A claim attached to this watch was too wide and is narrowed.** The first revision said the mutation
reached no other case "because no other case in the suite counts stages at all". False: `scene.test.ts`
uses the identical `stagesBefore` delta, and twenty-two test files read `Konva.stages`. The conclusion
survives, for a different reason — the mutation was planted in `DesignerCanvas`, so only a designer
case could observe it — and the honest narrowing is the DIRECTORY: other suites under
`tests/presentation/designer/` SELECT a stage (`Konva.stages.at(-1)`); this is the only one there that
COUNTS them. The docblock says that and no longer says "the suite".

### Verbatim red — watch 5 (T41, the observer left connected)

Mutation: `observer?.disconnect()` removed from `EditorSurface`'s unmount path.

```
 ❯ |suite| tests/presentation/designer/designerCrossLeaf.test.ts (5 tests | 1 failed) 2023ms
     × stacks nothing across repeated open and close cycles 246ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerCrossLeaf.test.ts > the designer’s own lifecycle > stacks nothing across repeated open and close cycles
AssertionError: expected 9 to be 8 // Object.is equality
- Expected
+ Received
- 8
+ 9
 ❯ tests/presentation/designer/designerCrossLeaf.test.ts:262:33
    260|    // This rig really does acquire both, so neither delta below can pa…
    261|    expect(Konva.stages.length).toBe(stagesBefore + 1);
    262|    expect(connectedObservers()).toBe(observersBefore + 1);
       |                                 ^
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```

Two things this red establishes beyond "the arm is live". It fires at the **in-loop** assertion on the
second cycle — `9` against `8` — so a retained observer is caught as ACCUMULATION rather than at the
end, which is precisely the monotonic growth §6 names. And it fires there and nowhere else in the
file: the observer is a resource no other case in this suite counts.

### Verbatim green — the observer assertion as it actually stands

Since a passing new assertion is the finding here, the whole run is recorded rather than summarised:

```
 ✓ |suite| …designerCrossLeaf.test.ts > two designer leaves and one bus > refreshes a second leaf on the same asset 1190ms
 ✓ |suite| …designerCrossLeaf.test.ts > two designer leaves and one bus > leaves a leaf on a different asset alone 517ms
 ✓ |suite| …designerCrossLeaf.test.ts > two designer leaves and one bus > does not refresh a leaf that has been closed 356ms
 ✓ |suite| …designerCrossLeaf.test.ts > two designer leaves and one bus > leaves nothing subscribed once every leaf is closed 231ms
 ✓ |suite| …designerCrossLeaf.test.ts > the designer’s own lifecycle > stacks nothing across repeated open and close cycles 1963ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

**No `src/` defect was found by the observer arm.** The designer releases its `ResizeObserver` on
every one of the ten cycles.

## Verification not performed

| Not run | Why |
|---|---|
| `npm run check` | Not this card's to run — the wave's brief reserves the full gate for CI, and two other cards were executing on a 7.8 GB shared machine. CI runs it on the PR |
| `npm run check:fast`, `npm run test:coverage`, `npm run analyze`, `npm run build` | Same: outside this card's allowed commands. **Coverage is the one worth naming as a real gap** — this change adds only test code and no `src/` branch, so the floors should be unaffected, but that is an argument and not a measurement |
| `npm run harness`, `npm run harness-shot`, `asset-library-shots`, `concept-shots` | No surface's LAYOUT changed; nothing here draws anything new. Also outside the allowed commands |
| `scene.test.ts` and the other five `connectedObservers()` users | Not run. This change adds a SIXTH caller of that helper and changes nothing in it, so they are unaffected by construction — but that is an argument, and CI is what measures it |
| `npm run test-build` / a vault walk | No `src/` change, so there is nothing new for Obsidian to accept or refuse. Every defect class the manual suite exists for (a fake kinder than Obsidian) is unreachable from a test-only diff |
| The full `tests/presentation/designer/` directory | Narrow invocations only, by the brief. The two edited files and the domain suite they cite were run together (108 passed). Nothing outside them imports either file |
| A rerun under `--no-file-parallelism` | Not needed: no `beforeAll` timeout was seen. Named here because the new T41 case is the isolation-sensitive shape and a future contended run is where it would first misbehave. One run DID die during this round with `[vitest-pool]: Failed to start forks worker … Timeout waiting for worker to respond` — a load artifact with two sibling cards running, which passed on an immediate re-run alone, per CLAUDE.md's own rule. No budget was raised |
| Whether 50 cycles would still pass | Deliberately not measured beyond the ten the case drives. Recorded as a decision rather than an omission: see T41 above |

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none touched. The T21 finding is ABOUT a renderer
(`layers/detailsLayer.ts`) and changes nothing in it.
Undo/no-op/conflict/failure coverage: the T07 cases assert the no-write half (`writes` empty, shape
`toEqual` its before-value), so a refusal still pushes no undo entry.
Identity/unit/quantity/calibration invariants: T07 IS the unit invariant — background pixels never
laundered into millimetres — now asserted at the gesture as well as in the domain.
Shared root/runtime/locales wiring still required: none. `asset.mixed-coordinate-spaces` already exists in
`en` and `de`.
Rollback/recovery considerations: none; the diff is two test files and this report.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.
