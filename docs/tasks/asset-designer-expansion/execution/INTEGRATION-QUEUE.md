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

- [ ] **Background OPACITY**, ruled a real gap by AD12-R1 and assigned here because it is not in any
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
- [ ] **PERSISTED REVIEW STATE is OWED and cannot be built in any current lease.** AD01 §1 S09 names
      **AD12** as its owner, and AD12 could not reach it: a durable flag needs `AssetShape`, the DTO
      schemas, the mappers and the schema-version literal, plus a C09 version bump so an older build
      refuses the file rather than stripping the field. **It is also blocked on a decision nobody has
      made** — C07 delegates the representation to AD01 and AD01 never chose one. So this needs a
      ruling first and a card second, and it must not be quietly dropped: the AD12 report originally
      called it "not owed", which the reviewer corrected, and that is the wording that would have
      lost it.
- [ ] **Clearance under resize (criterion 4) is NOT met**, and r1 does not park all of it. `scaleDesign`
      scales the clearance about the anchor unconditionally; C07's default is not to weaken one
      silently and C03 records the behaviour as one to supersede deliberately with a spec or ADR
      update. r1 row 2 disposes only of the REFUSE arm, and only for a PENDING clearance. Carried as
      an integration obligation rather than as an AD12 shortfall — nothing in that lease could fix it.
- [ ] **There is no door to DELETE a reference** — `SetAssetBackgroundInput.path` is a bare string,
      so replacement is expressible and removal is not. AD12's criterion about deleting a reference
      cannot be met without a new command arm with its own calibration and pending-flag answers.
      Decide whether that is owed here or is its own card.

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
      surfaces are unphotographed: a fourteen-thumbnail preset gallery in a dialog, three stacked
      overlay buttons on the empty state, and a fifteen-button seven-field Arrange block in a
      sidebar leaf. **This is the check most likely to find the next defect**, because layout is
      what a capture measures and no layout engine in this repository does. The 460 px narrow width
      matters most — it is also ruling AD08-R1's own stated trigger for ever building an overlap
      chooser, and it is unmeasurable here.
- [ ] **No Obsidian.** `npm run test-build` was never run and no manual case under `docs/tests/` was
      walked. Nothing about appearance in a themed vault, keyboard activation in a real host, or hit
      size is verified by anyone.
- [ ] **`npm audit`** — its own CI job, not run here.
