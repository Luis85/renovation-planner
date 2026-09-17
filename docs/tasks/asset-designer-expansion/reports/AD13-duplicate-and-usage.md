# Task report — AD13 (duplicate and usage-scope half)

Outcome: **implemented, not verified; reviewed once and FIXED once** — the three implementation
items in this half (3, 4, 5) and the three acceptance criteria that go with them (3, 4, 5) are
built and covered by tests. Nothing in this half is deferred. Two things are NOT claimed: no check
needing Obsidian, a real vault or the pinned Chromium was run (none is available on this machine),
and `npm run check` itself was not run, by instruction. Two integration change requests are
outstanding, neither of them a blocker - one is bookkeeping in the lease ledger and one is a member
relocation into an integrator-owned read model.

**A review returned REQUEST CHANGES and the fix round is in this same branch.** Its five findings
and what each one cost are in [Fix round](#fix-round--what-the-review-found-and-what-changed),
below. Two were blocking: a docblock whose central justification was FALSE about the ports it
named, and with it a defect that sentence claimed to have closed and had not; plus a coverage table
citing two test cases that do not exist and one wrong count. Read that section before this
report's own claims - one of them is a claim this round had to narrow rather than defend.

Owner / worktree / branch: AD13 duplicate-and-usage worker ·
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539\.worktrees\ad13b`
· `ad13b-duplicate`

Base commit / candidate commit: `ae6bb2a63` / the single commit on `ad13b-duplicate`. Its SHA is
deliberately not written here, because this report is INSIDE that commit and a hash cannot name
the object that contains it — `git rev-parse ad13b-duplicate` is the candidate, and the handoff
message carries the value it had at handoff.

Accepted contract revision: **`r1`**

Allowed scope and shared-file leases: NEW `application/commands/asset/DuplicateAsset.ts`,
`application/commands/asset/CreateAsset.ts`, NEW `application/queries/ListPlansUsingAsset.ts`,
`presentation/library/{AssetInspector.vue,AssetInspectorUsedIn.vue,AssetLibraryDeps.ts}` plus NEW
`AssetUsage*.vue` in that directory, `plugin/assetLibraryDeps.ts`, `plugin/guardedServices.ts`,
`plugin/guardedAssetLibrary.ts`, `i18n/locales/{en,de}/assetDuplicate.ts`, and any NEW file under
`tests/`. `CreateAsset.ts`, `AssetInspectorUsedIn.vue` and `guardedServices.ts` were leased and
turned out not to need changing; they are untouched.

**ONE edit fell outside the literal lease and is disclosed rather than buried:**
`tests/presentation/i18n/strings.test.ts`, whose *"pins the Asset library inventory at N keys in
both locales"* case went red on this branch's thirteen new keys. That case exists to fire and be
bumped deliberately — its own docblock says *"whoever bumps the number reads why"* — and the
alternative was handing over a red tree for a two-digit change the test itself invites. 87 to 100,
with the reason written into the docblock beside the previous two bumps. **The section 8 spec
amendment that pin cannot check is OWED and NOT made**:
`asset-library-overview-DESIGN-SPEC.md` is nobody's lease this wave, and the pin's own paragraph
is explicit that its guarantee is *the count cannot move silently* and never *the spec was
amended*. Naming the keys something outside the `view.asset-library.` prefix would have dodged
the pin entirely and was refused for that reason.

**A SECOND edit fell outside the literal lease in the fix round, and it is five additive lines:**
`tests/helpers/assetInspectorHarness.ts` gained an optional `indexScanCompleted` option,
defaulting to the `() => true` it hard-coded before, so that the new pre-scan case can construct
the state it is about. Three files use that helper and neither of the other two can see the
change: an option nobody passes resolves to the value that was already there. The alternative was
mounting `AssetUsageScope` bare in this card's own file, which that file's header refuses for a
stated reason (a bare mount passes with the control wired to nothing), so the choice was between
a five-line additive helper edit and a second mounting convention inside one suite.

**One bookkeeping point, raised because the ledger's own opening sentence says it must be:**
`docs/tasks/asset-designer-expansion/execution/LEASES.md` has no wave 4 section. This lease exists
only in the dispatch brief and now in this report — which is exactly the state that document
records as a correction it had to make once already for AD07 and `EmptyState.vue` (*"which made the
worker's own report the only place the permission existed"*). The integrator owns that file; the
row wants writing.

**Withdrawn in the fix round: the row EXISTS.** It was committed at `584bb2f19`, three minutes
after this branch's base `ae6bb2a63`, so it is real and simply invisible from this worktree - and
the reviewer compared this card's paths against it and found them matching exactly. Nothing was
mis-granted. Left standing rather than deleted because the shape is worth keeping: a worker cannot
tell "not recorded" from "recorded after my base", and the honest report of that state is the one
above plus this correction.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/application/commands/asset/DuplicateAsset.ts` | NEW. `DuplicateAssetCommand`: one definition copied to a fresh asset id across the note and the geometry sidecar, note first, with a version-conditioned compensating delete and `markUncompensated` when that delete itself fails | Yes — new file, named in the lease |
| `src/application/queries/ListPlansUsingAsset.ts` | NEW. `ListPlansUsingAsset`: which plans place one asset, with a per-plan placement count and a separate `unreadable` accounting. Fix round: the header's false *"deliberately not `index.getIdsByType`"* claim deleted and replaced with what the shape actually guarantees, plus one paragraph naming which sidecar refusals `unreadable` conflates | Yes — the new query the lease reserves |
| `src/presentation/library/AssetUsageScope.vue` | NEW. The **Used in plans** section: loading, refused, rows, *no plan places this*, plus the additive *this list may be incomplete* line. Fix round: the read is GATED on `context.indexScanCompleted()` and draws the unknown-scope sentence instead of dispatching, so a pre-scan index cannot produce a confident *no plan places this* | Yes — `AssetUsage*` prefix |
| `src/presentation/library/AssetUsageDuplicate.vue` | NEW. The duplicate panel: the scope above, the name field prefilled *{name} (copy)*, the refusal line, `Create copy` / `Cancel` | Yes — `AssetUsage*` prefix |
| `src/presentation/library/AssetInspector.vue` | A `Duplicate` action drawn only for a readable asset and withdrawn while its own panel is open; the panel; `duplicating` reset on every selection change | Yes — explicitly leased |
| `src/presentation/library/AssetLibraryDeps.ts` | Two members on `AssetLibraryCommandServices` (`duplicateAsset`, `listPlansUsingAsset`) and their refusals in `unavailableAssetLibraryCommands` | Yes — explicitly leased |
| `src/plugin/guardedAssetLibrary.ts` | NEW exported `guardAssetDuplication`: constructs both and guards each under its own event name. No `Result` adapter - the query answers one of its own. Fix round: the *"walks the repositories rather than the index"* half of its docblock narrowed to match the ports | Yes — explicitly leased |
| `src/plugin/assetLibraryDeps.ts` | Calls it with ports the root already holds (`assets`, `assetGeometry`, `locks`, `projects`, `plans`, `geometry`) and spreads the pair into the command bundle | Yes — explicitly leased |
| `src/presentation/i18n/locales/en/assetDuplicate.ts` | 13 keys (counted in this edit: `grep -c "^\t'view\." src/presentation/i18n/locales/en/assetDuplicate.ts`). Was an empty scaffold | Yes |
| `src/presentation/i18n/locales/de/assetDuplicate.ts` | The same 13 keys in German, the count held by the same grep and by the `Record<keyof typeof assetDuplicateEn, string>` type | Yes |
| `tests/application/commands/asset/duplicateAsset.test.ts` | NEW, node. 11 cases over the real repository and the real sidecar (fix round: the compensation's REFUSAL arm, a peer edit landing between the save and the cleanup). `facts` hoisted to module scope - oxlint reported it on the candidate, see Executed checks | Yes |
| `tests/application/queries/listPlansUsingAsset.test.ts` | NEW, node. 7 cases over the real project repository, the real plan repository and the real plan geometry sidecar | Yes |
| `tests/presentation/library/assetUsageDuplicate.test.ts` | NEW, jsdom. 13 cases through the real `AssetInspector` (fix round: the pre-scan gate, and the in-flight state with the confirm live) | Yes |
| `tests/helpers/assetInspectorHarness.ts` | Fix round. An optional `indexScanCompleted`, defaulting to the `() => true` it hard-coded | **No** — disclosed above; five additive lines, invisible to the two other files that use it |
| `docs/tasks/asset-designer-expansion/reports/AD13-duplicate-and-usage.md` | This report | Yes |

## What was NOT built, and why that is the right answer rather than a gap

**No id remapper.** Item 4 asks for *"internal identities remapped as required"*, and the amount
required is nothing. `detail-<n>` and `group-<n>` are numbered WITHIN one `AssetShape`
(`nextDetailId`/`nextGroupId` count off that shape's own ids), the copy is its own document, and
nothing outside that document names a part id — a `NamedSpatialElement` carries an `assetId` and a
`Requirement` carries an `assetId`. So the shape is copied verbatim, which is also what preserves
what C09 asks a migration to preserve: identities, order, bulges, pending flags, measured
coordinates. C06's *"duplicate assigns fresh IDs once and remaps group membership"* is about
duplicating a PART inside one shape, which `detailEdits.duplicateDetail` already does. A remapper
here would renumber a correct identity graph and lose the one property a copy must have. Asserted
rather than argued: the first command case compares the copied document against the source's, and
names the detail ids and the group membership explicitly.

**No publish/draft state machine.** C11 and the card both forbid one, AD01 §3 rules the concept
board's Save button absent, and none was added. The scope read is a snapshot consulted before the
gesture; nothing is staged, versioned or approved.

**No schema change, no migration.** Neither half touches a stored shape. The duplicate writes the
document it read, and the query only reads.

**No always-on plan-usage section.** Considered and refused on two counts: it would run a
vault-wide walk of every plan note and every plan sidecar on every SELECTION for a question nobody
asked, and the scope an ordinary field edit needs is the REQUIREMENT one `AssetInspectorUsedIn`
already draws — a name or a price reaches requirements and touches no geometry. The plan list is
drawn inside the duplicate panel, which is AD13 item 3's *"before impactful changes"* read
literally. It also happens to be why no existing library test moved: a new always-on section breaks
`assetInspector.test.ts`'s exact-headings assertion, which is not this worker's file.

## Acceptance coverage

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| 3 — *editing a shared definition has explicit usage scope; a duplicate does not change the original* | **Met** | Scope: `assetUsageDuplicate.test.ts` *"shows which plans place the definition before anything is dispatched"*, *"says the scope is incomplete when some plans could not be read"*, *"draws the refusal rather than an empty scope"*. Original untouched: `duplicateAsset.test.ts` *"copies metadata and geometry to a new identity and leaves the original untouched"* asserts the source's version is unchanged, its name is unchanged, and the only event published is `AssetCreated` for the COPY | The scope is drawn at the duplicate rather than permanently; see the paragraph above for why. A price/name edit's scope remains the pre-existing *Used in* section |
| 4 — *no asset ID, reference or quantity link points to an orphan after cancel/failure* | **Met** | Cancel: `assetUsageDuplicate.test.ts` *"dispatches nothing on cancel"*. Failure: `duplicateAsset.test.ts` *"deletes the note it created when the sidecar write fails, leaving no orphan"* (catalogue back to one entry, nothing published) and *"refuses a damaged source sidecar before it writes the note"*. Un-compensatable failure: *"stamps the refusal uncompensated when the cleanup itself fails"* | The uncompensated case DOES leave a metadata-only copy in the vault — that is the reported state, not a silent one, and it is what `markUncompensated` exists to say |
| 5 — *graphic parts never become independent purchasable assets automatically* | **Met** | `duplicateAsset.test.ts` *"creates exactly one catalogue entry for a definition holding several graphics"* — a shape with two details and a group over both yields exactly two asset notes in the vault, the source and the copy | None |
| Item 5's other half — *references stay correct across renamed/moved library notes and missing assets; invalidate thumbnails/plan views on relevant asset updates* | **Met in the parts this half owns** | Moved note: `duplicateAsset.test.ts` *"follows a source note that has been renamed and moved"*. Missing vs unreadable: *"refuses an asset that is not there"* and *"reports a failed note read as a vault fault rather than as a missing asset"*. Invalidation: the `AssetCreated` assertion above — the catalogue refreshes for the copy through the existing `createAssetLibraryChangeSource` path, and NOTHING is published for the source, so no thumbnail or plan view is invalidated by a change that did not happen. Query side, rewritten in the fix round from the file as ENUMERATED rather than from memory - it holds seven cases and two of the three names quoted here before did not exist: *"counts the notes each listing skipped, so a partial scope says it is partial"* (both tolerant halves, project notes and plan notes) and *"counts a plan whose geometry sidecar refuses as unreadable"*. **The gone-note arm is claimed by nothing now**: `getById` answering `ok(null)` cannot arise through `listByProject`, which yields only notes it loaded, so the query's header states the rule and no case pins an unreachable state | Invalidation on an EDIT to a definition is pre-existing behaviour (`AssetUpdated`/`AssetDesignChanged`) and was neither changed nor re-verified here |
| 1, 2, 6 | **Not this worker's** | designer→plan navigation, the plan picker, the return path and the library's mobile gate are the other AD13 worker's half | — |

## Executed checks

Environment: Windows 11, Node via `npx`, worktree `.worktrees/ad13b`, working tree as committed.
`TEMP`/`TMP` set to `D:/tmp-claude` for every node-spawning command.

| Command | Exit code | Evidence |
|---|---|---|
| `npx vue-tsc -noEmit` | 0 | Whole tree, `src/**` and `tests/**` — no output |
| `npx vitest run tests/application/commands/asset/duplicateAsset.test.ts` | 0 | 10 passed |
| `npx vitest run tests/application/queries/listPlansUsingAsset.test.ts` | 0 | 7 passed (this row said 6; corrected in the fix round against `vitest`'s own count) |
| `npx vitest run tests/presentation/library/assetUsageDuplicate.test.ts` | 0 | 11 passed |
| `npx vitest run tests/presentation/library tests/plugin tests/harness` | **1** first time, 0 after the fix | 1 failed / 1059 passed (1060). The failure was `tests/plugin/guardCategory.test.ts` and it was a REAL defect - see the next section. Re-run after the fix in the row below |
| `npx vitest run tests/application/queries/listPlansUsingAsset.test.ts tests/application/commands/asset/duplicateAsset.test.ts tests/presentation/library/assetUsageDuplicate.test.ts tests/plugin/guardCategory.test.ts` | 0 | 4 files, 40 passed |
| `npx vitest run tests/build/libraryComponentStyles.test.ts tests/build/localeModuleSentenceCase.test.ts tests/presentation/i18n` | **1** first time, 0 after the pin bump | 201 passed. The failure was the Asset library key pin (`expected [ ...(100) ] to have a length of 87`), bumped as disclosed above |
| `npx vitest run` over every affected directory at once (the two new application suites, `tests/presentation/library`, `tests/plugin`, `tests/presentation/i18n`, the two `tests/build/` gates) | **1**, and it is the documented parallelism artifact | 817 passed / 73 skipped / 890, with ONE failure: `tests/build/localeModuleSentenceCase.test.ts` reporting `Hook timed out in 60000ms` at `beforeAll(warmUpEslint, ESLINT_BOOT_MS)`. That is exactly the contention CLAUDE.md names (*"re-run serially before believing a `beforeAll` timeout in that directory"*), and that same file passed in the narrower run two rows up on the identical tree |
| `scripts/lint-edited.mjs` on every edited file | 0 after fixes | The edit-loop hook; it reported `vitest(require-mock-type-parameters)` twice on the component test and both were fixed by typing the mock against the bundle's own door type. **It did NOT report `unicorn(consistent-function-scoping)` on `facts`, which oxlint does report on the candidate** - so read this row as "the hook was run and answered", not as "the file is lint-clean"; the fix round cleared the finding |

**Fix round, on the same machine and the same instruction (`check:fast` only, never the full gate):**

| Command | Exit code | Evidence |
|---|---|---|
| `npm run check:fast -- tests/application/commands/asset/duplicateAsset.test.ts tests/application/queries/listPlansUsingAsset.test.ts tests/presentation/library` | 0 | `oxlint --deny-warnings` over the whole tree, `vue-tsc -noEmit` over the whole tree, then 22 test files / 276 tests passed. This is the round's own definition of "green" and it is a strict subset of `npm run check` |
| `npx vitest run` over the three subject suites | 0 | 3 files, 31 passed (11 command, 7 query, 13 component) |
| `npx vitest run tests/plugin/guardCategory.test.ts` | 0 | 12 passed - the detonation suite, re-run because this round edited `guardedAssetLibrary.ts` (comment only) |
| `npx oxlint --deny-warnings` on a copy of `git show HEAD:…/duplicateAsset.test.ts` | **1** | How the `facts` finding was attributed to the candidate rather than to this round. The temporary file was deleted in the same command |
| Three watched-failing reverts | **1** each, then 0 restored | The table above quotes what each red said |

## One real defect this branch's own gate run found, and the redesign it forced

The first version of `ListPlansUsingAsset` enumerated plans from
`index.getIdsByType('renovation-plan')` - cheaper, and wrong in the one direction that matters for
a scope read. `tests/plugin/guardCategory.test.ts` detonates every collaborator the composition
root hands out, and reported one finding:

> `libraryDeps.commands.listPlansUsingAsset` - "`execute` answered a SUCCESS while the vault below
> it threw - nothing mapped the fault"

The index is derived data that is legitimately EMPTY before the initial scan and after a failure
below it, so an unreachable vault got `{ plans: [], unreadable: 0 }` back: *no plan places this
asset*, stated confidently, at the one surface whose whole job is to state a blast radius. It is
the same false-absence class as `ListAssetOutlines`' `refused` entries and the library's own
`indexScanCompleted` gate, arriving through a new door.

**The fix was not a guard, it was the source of truth.** The query now walks
`ProjectRepository.listAll` and `PlanRepository.listByProject`, so its answer derives from reads
that FAIL when the vault fails: a whole listing that refuses is propagated, and each listing's
tolerant `refused` count is added to `unreadable`. It answers a `Result` now rather than a bare
value, `guardAssetDuplication` guards it plainly instead of wrapping an `ok()` around it, and the
`unreadable` string says *note(s)* rather than *plan(s)* because the number now counts three kinds
of note. `listPlansUsingAsset.test.ts` carries the case that would have caught it - *"REFUSES
rather than answering an empty scope when the project list cannot be read"* - with the gate's own
message quoted in its comment.

Worth recording for the next read that must not report a false absence: **an index lookup cannot
be the sole basis for one.**

**Amended by the review: that fix closed ONE of the two arms and this section claimed both.** The
walk closes the refusing-ports arm, which is the one `guardCategory.test.ts` can see. It does not
close the PRE-SCAN arm, because `ObsidianProjectRepository.listAll` and
`ObsidianPlanRepository.listByProject` both enumerate `index.getIdsByType` themselves - so an
empty index over a healthy vault still answered *no plan places this asset*, confidently. The
sentence *"the source of truth"* was therefore wider than the change. The second arm is closed in
the fix round below, at the caller, where the fact that separates an empty index from an empty
vault actually lives.

## Fix round — what the review found, and what changed

| # | Finding | What was done |
|---|---|---|
| 1 (blocking) | `ListPlansUsingAsset`'s header justified its shape as *"deliberately not `index.getIdsByType`"*, which is FALSE of both ports it walks - and the pre-scan false absence that sentence claimed to have closed was still open | **Both halves.** The false sentence is deleted and replaced by what the shape guarantees (a whole listing that REFUSES is propagated) plus an explicit paragraph naming what it does NOT close, with the grep that measured it. The same narrowing is applied to `guardAssetDuplication`'s docblock and to the test case comment that repeated it. And the arm is CLOSED rather than documented: `AssetUsageScope.vue` asks `context.indexScanCompleted()` before it dispatches and draws the unknown-scope sentence instead. New case, watched failing |
| 2 (blocking) | The Item 5 coverage row cited three query case names, two of which do not exist, and Executed checks recorded 6 passing where there are 7 | The row is rewritten from the enumerated file, the count is corrected, and the gone-note claim is DROPPED rather than backfilled - that state cannot arise through `listByProject`, so a case for it would pin something unreachable |
| 3 (required) | The component suite's header claims it covers *"what is on screen while it has not answered"* and no case covered the in-flight state | Case added rather than header narrowed, because it is the state a slow vault actually shows: a usage read that never settles, asserting the loading line AND that `duplicate-confirm` still dispatches. The integrator's ruling that the control stays live is now pinned by that second assertion rather than by prose. Watched failing, and the red is worth reading - see the table below |
| 4 (required) | The compensation's REFUSAL arm was correct by construction and pinned by no case | Case added: a peer renames the copy's note from inside the sidecar write, so the version the cleanup was conditioned on is stale. The delete refuses, the note stays, the refusal is stamped uncompensated, and the peer's name is what the vault holds. Watched failing |
| 5 (required) | `unreadable` counts any refusing `geometry.read` and the header did not say which refusals that conflates | One paragraph in the query header: `plan-geometry.missing`, `plan-geometry.path-unresolved` and any parse or I/O failure, all into one number, with the ASSET sidecar's opposite behaviour named because a reader who knows that one would expect it here. No behaviour change |

**Nothing the review accepted was undone.** The compensation, the no-remapper argument, the two
required props, the predicate-only controls, the real-repository fakes and the `strings.test.ts`
pin bump are untouched.

**One thing was fixed that no finding named**, because it would have turned the integrator's gate
red: `unicorn(consistent-function-scoping)` on the `facts` helper inside the first command case.
It is in the CANDIDATE, not in this round's edits - verified by running oxlint against
`git show HEAD:tests/application/commands/asset/duplicateAsset.test.ts` in a temporary file, which
reported it at the same position. So this report's *"`scripts/lint-edited.mjs` on every edited file
- 0 after fixes"* row was wrong about that file. `facts` now sits at module scope, where the rule
asks for it, and oxlint is clean over the whole tree.

**One disagreement, and it is small: the "distinguish unknown from none" half of finding 1 is met
by REUSING the refusal sentence rather than by a fourteenth locale key.** *The plans that place
this asset could not be read, so the scope below is unknown* is true of a scan that has not run,
and the distinction that matters to a user is unknown-versus-none: the first does not invite a
change and the second does. A dedicated string would have meant a sixth key in this section, a
sixth German line, and a second bump of the out-of-lease `strings.test.ts` pin, for a state whose
remedy is identical to the refusal's. If the integrator wants the two states worded apart, it is
one key pair plus a 100 to 101 bump, and the component's header carries this trade where the next
reader is standing.

## Invariants watched failing

Each fix was reverted, the named case was run and seen RED, and the fix was restored.

| Invariant | What was reverted | What the red said |
|---|---|---|
| The compensating delete | `copyGeometry` returns the sidecar refusal without deleting the note | TWO cases red. *"deletes the note it created when the sidecar write fails, leaving no orphan"* gave `expected [ ...(2) ] to deeply equal [ 'asset-01M2RM74W558KWY7SXD3RAJ4RM' ]` - the catalogue kept the orphan. *"stamps the refusal uncompensated when the cleanup itself fails"* gave `expected false to be true` |
| *A duplicate does not change the original* | the command also publishes `assetUpdated` for the SOURCE id | *"copies metadata and geometry to a new identity and leaves the original untouched"* gave `expected [ ...(2) ] to deeply equal [ Array(1) ]`, the extra line being `+ "AssetUpdated:asset-01M2RM8WKJNK6NXRKEG125C6DD"` |
| The `unreadable` accounting | `unreadable += found.value.refused` deleted | *"counts the notes each listing skipped, so a partial scope says it is partial"* gave `expected +0 to be 2` |
| One placement counted once across both structures | `placementCount` counts elements instead of distinct ids | *"counts a placement held in both the current and the proposed structure once"* gave `expected [ { ...(4) } ] to deeply equal [ { ...(4) } ]` - three placements where two are distinct |
| The panel closes on a selection change | the `duplicating` reset watch removed from `AssetInspector.vue` | *"closes when the selection moves, so no name is carried from the previous asset"* gave `expected true to be false` |
| **Fix round.** The pre-scan gate | `scanned.value = context.indexScanCompleted(); if (!scanned.value) return;` replaced by `scanned.value = true` | *"says the scope is unknown rather than empty when the index has not been scanned"* gave `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times`, the recorded call being `[ "asset-01M2RPSST3JKGYH3X62FFG3HS7" ]` - the query dispatched over an unscanned index, which is the whole defect |
| **Fix round.** The in-flight state is DRAWN | the loading `<p>` deleted from `AssetUsageScope.vue`'s template | *"draws the loading line while the usage read is out, and the confirm stays live"* gave `expected 'Back to libraryWall ovenUsed inNot us…' to contain 'Loading which plans place this'`, and the received text is the finding rather than the assertion: `…Used in plansNo plan places this assetName of the copy…`. With no loading arm the section falls through to the ready one and states a clean empty scope while the read is still out |
| **Fix round.** The cleanup refuses a note a peer edited | `copyGeometry`'s `assets.delete(assetId, noteVersion)` replaced by a delete at the note's CURRENT version | *"refuses the cleanup rather than trashing a note a peer edited in between"* gave `expected false to be true` on `leftWritesBehind(refusal)` - the cleanup had trashed the peer's renamed note and reported a clean failure, which is the exact outcome C08's sentence forbids |

Every fix was restored and the files re-run green afterwards - the 40-passing row above, plus the
wide run whose only failure is the named ESLint-boot artifact. The fix round's three were restored
and re-run the same way; the `check:fast` row below is that re-run.

## Verification not performed

- **`npm run check`** — not run, by instruction: the integrator runs the full gate serially, and
  two heavy runs on this box produce wrong reds rather than slow ones. So **`eslint .`** (the layer
  bans, `WRITE_BOUNDARY`, `I18N_LITERAL_BAN`, `NOTICE_TEXT_BAN`, the obsidianmd ruleset and the
  size/complexity budgets), **`npm run build`**'s stylesheet assembly and **`npm run analyze`**
  (dead exports, duplication, `private-type-leaks`, dependency hygiene) are all UNRUN on this
  branch. The edit-loop hook ran oxlint on every edited file and ESLint on every edited `.vue`,
  which is a strict subset of that.
- **Coverage floors** — `npm run test:coverage` was not run, for the same reason. Nothing here
  measures what the three new files do to the 99/99/99/98 floors or to the branch margin. Every
  arm I could identify in the new code has a case, and `copyGeometry`'s two arms, the query's four
  and the section's five drawn states (loading, refused, rows, empty, unknown-scope, plus the
  additive incomplete line) are each driven, but that is a claim about the cases rather than a
  measurement of `coverage-final.json`. The fix round added three cases and one source branch
  (`if (!scanned.value) return;`), so the direction is more covered rather than less - still
  unmeasured.
- **`npm run test-build` and every manual case under `docs/tests/`** — Obsidian is not available on
  this machine. Nothing about how this looks in a real vault, how the panel behaves in a narrow
  leaf, or whether a real `Notice` appears has been observed.
- **`npm run harness` / `npm run harness-shot`** — no pinned Chromium here, and
  `scripts/chromium.mjs` correctly refuses to hunt a substitute. No capture of the duplicate panel
  or the usage section exists at any width, in either colour scheme.
- **Accessibility** — `tests/harness/accessibility*.test.ts` scans the mounted harness surfaces,
  not this panel in isolation; nothing in this branch was scanned by axe. The panel uses a real
  `<form>`, a `<label for>` bound to a `useId`, and `role="alert"` on the refusal, but that is
  construction rather than evidence.
- **Two leaves duplicating one asset at once** — still not driven. The command takes
  `locks.withLevel1` on the SOURCE id so its two reads are atomic against this plugin's own
  writers, and the copy's id is minted inside the call so nothing else can hold it; neither is
  proved by a concurrent case. What the fix round DID drive is the adjacent half - a peer edit
  landing inside the gesture, between the copy's save and its compensating delete - which is
  interleaving rather than concurrency and is the arm C08's cleanup sentence is about.
- **A real vault-scale plan walk** — the query's cost (one note read and one sidecar read per plan
  in the vault, per call) is stated, not measured. There is no `npm run perf` here to measure it
  with.

## Data and integration implications

**Schema/migration change:** none. No stored shape changes; the duplicate writes back the document
it read, and the query only reads.

**Relevant renderer/export/revision consumers:** r1 row 4 fixes the consumer set at three — the
authoring canvas, the library mark (`ListAssetOutlines` → `AssetMark.vue`) and plan placement. The
duplicate adds a new asset id to the catalogue, so the mark for that id is read for the first time
rather than invalidated, and no existing placement changes. No export subsystem exists to touch.

**Undo/no-op/conflict/failure coverage:** the duplicate is not on the designer's `CommandHistory`
and is not a reversible design command — it is a catalogue creation, like `CreateAssetCommand`,
which is also not undoable. Its failure modes are all covered above. Its version conflict is the
`'absent'` save: a fresh id cannot collide in practice, and a collision refuses rather than
overwriting. The compensating delete is conditioned on the version this command's own save
produced, so an edit landing in between makes the cleanup REFUSE and the note stays — which is
C08's *"only touches files created by that operation and has not overwritten later user edits"*
enforced by the port rather than by a filename.

**Identity/unit/quantity/calibration invariants:** the copy carries a fresh `AssetId` and every
other field unchanged, including `unitCost` (decimal string across the boundary, ADR-010), `unit`,
`wasteFactorDefault`, `height`, `background` and `planPattern`, plus the whole geometry document
including its `calibration` and every pending flag. No quantity is recomputed and no requirement is
created — the copy is referenced by nothing at the moment it exists, which is criterion 5's whole
point.

**Shared root/runtime/locales wiring still required:** see the next section. The locale pair is
already imported and spread into `{en,de}/editor.ts` by the integrator, so nothing is owed there.

**Rollback/recovery considerations:** reverting this branch removes two members from
`AssetLibraryCommandServices` and two constructions from `assetLibraryDeps`. It leaves no data
behind — any assets a user duplicated are ordinary catalogue notes that every other door already
understands.

## Integration change requests

**One, and it is about placement rather than behaviour.**

`listPlansUsingAsset` is a READ sitting in `AssetLibraryCommandServices`
(`src/presentation/library/AssetLibraryDeps.ts`). Its proper home is
`AssetLibraryQueryServices` in `src/presentation/read-models/assetLibraryQueries.ts`, beside the
other six reads — that file is integrator-owned, and moving the member there is the only reason
this is a request rather than something done in this branch. The relocation, exactly:

1. `src/presentation/read-models/assetLibraryQueries.ts` — add
   `listPlansUsingAsset(assetId: AssetId): Promise<Result<AssetPlanUsage, RepositoryError>>` to
   `AssetLibraryQueryServices`, `listPlansUsingAsset: refuseUnrecovered` to
   `unavailableAssetLibraryQueries()`, and one delegating line in `createAssetLibraryQueries`.
2. `src/presentation/library/AssetLibraryDeps.ts` — delete the `listPlansUsingAsset` member and its
   refusal arm, and drop the `Query`/`AssetPlanUsage` imports it needs.
3. `src/presentation/library/AssetUsageScope.vue` — one call site:
   `context.commands.listPlansUsingAsset.execute(id)` becomes `context.queries.listPlansUsingAsset(id)`.
4. `tests/presentation/library/assetUsageDuplicate.test.ts` — the same member moves from the
   `commands` override to the `queries` one in `doors()` and in the refusal case.

**Two, and the second is optional.** `guardAssetDuplication` could be folded back into
`guardAssetLibrary`, which would need the `guardAssetLibrary(...)` call in
`src/plugin/composition-root.ts` (the `const assetLibrary = guardAssetLibrary({ assets, index,
geometry: assetGeometry, overrides }, logger, map)` line) to gain `projects`, `plans`,
`planGeometry: geometry`, `events: eventBus`, `locks` and `assetGeometry` in its ports object, and
`assetLibraryDeps.ts` to read the pair off `persistence` instead of composing them. Addressed by
name rather than by line number, per this repository's own rule about positions.

**Neither request is a blocker: this branch compiles and its suites pass without either.** Both
are worth doing while the reasoning is fresh rather than after the wave.

**Nothing else is requested.** In particular no shared test helper needed changing:
`defaultAssetLibraryDeps` builds its command bundle from `unavailableAssetLibraryCommands()`, which
is a leased file, so the two new members refuse by default everywhere and no existing fixture had
to learn about them.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.
