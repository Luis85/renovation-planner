# Improvement and Polish Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the verified findings of the 2026-09-05 whole-tree review — one high-severity defect (a second undo on one requirement is refused), eleven medium ones (a 0 ms debounce, an id-swap that trashes another plan's sidecar, a price input that drops focus, drafts discarded by Open note, an Add menu that steals focus, a settings save that swaps the session before the file is written, an unrecovered-write flag any success clears, and four more), the low ones that are one line each, and the documents whose claims outran their checks — on one branch, `claude/polish-pass-2026-09`, in nineteen tasks that each leave `npm run check` green.

**Architecture:** No new entity, no new schema key, no new vault write path, no new dependency. Every change stays inside the seam its finding names: the override adapters take the `WriteLedger` their siblings already take; `VaultChangeAdapter` and the two sidecar stores get the guard the asset store already has; the price section's store returns whether its read landed; `AddMenu` restores focus only when it still holds it; the plugin flushes and swaps in the order its own docblocks argue for. Seven decisions the code cannot make on its own are RULED in Task 0 and recorded in the ledger before any code task starts; a code task never silently flips one.

**Tech Stack:** TypeScript, Vue 3 + Pinia, Konva via vue-konva, Obsidian 1.13.0 API, decimal.js, vitest + jsdom + axe-core, playwright-core for captures, ESLint + oxlint + fallow.

**Spec:** [`../specs/2026-09-05-whole-tree-review-findings.md`](../specs/2026-09-05-whole-tree-review-findings.md) — every finding's id (A1, I6, V1, …), verdict, evidence and fix shape. This plan cites ids; the spec is the argument. Where the spec and this plan disagree, the spec's evidence wins and the plan is the bug. Then `CLAUDE.md` ("Claims, and the checks under them", "Testing", "Definition of done").

## Global Constraints

- **`npm run check` passes before every commit** (build + oxlint + ESLint + `test:coverage` + fallow), in the FOREGROUND with `timeout: 600000`, on a QUIET tree — nothing else running. Between edits run `npm run check:fast -- <test paths>`. Two known artifacts: a single 5000 ms timeout in a `src/`-walking test, and a 60 s `beforeAll` timeout in ESLint-booting `tests/build/*` files under default parallelism — re-run the file alone before believing either.
- **Baseline at `a1b3e3c4`:** 469 files / 6539 tests; coverage 99.33 / 98.20 / 99.18 / 99.62 (statements / branches / functions / lines) against floors 99 / 98 / 99 / 98. **Functions has about five units of headroom, branches about eleven.** Every new function and every new arm ships with the test that reaches it, in the same task. Read `coverage/coverage-final.json` for the changed files before calling a task done. A guard whose other arm no test can take is not free — restructure so the arm does not exist.
- **Layer bans are lint rules.** `presentation → application → domain → core`; `infrastructure → application (ports) → domain → core`; only `src/plugin/` composes. `vue`, `pinia`, `konva`, `obsidian` are banned by name in `core/`, `domain/`, `application/`.
- **No user-facing string literal.** Every new key lands in `src/presentation/i18n/locales/en.ts` AND `de.ts` in the same edit (editor keys in `en/editor.ts` AND `de/editor.ts`, which is a `Record<keyof typeof editorEn, string>`). German is formal (Sie). Sentence case in English; a capitalised word mid-sentence fails the build.
- **`aria-disabled`, never `:disabled`, on a PAUSED control**; a paused control stays focusable. `:disabled` is for a control that is not an option at all (`assetStatus !== 'known'`, Undo with nothing to undo).
- **`max-lines` is 400** (blank and comment lines skipped; TEMPLATE comments in an SFC are NOT skipped) for every `src/**` file and `styles/*.css` partial. `EditorSurface.vue` measures 387 and `runtime.ts` 368 — Tasks 10 and 13 MEASURE before they add and extract if needed.
- **A test is watched failing before the code that passes it.** Where a step says "mutation-check", apply the mutation, run the file, observe the red AT THE ASSERTION, revert, and record it in the task report.
- **Write files with Write/Edit, never PowerShell** (`Set-Content`/`Out-File` write a BOM). **Stage explicit paths**; never `git add -A` or `commit -a`.
- **Commit messages end with** `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Room, never Zone**, in every string a user reads on the Plan Editor surface.
- **Rulings go in the ledger** `.superpowers/sdd/2026-09-05-polish-pass/progress.md` as `Ruling: <what> — <why> — <cost if wrong>`. The seven below are pre-written; the executor copies them at setup and adds any the run produces.
- **Models:** `sonnet` for implementers and task reviewers; `opus` for Task 1, Task 2, Task 4, Task 7, Task 13 and the final whole-branch review; never `haiku`.

---

## Prerequisite gate (orchestrator, not a subagent)

```bash
git fetch origin && git checkout main && git pull
git log -1 --format=%H                                   # expect a1b3e3c4 or a descendant
git checkout -b claude/polish-pass-2026-09
mkdir -p .superpowers/sdd/2026-09-05-polish-pass
grep -n "ledger" src/presentation/editor/inspector-wiring.ts | head -3      # expect: a `ledger: SessionWriteLedger` parameter
grep -n "debounceMs" src/infrastructure/persistence/index/VaultChangeAdapter.ts   # expect: 2 lines (113, 119)
grep -c "declaredAssetOf" src/infrastructure/obsidian/repositories/AssetGeometryStore.ts   # expect: >= 2
grep -n "props.anchor?.focus()" src/presentation/editor/add/AddMenu.vue     # expect: 1 line, inside onBeforeUnmount
```

If any expectation fails, a task's premise has moved since the review; read the spec entry, re-measure, and record the difference in the ledger before starting that task.

## Triage

| Id | Finding (spec) | Sev | Task |
|---|---|---|---|
| A1 | Override adapters bypass the `WriteLedger`; second undo refused | high | T1 |
| A8 | `publishIfEffectiveCostChanged` compares money by string | low | T1 |
| I1 | Debounce is 0 ms in production | medium | T2 |
| I6 | Id swap inherits the displaced entity's sidecar | medium | T2 |
| I5 | `PlanGeometryStore.delete` has no declared-plan guard | medium | T2 |
| I8 | Asset sidecar hint read outside the queue | low | T2 |
| I2 | Marker file `null` crashes `readEnvelope` | low | T2 |
| G1, G10 | Adapter timer and outgoing subscriptions survive unload / swap | low | T3 |
| G4, G9, G7, G5, G6 | Bare `startPersistence`; layout-ready after unload; `onunload` logger; three stale sentences | low | T3 |
| G3, N3, N4 | Settings save swaps before writing; failure silent; wrong migration message | medium | T4 |
| G8 | Three vault scans per library move | low | T4 |
| G2 | Per-root `ReferenceLocks`/queues across a swap | medium | T4 (R7) |
| A3, A5 | Compensation leaves the marker; recovery write unguarded | medium | T5 |
| A7 | Optional `markers`, `ResolutionOps.notify`, `CascadeDeps.notify` | medium | T5 |
| A4 | Reassign arm publishes before `deleteEntity` | low–med | T5 (R3) |
| A12, A9, A10 | `cause: undefined`; calibrate fan-out; conditional asset lock | low | T5 |
| A2 | Four published events nobody hears | medium | T6 |
| A6 | Nine error codes with no message | medium | T7 |
| V4, V8, P11, P5 | Detail store and state: stale unreadable count, superseded read, prices loaded in details, stale docblocks | medium | T8 |
| V1, P1, P7, P10 | Price row: `:disabled` while pending; 2 dp regex; German comma; orphaned docblocks | medium | T9 (R2) |
| P3, P12, V3, P2, P6 | Detail navigation: Open note discards drafts; mobile empty state; palette on mobile; history flag; stale test docblock | medium | T10 (R4) |
| E1, E2, E5, E10, E11 | Add menu focus steal; designer cursors; nested landmarks; Shift docblock | medium | T11 |
| E3 | Any success clears `unrecoveredWrite` | medium | T12 (R1) |
| E4 | Fragment-rooted `ZoneShape`; paint order is mount order | medium | T13 |
| E8 | No keyboard path moves a zone | medium | T14 |
| E7, E9, V5, V10, C11, C12 | Dead transformer code; designer sketch clone; unreachable guard; prototype key; four negative-money copies; fixture-asserting test | low | T15 (R5) |
| C1–C7, C9, C10, new | Core hardening: non-finite arithmetic, facing fold, `-0`, aliasing, docblocks, `definitionChanges` | low | T16 |
| I3, I4, V7 | Fixture vault `offref`; fake mutators fire no events; five dialogs never axe-scanned | low–med | T17 |
| X7, X8, X9 | Two undeclared classes; the one float on money | low | T18 |
| X1–X6, X10, E6, P9, V6, I11, N-docs | Records | low | T19 |
| I7 | Folder rename never reaches the index | medium | **Not now** (R6) |
| P8, V2 | Mobile read-only scope | — | Not now — owned by the Active PBI |

## Rulings (pre-written; copied into the ledger at setup)

- **R1 — the unrecovered-write flag is STICKY for the leaf's life.** `resolveOk` stops clearing it. Why: the only in-session event that repairs a half-written vault is a successful retry of the SAME delete resolution over the SAME rows, and the dispatch wrapper cannot see either fact; a stale warning is cheaper than a false all-clear, which is the defect. Cost if wrong: a user who repaired the vault by hand sees the warning until the leaf is reopened. Deferred: clearing on a successful delete-resolution dispatch, once `withSaveStateTracking` can identify one.
- **R2 — a price input in flight is `readonly` + `aria-disabled`, not `:disabled`.** Keep `:disabled` for `assetStatus !== 'known'` (not an option) and for `refreshBlocked` (a paused surface, but the trust-path rule says paused controls stay focusable — so `refreshBlocked` moves to `aria-disabled` too). Why: CLAUDE.md's paused-control rule; `RequirementRow.vue:331-378` is the house shape. Cost if wrong: a keystroke during a write is ignored by `onPriceInput`'s existing `pending` guard, which is already the behaviour.
- **R3 — the reassign arm's inline recalculation keeps publishing; the `AppliedStep` docblock is narrowed to say so.** Why: deferring the recalculation past `deleteEntity` changes what a failed delete compensates and needs its own design; the composite harm with A2 disappears once T6 subscribes the correction events. Cost if wrong: a peer leaf shows an intermediate repoint for the length of one failed delete.
- **R4 — the `new-project` palette command uses `checkCallback` and answers `false` on `Platform.isMobile`.** Why: a command the palette hides is honest; a notice on a command that then does nothing is a second surface for one fact. Cost if wrong: none on desktop; on mobile the command is absent rather than inert.
- **R5 — `normalizeTransformerResult`, `snapToGrid` and `snapResize` are DELETED with their tests.** Why: no `src/` caller, no `VTransformer` anywhere, and the identity-today fact is already recorded; code kept green only by its own test is the cost CLAUDE.md names. `snapRotation`, `snapPoint`, `snapDirection` stay (four tool callers). Cost if wrong: a future transformer re-derives ~60 lines from git history.
- **R6 — folder rename (I7) is OUT of this pass.** Why: it is recorded pre-existing, has a manual case that names the reload, and the remedy (`Vault.recurseChildren` on the `TFolder` arm) needs its own test fixture for a folder event. Cost if wrong: the largest live index gap waits one more increment. It gets an issue note in T19.
- **R7 — `ReferenceLocks` becomes a session collaborator; repository `KeyedQueues` stay per root and their docblocks say "per root".** Why: the lock set has no settings dependency and `markerStore`/`continueStore` set the precedent; a repository depends on the folder settings and must be rebuilt. Cost if wrong: a write in flight across a settings save can still meet a fresh queue — recorded in the docblock as the window it is.

## File Structure

Modified (by task): T1 `reversible-override-commands.ts`, `SetRequirementQuantityOverride.ts`, `inspector-wiring.ts`, four tests. T2 `VaultChangeAdapter.ts`, `PlanGeometryStore.ts`, `ObsidianAssetRepository.ts`, `SequenceMarkerFileStore.ts`, three tests. T3–T4 `RenovationPlannerPlugin.ts`, `composition-root.ts`, `repositoryComposition.ts`, `libraryMigration.ts`, `SettingsTab.ts`, four tests. T5 `deleteResolution.ts`, `recoverInterruptedSequences.ts`, `DeleteZone.ts`, `DeleteAsset.ts`, `cascade.ts`, `errors.ts`, `ReversibleCalibratePlan.ts`, `UpdateAsset.ts`, five tests. T6 `requirementFiguresChangeSource.ts` plus one zone-list source. T7 `en.ts`, `de.ts`, `toUserMessage.test.ts`. T8 `ProjectDetailStore.ts`, `ProjectDetailState.vue`, `ProjectDetail.vue`. T9 `AssetPriceRow.vue`, `de.ts`, `strings.test.ts`, `assetPriceList.test.ts`. T10 `ProjectDetailState.vue`, `ProjectDetail.vue`, `RenovationProjectView.ts`, `RenovationPlannerPlugin.ts`, one manual case. T11 `AddMenu.vue`, `EditorSurface.vue`, `EditorContextBar.vue`. T12 `save-state-store.ts`, `saveStateStore.test.ts`. T13 `ZoneShape.vue` + a new ordering test. T14 `runtime.ts`, `EditorSurface.vue`, `registerEditorTools.ts` + a new test. T15 deletes two modules; extracts `DesignerSketch.vue`; `notify.ts`; `route-error.ts`; `core/money`. T16 `operations.ts`, `costPipeline.ts`, `quantityEngine.ts`, `AssetShape.ts`, `Asset.ts`, `Zone.ts`, `Project.ts`, `definitionDraft.ts`. T17 `fixtureVault.ts`, `vault.ts`, `accessibility.test.ts`. T18 `forms.css`, `designer.css`, `libraryComponentStyles.test.ts`. T19 docs and CLAUDE.md.

Created: `tests/presentation/editor/layers/zoneLayerOrder.test.ts` (T13), `tests/presentation/editor/keyboardNudge.test.ts` (T14), `src/presentation/editor/layers/GestureSketch.vue` (T15), `docs/issues/A folder rename never reaches the project index.md` (T19), `docs/tests/cases/Back arrow over a dirty price draft.md` (T10).

---

### Task 0: rulings into the ledger

**Files:**
- Create: `.superpowers/sdd/2026-09-05-polish-pass/progress.md`

- [ ] **Step 1: Write the ledger** with the seven rulings above verbatim, one per line, prefixed `Ruling:`, followed by a `## Log` heading.
- [ ] **Step 2: Commit**

```bash
git add .superpowers/sdd/2026-09-05-polish-pass/progress.md
git commit -m "chore(polish): open the ledger with the seven pre-written rulings"
```

---

### Task 1: override undo through the `WriteLedger` — `opus`

Closes A1 and A8. The two override adapters become the fourth and fifth adapters to take the history's ledger, exactly as `ReversibleCreateZoneCommand` does.

**Files:**
- Modify: `src/application/commands/requirement/reversible-override-commands.ts`
- Modify: `src/application/commands/requirement/SetRequirementQuantityOverride.ts:142`
- Modify: `src/presentation/editor/inspector-wiring.ts:136-152`
- Test: `tests/application/commands/requirement/overrides.test.ts`, `reversibleOverrides.test.ts`, `reversibleRefusals.test.ts`, `tests/application/events/reversibleWritePathCensus.test.ts`

**Interfaces:**
- Consumes: `WriteLedger` (`src/application/editor/WriteLedger.ts`): `lastWritten`, `record`, `generation`, `observe`; `undoSuperseded(id)`.
- Produces: both adapter constructors gain a fourth parameter `ledger: WriteLedger`.

- [ ] **Step 1: Write the failing test** in `overrides.test.ts`, beside the two-adapter case at line 97:

```ts
it('two adapters on one requirement undo in order through the shared ledger', async () => {
	const w = await withRequirement();
	const ledger = new SessionWriteLedger();
	const quantityPlain = new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks);
	const costPlain = new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks);
	const a = new ReversibleSetRequirementQuantityOverrideCommand(quantityPlain, w.requirements, w.events, ledger);
	const b = new ReversibleSetRequirementCostOverrideCommand(costPlain, w.requirements, w.events, ledger);

	expectOk(await a.execute({ requirementId: w.requirementId, quantity: 12 }));
	expectOk(await b.execute({ requirementId: w.requirementId, cost: moneyOf('550.00', 'EUR') }));

	expectOk(await b.undo());
	// The second undo used to refuse with `requirement.revision-conflict`: adapter A presented
	// the version ITS write produced, two writes ago.
	expectOk(await a.undo());
	const restored = expectOk(await w.requirements.getById(w.requirementId));
	expect(restored?.entity.quantity.override ?? null).toBeNull();
	expect(restored?.entity.estimatedCost.override ?? null).toBeNull();
});
```

Import `SessionWriteLedger` from `../../../../src/application/editor/WriteLedger`.

- [ ] **Step 2: Run it** — `npm run check:fast -- tests/application/commands/requirement/overrides.test.ts`. Expected: a compile error on the fourth constructor argument (vitest transpiles without checking, so the runtime symptom is the second `expectOk` failing with `requirement.revision-conflict`). Record which.

- [ ] **Step 3: Implement** in `reversible-override-commands.ts`:

```ts
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
// …
abstract class ReversibleOverrideBase<TInput> {
	protected snapshot: Snapshot | undefined;
	/** The ledger generation this gesture last ran under — see `ReversibleCreateZoneCommand.generation`. */
	private generation: number | null = null;

	constructor(
		private readonly requirements: RequirementRepository,
		private readonly events: EventBus,
		private readonly ledger: WriteLedger,
	) {}

	async execute(input: TInput): Promise<DispatchResult> {
		const id = this.requirementIdOf(input);
		if (!this.snapshot) {
			const before = await this.requirements.getById(id);
			if (isErr(before)) return err(before.error);
			if (before.value === null) {
				return err({ category: 'Reference', code: 'requirement.not-found', message: 'Nothing to override.' });
			}
			// What this history last wrote against what this read just found: a difference is a
			// foreign write, and the generation moves (`WriteLedger.observe`).
			this.generation = this.ledger.observe(id, before.value.version);
			const ran = await this.run(input);
			if (!ran.ok) return ran;
			this.ledger.record(id, ran.value.version);
			this.snapshot = {
				entity: before.value.entity,
				postVersion: ran.value.version,
				writtenEffectiveCost: effectiveValue(ran.value.requirement.estimatedCost),
			};
			return ok('wrote');
		}
		const ran = await this.run(input);
		if (!ran.ok) return ran;
		this.ledger.record(id, ran.value.version);
		this.generation = this.ledger.generation(id);
		this.snapshot = {
			...this.snapshot,
			postVersion: ran.value.version,
			writtenEffectiveCost: effectiveValue(ran.value.requirement.estimatedCost),
		};
		return ok('wrote');
	}

	async undo(): Promise<DispatchResult> {
		const captured = this.snapshot;
		if (!captured) {
			return err({ category: 'Domain', code: 'undo.before-execute', message: 'Nothing to undo yet.' });
		}
		const id = captured.entity.id;
		if (this.generation !== null && this.ledger.generation(id) !== this.generation) {
			return err(undoSuperseded(id));
		}
		// The expectation is the HISTORY's, not this adapter's (`WriteLedger`'s first paragraph).
		const expected = this.ledger.lastWritten(id) ?? captured.postVersion;
		const saved = await this.requirements.save(captured.entity, expected);
		if (isErr(saved)) return err(saved.error);
		this.ledger.record(id, saved.value.version);
		this.snapshot = { ...captured, postVersion: saved.value.version };
		await publishIfEffectiveCostChanged(this.events, saved.value.entity, captured.writtenEffectiveCost);
		return ok('wrote');
	}
	// …
}
```

Both subclasses take `ledger: WriteLedger` as their fourth constructor parameter and pass it to `super`. Rewrite the class docblock's "presents the version its own execute() produced" sentence to name the ledger. In `inspector-wiring.ts` pass the `ledger` parameter that function already receives (line 71) as the fourth argument at both `new Reversible…` sites.

- [ ] **Step 4: A8** — in `SetRequirementQuantityOverride.ts:142` replace the two string compares with `if (sameMoney(previous, current)) return;` (import from `core/money/Money`). Add to `reversibleOverrides.test.ts`, beside "announces nothing when an undo restores the identical figure": a case that overrides the cost to `'19.5'` over a calculated `'19.50'` and asserts no `CostEstimateChanged` was published.

- [ ] **Step 5: Update the other tests** — every `new ReversibleSet…OverrideCommand(…)` in the four test files gains `new SessionWriteLedger()` (or a shared one where a case builds two adapters). Run: `npm run check:fast -- tests/application/commands/requirement tests/application/events/reversibleWritePathCensus.test.ts tests/presentation/editor`. Expected: all green, the new case included.

- [ ] **Step 6: Mutation-check** — revert `expected` to `captured.postVersion`, run `overrides.test.ts`, watch the new case go red at the second `expectOk`, restore.

- [ ] **Step 7: `npm run check`, then commit**

```bash
git add src/application/commands/requirement/reversible-override-commands.ts src/application/commands/requirement/SetRequirementQuantityOverride.ts src/presentation/editor/inspector-wiring.ts tests/application/commands/requirement tests/application/events/reversibleWritePathCensus.test.ts
git commit -m "fix(undo): the override adapters present the history's version, not their own"
```

---

### Task 2: the index adapter and the sidecar stores — `opus`

Closes I1, I6, I5, I8, I2.

**Files:**
- Modify: `src/infrastructure/persistence/index/VaultChangeAdapter.ts:113-120,235`
- Modify: `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts:75-89`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianAssetRepository.ts:107`
- Modify: `src/infrastructure/obsidian/plugin-data/SequenceMarkerFileStore.ts:90-91`
- Test: `tests/infrastructure/persistence/index/branches.test.ts:115-136`, `tests/infrastructure/persistence/index/pipeline.test.ts`, `tests/infrastructure/obsidian/repositories/planGeometryStore.test.ts` (or the file that drives `PlanGeometryStore.delete` — find with `grep -rln "PlanGeometryStore" tests/`), `tests/infrastructure/obsidian/plugin-data/sequenceMarkerFileStore.test.ts`

- [ ] **Step 1 (I1): failing test.** In `branches.test.ts` add, beside "loses its index entry when its type changes":

```ts
it('debounces for 500 ms when no debounceMs is configured', async () => {
	const armed: number[] = [];
	vi.stubGlobal('window', {
		setTimeout: (fn: () => void, ms?: number) => { armed.push(ms ?? -1); return setTimeout(fn, 0); },
		clearTimeout,
	});
	try {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		const adapter = adapterOf(stack);
		adapter.onModify(stack.vault.getAbstractFileByPath(stack.index.getPath(projectId) ?? '') as never);
		expect(armed).toEqual([500]);
	} finally {
		vi.unstubAllGlobals();
	}
});
```

Run it; expected red: `armed` is `[-1]`.

- [ ] **Step 2 (I1): implement** in `enqueue`:

```ts
const delay = this.deps.debounceMs ?? 500;
if (delay <= 0) { this.processPath(path); return; }
this.pending.add(path);
if (this.timer === null) this.timer = window.setTimeout(() => this.flush(), delay);
```

The existing case at line 115 waited 10 ms for a 0 ms timer; change it to call `adapter.flush()` instead of sleeping. Run the file; green.

- [ ] **Step 3 (I6): failing test.** In `pipeline.test.ts` (the file with the same-id sidecar-preservation case — find it with `grep -n "geometrySidecarPath" tests/infrastructure/persistence/index/*.test.ts`), add an id-swap case: seed a plan A with a sidecar mapping, rewrite the note's `id` frontmatter to `B`, drive `onModify`, `flush()`, then assert `index.getGeometrySidecarPath('B')` is `undefined` (B has no sidecar) and `getGeometrySidecarPath('A')` is `undefined` (A is gone). Expected red: B answers A's path.

- [ ] **Step 4 (I6): implement** at line 235:

```ts
geometrySidecarPath:
	(existing?.id === ref.id ? existing.geometrySidecarPath : undefined)
	?? this.deps.index.getGeometrySidecarPath(ref.id as ProjectIndexEntry['id']),
```

Reword the comment above it: the preservation is for the SAME id; a displaced entity's mapping does not travel to its successor.

- [ ] **Step 5 (I5): failing test.** In the plan-geometry store test, seed a sidecar whose body declares `planId: 'A'` at the path the index maps for `'B'`; call `store.delete('B')`; assert `err` with code `plan-geometry.plan-id-mismatch` and that the file still exists. Expected red: `ok` and the file is trashed.

- [ ] **Step 6 (I5): implement** — copy `AssetGeometryStore.declaredAssetOf` as a private `declaredPlanOf(file)` using `PlanGeometrySchemaV1` and `.planId`; in `delete`, after the `instanceof TFile` check:

```ts
const claimed = await this.declaredPlanOf(file);
if (claimed !== null && claimed !== planId) {
	return err(persistenceError('plan-geometry.plan-id-mismatch', `Sidecar ${path} declares plan ${claimed}, not ${planId}. It was not deleted.`));
}
```

`null` (unparseable or empty — the insert-rollback case) stays deletable, as in the asset store.

- [ ] **Step 7 (I8):** move `const sidecarPath = this.deps.index.getGeometrySidecarPath(id);` in `ObsidianAssetRepository.delete` INSIDE the `queues.run` closure, first line. Rewrite the comment above it: it now matches `ObsidianPlanRepository.delete:293`, which it claimed to match already. The existing delete tests stay green; no new arm.

- [ ] **Step 8 (I2): failing test** — a marker file whose body is the four bytes `null`; `store.list()` must answer `err` with `sequence.marker-unreadable`, not reject. Expected red: rejects with a TypeError.

- [ ] **Step 9 (I2): implement** — move the `const markers = …` line BELOW the `typeof raw !== 'object' || raw === null` test and split the condition:

```ts
if (typeof raw !== 'object' || raw === null) return err(persistenceError('sequence.marker-unreadable', 'The sequence marker file has an unreadable shape.'));
const markers = (raw as { markers?: Record<string, unknown> }).markers;
if (typeof markers !== 'object' || markers === null) return err(persistenceError('sequence.marker-unreadable', 'The sequence marker file has an unreadable shape.'));
```

- [ ] **Step 10:** `npm run check`; commit

```bash
git add src/infrastructure/persistence/index/VaultChangeAdapter.ts src/infrastructure/obsidian/repositories/PlanGeometryStore.ts src/infrastructure/obsidian/repositories/ObsidianAssetRepository.ts src/infrastructure/obsidian/plugin-data/SequenceMarkerFileStore.ts tests/infrastructure
git commit -m "fix(index): the debounce is 500 ms, an id swap keeps no stranger's sidecar, and a plan delete checks the declared plan"
```

---

### Task 3: the plugin's two boundaries in time — unload and the root swap

Closes G1, G10, G4, G9, G7, G5, G6.

**Files:**
- Modify: `src/plugin/RenovationPlannerPlugin.ts` (`onload` disposers, `applySettings`, `startPersistence`, `onunload`, three sentences)
- Modify: `src/plugin/composition-root.ts:243-248`
- Test: `tests/plugin/registration.test.ts` ("what onunload disposes"), `tests/plugin/rootSwapRebind.test.ts`

- [ ] **Step 1 (G1): failing test** in "what onunload disposes":

```ts
it('flushes the change adapter, so no timer fires into a retired root', async () => {
	const { plugin: loaded } = await loadedPlugin(DEFAULT_SETTINGS);
	const adapter = loaded.root.persistence?.changeAdapter as { flush: () => void };
	const flush = vi.spyOn(adapter, 'flush');
	loaded.onunload();
	expect(flush).toHaveBeenCalledTimes(1);
});
```

(`root` may need the same `as unknown as` reach the sibling case uses for `disposers`.) Red: 0 calls.

- [ ] **Step 2 (G1 + G10): implement.** Extract the cascade disposer into a private method and add the flush:

```ts
private disposeCascade(): void {
	this.root.persistence?.changeAdapter.flush();
	for (const subscription of this.root.persistence?.subscriptions ?? []) subscription.dispose();
}
```

In `onload` push `() => this.disposeCascade()` where the inline loop was. In `applySettings`, call `this.disposeCascade()` FIRST, before `createCompositionRoot`, under a comment: the outgoing root's pending flush and cascade subscriptions must not run against a bus nothing will consult (G10; the timer is the one publisher that could).

- [ ] **Step 3 (G4 + G9): implement** in `startPersistence`, first lines:

```ts
if (!this._loaded) return; // layout-ready after a disable: nothing to scan for (G9)
try { … existing body … } catch (cause) {
	this.root.logger.error('plugin.index.rebuild-failed', { cause });
	notifyFault(cause, this.root.logger, 'plugin.index.rebuild-failed');
	return;
}
```

Check that `_loaded` is what `Component` exposes in `obsidian.d.ts` (it is `_loaded: boolean` on `Component`); if the pinned typings name it differently, use that name and record it. Add a case to `registration.test.ts`: a `buildProjectIndexEntries` that throws (stub the metadata cache to throw) leaves the plugin loaded, logs the event, and a second `startPersistence()` still registers the listeners once. Add a locale row for the fault event only if `notifyFault` requires a key — read `notifyFault`'s signature; it takes an `event` string for the log, not a locale key.

- [ ] **Step 4 (G7):** `onunload`'s catch: `(this.root?.logger ?? this.logger).error(...)`. Add a variant of "logs a failing disposer" that constructs the plugin, pushes a throwing disposer BEFORE `onload` completes (or nulls `root`), and asserts `onunload` does not throw.

- [ ] **Step 5 (G5 + G6): three sentences and one paragraph.** In `RenovationPlannerPlugin.ts`: the comment above the cascade push becomes "The cascade handlers and the adapter's pending flush are retired together, last in push order — the drain loop is synchronous, so nothing can land between disposers"; `onunload`'s docblock loses "of which there is exactly one step today"; the class docblock's "flush pending writes" becomes "flushes the change adapter; settings writes are awaited by their own callers". In `composition-root.ts:243-248` rewrite from a grep: `createProject` is dispatched by `ViewRoot.vue` (New project) and `sampleProject.ts`; `createPlan` by `ProjectDetailState.vue` (New plan) and `sampleProject.ts`.

- [ ] **Step 6:** `npm run check:fast -- tests/plugin`, then `npm run check`; commit

```bash
git add src/plugin/RenovationPlannerPlugin.ts src/plugin/composition-root.ts tests/plugin
git commit -m "fix(plugin): flush and dispose the outgoing root, guard the rebuild, and correct three sentences"
```

---

### Task 4: the settings write — order, failure, and one rebuild

Closes G3, N3, N4, G8, G2 (per R7).

**Files:**
- Modify: `src/plugin/RenovationPlannerPlugin.ts` (`saveSettings`, `applySettings`, `rebuildProjectIndex`, the session collaborators)
- Modify: `src/plugin/composition-root.ts` (`composeSlice10Wiring` takes `locks`), `src/plugin/repositoryComposition.ts` (docblock only)
- Modify: `src/plugin/settings/libraryMigration.ts:279-300`
- Test: `tests/plugin/settings/settings.test.ts`, `tests/plugin/settings/libraryMigration.test.ts:91`, `tests/plugin/rootSwapRebind.test.ts`

- [ ] **Step 1 (G3/N3): failing test** — `saveSettings({ units: 'imperial' })` with a `saveData` that rejects: assert the root's settings are UNCHANGED (still metric), a `logger.error('settings.save-failed', …)` line, and one notice. Red: settings flipped, no log, no notice.

- [ ] **Step 2: implement** `saveSettings`:

```ts
saveSettings(patch: SettingsPatch): Promise<void> {
	return this.queueSettingsWrite(async () => {
		const current = this.root.settings;
		if (current === null) return;
		const composed = settingsFrom({ ...current, ...patch, libraryFolder: current.libraryFolder });
		// WRITE, then swap — `persistLibraryFolder`'s own argument, which holds for every
		// setting that names a folder: a session running on a value the file does not hold
		// creates notes under a root the next start will not know about.
		try {
			await this.saveData(composed);
		} catch (cause) {
			notifyFault(cause, this.root.logger, 'settings.save-failed');
			return;
		}
		this.applySettings(composed);
	});
}
```

Read `persistLibraryFolder` (`:471-499`) and confirm its order is already save-then-apply; if it is, both doors now agree and its docblock's "what differs is which side" sentence is rewritten to say they agree.

- [ ] **Step 3 (G8): implement** — `applySettings(next, options: { rebuild: boolean } = { rebuild: true })`; `persistLibraryFolder` passes `{ rebuild: false }` since the migration's step 5 just rebuilt. Update `libraryMigration.test.ts:91`'s expected order array (one fewer rebuild). Delete the migration's step-0 rebuild only if its own comment gives no reason for it — read it; if it does, keep it and record why in the ledger.

- [ ] **Step 4 (N4):** in `libraryMigration.ts:292-300`, split the catch: a failure from `persist` before `saveData` resolved reports `settings.library-persist-failed`; a throw from `applySettings` after a successful write reports a NEW code `settings.library-apply-failed` ("The setting was saved; the session could not switch to it. Reload Obsidian.") — add both locale rows. If `persist` cannot distinguish the two arms as written, make `persistLibraryFolder` return which arm failed.

- [ ] **Step 5 (G2, R7):** add `private referenceLocks: ReferenceLocks | null = null;` beside `markerStore` with the same memoising accessor; pass it into `createCompositionRoot`'s session-collaborators bundle (where `ledger` and `markers` already travel) and have `composeSlice10Wiring` take it instead of `new ReferenceLocks()`. Narrow the three docblocks (`composition-root.ts:206,:310-312`; `ObsidianRequirementRepository.ts:36-48`) — the lock set is per SESSION; the repository queues are per ROOT, and a settings save while a write is in flight opens an empty lane for that entity (the recorded window). Add to `rootSwapRebind.test.ts`: the `locks` instance is identical across `applySettings`.

- [ ] **Step 6:** `npm run check`; commit

```bash
git add src/plugin tests/plugin src/presentation/i18n/locales/en.ts src/presentation/i18n/locales/de.ts
git commit -m "fix(settings): write before swapping, say so when the write fails, rebuild once, and share one lock set per session"
```

---

### Task 5: delete-resolution recovery — the marker, the write, and the optional collaborators — `opus`

Closes A3, A5, A7, A4 (per R3), A12, A9, A10.

**Files:**
- Modify: `src/application/reference/deleteResolution.ts` (`compensate` signature, `ResolutionOps.notify`, `runDeleteResolution` `markers`, the `AppliedStep` docblock)
- Modify: `src/application/reference/recoverInterruptedSequences.ts:78,:143`
- Modify: `src/application/commands/zone/DeleteZone.ts:50`, `src/application/commands/asset/DeleteAsset.ts:46`, `src/application/events/cascade.ts:23`, `src/plugin/composition-root.ts:269,287,307`, `src/plugin/RenovationPlannerPlugin.ts:783`
- Modify: `src/application/errors.ts:31`, `src/application/commands/plan/ReversibleCalibratePlan.ts:252`, `src/application/commands/asset/UpdateAsset.ts:79`
- Test: `tests/application/reference/recovery.test.ts`, `deleteResolutionEngine.test.ts`, `tests/application/commands/{zone,asset}/*.test.ts` (constructor/deps arity), `tests/application/errors.test.ts`, `tests/application/commands/plan/reversibleCalibratePlan.test.ts`
- Create (if absent): `tests/helpers/noopMarkers.ts` — a `SequenceMarkerStore` whose four methods answer `ok`

- [ ] **Step 1 (A3): failing test** in `deleteResolutionEngine.test.ts`'s `compensation` block: after a `delete-anyway` whose second referent refuses and whose compensation fully succeeds, assert `markers.list()` is empty. Red: one marker with `entityDeleted: false`.

- [ ] **Step 2 (A3): implement** — `compensate(ops, marker, cause, markers)`; after the loop:

```ts
if (!uncompensated) {
	const cleared = await clearMarker(markers, ops.entityId);
	if (isErr(cleared)) ops.logger.error('sequence.marker-clear.failed', { entityId: ops.entityId, entityKind: ops.entityKind, cause: cleared.error });
}
return err(uncompensated ? markUncompensated(cause) : cause);
```

An UNcompensated sequence keeps its marker on purpose — that is what the next load recovers.

- [ ] **Step 3 (A5): failing test** in `recovery.test.ts`: two markers; the first's `requirements.save` REJECTS (not refuses); assert the second marker is restored and both are cleared. Red: the second is untouched.

- [ ] **Step 4 (A5): implement** — wrap the save and the clear the way the read is:

```ts
const saved = await deps.requirements.save(snapshot.entity, expected)
	.catch((cause: unknown) => err(persistenceError('sequence.recovery.restore-faulted', 'The restore write faulted.', cause)));
// … and at :143
const cleared = await deps.markers.clear(marker.entityId)
	.catch((cause: unknown) => err(persistenceError('sequence.recovery.clear-faulted', 'The marker could not be cleared.', cause)));
```

- [ ] **Step 5 (A7): make three collaborators required.** `runDeleteResolution(ops, input, locks, markers: SequenceMarkerStore)`; `DeleteZoneDeps.markers` and `DeleteAssetDeps.markers` required; `ResolutionOps.notify` and `CascadeDeps.notify` required; composition root passes what it has (it always has all three); `RenovationPlannerPlugin.ts:783` loses its `if`. Tests pass `noopMarkers()` and a no-op notify from `tests/helpers/`. Quote `AssetPriceOverrideRepository.ts:103-106` in the commit body. Expect compile errors to lead you to every call site — that is the point.

- [ ] **Step 6 (A4, R3):** rewrite the `AppliedStep` docblock at `deleteResolution.ts:321-323`: announcements are collected, EXCEPT the reassign arm's inline recalculation, which publishes from inside its own save and is corrected by `RequirementRestored` on compensation (subscribed since T6). Record the deferral in the ledger.

- [ ] **Step 7 (A12, A9, A10):** `calculationError` spreads `cause` as `persistenceError` does (one test asserting `'cause' in error === false`); `ReversibleCalibratePlan.announce` publishes with `for (const id of objectIds) await publish(id)` and its `:235-238` comment is rewritten (the cascade bounds itself; the fan-out multiplied the bound); `UpdateAsset` acquires `[current.id]` unconditionally and the ternary goes.

- [ ] **Step 8:** `npm run check`; commit

```bash
git add src/application src/plugin tests/application tests/helpers
git commit -m "fix(reference): compensation clears its marker, recovery survives a faulting write, and the recovery collaborators are required"
```

---

### Task 6: the events nobody heard

Closes A2. Depends on T5's R3 note.

**Files:**
- Modify: `src/application/events/requirementFiguresChangeSource.ts`
- Modify: the source that refreshes a zone's requirement LIST — find it: `grep -rn "subscribeAll(" src/application/events/*.ts` and pick the one whose consumer re-runs `GetRequirementsForZone` (expected: the Inspector's zone-level source in `runtime.ts`'s subscriptions, or `planChangeSource.ts`); record which in the ledger
- Test: `tests/application/events/requirementFiguresChangeSource.test.ts` and the sibling for the list source

- [ ] **Step 1: failing test** — publish `costEstimateChanged({ scope: { kind: 'requirement', id: 'r1' }, … })` and assert the figures listener is called with `'r1'`. Red: never called.
- [ ] **Step 2: implement** — `REQUIREMENT_FIGURE_EVENTS = ['RequirementInvalidated', 'RequirementRecalculated', 'CostEstimateChanged']`; `requirementIdOf` reads `payload.requirementId` OR `payload.scope.id` when `payload.scope.kind === 'requirement'`. Extend the docblock: THREE events, and why the override path publishes only the third.
- [ ] **Step 3: failing test** for the list source — publish `requirementRestored({ requirementId, projectId })` and assert the zone-list listener fires. Red.
- [ ] **Step 4: implement** — add `RequirementCreated`, `RequirementDeleted`, `RequirementRestored` to that source's list; the consumer already re-reads the whole list.
- [ ] **Step 5: extend `tests/application/events/reversibleWritePathCensus.test.ts`** (or a new sibling) with the joint assertion the spec names: every event type published under `src/domain/*/*.events.ts` appears in at least one `*_EVENTS` list under `src/application/events/`. Name the deliberate exceptions in a table if any remain.
- [ ] **Step 6:** `npm run check`; commit `fix(events): the override and lifecycle events reach a subscriber`.

---

### Task 7: nine refusals get their sentence

Closes A6.

**Files:**
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Modify: `tests/presentation/i18n/toUserMessage.test.ts:117` (scope)

- [ ] **Step 1: failing test** — widen the per-kind scan's root from `src/infrastructure/` to `src/application/` and add a second case: every `code: '<literal>'` minted under `src/application/` resolves to something other than its category sentence, with a named exclusion table for codes that are deliberately generic. Red: nine codes.
- [ ] **Step 2: add the rows** (English; German formal, same order):

```ts
'reference.reassign-target-gone': 'The entry you chose to reassign to is no longer there. Pick another.',
'reference.entity-gone': 'This entry was removed while you were deciding.',
'reference.resolution-without-set': 'Nothing references this any more; delete it directly.',
'reference.reassign-without-target': 'Choose where these references should go.',
'requirement.not-found': 'That requirement is no longer there.',
'requirement.zone-gone': 'The room this requirement belongs to is no longer there.',
'requirement.asset-gone': 'The asset this requirement uses is no longer in the library.',
'zone.nothing-to-undo': 'Nothing to undo yet.',
'undo.before-execute': 'Nothing to undo yet.',
```

- [ ] **Step 3:** `npm run check:fast -- tests/presentation/i18n`; `npm run check`; commit `feat(i18n): the nine application refusals that fell to a category sentence`.

---

### Task 8: the detail store and state — `opus`

Closes V4, V8, P11, P5 and the `:108` docblock.

**Files:**
- Modify: `src/presentation/stores/ProjectDetailStore.ts` (`createPriceSection.hydrate` return, `hydrate`'s `isErr(listed)` arm, two docblocks)
- Modify: `src/presentation/views/ProjectDetailState.vue` (`hydratePrices`, `writeAssetPrice`, `onMounted`, the two price subscriptions)
- Test: `tests/presentation/views/viewRootProjectDetail.test.ts`, `tests/presentation/views/projectPriceSection.test.ts:391`

- [ ] **Step 1 (V4): failing test** — hydrate a project whose listing succeeds with `unreadable: 2`, then re-hydrate with a listing that returns `err`; assert the failure notice renders AND no "2 plans could not be read" paragraph. Red: both render.
- [ ] **Step 2 (V4): implement** — in the `isErr(listed)` arm: `plans.value = []; unreadablePlans.value = 0;` before `plansError.value = listed.error`. The `:108` docblock's "three places" becomes "every place `plans` is written, the failed listing included".
- [ ] **Step 3 (V8): failing test** in `projectPriceSection.test.ts` beside "reports a saved write separately from refresh failure": the write's own refresh is superseded by a later read that fails; assert the copy is `view.project.price-saved-refresh-failed` only if the WRITE's read failed — construct it so the write's read succeeds and the later one fails, and assert the plain read-failure sentence. Red: `savedRefreshFailed` is set from the later read.
- [ ] **Step 4 (V8): implement** — `createPriceSection.hydrate` returns `Promise<'landed' | 'superseded'>` (`'superseded'` on the ticket miss, `'landed'` otherwise). In the state:

```ts
async function hydratePrices(): Promise<'landed' | 'superseded'> {
	if (disposed) return 'superseded';
	refreshRequested = false;
	const outcome = await detail.hydratePrices(context.queries, props.projectId);
	if (disposed || outcome === 'superseded') return 'superseded';
	pricesLoading.value = false;
	if (assetPricesError.value === null) savedRefreshFailed.value = false;
	return 'landed';
}
```

In both arms of `writeAssetPrice`: `if ((await hydratePrices()) === 'landed') savedRefreshFailed.value = assetPricesError.value !== null;`. The direct call stays direct (the write must await ITS read) — say so in a comment, and say why it is outside `singleFlight` on purpose now that a superseded outcome writes nothing.

- [ ] **Step 5 (P11): implement** — wrap `reloadPrices()` in `onMounted` and the two `onBeforeUnmount(context.onCatalogueChanged…/onProjectPricesChanged…)` registrations in `if (section === 'prices')`. Add a test: mounting the DETAILS section never calls `listAssetPrices` (count the query fixture's calls). Cite `ViewRoot.vue:328-332` in the comment.
- [ ] **Step 6 (P5):** rewrite the `createPriceSection.hydrate` docblock: rows SURVIVE a failed refresh and `refreshBlocked` is what makes them non-editable (`ProjectPrices.vue:42`).
- [ ] **Step 7:** `npm run check`; commit `fix(project-detail): a failed listing clears its count, a superseded price read decides nothing, and details loads no prices`.

---

### Task 9: the price row

Closes V1 (per R2), P1, P7, P10.

**Files:**
- Modify: `src/presentation/views/AssetPriceRow.vue:57,:120,:172,:175`
- Modify: `src/presentation/i18n/locales/de.ts:338-350`
- Modify: `src/presentation/composables/use-field-commit.ts:321-338` (docblock)
- Test: `tests/presentation/views/assetPriceList.test.ts:278-331,:528,:668-689`, `tests/presentation/i18n/strings.test.ts:161-179`

- [ ] **Step 1 (V1): failing test** — focus the input, type `12.50`, press Enter, and while the commit is pending assert `document.activeElement` is still the input and it carries `aria-disabled="true"` and `readonly`. Red: `activeElement` is `body`.
- [ ] **Step 2 (V1): implement**:

```ts
const priceUnavailable = computed(() => props.row.assetStatus !== 'known');
const pricePaused = computed(() => price.pending.value || props.refreshBlocked);
```

```html
<input … :disabled="priceUnavailable" :readonly="pricePaused" :aria-disabled="pricePaused ? 'true' : undefined" :aria-busy="price.pending.value" … >
```

Apply/Clear/Cancel buttons follow the same split (`:disabled` only for `priceUnavailable`; `aria-disabled` while paused, and their handlers already return early on `pending`). Rename `priceDisabled` out of existence. Update "locks the row while Apply is writing" (`:302-305`) to assert the paused attributes rather than `disabled`.
- [ ] **Step 3 (P1):** regex becomes `/^-?\d+(?:[.,]\d+)?$/`; drop `'1.234'` from the refuse list at `:528` and add it to the accept list.
- [ ] **Step 4 (P7):** `de.ts` row becomes `'Geben Sie einen Preis wie 19,50 ein'`; rewrite the comment above it (the field accepts a comma since PR #73 and normalises it before `createMoney`). Rework `strings.test.ts:161-179`: the accepted-form check runs each digit-bearing token through the FIELD's normalisation (`token.replace(',', '.')`) before `createMoney`, with the docblock updated to say the parser under test is `validatePrice`'s, not `createMoney`'s alone.
- [ ] **Step 5 (P10):** rewrite the four docblocks at `:278-296`, `:313-331`, `:668-688` against the tests they now head (no blur commit, no `draftToken`; the lost-update path is closed by `onPriceInput`'s `pending` early-return at `AssetPriceRow.vue:99`), and restore the blank line before each. Rewrite `use-field-commit.ts:321-338` to say which callers use the coalescing branch (grep `useFieldCommit(` and list them) and that the price row does not.
- [ ] **Step 6:** `npm run check`; commit `fix(prices): the input pauses instead of disabling, accepts what Money accepts, and the German example matches the field`.

---

### Task 10: detail navigation

Closes P3, P12, V3 (per R4), P2, P6.

**Files:**
- Modify: `src/presentation/views/ProjectDetailState.vue:110-113`, `src/presentation/views/ProjectDetail.vue:34`, `src/presentation/views/RenovationProjectView.ts:168-181`, `src/plugin/RenovationPlannerPlugin.ts:324-330`
- Modify: `tests/presentation/views/viewRootProjectDetail.test.ts:242-255` (docblock), `tests/presentation/views/projectExperience.test.ts:242,:265`
- Create: `docs/tests/cases/Back arrow over a dirty price draft.md`

- [ ] **Step 1 (P3): failing test** — in the prices section with one dirty draft, click Open note; assert `openProject` was called, no confirm dialog opened, and the draft is still in the input. Red: dialog opens.
- [ ] **Step 2 (P3): implement** — `onOpenNote` drops the `canLeave()` call; comment: opening the note leaves nothing, so nothing is discarded.
- [ ] **Step 3 (P12): failing test** — `readOnly: true`, zero plans: the empty state renders without its action button. Red: no empty state.
- [ ] **Step 4 (P12): implement** — `planEmpty = computed(() => props.plansFailure ? null : props.emptyState)`; pass `:action-label="readOnly ? undefined : planEmpty.actionLabel"` (read `EmptyState`'s props to find the action label's name; `ViewRoot.vue:314`'s `emptyActionLabel` is the model).
- [ ] **Step 5 (V3, R4): implement** — the `new-project` command becomes `checkCallback: (checking) => { if (Platform.isMobile) return false; if (!checking) runDetached(this.newProject(), …); return true; }`. Test in `tests/plugin/registration.test.ts`: with `Platform.isMobile = true` the check answers `false` and nothing runs (reset the platform in `afterEach` — CLAUDE.md names it as the mutable member that owes the reset).
- [ ] **Step 6 (P2):** in `setState`, assign `result.history = changed` BEFORE the `await this.session.canLeave()` and set `result.history = false` on refusal; `projectExperience.test.ts:265` already asserts `refused.history === false`. Write the manual case: open a project, prices, type a draft, press the pane's back arrow, choose Stay, then Forward, then Back, and record what the pane and the arrows do. Runs table empty, as the house rule requires.
- [ ] **Step 7 (P6):** rewrite the docblock at `viewRootProjectDetail.test.ts:242-255` to describe the outcome-gated ordering it pins now.
- [ ] **Step 8:** `npm run check`; commit `fix(project-detail): Open note discards nothing, mobile keeps its empty state, and the palette command hides where it cannot act`.

---

### Task 11: the Add menu's focus and four editor sentences

Closes E1, E2, E5, E10, E11. `EditorSurface.vue` is at 387/400 — adding four ids costs no lines; if any step adds one, extract `PRECISE_TOOLS` and `cursorClass` into `surface/cursor.ts` first.

**Files:**
- Modify: `src/presentation/editor/add/AddMenu.vue:8-10,:331-334`, `src/presentation/editor/surface/EditorSurface.vue:182,:1166-1170`, `src/presentation/editor/shell/EditorContextBar.vue:22-34`
- Test: `tests/presentation/editor/add/addMenu.test.ts:385-398`, `tests/presentation/designer/*` (a cursor case), the editor shell render test

- [ ] **Step 1 (E2): failing assertion** — append to the focus-out case: `expect(document.activeElement?.getAttribute('data-rp-action')).toBe('select');`. Red: it is `'add'`.
- [ ] **Step 2 (E1): implement**:

```ts
onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', onDocumentPointerDown, { capture: true });
	// Hand focus back ONLY if this menu still holds it. The focus-out door closes the menu
	// BECAUSE focus moved to another control, and reclaiming it there steals the control the
	// user just reached.
	if (menuRoot.value?.contains(document.activeElement) === true) props.anchor?.focus();
});
```

Header (`:8-10`): "two doors hand focus back to the button (Escape, an outside press); the third retires the menu where focus already went". Also add a case: the Escape door still returns focus (`:64-77` already does — confirm it stays green).
- [ ] **Step 3 (E5):** `PRECISE_TOOLS` gains `'trace-footprint', 'trace-clearance', 'set-anchor', 'set-facing'` with `CONSTRAINING_TOOLS`'s one-list docblock copied. Test in `tests/presentation/designer/`: activating `trace-footprint` sets the precise cursor class on the surface.
- [ ] **Step 4 (E10):** `<nav>` becomes `<div>` (crumbs are text per ADR-0017); drop its `aria-label`. A render test asserts exactly one element carries `editor.context-bar`'s label.
- [ ] **Step 5 (E11):** rewrite the `onKeyUp` docblock: the RELEASE is ungated so a Shift pressed on the canvas and released elsewhere still unconstrains; the press is gated with every other canvas key.
- [ ] **Step 6:** measure `EditorSurface.vue` with the `max-lines` semantics before committing (`npx eslint src/presentation/editor/surface/EditorSurface.vue` is the instrument). `npm run check`; commit `fix(editor): the Add menu leaves focus where it went, the designer's tools get their cursor, and one landmark per bar`.

---

### Task 12: the unrecovered-write flag is sticky (R1)

Closes E3.

**Files:**
- Modify: `src/presentation/editor/save-state/save-state-store.ts:44-49,:91-96`
- Test: `tests/presentation/editor/saveState/saveStateStore.test.ts`

- [ ] **Step 1: failing test** — `markUnrecovered(); resolveOk(); expect(store.unrecoveredWrite).toBe(true)`. Red (the trust-path plan pinned the opposite; find that case and invert it in the same edit, citing R1).
- [ ] **Step 2: implement** — delete `unrecoveredWrite.value = false;` from `resolveOk`; rewrite the field's docblock: sticky for the leaf's life, because the wrapper cannot tell a repairing write from any other, and a stale warning is cheaper than a false all-clear; recovery at the next load is what mends the vault. Confirm `warnings.ts` needs no change.
- [ ] **Step 3:** `npm run check`; commit `fix(save-state): an unrecovered write stays reported until the leaf is reopened`.

---

### Task 13: zones paint in model order — `opus`

Closes E4.

**Files:**
- Modify: `src/presentation/editor/layers/zone/ZoneShape.vue:66-121`
- Create: `tests/presentation/editor/layers/zoneLayerOrder.test.ts`
- Test: `tests/presentation/editor/scene.test.ts` (must stay green)

- [ ] **Step 1: failing test** — mount the zone layer with zones `[a, b]`, then replace the store's zones so the iteration order is `[b, a]`, `await nextTick()`, and assert `layer.getChildren().map((n) => n.name())` is `['b', 'a']`. Model the harness on `roomDraftSketch.test.ts`'s index assertion. Red: `['a', 'b']`.
- [ ] **Step 2: implement** — wrap the four nodes in `<VGroup :config="{ name: props.model.id, listening: false }">`; move the template comment inside the group so `max-lines` counts nothing new. Docblock: fragment-rooted vue-konva children are outside the reindex walk (`RoomDraftSketch.vue:16-51`), so an unconditional group root is what makes `v-for` order the paint order.
- [ ] **Step 3:** run `scene.test.ts` and `tests/presentation/editor` — the `flatPoints` identity case must survive the extra node. `npm run check`; commit `fix(canvas): a zone has one Konva root, so paint order follows the model`.

---

### Task 14: move a room with the keyboard

Closes E8. Adds a real feature, kept to the one operation SDD §85 leaves unreachable.

**Files:**
- Modify: `src/presentation/editor/tools/registerEditorTools.ts:55-58` (lift the move factory), `src/presentation/editor/runtime.ts` (expose `nudgeSelection`), `src/presentation/editor/surface/EditorSurface.vue` (`onKeyDown` arrow branch — MEASURE; extract `keyboard.ts` if over budget)
- Create: `tests/presentation/editor/keyboardNudge.test.ts`
- Modify: `src/presentation/i18n/locales/en/editor.ts`, `de/editor.ts` (one announcement key if the move announces; reuse the move gesture's existing announcement if it has one — check `every-undo-and-redo-announces` plan)

**Interfaces:**
- Produces: `runtime.nudgeSelection(by: Vector): Promise<void>` — no-op unless exactly one zone is selected and the active tool is `select`; step 10 mm, 100 mm with Shift, in WORLD units (`translate` from `core/geometry/operations`).

- [ ] **Step 1: failing test** — mount the plan editor canvas, select `zone-kitchen`, focus the container, dispatch `keydown ArrowRight`; assert one `moveObject` dispatch with the polygon translated by `{ dx: 10, dy: 0 }` and a history entry; then `Ctrl+Z` restores. Red: nothing dispatched.
- [ ] **Step 2: implement** — extract `createMoveGesture` (`registerEditorTools.ts:55-58`) into an exported `moveGesture(context, ledger)` used by both `SelectTool`'s deps and a new runtime method:

```ts
async nudgeSelection(by: Vector): Promise<void> {
	if (this.activeToolId.value !== 'select') return;
	const [zoneId, ...rest] = this.selection.selectedIds;
	if (zoneId === undefined || rest.length > 0) return;
	const zone = this.projectStore.zones.get(zoneId);
	if (!zone) return;
	const moved = createPolygon(translate(zone.geometry, by).points);
	if (isErr(moved)) return;
	await this.dispatcher.dispatch(moveGesture(this.context, this.ledger)(zoneId, moved.value, zone.geometry));
}
```

(Names are the runtime's; read `runtime.ts:560-680` for the real field names before writing.) In `onKeyDown`, after the Escape branch and behind `gestureInFlight()`: map `ArrowLeft/Right/Up/Down` to `{dx,dy}` × (`event.shiftKey ? 100 : 10`), `preventDefault`, `void runtime.nudgeSelection(vector)`.
- [ ] **Step 3:** add the four keys to `canvasNavigation.test.ts`'s "keys the canvas answers" list; `npm run check`; commit `feat(editor): arrow keys move the selected room, undoably`.

---

### Task 15: dead code, one clone, one guard, one prototype key, four copies

Closes E7 (R5), E9, V5, V10, C11, C12.

**Files:**
- Delete: `src/presentation/editor/selection/normalize-transform.ts`, `tests/presentation/editor/selection/normalizeTransform.test.ts`
- Modify: `src/presentation/editor/snapping/snap-service.ts` (remove `snapToGrid`, `snapResize`), `tests/presentation/editor/snapping/snapService.test.ts`, `src/presentation/editor/snapping/editorSnapping.ts:17-29` (docblock)
- Create: `src/presentation/editor/layers/GestureSketch.vue` (VGroup-rooted; the sketch + measurement block both layers draw); Modify: `InteractionLayer.vue`, `DesignerGestureLayer.vue` (drop the `fallow-ignore` at `:68`), `tests/presentation/designer/layers.test.ts:318`, `closeTarget.test.ts`
- Modify: `src/presentation/notices/notify.ts:562`, `src/presentation/errors/route-error.ts:43`
- Create: `negativeMoney` in `src/core/money/Money.ts` (beside `isNegative`); Modify: `costPipeline.ts:171`, `Project.ts:38`, `Asset.ts:222`, `AssetPriceOverride.ts:64`
- Delete: the second case in `tests/core/units/measurementUnit.test.ts:18-23`

- [ ] **Step 1 (E7):** delete the module and its test; delete the two methods and their `describe` blocks; if `fallow` then reports `TransformerHandle`/`HANDLE_EDGES` dead, delete those too. Rewrite `editorSnapping.ts:17-29` to name the live members. `npm run analyze` must be clean.
- [ ] **Step 2 (E9): failing test** — `layers.test.ts` asserts the designer's gesture layer draws the sketch line and the measurement text for a two-point trace (the plan-editor copy's assertions, applied to the designer). Red (only the layer's existence is asserted today).
- [ ] **Step 3 (E9): implement** — `GestureSketch.vue` with `<VGroup :config="{ name: 'gesture-sketch', listening: false }">` rooting the shared template; both layers mount it unconditionally with `v-if` on its children. Docblock cites `RoomDraftSketch.vue:158` as the shape and `DesignerGestureLayer.vue`'s old comment as the refusal it replaces.
- [ ] **Step 4 (V5):** `notifyFault` becomes `notifyError(error, surfaceFor(error, { kind: 'explicit-operation' }) as …)` — narrow the type at the call rather than branching; if `notifyError`'s parameter type refuses the union, add a `toastSurfaceFor(error)` in `errorSurfacePolicy.ts` that returns the routed toast for `explicit-operation` origins. Check `coverage-final.json`: the file's zero-count branch is gone.
- [ ] **Step 5 (V10):** `const fields = Object.prototype.hasOwnProperty.call(map, error.code) ? map[error.code] : undefined;` with a test: `code: 'constructor'` routes to `kind: 'banner'`.
- [ ] **Step 6 (C11):** `export function negativeMoney(label: string, value: Money | null | undefined, errorOf: (code: string, message: string) => AppError): AppError | null` in `Money.ts`, returning `null` unless `isNegative(value)`, with the message `A ${label} cannot be negative; got ${amount} ${currency}.`; the four call sites call it with their own `errorOf` and code, messages preserved byte-for-byte (`costPipeline`'s extra "A credit is not a cost component." sentence is appended by its caller). No test changes if messages and codes are identical — assert that by running the four test files.
- [ ] **Step 7 (C12):** delete the case; add one line to the remaining case's docblock naming the `Readonly<Record<MeasurementUnit, UnitKind>>` annotation as the instrument.
- [ ] **Step 8:** `npm run check`; commit `refactor: delete the transformer scaffold and two dead snaps, share the gesture sketch, and fold four negative-money guards into one`.

---

### Task 16: core hardening

Closes C1–C7, C9, C10 and the two new items. All low; grouped because they share one shape — a guard on the INPUT where the failure lives in the ARITHMETIC.

**Files:**
- Modify: `src/core/geometry/operations.ts:301,:486-489,:503-506`, `src/domain/cost/costPipeline.ts` (`inputError`), `src/domain/cost/quantityEngine.ts:53,:80,:134`, `src/domain/asset/AssetShape.ts:123-127`, `src/domain/asset/Asset.ts:107`, `src/domain/zone/Zone.ts:84,:95`, `src/domain/project/Project.ts:184-185`, `src/presentation/library/definitionDraft.ts:40,:56-57`
- Modify: `docs/entities/Spatial object.md:37`
- Test: `tests/core/geometry/operationsNumericLimits.test.ts`, `tests/domain/cost/costPipeline.test.ts`, `tests/domain/cost/quantityEngine.test.ts`, `tests/domain/asset/assetShape.test.ts`, `tests/domain/asset/asset.test.ts`, `tests/domain/zone/zone.test.ts`, `tests/domain/project/project.test.ts`, `tests/presentation/library/definitionDraft.test.ts`

- [ ] **Step 1: failing tests, all at once** (each reproduced by the review with `node -e`):

```ts
// operationsNumericLimits.test.ts
it('perimeter refuses the polygon area refuses', () => {
	const p = polygonOf([{ x: -1e308, y: 0 }, { x: 1e308, y: 0 }, { x: 1e308, y: 10 }]);
	expect(perimeter(p)).toMatchObject({ ok: false, error: { code: 'polygon-perimeter-overflow' } });
});
it('intersect answers null, never a NaN point, when the products overflow', () => {
	const r = intersect({ start: { x: 0, y: 0 }, end: { x: 1e200, y: 1e200 } }, { start: { x: 1e200, y: 0 }, end: { x: 0, y: 1e200 } });
	expect(r).toEqual({ ok: true, value: null });
});
it('project refuses when the products overflow', () => {
	const r = project({ x: 1e200, y: 0 }, { start: { x: 0, y: 0 }, end: { x: 1e200, y: 1e200 } });
	expect(r).toMatchObject({ ok: false, error: { code: 'segment-overflow' } });
});
// costPipeline.test.ts
it('refuses a non-finite quantity before any arithmetic', () => {
	const r = computeEstimatedCost({ ...baseInput, quantity: { value: new Decimal(Infinity), unit: 'piece' } });
	expect(r).toMatchObject({ ok: false, error: { code: 'cost.non-finite-input' } });
});
// assetShape.test.ts
it('folds a hair below the +x axis to 0, not to 2π', () => {
	expect(normaliseFacing(-1e-17)).toBe(0);
	expect(Object.is(normaliseFacing(-Math.PI * 2), 0)).toBe(true);
});
// asset.test.ts
it('accepts a negative-zero waste factor as zero', () => {
	expect(checkWasteFraction(new Decimal(0).mul(-1), 'waste-factor-default', assetError).ok).toBe(true);
});
// zone.test.ts / project.test.ts
it('a polygon mutated after create does not reach the zone', …)   // mutate points[0].x = NaN after create; area() still ok
it('a Date mutated after create does not reach the project', …)   // setFullYear(1970) after create; p.start unchanged
```

Adapt fixture names to each file's helpers. Run each; all red.

- [ ] **Step 2: implement**, one function each:

```ts
// operations.ts
// perimeter: after the loop
if (!Number.isFinite(total)) return geometryErr('polygon-perimeter-overflow', 'The perimeter overflows.');
// intersect: after computing t and u
if (!Number.isFinite(t) || !Number.isFinite(u)) return ok(null);
// project: replace the clamp01 line
const raw = ((point.x - onto.start.x) * vx + (point.y - onto.start.y) * vy) / (vx * vx + vy * vy);
if (!Number.isFinite(raw)) return geometryErr('segment-overflow', 'The projection overflows.');
const t = clamp01(raw);

// AssetShape.ts
export function normaliseFacing(radians: number): number {
	if (!Number.isFinite(radians)) return 0;
	const folded = radians % TAU;
	const positive = folded < 0 ? folded + TAU : folded;
	return positive >= TAU || positive === 0 ? 0 : positive;
}

// Asset.ts:107 and definitionDraft.ts:40
if (value.lessThan(0)) …           // was isNegative()

// costPipeline.ts inputError — first check, before the sign guards
if (!input.quantity.value.isFinite() || (input.taxRate !== undefined && !input.taxRate.isFinite()) || (input.discount !== undefined && !input.discount.percent.isFinite())) {
	return { category: 'Calculation', code: 'cost.non-finite-input', message: 'A cost input is not a finite number.' };
}
// quantityEngine.ts negativeQuantity: same `isFinite` arm, code 'quantity.non-finite'

// Zone.ts create/withGeometry: store createPolygon(props.geometry.points)'s copy, not props.geometry
// Project.ts: start: props.start ? new Date(props.start.getTime()) : null  (and targetCompletion)
```

`definitionChanges` (`definitionDraft.ts:56-57`): wrap the two parses in the same `try` its sibling uses and return `{}` on a throw, with a comment that `validateDefinition` is the gate and this is the belt. `quantityEngine.ts:53`'s docblock: "`fixed` answers 1 whatever the raw value; the rest pass through". `docs/entities/Spatial object.md:37`: a self-intersecting polygon is ACCEPTED and measured as-is (SDD §26 defers detection; `Zone Editing Walkthrough.md:292`).

- [ ] **Step 3:** each new error code that can reach `toUserMessage` gets a locale row (`polygon-perimeter-overflow`, `segment-overflow`, `cost.non-finite-input`, `quantity.non-finite`) — or, if the geometry codes already fall to a specific `error.category.geometry` sentence that fits, record that and add none. `npm run check`; commit `fix(core): guards where the failure lives — overflow, non-finite, the facing fold, negative zero, and two aliased fields`.

---

### Task 17: fakes and scans

Closes I3, I4, V7.

**Files:**
- Modify: `tests/helpers/fixtureVault.ts:291`, `tests/helpers/vault.ts:281,:301,:322`
- Modify: `tests/harness/accessibility.test.ts:962-985` (or a new `accessibilityDialogs.test.ts` if the file crosses 450 lines)

- [ ] **Step 1 (I3):** give `FixtureVault` the `listeners`/`on`/`offref`/`trigger` quartet — import and reuse `FakeVault`'s if it is exported, else copy the twelve lines with a pointer. Add a case in `tests/helpers/fixtureVault.test.ts`: registering through `createVaultFileChangeSource` against `openFixtureVault` and disposing does not throw and leaves zero listeners.
- [ ] **Step 2 (I4):** `FakeVault.create/modify/delete` call `this.trigger('create' | 'modify' | 'delete', file)` after mutating `entries` (and `rename` triggers `'rename'` with `(file, oldPath)`); assert in `tests/helpers/vault.test.ts` (create it if absent) that a `modify` reaches an `on('modify')` listener once, and that `eventListenerCount` returns to 0 after `offref`. Then run the WHOLE suite once (`npm run check:fast`) — a fake that now fires events can surface tests that relied on silence; fix each by asserting the event rather than suppressing it, and record any that had to change in the ledger.
- [ ] **Step 3 (V7):** five more `it('reports no semantic violations with the <X> open')` cases modelled on the `NewProjectForm` one at `:970`, for `NewAssetForm` (with `catalogueFrozen` true AND false), `NewPlanForm`, `ConfirmDialog`, `DeleteReference`, `AssetDimensions`. Expect real findings on `NewAssetForm`'s `aria-disabled` selects; fix them in `NewAssetForm.vue` in this task (a `<select aria-disabled>` that is meant to be paused needs `aria-describedby` naming the reason; one meant to be unavailable is `:disabled`).
- [ ] **Step 4:** `npm run check`; commit `test: the disk-backed vault fake has Obsidian's event surface, the fakes fire what they mutate, and every dialog is axe-scanned`.

---

### Task 18: two undeclared classes and the one float

Closes X7, X8, X9.

**Files:**
- Modify: `styles/forms.css`, `styles/designer.css`, `tests/build/libraryComponentStyles.test.ts` (scope), `src/presentation/library/AssetRow.vue:103`

- [ ] **Step 1: failing test** — widen `libraryComponentStyles.test.ts`'s walk from `src/presentation/library/` to `src/presentation/{library,components,designer}/` (rewrite its header, which argues against widening to the WHOLE tree — this is three directories, and the two gaps below are the measured cost of not widening). Red: two classes.
- [ ] **Step 2:** add `.rp-form-banner__glyph { … }` to `forms.css` (a `margin-inline-end` using the existing spacing variable the banner uses) and `.rp-designer-inspector-panel { … }` to `designer.css` (whatever the sibling `-fields` rule gives; if the element needs no styling, remove the class from the template instead and say so). Both partials must stay under 400 lines.
- [ ] **Step 3 (X9):** above `AssetRow.vue:103` add the comment: the one place a monetary amount passes through `Number`, display-only, bounded to two fraction digits, exact below 2^53/100; a decimal-string formatter arrives with the first surface that needs more.
- [ ] **Step 4:** `npm run check`; commit `style: two declared classes, one widened style scan, and the float's bound written down`.

---

### Task 19: the records

Closes X1–X6, X10, E6, P9, V6, I11 and the docblocks the verifiers found. Documents only; `npm run check` still runs (the docs tests walk these).

**Files:**
- Modify: `CLAUDE.md` (lines 692, 719, 720, 724, 730, 1074; the "differ in three host fakes" sentence in the repository-stacks paragraph — after T17 it is four members that MATCH, so rewrite it as "differ in three host fakes, each carrying Obsidian's event surface"), `vitest.config.ts:83,:185,:192`, `.fallowrc.json` (the `.test-d.ts` paragraph)
- Modify: `docs/issues/Slice 13 is designed and planned and not yet built.md` (status Done, dated `## What closed it` naming `src/presentation/notices/` and `save-state/`), `docs/issues/The canvas has no budget left for the next input rule.md` (repoint at `EditorSurface.vue`, 387/400, template comments counted), `docs/tasks/{12,13,14,16,17,18,19,20,21}-*.md` (`status:` from each file's own amendments — `Done` where the last amendment says the slice landed, `Active` where it names open items), `docs/user-experience/archive/renovation-planner-home-DESIGN-SPEC.md:597,:739` (one-line pointer each to `docs/requirements/Return to the project list with my search context.md`)
- Modify: `src/presentation/views/ProjectList.vue:446-451` (delete the two false clauses), `src/infrastructure/obsidian/workspace/reveal.ts:50-57` (record the flat-state precondition), `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts:285-298` ("probes" not "snapshots" the sidecar), `src/plugin/composition-root.ts:131-137` (no change unless T3 moved the bus)
- Create: `docs/issues/A folder rename never reaches the project index.md` — `status: New`, citing the increment history's PRE-EXISTING entry, `Move the Library.md` steps 12/12b, and R6; `## What closes it`: `Vault.recurseChildren` on the `TFolder` arm of rename and delete, a fake that fires a folder event, and the manual case losing its reload step
- Modify: `docs/development/agent-guide-increment-history.md` — one new section for this pass: the eight-finder / eight-verifier shape, the refuted list (so the next reviewer does not re-find P4, P8, P9, C8, A11, I10, I12), and the three lessons the pass paid for: a guard over inputs where the failure lives in the arithmetic; a rule stated in one file and broken by a caller in another (V1, V4, I5); and a fix applied to one copy of a duplicated structure (I5/I9, I8).

- [ ] **Step 1:** make every edit above; for CLAUDE.md's counts, replace "twelve" with a sentence that names the derivation (`vitest.config.ts`'s `eslintBootingTests()`) and no number, and replace the bundle size with "`npm run build` prints today's".
- [ ] **Step 2:** `npm run check` (the docs-walking tests); commit `docs: close slice 13, status the nine slices, repoint the canvas-budget note, and write the pass into the increment history`.

---

### Task 20: finish

- [ ] **Step 1:** `npm run check` on the quiet branch; `npm run harness-shot` and READ the Plan Editor and project-view PNGs for anything T9, T11, T13 changed visibly (the paused price input, the context bar, zone stacking).
- [ ] **Step 2:** a whole-branch review by a fresh `opus` reviewer against the spec: every id in the Triage table is either closed by a named commit and a named test, or recorded as deferred with a ruling.
- [ ] **Step 3:** push and open the pull request with the spec linked; body lists the rulings.

```bash
git push -u origin claude/polish-pass-2026-09
gh pr create --title "Improvement and polish pass, 2026-09-05 review" --body-file .superpowers/sdd/2026-09-05-polish-pass/progress.md
```

## Self-review against the spec

- **Coverage:** every CONFIRMED and PLAUSIBLE id in the spec's tables appears in the Triage table with a task, except I9 (leave, by the verifier's own recommendation), V11 (optional, not scheduled), X9 (comment only, T18) and I7 (R6). Every REFUTED id is named in the Triage's last rows or in T19's increment-history note so it is not re-found.
- **Placeholders:** T6 Step 2 names the file to find by grep rather than by path because the review could not settle which source refreshes the zone's requirement list; the step says what to grep and what to record. T14's runtime field names are flagged as to-be-read. No other step defers content.
- **Type consistency:** the fourth constructor parameter is `ledger: WriteLedger` in T1 everywhere; `hydratePrices` returns `'landed' | 'superseded'` in T8 at both the store and the state; `pricePaused`/`priceUnavailable` in T9 replace `priceDisabled` everywhere it was read; `disposeCascade()` in T3 is what T3's `applySettings` calls.
- **Ordering:** T5 before T6 (R3 cites T6); T3 before T4 (both edit `applySettings`); T17's fake change runs the whole suite because it can redden unrelated files; T19 last because it writes the counts the other tasks change.
