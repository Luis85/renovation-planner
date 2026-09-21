# Task report — W14-B (AD15 rows T07, T21, T41: designer presentation)

Outcome: partially implemented — **two rows closed with tests, one reported STRUCTURAL and deliberately left untested**
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
| `tests/presentation/designer/designerArrangePanel.test.ts` | T07's missing GESTURE half: a mixed-space selection driven through the panel, at two distinct `commit` paths, plus the ruling's grouping carve-out | yes — named in the lease |
| `tests/presentation/designer/designerCrossLeaf.test.ts` | T41's missing REPEATED half: ten open/close cycles asserted on the bus's subscriptions and on `Konva.stages` | yes — named in the lease |
| `docs/tasks/asset-designer-expansion/reports/W14-B-designer-presentation.md` | this report | yes — the deliverable |

`tests/presentation/designer/layers.test.ts` is leased and **deliberately unchanged**; the T21 section below is why.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| **T07** mixed-space composition refused | **closed** | `designerArrangePanel.test.ts` → `a mixed-space selection (ruling AD10-R1)`: `it.each(['align-left', 'set-move-x'])('refuses the arrangement at %s and writes nothing')` asserts `[role="alert"]` is `t('en', 'asset.mixed-coordinate-spaces')`, `writes` is empty and the shape is `toEqual` its before-value; `still groups a mixed selection, since a group carries no coordinates` asserts the carve-out at the panel | none. The domain half was already exhaustive; this is the gesture half the row asked for |
| **T21** group/ungroup does not move or reorder | **STRUCTURAL — no test written** | Argument and greps below | The row should be regraded on the argument, not on a case |
| **T41** repeated mount/unmount releases resources | **closed, with a NARROWED sentence** | `designerCrossLeaf.test.ts` → `stacks nothing across repeated open and close cycles`: ten real open/close cycles, then `expect(reads).toEqual([])` and `expect(Konva.stages.length).toBe(stagesBefore)` | §6's "monotonic heap growth over 50 cycles" is **not** what this asserts, and the docblock says so. See below |

### T07 — what was actually missing, and what closes it

The matrix was right that `designerArrangePanel.test.ts`'s `refuses the arrangement and writes nothing`
is the LOCKED-participant refusal: read at the assertion, it expects `t('en', 'asset.locked-part')` and
its `describe` is `a locked participant`. Nothing drove a mixed selection through the panel.

`DesignerArrangePanel.vue` withholds nothing for a mixed selection — deliberately, by the same rule that
makes `overlapping-groups` reachable: which parts a control NEEDS decides whether it is drawn, and whether
those parts share a coordinate space is a fact about the shape the step reads when it RUNS. So the refusal
is reachable from the panel and the row is a genuinely missing test, not a structural one.

Driven at **two** controls because they are two `commit` paths: `align-left` is built in
`DesignerArrangePanel`'s own `alignActions`, `set-move-x` in `DesignerSetTransform`, which assembles its
own spec from the `ids` it was handed.

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

**Proposed regrade: `covered` (domain) with the rendering half recorded as unreachable by construction** —
not `partial`. The one thing that WOULD change the drawn order, `moveGroupToEnd`, reorders `shape.details`
itself and is already asserted at the panel (`moves a noncontiguous group with %s, as a block`) and in the
domain; it is a different claim from T21's.

### T41 — closed, with the sentence written to the check

§6 asks for 50 cycles and monotonic growth. **The monotonic-growth half is a HEAP measurement and no
instrument here can take one** — jsdom has no heap accounting and `npm run perf` is deliberately absent
(CLAUDE.md names its trigger). What is observable in this environment is a leak COUNT, over two resources:

1. the bus's subscriptions, through the vault read a closed leaf would still issue;
2. `Konva.stages`, the module-level registry a mounted stage adds itself to and a destroyed one leaves.

Both asserted as a **delta** against the value at case start, never against zero, because that registry is
process-global; an absolute expectation would be an assertion about which file ran first in the worker.
The case is named `stacks nothing across repeated open and close cycles`, which is deliberately the exact
shape CLAUDE.md records as broken by `--no-isolate` — its docblock says so and says why per-file isolation
is what makes the delta this file's own.

**Ten cycles, not fifty**, argued in the docblock: a per-cycle leak is linear in the cycles, so ten
discriminates it exactly as fifty would. Measured cost of the loop on this machine: **711–787 ms** against
vitest's 5 s per-case budget (no budget was raised). Fifty cycles would be ~3.5–4 s of a 5 s budget, which
is a timeout waiting for a slower CI leg, for no extra discrimination.

What the case **cannot** see, stated in its docblock rather than glossed: heap growth, a detached DOM
subtree still referenced, a timer, and anything jsdom does not implement. One measurement worth recording
for the next author: a `document.querySelectorAll('canvas')` assertion was **considered and dropped** — a
probe showed it answers `0` even while a leaf is open, because the view's `contentEl` is never attached to
`document` in this rig. It would have been a fake kinder than the real thing: green whatever leaked.

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

## Verification not performed

| Not run | Why |
|---|---|
| `npm run check` | Not this card's to run — the wave's brief reserves the full gate for CI, and two other cards were executing on a 7.8 GB shared machine. CI runs it on the PR |
| `npm run check:fast`, `npm run test:coverage`, `npm run analyze`, `npm run build` | Same: outside this card's allowed commands. **Coverage is the one worth naming as a real gap** — this change adds only test code and no `src/` branch, so the floors should be unaffected, but that is an argument and not a measurement |
| `npm run harness`, `npm run harness-shot`, `asset-library-shots`, `concept-shots` | No surface's LAYOUT changed; nothing here draws anything new. Also outside the allowed commands |
| `npm run test-build` / a vault walk | No `src/` change, so there is nothing new for Obsidian to accept or refuse. Every defect class the manual suite exists for (a fake kinder than Obsidian) is unreachable from a test-only diff |
| The full `tests/presentation/designer/` directory | Narrow invocations only, by the brief. The two edited files and the domain suite they cite were run together (108 passed). Nothing outside them imports either file |
| A rerun under `--no-file-parallelism` | Not needed: no `beforeAll` timeout was seen. Named here because the new T41 case is the isolation-sensitive shape and a future contended run is where it would first misbehave |
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
