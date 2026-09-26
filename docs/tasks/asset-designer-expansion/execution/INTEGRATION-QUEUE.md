# What integration owes, per candidate

The integrator's own list, kept because a worker's report is the wrong place for it: these are edits
in files no worker may touch, so nobody else's handoff can carry them and a session that ends
without writing them down loses them. Each row is deleted when it is done and the gate is green on
the SHA that did it — not when it is written.

Written 2026-09-17 during wave 2.

## AD07 — candidate `5e1200a2d` (branch `ad07-entry-paths`)

- [x] **DONE** — **`styles/designer.css` was at exactly 400 total lines and `scripts/styles-assemble.mjs` sets
      `MAX_LINES = 400`.** Measured, not reported: `git show ad07-entry-paths:styles/designer.css | wc -l`
      is 400 against 385 at the base. The candidate builds; the next line anyone adds to that partial
      fails the build. Extract the preset-form rules into a new `styles/designer-presets.css` and add
      its `@import` to `styles/index.css`. **Both files are integrator-owned, which is why this is
      here rather than in the worker's diff.**
- [x] **DONE (deferred, with the reason corrected)** — the numeric-field-row request. The worker left AD07 item 3's optional descriptive
      height unbuilt because `NewAssetForm.vue` is 399 lines against a 400-line `max-lines`, and
      reverted a working version when eslint reported 434. A shared field-row component takes it to
      roughly 355. **A line budget is a real constraint and not a reason to drop an acceptance
      criterion permanently** — either the component lands or the criterion is recorded unmet with a
      trigger, in the card's own amendments.

## AD08 remainder — candidate `fd1cfb1e9` + the review-fix commit on top (branch `ad08r-marquee`)

- [x] **DONE** (`187b1de5d`) — **Lift the clone into `core/geometry/`.** `segmentMeetsBox` in
      `presentation/designer/selection/marquee.ts` is a verbatim copy of the private `intersects` in
      `presentation/editor/selection/MarqueeSelection.ts` — same slab algorithm, same identifier
      names, same early returns, differing only in line wrapping, which is exactly what could hide it
      from a line-oriented clone detector. **Confirmed by reading both, not taken from the report.**
      It is a pure segment-versus-AABB predicate with no presentation dependency, and
      `MarqueeSelection` already imports `contains` from `core/geometry/operations`, so that is its
      home. The worker proposed exporting the plan editor's copy instead; that would have
      `presentation/designer/**` import a geometry primitive out of another surface's selection tool.
      One export, two call sites. **The fix worker was told explicitly to leave `segmentMeetsBox`
      alone so it cannot collide with this.**
- [x] **DONE** (`187b1de5d`) — Delete the `assetMarquee` locale pair and its two spreads if the fix commit still adds no
      strings. A scaffold that turned out unneeded is deleted, not left standing.

## AD10 — candidate `0c818cb1c` (branch `ad10-arrange`)

- [x] **DONE** (`c107b2bda`) — **`AssetDesignerRoot.vue`: pass `:locked-graphics="runtime.partView.locked.value"` to
      `<DesignerInspector>`, AND make that prop REQUIRED rather than optional.** The worker calls the
      wiring the single highest-value line in its handoff and it is right: while the prop is optional
      with an empty default, **a locked graphic composes like any other** — C06's "locked elements
      must not move by implication", live.

      The reviewer answered the required-versus-optional question and I accept the answer. Optional
      is right for `openLibrary` and `setMultiSelectionMode`, because their ABSENCE MEANS something
      — no runtime, therefore no navigation. Absence means nothing here: "no locks" and "locks
      unknown" are different states, and `?? new Set()` collapses them into the permissive one, so a
      missing wire is invisible to all four gates and the only thing that would ever notice is a
      person. That is this repository's own recorded defect shape with the safety rule pointed the
      wrong way.

      **This is an INTEGRATOR edit and neither worker may do it**, which is why it sits here: making
      the prop required breaks `vue-tsc` on any branch whose root does not yet pass it, and the root
      belongs to AD07 while the prop belongs to AD10. It lands in one commit after BOTH are merged —
      the prop, the root's binding, and the three test mounts the reviewer counted. If it ever gets
      deferred back to optional, the reviewer's alternative is binding rather than advisory: an
      assertion in `assetDesignerRoot.test.ts` that the root binds `:locked-graphics`, in the idiom
      `lint-edited.test.ts` uses for its own hook registration. One or the other, never neither.
- [x] **DONE** in AD10 fix round `dcc456adf`, at the corrected site — Ruling **AD10-R1** (recorded in `contracts/DECISIONS.md`, commit `857c05da5`) is not yet
      satisfied by the candidate: the five spatial operations still accept a selection mixing a
      `pending` graphic with a measured one. The check belongs in `resolveParticipants`
      (`domain/asset/arrangeDetails.ts`), which is the worker's own file — so this is a change
      request back to that card, not an integrator edit. Recorded here so it is not lost between the
      two.

## AD12 — candidate `643ba6e5e` (branch `ad12-reference`)

- [x] **DONE** (`cde0e8444`) — **ALLOCATED 2026-09-17 (session three)** to the queue worker of wave 4, with `runtime.ts`,
      `DesignerCanvas.vue` and `DesignerViewMenu.vue` sub-let to it and the grant written into
      `LEASES.md` in the same edit. **Background OPACITY**, ruled a real gap by AD12-R1 and parked here because it was not in any
      card's lease: a leaf-local view preference reaching `runtime.ts`, `DesignerCanvas.vue` and
      `DesignerViewMenu.vue`. `PartView` is the shape to follow — transient, per leaf, written
      nowhere. **Background LOCK is refused, not deferred**: every designer layer is
      `listening: false` and no tool moves the background, so the property is already true and a
      control for it would be a switch with an unreachable off position.
- [x] **DONE** (`8825bfb76`) — `DesignerReferenceFrame.ts` moved to `domain/asset/referenceFrame.ts`,
      its test beside it. The reviewer confirmed purity independently. Decide whether The worker says it is pure
      and reaches only `core/geometry`, and that it sits in `presentation/` only because its lease
      granted no `domain/asset/` file. If that holds on reading, the move is a rename plus three
      imports — and it matters beyond tidiness, because a pure geometry rule in `presentation/` is
      one the layer bans cannot protect.
- [x] **DONE — KEPT after review.** The **narrowed assertion** in `designerInspector.test.ts`. AD12 applied it rather than
      requesting it, and declared it. It changed "the asset's is the ONLY `h3`" to "it is the FIRST".
      Defensible — the case's title is about ordering — but a rewritten assertion is how a real
      regression gets absorbed, so read the before and after and agree or revert.
- [x] **DONE** (`7908969d3`) — **RULED 2026-09-17 (session three) as AD14-R1, and ALLOCATED to AD14.** The representation is
      one boolean `clearanceNeedsReview` on `AssetShape`, beside the three pending flags it is
      modelled on; asset-geometry **schema v4** is allocated in the same edit, as C09 requires. The
      ruling also answers the question underneath it, in C07's own words rather than a third option
      invented beside them: a **measured** clearance is PRESERVED under a whole-object scale rather
      than scaled, so the mismatch is visible on the canvas and not merely recorded, while a
      **pending** one goes on scaling per r1 row 2. `ADR-0034` carries it in the repository's durable
      record, because C03 requires a spec or ADR update to supersede this behaviour rather than an
      unrecorded cleanup. **The row stays unchecked until the gate is green on the SHA that builds
      it** — a ruling is not an implementation. The original statement of the obligation follows,
      unaltered, because it is what the ruling had to answer:

      **PERSISTED REVIEW STATE is OWED and cannot be built in any current lease.** AD01 §1 S09 names
      **AD12** as its owner, and AD12 could not reach it: a durable flag needs `AssetShape`, the DTO
      schemas, the mappers and the schema-version literal, plus a C09 version bump so an older build
      refuses the file rather than stripping the field. **It is also blocked on a decision nobody has
      made** — C07 delegates the representation to AD01 and AD01 never chose one. So this needs a
      ruling first and a card second, and it must not be quietly dropped: the AD12 report originally
      called it "not owed", which the reviewer corrected, and that is the wording that would have
      lost it.
- [x] **DONE** (`7908969d3`) — **DISCHARGED BY AD14-R1 as a DECISION, and carried by AD14 as work.** The arm taken is
      preserve-and-flag, which is the first of the two C07 offers and the one r1's own reasoning
      points at — *a refusal now would block a common gesture to guard a rare one*. Two regression
      fixtures pin today's behaviour and are AMENDED deliberately rather than deleted:
      `tests/domain/asset/shapeEdits.test.ts`'s literal scaled-clearance points and its
      bounding-box case, plus `2026-09-16-asset-designer-consolidate-design.md` §7's line reading
      *"every part — clearance and details included — is scaled about the anchor"*, which stops
      being true of a measured clearance. The original statement follows:

      **Clearance under resize (criterion 4) is NOT met**, and r1 does not park all of it. `scaleDesign`
      scales the clearance about the anchor unconditionally; C07's default is not to weaken one
      silently and C03 records the behaviour as one to supersede deliberately with a spec or ADR
      update. r1 row 2 disposes only of the REFUSE arm, and only for a PENDING clearance. Carried as
      an integration obligation rather than as an AD12 shortfall — nothing in that lease could fix it.
- [x] **DONE** (`cde0e8444`, reachable at `c64acda60`) — **RULED 2026-09-17 (session three) as AD12-R2, and ALLOCATED to the queue worker rather than
      becoming its own card.** The row is ticked only now, and not at `cde0e8444`, for the
      reason the review gave: until `DesignerInspector.vue` bound `removeBackground`,
      `grep -rn removeBackground src/` printed the runtime member, the control and nothing
      joining them, so no user could reach the gesture at all. The wire is `c64acda60`. Measured rather than assumed: the domain already admits the state —
      `Asset.background` is `AssetBackgroundRef | null`, `withChanges` resolves
      `'background' in changes ? (changes.background ?? null) : this.background`, `checkBackground(null)`
      answers `ok(null)` on its first line, and `sameBackground` inside the command already compares
      two nullable references. Nothing needs designing; one input arm needs admitting, and the three
      answers it would otherwise have to invent (clear the calibration, leave the pending flags
      alone, put the removal arm ABOVE the two path-shaped pre-read refusals so removing a reference
      to an already-deleted file succeeds) are each inherited from the command's own existing
      account. The original statement follows:

      **There is no door to DELETE a reference** — `SetAssetBackgroundInput.path` is a bare string,
      so replacement is expressible and removal is not. AD12's criterion about deleting a reference
      cannot be met without a new command arm with its own calibration and pending-flag answers.
      Decide whether that is owed here or is its own card.

## AD11 — candidate `eab8cb00c` (branch `ad11-open-lines`), in review

- [x] **DONE** (`97ca96ff9`), rewritten from the code rather than from the note — which mattered:
      the note anticipated a widening of `outlineOf` that never happened. **`domain/asset/arrangeDetails.ts`'s header carried a paragraph that AD11 made stale**, and
      that file is outside AD11's lease so its worker correctly did not touch it. It says *"The two
      disagree about an OPEN graphic, and that is AD11's to reconcile rather than this module's"*
      and then describes `outlineOf` answering `null` for a path so every single-part gesture refuses
      a line. **Do this only AFTER AD11 integrates** — until then the paragraph is true, and editing
      it early would make the file claim something this branch has not yet delivered. Rewrite it from
      what the code then does rather than from this note: the finisher reports `outlineOf` is
      byte-identical and a new sibling carries the open case, so the reconciliation is not the
      widening the paragraph anticipates.
- [x] **DONE — all eight verdicted JUSTIFIED by the review, none reverted.** Eight out-of-lease edits were KEPT with reasons, including two files I explicitly forbade
      (`render-state.ts`, `detailEdits.ts`). The review's verdict on each is the gate; anything it
      calls unjustified comes back out before integration.

## Uncovered arms in changed files, read after the final green gate

`npm run test:coverage` passes at **99.22 / 98.04 / 99.28 / 99.67** against 99/98/99/98, so branches
carry roughly **nine arms of margin** — and the per-file read finds **22 uncovered arms across 61
changed source files** that the threshold cannot see. None is a failure; each is a decision somebody
should take deliberately rather than inherit:

- `ObsidianAssetGeometrySidecar.toDomainDetail` (4) — the OPEN graphic's read-back path, including
  `path.ok ? path.value : EMPTY_PATH`. **That fallback is the one worth a case**: it is what a
  corrupt or hand-edited sidecar takes, and nothing exercises it. Data-integrity, not cosmetics.
- `DesignerArrangePanel.vue` (4), `DesignerRepeatForm.vue` (3 + 1 function), `DesignerClearanceHelper.vue` (2),
  `DesignerInspector.vue` (1 + 1 function), `AssetDesignerRoot.vue` (2) — template and guard arms.
- `arrangeDetails.ts` (2), `operations.ts` (1), `draw-line-tool.ts` (1), `EmptyState.vue` (1),
  `MarqueeSelection.ts` (1).

Read each before adding a case: **an unreachable guard costs a branch it can never pay back**, and
this expansion has already recovered headroom twice by deleting rather than testing (AD09 six,
`rovingIndex`/`assetGroups` nine more). With nine arms of margin, the next card has very little room.

## AD13 hand-off — candidate `5a758f74b` (branch `ad13c-asset-handoff`)

- [x] **DONE** (`4521f6acf`) — **ICR 1-H — the SENDING half of the asset hand-off, three files, none in that card's lease.**
      The candidate built the RECEIVING half and proved it; nothing yet puts an `assetId` into the
      origin, so **AD13 criterion 1 is still unmet end to end**. The request, as filed:
      `plugin/renovationProjectOpenSeams.ts`'s `assetDesignerUsePlan` returns
      `(assetId: string) => void` and passes `{ planId, assetId }` on both arms, and
      `presentation/designer/AssetDesignerContext.ts` plus
      `presentation/designer/inspector/DesignerInspector.vue` each widen `usePlan` by one token.
      The matching case belongs in `tests/plugin/assetDesignerUsePlan.test.ts`, which that card held
      and deliberately left untouched because it would be red until this lands.
      **REVIEWED 2026-09-18, and the request as filed DOES NOT COMPILE — do not apply the version
      quoted above.** This row is left standing rather than corrected in place, because the whole
      value of the review step is visible only if the bad version and the finding sit together.

      `assetDesignerUsePlan` builds its picker ONCE at composition —
      `const pick = planPicker(app, () => index, (plan) => { … })` — so the callback has no lexical
      access to a per-press `assetId`, and `planPicker`'s own docblock refuses rebuilding it per
      press. The corrected shape is a closure-scoped slot (`let armed: string | undefined`) set in
      the returned function before `pick()` and read and cleared in the callback; the existing
      `picking` flag already serialises presses, so one slot is exactly as wide as the property.

      **It also reddens two EXISTING cases** in `tests/plugin/assetDesignerUsePlan.test.ts` that the
      request did not mention — *"continues into the one Plan Editor already open, asking nothing"*
      and *"asks which plan when none is open, and opens the one picked"* — because
      `prepareEditorArrival` calls `setViewState` on whichever leaf was revealed, including an
      already-open one. And `assetDesignerUsePlan`'s claim that continuing into an open editor
      preserves selection and camera has to be RE-DERIVED: it then rests on `PlanEditorView.sync()`'s
      `planId === mountedPlanId` early return rather than on the reveal not re-stating.

      **The fix round is building the assertion that fails without this**, which the ledger's own
      cross-lease idiom required and the first candidate skipped — so until it lands, NOTHING fails
      if this request is never applied or is applied wrongly. Take the corrected ICR from the fix
      round's amended report, never from the paragraph above.

- [x] **RESOLVED by sequencing** — **A FILE CONTENTION this had to wait on, named before it bit.** ICR 1-H edits
      `presentation/designer/inspector/DesignerInspector.vue`, and **wave 5's AD14 row holds an
      ADDITIVE-ONLY lease on that same file** for its `Reviewed` control's mount line. Two edits to
      one file is the thing this ledger exists to prevent, and being the integrator is not an
      exemption — it is how the AD10 wire and the ADQ wire both became one-commit problems.
      **Apply ICR 1-H only after AD14's candidate is integrated**, or after that lease is released.
      The other two files in the request are in nobody's row and could go earlier, but splitting the
      change would leave `usePlan` widened at one end and not the other, which `vue-tsc` refuses —
      so it is one commit, after AD14.

## AD13 — raised by the duplicate half's review, and NOT closed by it

- [ ] **RULED 2026-09-18 (session five) as AD13-R1, and ALLOCATED to wave 6 as card AD13-C3**
      (`.worktrees/ad13c`, branch `ad13c3-designer-usage-scope`). **The row stays
      unchecked until the gate is green on the SHA that builds it** — a ruling is not an
      implementation, which is the same reason AD14-R1's row stayed unchecked for a session.
      The ruling took the FIRST arm: the scope read reaches the designer. The
      *"undo covers it"* arm was refused on a category difference rather than on a judgement about
      undo — it is a per-leaf, in-session remedy reachable only by someone who already knows, while
      a scope is a disclosure made before the gesture — and on a measurement: the designer is
      reached from a plan through `EditorNavigation.asset` and from Obsidian's own restore of a
      leaf, so *"they saw the scope in the library on the way in"* is not true by construction.
      `DECISIONS.md` carries the reasoning, the shape (a passive statement, never a confirmation;
      a second CONSUMER of `ListPlansUsingAsset` through an extracted `guardAssetUsage`, never a
      second query) and the trigger for revisiting. The original statement of the obligation
      follows, unaltered, because it is what the ruling had to answer:

      **Usage scope is drawn in the LIBRARY, before a DUPLICATE — which is the one impactful
      change it provably does not affect.** A duplicate creates a new definition and leaves every
      plan that places the original untouched; the panel's own copy says so
      (*"Plans that place this asset keep the original"*). So the scope there is informational,
      and that is fine as far as it goes. **The gesture that genuinely changes what those plans
      draw is editing the asset's GEOMETRY**, which happens in the DESIGNER, where no usage scope
      precedes it at all. C11's *"show impact scope"* is therefore met for the harmless gesture
      and unmet for the harmful one.
      **AD13's criterion 3 must not be ticked on the library half alone.** Closing this needs
      either the scope read reaching the designer (`ListPlansUsingAsset` is now in
      `AssetLibraryQueryServices`, so a designer equivalent is a second consumer rather than a
      second query) or a ruling that a geometry edit needs no scope because undo covers it — and
      that ruling has to be made rather than inherited, because the two surfaces currently answer
      the same question differently by accident rather than by decision.

## AD07 — the deferral whose trigger fired, swept 2026-09-18 (session five)

- [ ] **AD07 Amendment 1's trigger has FIRED and the item is DISPATCHED rather than re-deferred**
      (`.worktrees/ad14`, branch `ad07h-creation-height`). That amendment's trigger reads *"do this
      when a single task holds BOTH leases at once: `CreateAsset.ts` and `NewAssetForm.vue`"*, and
      wave 6's table grants exactly those two to one card. Nothing else changed — no new capability
      was discovered and no constraint lifted itself; the trigger was one only an orchestrator could
      fire, and leaving it standing would have been the deferral quietly becoming a drop.
      **The row stays unchecked until the gate is green on the SHA that builds it.**

## AD13-C3's one change request — DEFERRED with a trigger, and every measurement it needs is here

- [x] **DECIDED 2026-09-19 (session six): the sentence is NOT added. The ruling, with the
      measurement that decides it, is at the end of this row.** The obligation as filed follows,
      unaltered, because the decision is only readable against what it answers.

      **A designer-owned impact sentence — *editing this asset changes every plan that places it* —
      was drafted, could not be placed, and is deferred rather than dropped.** What ships states the
      scope (the `Used in plans` heading and the per-plan list). What is missing is the sentence
      naming the CONSEQUENCE, which is arguably the payload of a disclosure.

      **Criterion 3 is met without it**, and both the worker and the independent reviewer say so
      independently. This is an improvement, not a compliance gap, which is why it is a queue row
      rather than a blocked integration.

      **The measurements are done, so nobody re-derives them.** Counted lines against the 400-line
      `max-lines`, taken per file with `eslint --rule max-lines` at `max:1` rather than `wc -l`:
      **`en.ts` 400, `de.ts` 399, `en/editor.ts` 359, `de/editor.ts` 361.** So the wave-6 lease's
      "ONE import and ONE spread line each in `{en,de}.ts`" is genuinely untakeable — `en.ts` has
      ZERO headroom — and the reviewer's proposed home is right: a new `{en,de}/assetUsageScope.ts`
      pair spread through `{en,de}/editor.ts`, which every other designer locale module already
      routes through (`designer.inspector.use-in-plan` in `assetWorkflow.ts`,
      `designer.clearance.review.*` in `assetClearanceReview.ts`). Four lines, no aggregator
      pressure, no extraction.

      **Refuse the worker's own alternative** (`{en,de}/assetDuplicate.ts`): that module's keys are
      all `view.asset-library.*`, and `strings.test.ts`'s retired-toolbar section is this repository
      already refusing exactly that borrowing — the designer had taken three `editor.toolbar.*` keys
      and R6 renamed them to `designer.toolbar.*` because borrowing left no way to express which
      surface owns the copy. The reviewer found this and it is the right call.

      **Note what is NOT an instance of that rule**, because it looks like one: the four state
      sentences this panel draws ARE `view.asset-library.used-in-plans.*`, borrowed deliberately.
      AD13-R1 part 3 requires exactly that — one vocabulary for one question across two surfaces,
      so *some plans could not be read* has a single spelling. A new key would be the fifth spelling
      that ruling exists to prevent. The impact sentence is different: it is a designer-only claim
      with no library counterpart, so it needs a designer-owned key.

      **The trigger is the live-vault pass, not a later card.** This is user-facing copy in two
      languages for a panel nobody has seen at any width or in either colour scheme. Whoever runs
      `npm run harness-shot -- --width=460` and opens the designer in Obsidian is better placed to
      decide whether the block needs a second sentence than anyone is writing blind — and the same
      pass has to look at whether this block pushes the dimensions and the three action buttons
      down by up to six lines at a sidebar's width, which is unmeasured and is the reviewer's own
      stated residual concern about its position.

### The ruling, 2026-09-19 — NOT ADDED, and why the trigger firing is what settles it

**The trigger fired.** It was *"whoever runs `npm run harness-shot -- --width=460` and opens the
designer in Obsidian is better placed to decide than anyone writing blind"*. Half of that happened:
the 460px captures were taken this session and are on disk; no Obsidian session was run. So this
ruling rests on a picture and not on a vault, and it says so rather than claiming the whole trigger.

**Two corrections to the instruction itself, both found by running it.** `npm run harness-shot --
--width=460` is REFUSED by the script — `--width` applies to a named entry and the fixed shots
carry their own, which `scripts/harness-shot.mjs` states in its own comment. The bare invocation is
what captures the sidebar-width shots, and it already had two: `asset-designer-narrow` and
`asset-designer-select-narrow`, both at 460. And the Chromium is **not the pinned one** —
`playwright-core` pins revision 1234 and this machine's cache holds 1223, so the capture went
through `RP_CHROMIUM_EXECUTABLE` and the script announced the substitution. Read the pictures as
approximate; the conclusion below rests on ORDER and on the presence of a scroller, neither of
which a build difference moves.

**What the picture shows, measured rather than inferred.** `DesignerInspector.vue` renders
`<DesignerUsageScope />` ABOVE its `design.dimensions` fields, which are above the action buttons —
so the reviewer's stated chain is the real one, read off the template rather than guessed. In
`asset-designer-narrow.png` (460px, an asset used in two plans, no dimensions set yet) the order on
screen is the asset name, `Used in plans` with one row per plan, then `Set dimensions`, then
`Start from preset` **at the bottom edge of the pane**. That is the reviewer's residual concern,
confirmed, on the FAVOURABLE fixture — an asset with dimensions set pushes the actions further.

**And what it shows that changes the verdict**: `.rp-designer-inspector` carries
`overflow-y: auto` (`styles/designer.css`). The pane scrolls. So the cost is PROMINENCE, not
reachability — a distinction worth keeping, because the two have different remedies and only one
of them is a defect.

**Therefore: not added.** Three reasons, in the order they decide it.

1. **The block already discloses what the sentence would claim.** It names every plan and its
   placement count. *Editing this asset changes every plan that places it* is the inference from a
   list the user is looking at, not a fact the list withholds.
2. **Criterion 3 is met without it** — the worker and an independent reviewer said so separately,
   and this is recorded above as an improvement rather than a compliance gap.
3. **Its measured cost lands on the one thing the picture shows is already tight.** It would be the
   longest sentence in the inspector, at the top of it, above the dimensions and the actions, at
   the width where the last action is already at the fold. An improvement that pays for itself by
   pushing a primary action further down is not obviously an improvement.

**The trigger, so this is a decision and not a drop.** Add it if a live-vault session finds a user
surprised by cross-plan impact — that is evidence this position cannot produce and a picture cannot
settle. Add it WITHOUT this cost if it ever has a home that is not the top of the inspector: the
confirmation of a destructive or wide-reaching edit is where a consequence sentence is read rather
than skipped, and that home charges no layout at rest. The measured locale homes recorded above
(`{en,de}/assetUsageScope.ts` spread through `{en,de}/editor.ts`, four lines, `en.ts` at 400/400 and
therefore untakeable) stay correct for whichever of those two arrives.

## Swept and NOT re-opened, recorded so the next session does not re-derive them

- [x] **AD06's *"Use in plan deferred to AD13"* is DISCHARGED**, not carried. `DesignerUsePlan.vue`
      is mounted in the designer inspector and `assetDesignerUsePlan` builds a `{ planId, assetId }`
      origin as of `4521f6acf`. `state.json`'s AD06 blocker is rewritten to the half that survives
      (no header chrome, per C12) rather than left whole.
- [x] **AD11's PRECISE_TOOLS doubt is NARROWED, and the narrowing was worth doing.** The blocker read
      *"nothing verifies that PRECISE_TOOLS membership actually resolves to a crosshair"*, which is
      two claims wearing one sentence. The WIRING half was checkable here and holds:
      `grep -rn cursorClassFor src/ tests/` prints one non-test call site — `EditorSurface.vue` —
      and `DesignerCanvas.vue` MOUNTS `EditorSurface`, passing `:active-tool-id`, so a designer tool
      in that list does reach the class. (The first reading of that grep concluded the opposite, on
      the call-site count alone, and was wrong: the designer reaches the function through a
      component rather than through an import.) What is left is the KEYWORD half — that
      `.rp-plan-canvas-precise` renders as a crosshair — which jsdom cannot resolve and a headless
      capture cannot show, because nothing in a capture hovers. Trigger unchanged: a live Obsidian
      session walking `docs/tests/cases/Canvas Navigation.md`.
- [x] **`DesignerUsePlan.vue`'s docblock was STALE in two paragraphs and is corrected in the wave-6
      base commit.** Both claimed the sender did not exist; ICR 1-H landed it at `4521f6acf`. The
      prop's paragraph is kept rather than deleted, because its point survives the fix and matters
      more now: `() => void` is assignable to `(assetId: string) => void`, so a narrowed declaration
      anywhere along that chain drops the argument with `vue-tsc` still at exit 0 — the seam is held
      by a case and never by the compiler.

## Standing, not per-candidate

- [x] **DONE** — Re-run all six gates on **each** integration SHA, serially, one heavy command at a time:
      `npm run build`, `npx oxlint --deny-warnings`, `npx eslint . --max-warnings 0`,
      `npx vue-tsc -noEmit`, `npm run analyze`, `npm run test:coverage`. All six were exit 0 at
      `c82b35e6f`.
- [x] **DONE, and it was RED** — **`npm run analyze` had never seen any of this wave's code** — five new SFCs and three new
      domain modules across the three candidates. AD09 hit two SFC complexity findings on its first
      fallow run, so expect some, and fix them by factoring rather than by suppressing.
- [x] **DONE, and it found two things the gate could not** — Read `coverage/coverage-final.json` for the CHANGED FILES after `test:coverage`. The floors
      cannot see a single untested arm in a slack metric; AD09 had ten behind a green gate.

## A process note for the next reviewer dispatch

A reviewer reading from the integration worktree **cannot run the candidate's tests** — the branch is
not checked out there and checking out is forbidden mid-wave. The AD08 reviewer discovered this
mid-review and correctly reported every test claim as unverified rather than implying otherwise. Say
so in the brief up front. Either give the reviewer its own detached worktree at the candidate SHA, or
tell it plainly to review by reading and let the integrated-SHA gate be the run. **Do not leave it to
find out.**

## What the standing items actually found, recorded because the checkboxes above hide it

**`npm run analyze` was RED on the first integrated tree** and is green now (`4717f7b71`,
`aef5e91c3`). Six complexity findings and one clone. Three of the six were CRAP scores against
STALE coverage and cleared themselves once the suite had run — the artefact `CLAUDE.md` names, met
twice in one session, because the refactor that fixed the other three shifted the line numbers the
coverage map is keyed on and made it stale again for exactly the file that had been edited. **Do
not read a fallow CRAP finding without asking when the coverage under it was written.**

The clone was the integrator's doing: AD07's fix round was told to follow the Parts panel's roving
tabindex rather than invent a second one, and followed it closely enough to duplicate nineteen
lines. The three template breaches were each the branchiest part of a template having nowhere else
to live. All four fixed by moving code; none suppressed.

**The per-file coverage read found two things the floor could not**, on a branch metric sitting at
exactly its 98 floor:

- **A real test failure hiding among load artefacts.** `reversibleWritePathDiscovery.test.ts`
  failed on an ASSERTION, not a timeout, and was initially reported as load along with two genuine
  timeouts — because the log had been piped through `tail` and only two of the three failures were
  visible. **Never generalise from a truncated log.** The census had discovered
  `DesignerSelectTool` because the marquee round added a comment containing the word `undo`; the
  scan is textual and over-inclusive on purpose and asks its author for a disposition row, so it
  got one rather than the comment being reworded.
- **Nine copies of `shape.groups ?? []`**, each with an arm `validateAssetShape` can never take.
  One accessor now, both arms driven.

## Still outstanding, and not closable from this environment

- [ ] **No capture of anything this wave drew.** The pinned Chromium cannot be installed here. Three
      surfaces are unphotographed: a whole-catalogue thumbnail preset gallery in a dialog (fifteen
      thumbnails since the vanity landed, and the number is the catalogue's rather than this item's),
      three stacked
      overlay buttons on the empty state, and a fifteen-button seven-field Arrange block in a
      sidebar leaf. **This is the check most likely to find the next defect**, because layout is
      what a capture measures and no layout engine in this repository does. The 460 px narrow width
      matters most — it is also ruling AD08-R1's own stated trigger for ever building an overlap
      chooser, and it is unmeasurable here.
- [ ] **No Obsidian.** `npm run test-build` was never run and no manual case under `docs/tests/` was
      walked. Nothing about appearance in a themed vault, keyboard activation in a real host, or hit
      size is verified by anyone.
- [ ] **`npm audit`** — its own CI job, not run here.
