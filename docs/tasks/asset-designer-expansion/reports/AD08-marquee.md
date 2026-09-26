# Task report — AD08 remainder, marquee selection

Outcome: **implemented**
Owner / worktree / branch: one implementation worker ·
`.claude/worktrees/renovation-planner-asset-designer-bc5539/.worktrees/ad08r` · `ad08r-marquee`
Base commit: `13f82f82e` · First candidate: `fd1cfb1e9` · **Review-fix candidate: see the commit this
report is committed in** (one commit on top of `fd1cfb1e9`, not an amend, so the review boundary
stays visible)

**The first candidate named `6cf098480`, which is a SHA no branch carries.** The branch was at
`fd1cfb1e9`. Corrected here rather than explained: a report naming a commit nobody can check out is
a report whose evidence cannot be reproduced.
Accepted contract revision: `r1`, plus ruling **AD08-R1** (2026-09-17)
Allowed scope and shared-file leases: the dispatch brief's exclusive lease —
`selection/designerSelection.ts`, `selection/hitTest.ts`, `selection/selectionDrag.ts`, a NEW
marquee module in `selection/`, `tools/designer-select-tool.ts`, `layers/DesignerGestureLayer.vue`,
both `assetMarquee` locale modules, and any new file under `tests/`. **Three of the leased files
were not touched at all** (`designerSelection.ts`, `hitTest.ts`, `selectionDrag.ts`) and neither
locale module needed a string — see below. **No integrator-held file was edited.** One
integration change request IS owed after the review round — one line in `runtime.ts` — and it has
its own section below; the first candidate's claim that none was owed was true of the first
candidate and is not true of this one.

Files outside the new-file rule that were edited are declared rather than assumed safe: two existing
unit suites for the tool this task owns (first candidate), and the shared rig helper
`tests/helpers/designerSelection.ts` (review round). Both tables below say which and why.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/selection/marquee.ts` | **New.** `marqueeBox` (the normalised rectangle) and `marqueeMembers` (the inclusion rule). Pure: no pointer, no store, no `RenderState` | yes — the brief's "NEW marquee module in `selection/`" |
| `src/presentation/designer/tools/designer-select-tool.ts` | The gesture: a `Marquee` draft begun where a press answers a null hit, the threshold, the band, the release, and the five interruptions | yes |
| `src/presentation/designer/layers/DesignerGestureLayer.vue` | Mounts `MarqueeOverlay` over `renderState.marquee` | yes |
| `tests/presentation/designer/selection/marquee.test.ts` | **New.** 13 cases over the rule | yes |
| `tests/presentation/designer/tools/designerSelectMarquee.test.ts` | **New.** 17 cases over the gesture | yes |
| `tests/presentation/designer/designerMarqueeCanvas.test.ts` | **New.** 6 cases on the mounted designer — the marquee end to end, and AD08-R1's occlusion check | yes |
| `tests/presentation/designer/tools/designerSelectTool.test.ts` | **Two assertions rewritten.** `hasDraft()` was asserted false after a press on empty canvas; that press now begins a marquee, which IS a draft | AD08's own unit suite; outside the strict "new files only" wording, declared here |
| `tests/presentation/designer/tools/designerSelectBend.test.ts` | **One assertion rewritten**, same cause | as above |

**The review round added these, on top of `fd1cfb1e9`:**

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/tools/designer-select-tool.ts` | All four fixes: the release's own clear, the additive sweep and its union rule (`include`), the plain press that preserves a set (`insideSelection`), and cancellation's restore (`restoreSelection`, `dropMarquee(context, restore)`) | yes |
| `tests/presentation/designer/tools/designerSelectMarquee.test.ts` | +15 cases in five new describes, **and four EXISTING assertions changed** — declared in full below | yes |
| `tests/presentation/designer/designerMarqueeCanvas.test.ts` | +4 cases on the real mounted store, which is the only place `extend`'s toggle can answer | yes |
| `tests/helpers/designerSelection.ts` | The rig gains a `selected` option, and leaves `hidden` UNWIRED by default | **shared test helper, outside the strict lease wording.** Additive: one new option and one default changed from "a function answering an empty set" to "no function", which is the same thing to every rule that reads it |

`selection/marquee.ts` was **not touched**, including `segmentMeetsBox`: the review's clone finding
(F1) is the integrator's and lifting that function into `core/geometry/` would collide with them.

### Why `RenderState` needed no change, and why the store needed no third door

The brief asked both questions explicitly.

**`RenderState` already declares `marquee: BoundingBox | null`**, written by the plan editor's
`MarqueeSelection` and reset by `reset()`. Nothing was added, and `previewPolygon` — the field the
brief suggested looking at first — is deliberately NOT reused: it already has two writers
(`DrawDetailTool` here, `SelectTool`'s translated ghost there) and the designer's own gesture layer
draws it dashed and CLOSED as a polygon, which is the wrong verb for a selection rectangle. The
right field already existed. `MarqueeOverlay.vue` is imported from `presentation/editor/layers/`
exactly as `GestureSketch.vue` and `SnapGuides.vue` already are — read, not edited.

**`assetDesignStore` needed no `selectMany`.** The press already clears the selection
(`select(null)`, unchanged), and a captured pointer leaves nothing else able to write one mid-sweep,
so the release adds to an empty set through `extend` in a loop. That is not a workaround: `extend`
is where C05's rule about which parts may be composed lives, and a marquee that assigned a list
would be a second answer to it. `marqueeMembers` answers graphics only, so no member of the loop is
ever refused — the two agree by construction, and the loop keeps the store the one that decides.

### The locale modules stay empty, deliberately

`en/assetMarquee.ts` and `de/assetMarquee.ts` are unchanged and still empty. The marquee draws a
rectangle and no text; the count it feeds is `designer.selection.count`, which AD08's earlier
increment already declared and `DesignerInspector.vue` already renders for a set of two or more.
Adding a key nothing renders would be a string with no reader. If the integrator wants a status-row
hint ("drag on empty canvas to select several"), that row lives in `AssetDesignerRoot.vue`, which
this task may not edit — it would be a separate one-line change and its string would go in these
two modules.

## The review round — every finding, and what was done about it

Independent review of `fd1cfb1e9` returned REQUEST CHANGES. Five findings; four were mine to fix.

### F2 (blocking) — the release must clear before it adds

**Done.** `finishMarquee` now calls `this.deps.select(null)` before the loop, in the non-additive
case. One line, no new branch, and C05's composition rule stays in `assetDesignStore.extend` where
the first candidate correctly put it.

**One correction to the finding's own reasoning, and it does not change the fix.** The review says
that with a SPECIAL part selected "every call degrades to `select(next)` and the loop leaves exactly
one part selected". Traced against the store: only the FIRST call degrades. `extend` filters
`selected` to its non-detail members, and after the first `select(detail-1)` there are none, so every
later call takes the toggle branch and APPENDS. A sweep landing on a footprint selection therefore
already produced the right set. The finding's second arm is the real one and is what the mounted case
drives: with a GRAPHIC already selected, the matching iteration REMOVES it — `[detail-1]` plus a
sweep meeting both leaves `[detail-2]`, and `detail-1` is gone. (The review's own F3 text states the
special-part rule correctly — "the first call replaces it, later calls add" — so the two halves of
the review disagree and F3 is the half that matches the code.)

The fix is unchanged by that: the release no longer depends on either arm.

### F3 (blocking) — the marquee ignored both additive routes

**Done, and not the way the finding prescribed.** The disagreement is about mechanism, not about
semantics: an additive sweep UNIONS, it does not toggle, exactly as required.

- `press` reads `this.additive(event)` — `event.modifiers.shift || multiSelectionMode?.()` — and
  latches it on the draft, so a control toggled off mid-sweep cannot change the gesture at the
  release. A non-additive press clears as before; an additive one clears nothing.
- The release composes through `include(member)` rather than `extend(member)`.

**Why `include` is a repair rather than the prescribed filter.** The finding says to "call `extend`
only for hit members that are **not already selected**". That needs a membership read, and this tool
has none: `deps.selection()` answers the PRIMARY, and `assetDesignStore.selected` reaches the tool
only through `runtime.ts`'s `selectToolDeps`, which is outside this lease. So `include` asks the one
question it can ask without inventing a second membership rule beside the store's:

```ts
this.deps.extend(member);
if (!sameSelection(this.deps.selection(), member)) this.deps.extend(member);
```

Two calls to a toggle are "make sure it is there". The outcome is identical to the prescribed filter
in every case — including the SPECIAL-part case the finding says to assert, where `extend`'s own rule
replaces on the first call and adds on the rest and nothing is repaired. **One observable difference,
and it is in ORDER, not membership:** a member the sweep re-crosses moves to the end of the set and
so becomes the primary, where the prescribed filter would have left it where it was. That reads
better rather than worse — the primary is the last part the rectangle crossed — and the mounted case
`leaves a part it swept over a second time selected` pins it either way.

It also costs no store door, no new dep, and no integration change request, which the filter would
have cost.

### F5 (blocking) — clicking inside the current multi-selection must preserve it

**Done, and PARTLY INERT in production until the change request below lands.** This is the one place
the lease actually bites.

`choosePart` asks `insideSelection(selection)` — is this part a member of a selection of two or more
— and skips the `select` when it is. What it does then:

| Question | Answer, and why |
|---|---|
| What does the set become? | **Unchanged**, member for member. |
| What does the PRIMARY become? | **Unchanged.** The pressed part does not become primary, so the inspector goes on showing the part it was showing and nothing flickers. The plan editor's `focusSelectedMember` re-focuses instead, through `context.selection.focus(id)` — a door `assetDesignStore` does not have. Adding one is a store change, outside this lease and outside this finding. |
| What does the drag move? | **The part PRESSED**, which is exactly what a press has always dragged here. Multi-part dragging is explicitly out of scope and none was invented. So a drag begun on a member moves that member while the handles stay drawn around the primary — a real wart, named here and in `choosePart`'s docblock rather than hidden. |
| A plain press on the SINGLE selected part? | **Unchanged.** `insideSelection` requires `length > 1`, so a one-member selection still goes through `select`, which is what preserves its point or bend mode (Amendment 1, through `sameSelection`). Asserted: *still re-chooses a part that is the whole selection, so its mode survives*. |
| A press on a part that is NOT a member? | **Still replaces**, which is what makes the preservation something a user leaves rather than is stuck in. Asserted twice, including with a set of two. |

**Why it is partly inert.** `insideSelection` reads `selectionSet()`, which reads the new optional
`deps.selected`. Nothing wires it yet — see the change request — so in a real leaf it answers the
primary alone, `length > 1` is never true, and a press behaves exactly as it did before this was
written. **No regression: strictly less of the fix, never a different behaviour.** The unit cases
drive the wired shape through the rig; the mounted cases for it are deliberately NOT written, because
a case that passes only against a stub proves nothing about the leaf.

### F4 (not blocking) — cancellation restores what the press cleared

**Done properly rather than by amending the docblock.** `Marquee` carries `initial`, snapshotted at
the press BEFORE the clear. `dropMarquee` took a `restore` flag, which is what separates its two
kinds of caller: `dropGesture` (Escape, a tool switch, `pointercancel`, focus loss, a release outside
the leaf, view teardown) passes `true`; the next `press` passes `false`, because that press has just
cleared the selection itself and restoring would undo its own gesture. An ADDITIVE sweep restores
nothing because it cleared nothing.

`restoreSelection` puts the snapshot back through the same two doors a user's own presses compose one
with — `select` the first member, then `include` the rest in order, so the last is primary again. The
docblock now names `MarqueeSelection.cancel` as the surface this matches (C12) instead of arguing its
own rule as the only answer.

**Two honest narrowings, both written at the code.** The MODE is not restored and cannot be: the
press's `select(null)` had already reset it to Transform and the store has no door that sets one. And
where `deps.selected` is unwired the snapshot is the primary alone, so an interruption puts back one
part rather than a set — still strictly more than the nothing the first candidate put back.

### F1 (clone) — NOT TOUCHED, deliberately

`segmentMeetsBox` in `selection/marquee.ts` is byte-for-byte the slab test `MarqueeSelection.ts`
keeps private as `intersects`. The integrator owns lifting it into `core/geometry/`; both files are
outside this lease and moving or renaming it here would collide. `marquee.ts` is unchanged in this
commit.

## Integration change request — one line

```ts
// src/presentation/designer/runtime.ts, inside selectToolDeps's returned object,
// beside the existing `selection: () => store.selection,`
selected: () => store.selected,
```

`DesignerSelectToolDeps.selected` is declared, documented and consumed; only the wiring is missing,
because `runtime.ts` is an integrator-held file. Until it lands:

- **F5 is inert.** A plain press inside a multi-part selection still collapses it.
- **F4 restores one part** rather than a whole set on cancellation.
- Everything else — F2, F3, the union rule, both additive routes — is live, because none of them
  needs the set.

`selectionSet()` is the one place the fallback lives and its docblock says so. Nothing else in this
candidate depends on the line.

### Assertions this round CHANGED rather than added — declared, not absorbed

Four existing assertions became wrong because the behaviour under them changed. Each is listed with
what it now says and why, because a rewritten assertion is how a regression gets absorbed:

| Case | Was | Is | Why |
|---|---|---|---|
| `designerSelectMarquee` → *composes through the store's own extend rather than assigning a selection* | `rig.selected` is `[null]` | `[null, null]` | F2: the release clears too. The case's own subject — that no selection is ever ASSIGNED — is unchanged, and its comment now says which half is which. |
| `designerSelectMarquee` → *takes the band away and composes nothing*, three parametrised cases | `rig.selected` is `[null]` | `[null, TANK]` | F4: the interruption puts back what the press cleared. The describe's docblock records that this case asserted NO restore until the finding. |

The three assertions the FIRST candidate rewrote (in `designerSelectTool.test.ts` and
`designerSelectBend.test.ts`) were not touched again.

## Acceptance coverage

The card's six criteria, of which AD08's earlier increment already met four; this report claims only
what this candidate adds or re-proves.

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Canvas and Parts selection observe the same model, not two synchronized copies | met | `designerMarqueeCanvas.test.ts` "is listed in the Parts panel, and its row selects it through the same door" — a canvas press and a panel row both land in `assetDesignStore.selected`, asserted on the real mounted leaf. The marquee writes through `extend`, the same door Shift-press uses (`designerSelectMarquee.test.ts` "composes through the store's own extend rather than assigning a selection") | — |
| No modifier is required for the only available route to multi-select | met | Three routes with no modifier: the sticky multi-selection toggle, the Parts panel, and a plain drag on empty canvas. **The sweep itself now honours the sticky control**, which the first candidate did not: `designerMarqueeCanvas.test.ts` *adds under the sticky select-multiple control, with no modifier held* drives the real checkbox the inspector draws and then two sweeps, on the real store | — |
| Clicking inside the current multi-selection preserves it until the user intentionally changes it | **built, and inert in a real leaf until the one-line change request lands** | `choosePart`'s `insideSelection` skip; `designerSelectMarquee.test.ts` *a plain press on a member of a multi-part selection*, five cases covering keep / drag / not-a-member / set-of-one | **Open in production only.** The rule reads `deps.selected`, which nothing wires yet, so a real leaf still collapses the set. No mounted case is written for it, deliberately: one that passed against a stub would prove nothing. The drag still moves the part pressed, never the set |
| A finished drag is one write/history entry; Escape/pointercancel is none | met, for this gesture | `designerSelectMarquee.test.ts` "selects every graphic the rectangle met, and writes nothing at all" (`written`, `dispatched` and `previews` all empty) and the three interruption cases; `designerMarqueeCanvas.test.ts` "writes nothing to the sidecar" compares the real sidecar document before and after | A marquee is ZERO history entries, which is the correct reading of "a preview is not a vault write" — it is not a drag that writes one |
| Locked/temporarily hidden parts are handled consistently and can still be found/unlocked in Parts | met | `marquee.test.ts` "is never a member, because it is not on screen"; `designerSelectMarquee.test.ts` "leaves a hidden one out" and "keeps a locked one, which a marquee could not have moved anyway". Both rules are stated in `marqueeMembers`'s docblock | — |
| External edits or deleted selected elements do not cause commands to target a different part | met | The marquee captures the press's shape (`Marquee.shape`), so a peer write mid-sweep cannot change which parts were swept; ids a write removed are pruned by `AssetDesignStore.hydrate`, unchanged. `designerSelectMarquee.test.ts` "a sweep begun while a write is still queued" drives the held-and-replayed path | — |

### C05's marquee clauses, one at a time

| Clause | Where it is met | Where it is checked |
|---|---|---|
| One documented inclusion rule | `marqueeMembers` / `graphicMeetsBox` docblocks: intersection, closed-by-area and open-by-stroke | `marquee.test.ts`, 13 cases |
| Never an accidental dependency on drag direction | `marqueeBox` normalises | `marquee.test.ts` "is the same box whichever way the pointer travelled" **and** "selects the same parts left-to-right and right-to-left"; `designerSelectMarquee.test.ts` "selects the same parts swept in either direction" |
| Show the count | Fed the existing `designer.selection.count` | `designerMarqueeCanvas.test.ts` "says how many parts are selected" (reads `.rp-designer-selection-count` on the real inspector) |
| A preview is not a vault write | The gesture builds no command | four assertions in the unit case plus the sidecar comparison on the mounted one |
| Pointer lifecycle, cancellable from pressed and previewing | `dropMarquee`, reached from `cancel`, `abandonGesture`, `deactivate` and the next press | `designerSelectMarquee.test.ts` "the interruptions C05 names", three parametrised cases plus "is over: a release after the interruption composes nothing" and "leaves nothing drawn over the press that follows it" |
| A drag threshold stops a click becoming a marquee | `travelled`, shared with the drag arm | "is a click: it clears the selection, draws no band and selects nothing" and its twin "becomes a sweep … once it passes the threshold", over a fixture built so the threshold is the thing deciding |
| Final pointer-up must not let a synthetic click clear the selection | Structural: `select(null)` is written once in the tool (grepped in the same edit — it is the press), and `EditorSurface` binds no `click` listener at all (grepped) | Stated at the call. There is no suppression flag to test because there is no click door to suppress |
| Only graphics join the set | `marqueeMembers` filters to details, and `extend` refuses the rest | `marquee.test.ts` "never selects the footprint, the clearance, the anchor or the facing" |
| Rotated geometry, zoom extremes, overlapping parts | — | `marquee.test.ts` "declines a box in a rotated graphic's empty bounding-box corner" and "takes every graphic it meets, overlapping ones included"; `designerSelectMarquee.test.ts` "is judged in screen pixels at both zoom extremes" (0.01 and 1000 mm per pixel) |

### Ruling AD08-R1 — what I verified, and my conclusion

**No chooser was built and none is proposed.** What the ruling asks for instead is a check that an
occluded part really is reachable through `DesignerPartsPanel.vue`. That check is
`designerMarqueeCanvas.test.ts`'s second `describe`, three new cases on the **real mounted designer**
(not a bare panel mount), over a fixture where `under` lies **wholly inside** `over` — so there is no
point on the canvas where `hitDesign`'s `findLast` answers `under` at all:

1. *cannot be had by pressing the canvas* — a press over both selects `over`. The determinism half.
2. *is listed in the Parts panel, and its row selects it through the same door* — the row press puts
   `{ kind: 'detail', id: 'under' }` into the real `assetDesignStore.selected`. One selection model.
3. *is reached by the arrow keys, on a row a keyboard can activate* — `ArrowDown` on the list moves
   focus to that row, the row carries `tabindex="0"` (the roving tab stop), and the element is a
   `<button>`.

**Conclusion: the ruling holds AT THE LAYER THIS EVIDENCE REACHES.** A buried part is listed,
focusable with no modifier, and selects through the same `select` a canvas press calls.

**What "verified on a mounted designer" means, said plainly**, because the first candidate let it
read wider than it is: **jsdom, through `tests/helpers/designerRig.ts`. Not Obsidian.** No vault, no
`npm run test-build`, no manual case walked. Three narrowings follow from that and all three are the
ruling's own subject matter:

1. jsdom synthesises no click from Enter or Space on a focused button, so case 3 proves that the
   keyboard reaches a native `<button>` — which is what makes both keys activate it in a browser —
   and not the activation itself. Driving `trigger('click')` after focusing would have looked like
   keyboard evidence and been none.
2. **Whether the Parts panel is on screen at a real leaf width is UNMEASURABLE here**, and that is
   exactly AD08-R1's own stated trigger for ever building a chooser: *"build a chooser when the Parts
   panel is not on screen and cannot be — a leaf too narrow to show it"*. jsdom lays nothing out, and
   `npm run harness-shot -- --width=460` — the sidebar width that has already hidden layout defects
   in this repository — could not be run here (no pinned Chromium, and `playwright install` is
   forbidden on this box). So the panel is *mounted and reachable*; whether a user at a narrow leaf
   can SEE it is untested by anything in this candidate.
3. Hit size, contrast and focus visibility on those rows are not graded by jsdom either.

## Executed checks

All on the candidate tree, in the assigned worktree, with `TEMP`/`TMP` pointed at `D:/tmp-claude` —
**the C: volume on this machine has 0 bytes free**, and a child process that cannot write a temp file
fails in ways that look like a source defect. One heavy command at a time; two other workers were on
the box.

| Command | Commit / environment | Exit | Evidence |
|---|---|---|---|
| `npm run check:fast -- tests/presentation/designer` | `6cf098480`, win32, node from the worktree's `node_modules` | **0** | oxlint clean, `vue-tsc -noEmit` clean, **52 files / 686 tests passed**, 316.7s |
| `npx eslint <the six changed files> --max-warnings 0` | same | **0** | This is what `check:fast` omits — the layer bans, the write boundary, both text bans and the Vue ruleset |
| `npx vue-tsc -noEmit` | same | **0** | Run separately before the gate as well |
| `npx vitest run tests/harness/assetDesignerSelectKnob.test.ts tests/harness/harnessSurfaces.test.ts tests/presentation/designer/regionsReachable.test.ts` | same | **0** | 29 passed — the harness surfaces and the import-graph walk, since a layer gained a component |
| `npx vitest run tests/presentation/designer/tools` | same | **0** | 104 passed, after the three rewritten assertions |

### Cases watched RED before they were trusted

Every invariant below was mutated in the source, the case was watched failing, and the source was
restored from a backup copy (`git diff` clean afterwards for the tracked file; `marquee.ts` is new,
so it was restored from `D:/tmp-claude/marquee.bak` and re-run green).

| Mutation | What went red | Reading |
|---|---|---|
| `marqueeBox` returns `{ min: a, max: b }` unnormalised | 1 case: "is the same box whichever way the pointer travelled" | **And this is the finding worth recording**: the MEMBERS direction case stayed GREEN, because the slab test is itself symmetric in a box's two corners. So normalisation is held by the box case, and the members case guards a future rule that read `min`/`max` directionally. That is now written into the test rather than left as a claim the case does not support |
| `graphicMeetsBox` becomes an axis-aligned-bounds test | 3: rotated corner, open-by-stroke, open arc | The rotated and open rules are real, not decoration |
| The `curvedContains(outline, box.min)` clause dropped | 4 | A box inside a graphic is in the set |
| An open graphic treated as closed | 1: "never by the area its ends imply" | |
| `hidden` ignored | 1 | |
| No marquee begun on a null hit | **14 of 17** gesture cases | |
| `dropMarquee` does not clear `renderState.marquee` | 4 interruption cases | |
| `if (!marquee.moved) return` removed at the release | 1: the click case — **after the fixture was rebuilt.** It stayed green against the first fixture, because on the toilet every graphic is inside the clearance, so a 1.5 mm box next to an empty-canvas press meets nothing whatever the threshold does. `OUTLIER` puts a graphic past the clearance's edge, which is the only arrangement where the threshold decides the outcome | The first version of this case proved nothing and looked identical to one that did |
| `hasDraft` drops its marquee arm | 5 | |
| The press does not drop a leftover sweep | 1 | |
| The press no longer drops a leftover drag/bend | the 2 REWRITTEN assertions, in both files | The rewritten assertions still catch exactly what the originals were written for |

## Executed checks — the review-fix round

Same environment and the same discipline: the assigned worktree, `TEMP`/`TMP` at `D:/tmp-claude`
(**the C: volume has 0 bytes free**), one heavy command at a time, other workers on the box. Node and
every binary from the worktree's own `node_modules`; no `npm install` and no `playwright install`.

| Command | Exit | Evidence |
|---|---|---|
| `npx vitest run tests/presentation/designer` | **0** | **52 files / 705 tests passed** |
| `npx vitest run tests/presentation/designer tests/presentation/editor/tools` | **0** | 77 files / 964 passed — the editor's own Select tool and `MarqueeSelection` are untouched and still green |
| `npx vitest run tests/presentation/designer/tools/designerSelectMarquee.test.ts` | **0** | 32 passed |
| `npx vitest run tests/presentation/designer/designerMarqueeCanvas.test.ts` | **0** | 10 passed |
| `npx eslint src/presentation/designer/tools/designer-select-tool.ts tests/presentation/designer/tools/designerSelectMarquee.test.ts tests/presentation/designer/designerMarqueeCanvas.test.ts tests/helpers/designerSelection.ts --max-warnings 0` | **0** | No output. This is what `check:fast` omits — the layer bans, the write boundary, both text bans, the size and complexity budgets |
| `npx vue-tsc -noEmit` | **0** | Whole program, `src/**` and `tests/**` |
| `npx oxlint --deny-warnings src/presentation/designer tests/presentation/designer tests/helpers` | **0** | |
| `npx vitest run tests/presentation/designer --coverage --coverage.reportsDirectory=D:/tmp-claude/cov-ad08r …` | **0** | Redirected out of `coverage/` so it could not destroy another worker's `coverage/.tmp`, and with the floors set to 0 so it REPORTS rather than gates. Read per file out of `coverage-final.json`, which is the only instrument that can see a single arm |

### Cases watched RED before they were trusted

Every one of these was watched failing before the fix existed, then green after. The source was
restored from `D:/tmp-claude/tool-fixed.ts`; `git diff` is clean against that copy.

| Red run | What went red, and what it said |
|---|---|
| The 21 new unit cases against `fd1cfb1e9`'s tool | **9 failed.** `a sweep made additive` ×3: `expected [ null ] to deeply equal []` — the press cleared where an additive sweep must not. `the release of a non-additive sweep` ×2: `expected [ null ] to deeply equal [ null, null ]` — one clear, not two. `a cancelled sweep` ×3: `expected [ null ] to deeply equal [ null, …(1) ]` and `expected [ null ] to deeply equal []` — nothing restored. `a plain press on a member of a multi-part selection` → *keeps the whole set*: `expected [ { kind: 'detail', id: 'detail-1' } ] to deeply equal []` — the press collapsed the set |
| The 4 new mounted cases, with `src/.../designer-select-tool.ts` reverted to `fd1cfb1e9` by `git checkout` | **4 failed, all with the same shape**: `expected [ { kind: 'detail', id: 'detail-2' } ] to deeply equal [ …(2) ]`. One part where two belong — the F2 hole with a graphic selected, the Shift route, the sticky route, and the union repair. This is the run that matters most: it is the REAL `assetDesignStore`, so `extend`'s toggle is the thing answering |

**Two of the new cases were red for the WRONG reason first, and both are worth recording.**

1. `a plain press on a member of a multi-part selection` first pressed
   `justInsideBottom(detailOutline('detail-1'))` — ten millimetres from the tank's bottom EDGE
   handle, which is inside the bowl's grab radius at this camera. The press was landing on a
   HANDLE, not on the part: one case passed for the wrong reason and another failed for it
   (`expected [] to deeply equal [ { kind: 'detail', id: 'detail-1' } ]`). The cases press the
   tank's derived CENTRE now, a hundred millimetres from every handle, and the reason is written
   above them.
2. `keeps the whole set rather than collapsing it to the part pressed` was GREEN in that first
   run — which looked like the fix already existing and was the handle hit instead. A case that
   passes before its fix is written is a case nobody has checked.

### Coverage of the changed file, read per arm

Read out of `coverage-final.json` for `designer-select-tool.ts` and `selection/marquee.ts`: **no
uncovered statement, no uncovered function and no uncovered branch** in either.

Getting there closed a PRE-EXISTING hole rather than one this round opened. The first pass reported
one uncovered branch — `this.deps.hidden === undefined ? {} : …` in `press`, the `{}` arm — which
`runtime.ts` can never reach (it always wires `hidden`) and which the rig could never reach either,
because it defaulted the option to a function answering an empty set. That is CLAUDE.md's *"an
unreachable guard is not free"* met from the test side: a branch nothing could pay back. The rig
leaves `hidden` unwired when a case names none, which is the same thing to every rule that reads it
and reaches both arms. It is incidental to the review findings and is declared here rather than
folded in quietly.

## Verification not performed

- **Real Obsidian — and this covers EVERY "mounted" claim in this report.** Mounted means jsdom
  through `designerRig`, never a vault. No Obsidian and no vault in this environment. `npm run test-build` was not run
  and no manual case under `docs/tests/` was walked. How the rubber band looks against a real theme,
  whether a sweep feels right with a real pointer, and whether the band is visible at all against a
  dark vault's accent are unverified. **The band's colour is `tokens.accent` at 8% fill with a dashed
  stroke — the plan editor's own `MarqueeOverlay`, unmodified — so it inherits whatever that surface
  already looks like in a vault, which is the strongest thing I can say without running one.**
- **Browser captures.** No pinned Chromium here and `npx playwright install` is forbidden on this
  box, so `npm run harness-shot` was not run. **There is no picture of a marquee in this repository.**
  Layout and contrast are what a capture measures and no layout engine here does — this is the check
  most likely to find a defect in this candidate.
- **The full gate.** `npm run check` was NOT run, per the dispatch brief (two other workers on the
  box). So: **no `eslint .` over the whole tree** (only the six changed files), **no coverage floors**,
  **no `npm run build`**, **no `npm run analyze`**. Three consequences the integrator should price in:
  - **Coverage floors are unmeasured over the TREE.** The review-fix round did measure the two
    changed source files per arm out of `coverage-final.json` — no uncovered statement, function or
    branch in either — through a scoped run redirected out of `coverage/`, and it closed one
    pre-existing unreachable branch on the way (see the checks section). What is still unmeasured is
    the whole-tree 99/99/99/98 gate, which only CI runs.
  - **`npm run analyze` was not run**, so fallow's own report on this tree is unseen. The review round
    DID report the clone: `segmentMeetsBox` is the same slab test as `MarqueeSelection.ts`'s private
    `intersects`. **It is left exactly as it is**, on the reviewer's instruction — lifting it into
    `core/geometry/` touches two files outside this lease and is the integrator's to do.
  - **`npm run build` was not run**, so the bundle size is unmeasured. Nothing was added to it but two
    small modules and one component reference.
- **Two leaves on one asset, and cross-leaf refresh mid-sweep.** `designerCrossLeaf.test.ts` covers
  the mechanism and passes unchanged; no case drives a peer write *while a marquee is open*. The
  argument that it is safe is structural (the marquee holds the press's shape and writes nothing),
  not driven.
- **Touch, and the SECOND uncaptured pointer.** `Platform.isMobile` gates this whole view (C12), so a
  marquee on a touch device is out of scope and untested; no case drives a non-mouse pointer type.
  The second-pointer path is also the reachable half of F2's precondition that no case here drives
  directly — the mounted case stands in for it with a Parts panel row activated mid-sweep, which is
  the same `select` call from the same kind of source.
- **F5 in a real leaf, and F4's multi-member restore.** Not tested end to end and cannot be until the
  one-line change request lands; no mounted case was written that would have passed against a stub.
- **The sticky control on a touch device.** Driven here as a real `change` on the real checkbox in
  jsdom, which is the wiring and not the ergonomics.
- **`npm audit`.** Not run; it is its own CI job.

## Data and integration implications

**Schema/migration change:** none. Nothing this candidate does reaches persistence at all.

**Relevant renderer/export/revision consumers:** none. r1's C10 names three consumers — the authoring
canvas, the library mark and plan placement — and a marquee changes only the authoring canvas's
transient layer. There is no export subsystem.

**Undo/no-op/conflict/failure coverage:** a marquee dispatches nothing, so there is nothing to undo,
nothing to conflict and nothing to fail. A cancelled sweep leaves the selection as the press left it
(cleared) — which is the press's own completed action, not the marquee's to reverse, and is stated in
`dropMarquee`'s docblock. A sweep begun while a write is queued is held and replayed, so it reads the
design that write left.

**Identity/unit/quantity/calibration invariants:** untouched. The marquee names existing graphic ids
and creates none; it shows no measurement, so no unscaled number can leak through it; the `tolerance`
it passes is a rendering approximation for arc flattening and never reaches a stored coordinate.

**Shared root/runtime/locales wiring still required:** **one line**, and it is the integration change
request above: `selected: () => store.selected,` in `runtime.ts`'s `selectToolDeps`. Everything else
is already supplied (`select`, `extend`, `hidden`, `locked`, `design`, `multiSelectionMode`);
`DesignerCanvas.vue` already hands the leaf's `RenderState` to the gesture layer; both locale modules
stay empty on purpose. Without that line the candidate is complete and correct, with F5 inert and
F4's restore reduced to the primary — both stated where the fallback lives.

**Rollback/recovery considerations:** reverting this commit loses a gesture and no data — nothing was
written by it and nothing persisted depends on it. The three rewritten test assertions would revert
with it, correctly.

## Reviewer and integrator acceptance

Reviewer outcome and findings: _not filled by the worker._
Integrated commit: _not filled by the worker._
Post-integration checks/evidence: _not filled by the worker._
Final status: _not filled by the worker._ This candidate is **not verified**; the checks above are
what was executed, and the section before them is what was not.
