# Task report — AD16

Outcome: **partially implemented, and BLOCKED for release**
Owner / worktree / branch: integrator · `renovation-planner-asset-designer-bc5539` · same
Base commit: `b0d15aca0` (session five's start) · Integration SHAs: see Executed checks
Accepted contract revision: `r1`
Allowed scope and shared-file leases: integrator-owned documentation, `CHANGELOG.md`, the suite and
case files under `docs/tests/`, and `docs/development/agent-guide-increment-history.md`

## Which of AD16's six items were reachable, and which were not

| Item | State | Why |
|---|---|---|
| 1 — benchmark the fixtures, undo chains, repeated open/close | **not-run** | Needs a host and the F12 fixture family, which does not exist at any size. `npm run perf` is deliberately absent from this repository and CLAUDE.md names its trigger: a render cost somebody can argue about. There is none to argue about yet |
| 2 — complete accessibility checks | **partially reachable, and NOT claimed** | The jsdom axe scans run and are green, and they are narrower than the word "accessibility": they verify no colour contrast, no visible focus indicator and no hit-target size, because jsdom has no rendering engine to measure any of the three. A live vault is the only instrument for those. **`tests/harness/accessibility*.test.ts` reaches the clearance-review block not at all** — see below |
| 3 — moderated novice usability | **not-run** | Needs people. Not fakeable and not faked |
| 4 — document creation, composition, precision limits, clearance meaning, live shared edits, revision limitations, supported geometry and recovery | **done** | `docs/using-asset-designer.md`, 365 lines, written from the code |
| 5 — changelog, known limitations, migration/backup warning, release checklist | **done**, and the checklist's decision is **blocked** | Below |
| 6 — consolidate execution evidence into current repo conventions | **done** | Below |

## Item 4 — the user documentation

`docs/using-asset-designer.md`, written into the convention `docs/using-plan-editor.md`,
`docs/using-planning-recovery.md` and `docs/using-item-colors.md` already set. It opens with two
blockquotes: that the designer is a **beta not validated in a live Obsidian session**, and the
desktop-only platform gate. It covers all eight of item 4's topics, states the limitations in the
body at the point a user would meet them, and closes with a section naming every question the code
did not settle.

**Two things it got right that are worth repeating here.** It makes **no appearance claim
anywhere**, because nothing has been rendered in Obsidian or captured. And it says plainly what
`r1` row 4 measured: **there is no export subsystem** — no PDF, no print path, no render-to-file,
no image export of a designed object. A shape reaches exactly three places.

**Writing it falsified two claims in the tree**, both corrected from a grep rather than from the
report that raised them:

- Ruling **AD13-R1** named the plan-side door into the designer *"Edit shared asset"*. No such
  string exists in `src/`; the shipped one is `editor.asset.open-designer` → **"Open in designer"**.
  The wrong label had been carried from the ICR 2 withdrawal note, which described the door that
  was proposed rather than the one that shipped.
- **`AssetGeometryStore.ts`**'s class docblock said `AssetGeometrySchema` "knows versions 1 and 2".
  It knows 1 through 4 — stale since AD04 took 3 and AD14 took 4.

One disagreement it found is **left standing deliberately**: `docs/requirements/Asset designer.md`
says height is "stored, shown and **exported**". That is an unmet requirement rather than a false
statement about the code, and rewriting a requirement to match the code is the wrong direction.

## Item 5 — the release artefacts

**Changelog.** `CHANGELOG.md`'s `[Unreleased]` section was missing AD09 through AD14 and the queue
card **entirely** — seven increments with no user-visible record. Seven entries were written from
the locale keys and the component predicates rather than from the task cards, because a card records
what was asked for and several of these were narrowed after being written.

**Known limitations and the migration/backup warning** live in `docs/using-asset-designer.md`'s own
Recovery section rather than in a second document, because a limitation a user needs is a limitation
where the user is. The two that matter most: a clearance is an **authored planning boundary and not
a regulatory approval**, and "reviewed" certifies nothing; and **going back to an older build is not
by itself a recovery**, because once this build has written geometry at schema 4 an older one
refuses it deliberately, so recovery means restoring a verified backup.

**The release checklist**, filled from `templates/RELEASE-CHECKLIST.md`:

```
Candidate commit: the wave-6 integration SHA (see Executed checks)
Reviewer / date / environment: integrator · 2026-09-18 · Windows 11, no Obsidian, no pinned Chromium

- [x] AD00 baseline and AD01 contract accepted; existing requirement mappings updated.
- [x] AD02–AD14 integrated with task-level verification on the correct history.
- [ ] AD15 end-to-end scenarios and mandatory host checks passed.        ← BLOCKED: no Obsidian
- [~] Build, lint, coverage, static analysis and audit have recorded dispositions.
      Audit: 2 high, `npm audit --omit=dev` 0 — both reach only through eslint-plugin-obsidianmd.
      The other four: see Executed checks.
- [x] New geometry supported by every current consumer; no silent export omissions.
      There are exactly three consumers and no exporter (`r1` row 4). Said, not silently assumed.
- [x] Legacy v1/v2 migration and unsupported future-version refusal verified — by tests.
      NOT by a checked-in legacy .rpgeo fixture: those documents exist only as literals.
- [ ] Backup-based upgrade/recovery path exercised in disposable data.   ← BLOCKED: no vault
- [x] Wrong-unit, false-save, data-loss, frozen-state and unreachable-control defects resolved.
- [ ] Light/dark, compact panes and keyboard alternatives verified.      ← BLOCKED: no host, no capture
- [ ] Performance/usability results name their conditions and limitations. ← BLOCKED: no figures exist
- [x] User documentation explains shared edits, clearance meaning and precision limitations.
- [x] No unfinished or nonfunctional controls advertised.
- [x] Known limitations and outstanding lower-severity issues explicitly accepted.
- [ ] Release authorization received before tag/push/publication.        ← NOT REQUESTED, NOT GIVEN

Decision: BLOCKED
Blocking evidence: five unchecked boxes, four of them environmental. Runbook §10 forbids
labelling the beta ready where an Obsidian session cannot be run, and it cannot be run here.
Nothing has been pushed, tagged or published, and no release authorization was sought.
```

**AD16 item 5 says explicitly: do not publish, tag or push without the user's release
authorization.** That authorization was not given and was not asked for. The artefacts are prepared;
none of them has been used.

## Item 6 — consolidating the execution evidence

The repository's own convention for the recorded history of an increment is
`docs/development/agent-guide-increment-history.md`, reached through the `increment-history` skill.
The expansion had no section in it. One was appended: what landed, the seven rulings and why three
of them refused work, **what the review step caught** (a change request that would not compile, two
counts whose greps included their own sentences, and a paragraph that would have described a real
defect had it been true), the process lessons, and what is not done.

**The package's own artefacts stay where they are** rather than being folded in: `state.json` is a
ledger a future session edits, `LEASES.md` and `INTEGRATION-QUEUE.md` are live, and the reports are
per-candidate evidence. Consolidation means the durable record joins the repository's convention,
not that the working files are flattened into prose.

## Acceptance coverage

| Criterion | Result | Evidence | Remaining issue |
|---|---|---|---|
| All core tasks through AD15 integrated and verified | **not met** | AD00–AD14 and the queue card are `integrated`; **none is `verified`**, and AD15 is `blocked` | `verified` requires a host |
| No unresolved critical/high issue; lower issues have a disposition | **partially met** | No critical or high defect is open in the ledger. `npm audit`'s two high advisories have a disposition: dev-tree only, production clean | The 20 partial matrix rows each carry a named gap; that is their disposition |
| Performance figures name hardware, viewport, fixture size, method | **not met, and unmeetable** | No figure exists to qualify | Needs item 1 |
| No theme, file-size, coverage or static-analysis gate weakened | **met** | No floor was lowered, no rule disabled, no suppression added. Two style partials were appended to within their caps, measured | — |
| Fresh install, legacy upgrade, backup recovery exercised or explicitly blocking readiness | **explicitly blocking** | Recorded as blocked rather than waived | — |
| Release notes describe what is implemented, verified and deferred | **met** | The changelog describes what is implemented; this report and `AD15-validation-matrix.md` describe what is verified and what is not | **Nothing is "verified" in the ledger's sense** and the notes must not imply otherwise |

## Executed checks

| Command | Commit | Exit code | Evidence |
|---|---|---|---|
| `npm run build` | `f43b84ff2` | **0** | AD07-H integration SHA |
| `npx oxlint --deny-warnings` | `f43b84ff2` | **0** | |
| `npx vue-tsc -noEmit` | `f43b84ff2` | **0** | |
| `npx eslint . --max-warnings 0` | `f43b84ff2` | **0** | |
| `npm audit` | 2026-09-18 | 2 high | Both through `eslint-plugin-obsidianmd` |
| `npm audit --omit=dev` | 2026-09-18 | **0 vulnerabilities** | The disposition |
| `npm run build` | **`f28a63095`** | **0** | The final wave-6 SHA |
| `npx oxlint --deny-warnings` | `f28a63095` | **0** | |
| `npx eslint . --max-warnings 0` | `f28a63095` | **0** | |
| `npx vue-tsc -noEmit` | `f28a63095` | **0** | |
| `npm run test:coverage` | `f28a63095` | **0** | **1052 test files, 11615 tests, 1 skipped, ZERO failures**, 1120s. **99.22 / 98.05 / 99.26 / 99.67** against floors 99/98/99/98 |
| `npm run analyze` | `f28a63095` | **0** | 0 dead files, **0 dead exports of 2393**, no private type leaks, no duplication, **0 complexity findings above threshold**, maintainability 86.8 |

**All six ran serially, in that order, on a quiet box** — zero other node processes — and coverage
ran before analyze because analyze reads the map the suite writes.

**Four gates also ran on `f43b84ff2`, the AD07-H integration SHA, and exited 0 there**: `build`,
`oxlint`, `vue-tsc` and `eslint .`. Coverage and analyze were NOT run on that SHA, deliberately —
another Claude session was mid-`test:coverage` on the same 7.8 GB machine, and this package has
already recorded what that produces: a 43-hour projection and seventeen failures that were all
timeouts and no assertions. **Running a gate into known contention produces a WRONG red, not a slow
one.** This session waited instead.

**`analyze` exited 1 on the first attempt and the fix is `f28a63095` itself.** One finding above
threshold, and it was this wave's: `DesignerUsageScope.vue`'s template at **cognitive 18** — a
`bound` guard wrapping a three-way state branch whose last arm held a list-or-empty choice and a
third conditional note. Factored into `DesignerUsagePlans.vue` rather than suppressed with the
`fallow-ignore-next-line complexity` that was available, because the complexity was real and
because this repository's record is explicit that AD09's two SFC findings and AD07's three template
breaches were every one of them fixed by moving code.

**Note what the failure line said and did not say.** It read *"Failed: health (1 above threshold):
start with `src/presentation/editor/renovation/renovationSummary.ts`"* — a file this branch never
touched. That name comes from the pre-existing 53-entry refactoring-target list, not from the
finding that failed the gate. **A tool's summary line is not its finding**, and reading that one at
face value would have sent a session into a plan-editor file for a defect in a designer one.

**The per-file coverage read, which the thresholds cannot do.** `coverage-final.json` was read for
every file this wave changed — `DesignerUsageScope`, `DesignerUsagePlans`, `NumericField`,
`guardedAssetLibrary`, `assetDesignerQueries`, `CreateAsset.ts`, `NewAssetForm` — and **every one
has zero uncovered branches, functions and statements**. That matters because branches sit at
98.05% against a 98 floor: 430 uncovered of 22065, so the margin is about **eleven arms** for the
whole repository, and one untested arm in a slack metric is invisible to the gate.

## Verification not performed

- **Every manual case under `docs/tests/`**, the three written for this expansion included.
- **Every capture.** No pinned Chromium; `npx playwright install chromium` is forbidden here.
- **`npm run test-build`**, and therefore anything about appearance in a themed vault, keyboard
  behaviour in a real host, hit size, or any assumed Obsidian API.
- **Every §6 performance and usability target.** No fixture, no host, no participants.
- **Colour contrast, visible focus indicators and hit-target size** — jsdom measures none of them,
  so item 2 is partially reachable at best and is not claimed as done.

## Data and integration implications

Schema/migration change: none in this report; schema 4 landed with AD14.
Relevant renderer/export/revision consumers: three, and there is no exporter.
Undo/no-op/conflict/failure coverage: recorded per row in `AD15-validation-matrix.md`.
Identity/unit/quantity/calibration invariants: same, and **T40 (quantity isolation) is the thin
one** — it rests on a note edit rather than a graphic one.
Shared root/runtime/locales wiring still required: one deferred locale key, with its measured home
recorded in `INTEGRATION-QUEUE.md`.
Rollback/recovery considerations: schema 4 is refused by older builds by design; restore a verified
backup. `docs/using-asset-designer.md` says so to the user.

## Reviewer and integrator acceptance

Reviewer outcome and findings: this report is the integrator's own and was not independently
reviewed. The two cards it accompanies each were, and both reviews are summarised in `state.json`.
Integrated commit: this report lands with the wave-6 integration.
Post-integration checks/evidence: the six-gate row above.
Final status: **blocked**. The beta is not ready, it is not labelled ready, and nothing has been
pushed, tagged or published.
