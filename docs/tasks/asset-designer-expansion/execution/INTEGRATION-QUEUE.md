# What integration owes, per candidate

The integrator's own list, kept because a worker's report is the wrong place for it: these are edits
in files no worker may touch, so nobody else's handoff can carry them and a session that ends
without writing them down loses them. Each row is deleted when it is done and the gate is green on
the SHA that did it — not when it is written.

Written 2026-09-17 during wave 2.

## AD07 — candidate `5e1200a2d` (branch `ad07-entry-paths`)

- [ ] **`styles/designer.css` is at exactly 400 total lines and `scripts/styles-assemble.mjs` sets
      `MAX_LINES = 400`.** Measured, not reported: `git show ad07-entry-paths:styles/designer.css | wc -l`
      is 400 against 385 at the base. The candidate builds; the next line anyone adds to that partial
      fails the build. Extract the preset-form rules into a new `styles/designer-presets.css` and add
      its `@import` to `styles/index.css`. **Both files are integrator-owned, which is why this is
      here rather than in the worker's diff.**
- [ ] Decide the numeric-field-row request. The worker left AD07 item 3's optional descriptive
      height unbuilt because `NewAssetForm.vue` is 399 lines against a 400-line `max-lines`, and
      reverted a working version when eslint reported 434. A shared field-row component takes it to
      roughly 355. **A line budget is a real constraint and not a reason to drop an acceptance
      criterion permanently** — either the component lands or the criterion is recorded unmet with a
      trigger, in the card's own amendments.

## AD08 remainder — candidate `fd1cfb1e9` + the review-fix commit on top (branch `ad08r-marquee`)

- [ ] **Lift the clone into `core/geometry/`.** `segmentMeetsBox` in
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
- [ ] Delete the `assetMarquee` locale pair and its two spreads if the fix commit still adds no
      strings. A scaffold that turned out unneeded is deleted, not left standing.

## AD10 — candidate `0c818cb1c` (branch `ad10-arrange`)

- [ ] **`AssetDesignerRoot.vue`: pass `:locked-graphics="runtime.partView.locked.value"` to
      `<DesignerInspector>`.** The worker calls this the single highest-value line in its handoff and
      it is right: the prop is declared optional with an empty default, so **until this lands a
      locked graphic composes like any other** — which is C06's "locked elements must not move by
      implication", live. Ask the reviewer's question while doing it: should the absence of that set
      be expressible at all, or should the prop be required?
- [ ] Ruling **AD10-R1** (recorded in `contracts/DECISIONS.md`, commit `857c05da5`) is not yet
      satisfied by the candidate: the five spatial operations still accept a selection mixing a
      `pending` graphic with a measured one. The check belongs in `resolveParticipants`
      (`domain/asset/arrangeDetails.ts`), which is the worker's own file — so this is a change
      request back to that card, not an integrator edit. Recorded here so it is not lost between the
      two.

## Standing, not per-candidate

- [ ] Re-run all six gates on **each** integration SHA, serially, one heavy command at a time:
      `npm run build`, `npx oxlint --deny-warnings`, `npx eslint . --max-warnings 0`,
      `npx vue-tsc -noEmit`, `npm run analyze`, `npm run test:coverage`. All six were exit 0 at
      `c82b35e6f`.
- [ ] **`npm run analyze` has never seen any of this wave's code** — five new SFCs and three new
      domain modules across the three candidates. AD09 hit two SFC complexity findings on its first
      fallow run, so expect some, and fix them by factoring rather than by suppressing.
- [ ] Read `coverage/coverage-final.json` for the CHANGED FILES after `test:coverage`. The floors
      cannot see a single untested arm in a slack metric; AD09 had ten behind a green gate.

## A process note for the next reviewer dispatch

A reviewer reading from the integration worktree **cannot run the candidate's tests** — the branch is
not checked out there and checking out is forbidden mid-wave. The AD08 reviewer discovered this
mid-review and correctly reported every test claim as unverified rather than implying otherwise. Say
so in the brief up front. Either give the reviewer its own detached worktree at the candidate SHA, or
tell it plainly to review by reading and let the integrated-SHA gate be the run. **Do not leave it to
find out.**
