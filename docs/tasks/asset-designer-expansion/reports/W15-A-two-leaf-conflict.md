# Task report — W15-A (AD15 validation matrix row T12)

Outcome: implemented
Owner / worktree / branch: card W15-A / `.worktrees/ad07` / `w15a-two-leaf-conflict`
Base commit / candidate commit: `098067d3c` / `25d8d3c3f`, plus the fix-round commit on top of it
(six reviewer findings, all in `docs/`; none in `src/`)
Accepted contract revision: wave 15 base, `r1`
Allowed scope and shared-file leases: exactly two CREATEs, both named after this card. No
shared file was opened for writing — not `docs/tests/suites/Smoke Test the Editor.md`, not
`reports/AD15-validation-matrix.md`, not `contracts/DECISIONS.md`, not `execution/state.json`,
not `src/`, not `tests/`.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `docs/tests/cases/Two designers on one asset.md` | The manual case discharging matrix row T12, sixteen steps | yes (CREATE) |
| `docs/tasks/asset-designer-expansion/reports/W15-A-two-leaf-conflict.md` | This report | yes (CREATE) |

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Matrix row **T12** — "Two leaves retain expected-version conflict behavior", minimum layer *Integration + real host* | case written, **not walked** | `docs/tests/cases/Two designers on one asset.md`, 16 steps: `suite` 8, `obsidian` 6, `desktop` 1, `judgement` 1 (counted with `grep -oE '^\| [0-9]+[a-z]? \| \`[a-z]+\`'` over the file, not remembered) | No step has been run in a vault. The row cannot move past *partial* on this card's work alone |
| C08 — "two leaves editing one asset must not cause silent overwrite" | covered by steps 5, 8, 15 | step 8 is the held-gesture conflict; step 15 counts real sidecar revisions | step 8 needs two pointing devices and may not be producible at all — see below |
| C08 — "External edits … must not cause silent overwrite" | covered by step 14 | the `external-modification` arm, reached by a timed external rewrite of the `.rpgeo` | — |
| C08 — "Do not blindly restore old snapshots over a newer external edit during undo" | covered by step 11 | the sandwiched undo, refused with `undo.superseded` and a real `Notice` | — |
| C08 — "Saved must not imply that a stale canvas is current" | covered by steps 5, 9, 12 | step 12 checks the badge does NOT clear on a `no-write` | — |
| Recorded hole (the designer's conflict is two silent words) | covered by steps 9 and 10, as a hole | step 9's pass condition is what the code does today; step 10 is the judgement | Deliberately not asserted as a guarantee |

## Executed checks

Every `suite` row in the case names a test file AND a case name, and every one of them has now
been executed from this worktree with `npx vitest run <path> -t "<case name>"`. None was taken
from the brief or from a subagent's report. **Twenty-two of the twenty-three were run that way
before the case was written; the twenty-third — `revealAssetDesigner.test.ts` "still gives two
DIFFERENT assets their own leaves when they race", cited in step 4 — was covered only by the
whole-file run until the fix round, which the first version of this sentence over-claimed and
the reviewer caught. It is in the table below with the rest.**

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerWriteChain.test.ts tests/presentation/designer/designerCrossLeaf.test.ts` | `098067d3c`, Windows, worktree `ad07` | 0 — 2 files, 14 tests passed | whole-file run before citing any case in either |
| `npx vitest run tests/application/commands/asset/setAssetFootprint.test.ts tests/infrastructure/obsidian/workspace/revealAssetDesigner.test.ts tests/presentation/designer/tools/designerSelectTool.test.ts tests/presentation/errors/saveStateAgreement.test.ts` | same | 0 — 4 files, 65 tests passed | whole-file run |
| `-t "refuses the second of two writes built from the same revision, rather than losing one"` (setAssetFootprint) | same | 1 passed, 23 skipped | cited in step 8 |
| `-t "conditions an unexpecting write on the version it read, so a racing writer is not lost"` (setAssetFootprint) | same | 1 passed, 23 skipped | read for the case's prose about `expected ?? version` |
| `-t "reports no-write when the rectangle asked for is the one already stored"` (setAssetFootprint) | same | 1 passed, 23 skipped | cited in step 12 |
| `-t "reports no-write for an identical footprint even when the expectation is stale"` (setAssetFootprint) | same | 1 passed, 23 skipped | cited in step 12 |
| `-t "stays conditional on the design it was replayed on, so a peer write during the live replayed drag refuses it"` (designerWriteChain) | same | 1 passed, 8 skipped | cited in step 8 — the closest thing in `tests/` to the held-gesture recipe |
| `-t "builds a drag held behind a write on a peer write that landed during the hold"` (designerWriteChain) | same | 1 passed, 8 skipped | read for the ordering the case describes |
| `-t "refreshes a second leaf on the same asset"` (designerCrossLeaf) | same | 1 passed, 4 skipped | cited in step 5 |
| `-t "leaves a leaf on a different asset alone"` (designerCrossLeaf) | same | 1 passed, 4 skipped | cited in step 6 |
| `-t "does not refresh a leaf that has been closed"` (designerCrossLeaf) | same | 1 passed, 4 skipped | cited in step 16 |
| `-t "leaves nothing subscribed once every leaf is closed"` (designerCrossLeaf) | same | 1 passed, 4 skipped | cited in step 16 |
| `-t "reuses the leaf already showing that asset rather than opening a second"` (revealAssetDesigner) | same | 1 passed, 8 skipped | cited in step 3 |
| `-t "does not re-set the view state of a leaf it found"` (revealAssetDesigner) | same | 1 passed, 8 skipped | cited in step 3 |
| `-t "coalesces two opens of the SAME asset into one leaf"` (revealAssetDesigner) | same | 1 passed, 8 skipped | cited in step 4 |
| `-t "still gives two DIFFERENT assets their own leaves when they race"` (revealAssetDesigner) | same, **fix round** | 1 passed, 8 skipped | cited in step 4; run in the fix round after the reviewer found it covered only by the whole-file run |
| `-t "moves a dragged detail in one write, conditional on the version the press read"` (designerSelectTool) | same | 1 passed, 27 skipped | read for the press-capture claim |
| `-t "leaves a write-boundary refusal to the indicator rather than toasting it twice"` (designerRefresh) | same | 1 passed, 21 skipped | cited in step 9 — the no-toast half of the recorded hole |
| `-t "keeps the design on screen when a peer-provoked re-read fails, and marks it stale"` (designerRefresh) | same | 1 passed, 21 skipped | cited in step 5 |
| `-t "does not re-read after a refusal, which wrote nothing"` (designerRefresh) | same | 1 passed, 21 skipped | read for step 8's "the canvas shows leaf A's change" clause |
| `-t "refuses the first gesture undo rather than restoring a document that predates a peer"` (reversibleAssetDesignWindows) | same | 1 passed, 12 skipped | cited in step 11 — drives the exact five-move sequence step 11 walks |
| `-t "still undoes two sibling gestures of its own, in order, across both resources"` (reversibleAssetDesignWindows) | same | 1 passed, 12 skipped | read for step 11's first-undo-succeeds clause |
| `-t "preserves a save error across an overlapping batch that writes nothing"` (saveStateStore) | same | 1 passed, 15 skipped | cited in step 12 |
| `-t "lets a write that actually succeeded clear a save error"` (saveStateStore) | same | 1 passed, 15 skipped | cited in step 13 |
| `-t "gives each Plan Editor its own state, since two can save independently"` (saveStateStore) | same | 1 passed, 15 skipped | cited in step 7 |
| `-t "settles run NEUTRALLY for a SUCCESS that wrote nothing"` (withSaveStateTracking) | same | 1 passed, 57 skipped | cited in step 12 |
| `-t "reads the codes from versioning.ts rather than a copy"` (withSaveStateTracking) | same | 1 passed, 57 skipped | cited in step 9 |
| `-t "carries the open asset in its own view state, so a workspace restore reopens the same asset"` (assetDesignerView) | same | 1 passed, 23 skipped | cited in step 2 |
| `grep -oE '^\| [0-9]+[a-z]? \| \`[a-z]+\`' <case> \| sort \| uniq -c` | same | `desktop 1`, `judgement 1`, `obsidian 6`, `suite 8`; `grep -c` over the same pattern prints 16 | the verdict tally the case's own "eight of these sixteen" sentence is derived from |
| `grep -rH '^order:' docs/tests/cases/` | same | 84 is unused. 80–83 are FOUR cases — `Design an Asset` 80, `Compose an asset from parts` 81, `Calibrate a sheet and reserve space` 82, `Take an asset from the library into a plan` 83 — three of them designer cases and the fourth a workflow one; 85 is the next taken. (This line read "80–83 are the three existing designer cases", which names four values and three cases; the conclusion was right and the arithmetic was not) | the frontmatter `order` |
| `grep -rn revealAssetDesigner src/` and `grep -rn ASSET_DESIGNER_VIEW src/` | same, **fix round** | four call sites, three of them one binding | the door census in the case's opening — see integrator finding 6 below |
| `grep -cE '^\\| [0-9]+[a-z]? \\| \`' <case>` and the verdict `uniq -c` | same, **fix round**, after every edit | still 16 rows; `suite` 8, `obsidian` 6, `desktop` 1, `judgement` 1 | the fix round changed prose inside rows and added no row, so "eight of these sixteen" still re-derives |

## Verification not performed

Named individually, because an environment being unavailable is not an excuse for a blank
section:

- **No step of this case has been walked in a vault.** `npm run test-build` was not run, Obsidian
  was never opened, and not one pass condition in the table has been observed. Every row is an
  expectation derived from source and from the tests named inside it. The Runs table says so in
  those words.
- **Step 1's premise is unverified and may be false.** Nobody has established that Obsidian
  offers a tab split, a move-to-new-window or a layout restore that yields two Asset Designer
  leaves on one asset. If it does not, steps 5 through 16 are unwalkable. The case is written so
  that this is found out at step 1 and recorded as the finding, rather than stranding the walker
  at step 8.
- **Step 8's fault setup has never been produced by anyone.** Three setups are named and all
  three are hypotheses: whether Chromium keeps a second mouse as a separate pointer, whether a
  touch pointer and a mouse pointer coexist through Konva's gesture layer, and whether a timed
  external sidecar write lands inside a held press. The case says so in the setup section and
  step 8 asks the walker to record which setup was used and whether the press survived at all.
- **`npm run check`, `check:fast`, `test:coverage`, `lint`, `build` and `analyze` were NOT run.**
  The lease forbids them (two full gates on a shared machine thrash rather than queue), and this
  card writes only Markdown under `docs/`, which no linter in this repository covers. Only
  narrow `npx vitest run <path>` invocations were used.
- **No browser harness or capture check.** `npm run harness` and `npm run harness-shot` were not
  run. They would add nothing here: the harness draws one leaf, and its vendored sheet declares
  no `.notice` or `.notice-container` rule at all, so neither the two-leaf premise nor step 11's
  toast is showable in it. This is stated in the case's own "Why a human" section rather than
  left to be rediscovered.
- **No migration, performance or accessibility check.** This card changes no schema, no code and
  no markup. Step 9's badge and step 11's notice are both outside every `accessibility*.test.ts`
  in this repository — a `Notice` renders on `document.body` while those scans are scoped to
  `contentEl` — and closing that is not this card's work.
- **The German locale was not checked.** Step 11 quotes the English `undo.superseded` sentence.
  `de.ts` was not read, and the case does not claim anything about a German vault.
- **W15-B's case was read in part, not in full.** For the cross-reference I read its opening
  prose, its steps 15 to 19 and its *Deliberately NOT checked* section out of `755aa0cd5`. I did
  not read its other twenty-odd rows, so my claim that step 17 is the ONLY overlap rests on B's
  own two statements that it cedes the two-leaf scenario here, not on my having checked every row
  of it against mine.
- **The step-1 fallback map is reasoned, not walked.** "14 and 15 survive a failed step 1" comes
  from reading those rows' own preconditions against the timed-external-write setup; nobody has
  walked either in a vault with no second leaf, and the whole map inherits step 1's own
  uncertainty.
- **No single test in `tests/` was found that takes a real `asset-geometry.revision-conflict`
  through to "badge, and no toast" on this surface.** I searched
  `grep -rn revision-conflict tests/presentation/` and checked `designerWriteChain.test.ts` for
  `Notice` assertions (there are none). Step 9 now states the seam as a composition of three
  tests rather than implying one case walks it. Whether that gap is worth a test is the
  integrator's call, not this card's.
- **The three `Reachable by` verdicts most open to argument were not second-guessed by anyone.**
  Step 8 is `desktop` because two pointing devices are hardware; step 9 is `suite` because
  `designerRefresh.test.ts` really does assert the no-toast behaviour at this surface; step 7 is
  `suite` with the gap stated inside the row, because the composite is expressible with no new
  infrastructure and is not asserted today. A reviewer disagreeing with any of the three changes
  what the walker spends time on.

## Data and integration implications

Schema/migration change: none. This card writes two Markdown files.

Relevant renderer/export/revision consumers: none touched. Step 15 reads the `.rpgeo` sidecar's
`revision` in the file explorer, which is a READ.

Undo/no-op/conflict/failure coverage: the point of the case. Conflict — steps 8 and 14, the two
codes `checkExpectedVersion` mints. No-op — step 12, the `no-write` short-circuit and the badge
that correctly does not clear over it. Undo — step 11, the ledger-generation refusal, which is
the one place this case and [[Recover an asset design rather than lose it]] overlap: that file's
step 17 is the same five moves with a text editor in place of leaf B, both rows now say so, and
a walker is told to walk it once. Failure reporting — steps 9 and 10, the recorded hole.

Identity/unit/quantity/calibration invariants: untouched.

Shared root/runtime/locales wiring still required: none.

Rollback/recovery considerations: deleting the case file is the whole of the rollback. The
integrator still owes three shared-file edits this card is forbidden to make: adding
`[[Two designers on one asset]]` to `docs/tests/suites/Smoke Test the Editor.md`'s `## Cases`
list, re-deriving that file's five-tier step census by grep (this case adds 16 rows: `suite` +8,
`obsidian` +6, `desktop` +1, `judgement` +1), and updating matrix row T12's evidence.

## For the integrator — findings that are not this card's to fix

1. **Matrix row T12 cites the wrong file for conflict evidence.** It names
   `designerCrossLeaf.test.ts` beside `setAssetFootprint.test.ts`. `designerCrossLeaf.test.ts`
   contains **no conflict case at all** — its five cases are bus delivery, per-asset filtering,
   a closed leaf, listener disposal and repeated open/close. Verified by listing every `it(` in
   the file, and then by running `ls` on `tests/presentation/designer/` rather than stopping at
   the file the brief named. **The behaviour IS asserted, in a file the row does not name**:
   `designerWriteChain.test.ts` "stays conditional on the design it was replayed on, so a peer
   write during the live replayed drag refuses it" drives a peer write against a live drag and
   asserts `save-error`, and `designerSelectTool.test.ts` "moves a dragged detail in one write,
   conditional on the version the press read" pins the press capture. So the row is true about a
   BEHAVIOUR and wrong about a FILE. Suggested evidence for T12:
   `designerWriteChain.test.ts` + `setAssetFootprint.test.ts` + `reversibleAssetDesignWindows.test.ts`.
2. **`reversibleAssetDesignWindows.test.ts` appears to be unclaimed by any matrix row.** It is
   the strongest two-leaf evidence in the repository — a peer write sandwiched between two of one
   leaf's own gestures, refused at undo — and I did not find it cited under T12. Worth a look
   before T12 is graded.
3. **A genuinely hand-walkable T12 path exists that the brief did not name**, and it is step 11:
   gesture in leaf A, write in leaf B, gesture in leaf A, Undo twice in leaf A. It needs no
   racing, no second pointing device and no timing — and it is the ONLY refusal on this whole
   path that reaches the user as a sentence rather than as two words, because `undo.superseded`
   is a `Validation` code that is NOT in `WRITE_BOUNDARY_CODES`, so `affectsSaveState` answers
   false and `reportDispatchFailure` takes the toast branch. If step 8's held gesture turns out
   to be unproducible, step 11 is what keeps this case worth walking at all.

   **This was NOT a sole discovery and the first version of this entry read as though it were.**
   Card W15-B reached the same refusal independently in the same wave, from the other side: its
   step 17 is the same five moves with a text editor in place of leaf B, quoting the same locale
   sentence and citing the same case. B anticipated the overlap and said so in its own row; this
   card did not, until the fix round. Both files now name the other and say to walk it once —
   this one prefers B's form whenever step 1 has not produced a pair, since B's needs neither a
   pair nor a second device. The narrow thing this variant still adds is that a peer LEAF's write
   moves the ledger generation exactly as a foreign FILE write does; the two arrive through
   different subscriptions and nothing asserts they land the same.
4. **No `src/` defect found.** Every claim in the brief that I relied on was re-verified at
   source and all of them held. Three corrections of detail, none of them substantive:
   - The project view's create-asset door reaches `revealAssetDesigner` through
     `renovationProjectOpenSeams.ts`'s `renovationProjectOpenAsset`, which
     `composition-root.ts` binds — not from the composition root directly.
   - The asset library's **Edit shape** is bound to that *same* `renovationProjectOpenAsset`
     (`assetLibraryDeps.ts`), so two of the three doors are literally one binding, not three
     bindings into one function.
   - `report-failure.ts`, `affects-save-state.ts` and `SaveStateIndicator.vue` live under
     `src/presentation/editor/`, not under `src/presentation/designer/`; the designer imports
     them. The behaviour the brief described is exactly right.

   **Corrected in the fix round: there are FOUR doors, not three.** The reviewer found
   `editorWorkspaceNavigation.ts`, which binds the Plan Editor's `EditorNavigation.asset` — the
   placement Inspector's "open this asset's designer" button — to the same
   `renovationProjectOpenAsset`. So the category claim holds unchanged and is now checkable
   rather than a list: four doors, three of them literally one binding, all four ending at
   `revealAssetDesigner`, which `grep -rn revealAssetDesigner src/` answers. Worth knowing for
   step 1 specifically, because a walker with a plan open may reach for that button and will get
   the existing leaf revealed rather than a second one. **My own first census missed it because
   my grep alternated two patterns and I read a hit on the second as a hit on the first** —
   "measure a set with an instrument that can see all of it, and test the instrument first",
   broken while measuring.
5. **Two things about the fix round that are the integrator's, not mine to edit.**
   - **The reviewer's unwalkable list omitted step 2**, and step 2 is the reviewer's own finding
     3: its action opens *"With both leaves open"*, so it presupposes the pair and is unwalkable
     without one exactly as 3 and 5–8 are. Step 1's map therefore reads **2, 3, 5, 6, 7, 8 and
     16**, one row longer than the message asked for. I also split the reviewer's "5–13" rather
     than copying it: 9, 10, 12 and 13 are observations of a **Save error** badge, and step 14
     produces one in a single leaf, so they survive a failed step 1 provided 14 is walked first
     and "leaf B" is read as "the only leaf". That is a more useful map than a contiguous range
     and it is what the row now says.
   - **W15-B's own file disagrees with itself by one step number.** Its opening prose says *"The
     one place the two nearly meet is step 18"*, while its table row and its *Deliberately NOT
     checked* section both say step 17 — and 17 is the row that actually carries the text-editor
     foreign write (18 is the follow-on comparing what that refusal offered). My cross-references
     say **17**, matching the table. B's prose is the odd one out and it is B's file, so I have
     not touched it.

6. **One thing the brief said that I would state more narrowly.** "Identical geometry is
   `no-write`, not a conflict" is true, and the sharper fact is the case
   `setAssetFootprint.test.ts` "reports no-write for an identical footprint **even when the
   expectation is stale**" — the short-circuit is above the version comparison, so a repeated
   gesture cannot conflict even from a genuinely stale leaf. Step 12 is written from that
   stronger form.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
