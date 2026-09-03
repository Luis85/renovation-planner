# Every undo and redo announces — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the category defect that every undo and every redo in this plugin writes to the
vault and publishes nothing, and land the two read-model foundations Project Home will consume.

**Architecture:** The forward commands publish; the reversible adapters restore snapshots
through the repository PORTS directly, and `CLAUDE.md` records why those ports are deliberately
raw — *"the boundary stops at the repository PORTS … because the reversible adapters restore
snapshots through them"*. Publishing was never part of that path. So this is **one defect at
thirteen sites**, not thirteen defects: each write path gains the `EventBus` it does not
currently hold and announces the event its own act actually performed. Two events are minted
because the existing vocabulary has no member meaning *this row is gone* or *this row was
written back*. A category test then holds the property for code not yet written, with one
named carve-out.

**Tech Stack:** TypeScript 5 (strict, `vue-tsc` over `src/**` and `tests/**`), Vitest, the
in-process `EventBus` in `src/core/events/EventBus.ts`, ESLint + oxlint, fallow.

**Spec:** [`docs/superpowers/specs/2026-09-02-project-home-design.md`](../specs/2026-09-02-project-home-design.md)
— specifically *Decision 7 → The undo/redo path publishes nothing at all, and that is a
category* (§1042–1418), *Decision 2* (§201–300) and *The walk is project-scoped* (§546–800).
The plan argues from the spec; read both.

## Why this is increment 1 of two

PR 62's body asked whether Decision 7 should be split from the surface that revealed it. It is,
and this is the first half. **Tasks 1–11 are a self-contained correctness fix with present-day
value**: `planChangeSource`, `projectPlansChangeSource`, `requirementFiguresChangeSource` and
slice 10's recalculation cascade are all live subscribers today, and every one of them is blind
to every undo and redo.

**Tasks 12–13 are different and the difference is stated rather than blurred.**
`RequirementRepository.listByProject` and the extracted row builder ship with unit tests and
**no production caller** — their first one is `GetProjectSummary` in increment 2. That is a
deliberate, sequenced obligation and not an oversight, and it is exactly the shape `CLAUDE.md`
warns about (*"an export with only a test caller stayed invisible to the gate the whole time"*).
It is carried because the alternative — landing them inside an already-large second increment —
is worse, and because increment 2 follows immediately on this branch. **If increment 2 is
abandoned, tasks 12–13 must be reverted rather than left standing.**

## Global Constraints

Copied verbatim from `CLAUDE.md` and the spec. Every task's requirements implicitly include
this section.

- **Definition of done is `npm run check`** — build + lint + coverage-thresholded tests +
  fallow. All four, before every commit. CI runs the same command verbatim.
- **Layer bans are lint-enforced.** `presentation → application → domain → core`;
  `infrastructure → application (its ports) → domain → core`; `plugin/` composes all of them
  and is the only layer that may. `vue`, `pinia`, `konva` and `obsidian` are banned by name in
  `core/`, `domain/` and `application/`.
- **Coverage floors: statements 99, functions 99, lines 99, branches 98.** Measured at the
  spec's baseline, **functions is the binding metric at ~1 unit of headroom**; branches has
  ~12. An untested new FUNCTION fails the gate outright; an untested new BRANCH disappears into
  the slack and says nothing. **Plan the test with the code**, and for any task that adds a
  function, read `coverage-final.json` for the changed files rather than trusting the summary
  line.
- **An optional collaborator is refused where a composition could forget it.** `RecoveryDeps`
  gains a REQUIRED `events`, per the `CascadeDeps.notify` precedent this repository already
  records: an optional member makes a composition that forgets it compile, pass, and say
  nothing.
- **A docblock saying "the only place X" gets a `grep` in the SAME edit**, and the sentence is
  written from what the grep printed.
- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing** — revert the fix, run it, see red, restore.
- **Write the guarantee to the check, never ahead of it.** Where a check cannot reach the whole
  claim, narrow the sentence.
- **Commit messages** end with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
  ```
- **Branch:** `claude/plan-editor-user-journey-jak1fl`. Never push elsewhere.
- **No model identifier** in any artifact pushed to the repository beyond the trailer above.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `tests/application/events/writerPublishSweep.test.ts` | The category check: every write path in `src/application` that writes also publishes, with `ReversibleSetPlanBackground` the one carve-out, asserted by exact key set. |
| `src/application/queries/buildRequirementRow.ts` | `GetRequirementsForZone`'s per-row builder, extracted so a second caller cannot derive a row differently. |
| `tests/application/queries/buildRequirementRow.test.ts` | Row-builder unit cases. |
| `tests/application/repositories/requirementListByProject.test.ts` | `listByProject` over both implementations. |

**Modified:**

| File | Change |
|---|---|
| `src/domain/requirement/Requirement.events.ts` | Mint `RequirementDeleted` and `RequirementRestored` (Task 1). |
| `src/presentation/editor/planEditorCommands.ts` | `PlanEditorCommandServices.events: EventBus` — REQUIRED, so every construction site is a build error (Task 2). |
| `src/application/commands/requirement/DeleteRequirement.ts` | Takes an `EventBus`; publishes `RequirementDeleted` (Task 2). |
| `src/plugin/slice10Composition.ts` | Passes `events` to `DeleteRequirementCommand` (Task 2). |
| `src/application/commands/zone/reversible-create-zone-command.ts` | Deps bundle; redo publishes `ZoneCreated`; redo publishes `RequirementInvalidated` per surviving referent, falling back to `ProjectIndexRebuilt` when the reverse lookup refuses (Task 3). |
| `src/presentation/editor/runtime.ts` | Passes the new bundle (Task 3). |
| `src/application/commands/zone/reversible-delete-zone-command.ts` | Redo publishes `ZoneDeleted` (Task 4). |
| `src/application/reference/undoDeleteResolution.ts` | `UndoSequenceOps.events`; publishes `RequirementRestored` / `RequirementCreated` (Task 5). |
| `src/presentation/editor/inspector-wiring.ts` | Passes `events` to the delete and assign adapters (Tasks 4, 5, 6). |
| `src/application/commands/requirement/reversible-assign-asset-command.ts` | `redoCreate` publishes `RequirementCreated`; `undo` publishes `RequirementDeleted` (Task 6). |
| `src/application/commands/requirement/reversible-override-commands.ts` | Both `undo`s publish `CostEstimateChanged` through `publishIfEffectiveCostChanged` (Task 7). |
| `src/application/reference/deleteResolution.ts` | Requirement-level events per referent it writes or deletes (Task 8). |
| `src/application/commands/asset/DeleteAsset.ts` | Resolution paths publish requirement-level events rather than leaving `assetDeleted({ assetId })` — which carries no project id — to stand for them (Task 9). |
| `src/application/reference/recoverInterruptedSequences.ts` | `RecoveryDeps.events` REQUIRED; publishes per restored entry (Task 10). |
| `src/plugin/RenovationPlannerPlugin.ts` | Passes `events` at the `recoverInterruptedSequences` call (Task 10). |
| `src/application/ports/RequirementRepository.ts` | `listByProject` + `RequirementListing` (Task 12). |
| `src/infrastructure/obsidian/repositories/ObsidianRequirementRepository.ts` | Implements it, tolerant per id (Task 12). |
| `src/infrastructure/persistence/in-memory/InMemoryRequirementRepository.ts` | Implements it (Task 12). |
| `src/application/queries/GetRequirementsForZone.ts` | Delegates to the extracted builder (Task 13). |
| `CLAUDE.md`, the spec | The account (Task 14). |

**Deliberately unchanged:** `src/application/commands/plan/ReversibleSetPlanBackground.ts` — the
named carve-out. A background is not a cost input, so it moves nothing a summary shows; what it
moves is the Plan Editor's own picture in a second leaf on the same plan. It is named in Task
11's carve-out table so the sweep is honest in both directions.

**Also unchanged:** `RequirementRepository.listByZone` keeps its strict contract.
`DeleteZoneCommand` relies on that error before `runDeleteResolution` — an unreadable requirement
referencing the zone being deleted must not be silently missed — and `AssignAssetCommand` leans
on it against a duplicate assignment. **A read concern must not weaken a write guarantee.**

---

## Task 1: Mint `RequirementDeleted` and `RequirementRestored`

**Files:**
- Modify: `src/domain/requirement/Requirement.events.ts`
- Test: `tests/domain/requirement/requirementEvents.test.ts` (create if absent)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export interface RequirementDeleted extends DomainEvent<'RequirementDeleted'> {
      readonly payload: RequirementEventPayload;   // { requirementId, projectId }
  }
  export interface RequirementRestored extends DomainEvent<'RequirementRestored'> {
      readonly payload: RequirementEventPayload;
  }
  export function requirementDeleted(payload: RequirementEventPayload): RequirementDeleted;
  export function requirementRestored(payload: RequirementEventPayload): RequirementRestored;
  ```
  Both reuse the existing `RequirementEventPayload`. Tasks 2, 5, 6, 8, 9 and 10 publish them.

**Why two and not one, and why not a substitute.** The vocabulary is `RequirementCreated`,
`RequirementRecalculated`, `RequirementInvalidated` and `CostEstimateChanged`. None means *this
row is gone*, so the assign adapter's `undo` has nothing to publish; `RequirementInvalidated` is
the tempting substitute and says something different — a figure stopped being trustworthy, not a
row stopped existing. And none means *this row was written back*: a `delete-anyway` restore
returns a requirement from `stale` to a `current` snapshot **without moving its cost**, so
`publishIfEffectiveCostChanged` is correctly silent and the state change reaches nobody.
`RequirementInvalidated` is the opposite claim there — it says a recalculation is OWED, where a
restore to a `current` pre-state says one is not.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/requirement/requirementEvents.test.ts` (append to it if it exists):

```ts
import { describe, expect, it } from 'vitest';
import {
	requirementDeleted,
	requirementRestored,
} from '../../../src/domain/requirement/Requirement.events';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import type { ProjectId } from '../../../src/domain/project/ProjectId';

const requirementId = 'requirement-01JAAA' as RequirementId;
const projectId = 'project-01JAAA' as ProjectId;

describe('the two events this increment mints', () => {
	it('names a deleted requirement and the project that must refresh', () => {
		expect(requirementDeleted({ requirementId, projectId })).toEqual({
			type: 'RequirementDeleted',
			payload: { requirementId, projectId },
		});
	});

	// The projectId is the whole point: a restore reached through a ZONE event carries the
	// ZONE's project, and a requirement in another project is exactly the row that event
	// cannot reach. This payload is what makes the cross-project case addressable.
	it('names a restored requirement and its OWN project', () => {
		expect(requirementRestored({ requirementId, projectId })).toEqual({
			type: 'RequirementRestored',
			payload: { requirementId, projectId },
		});
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/domain/requirement/requirementEvents.test.ts`
Expected: FAIL — `requirementDeleted is not a function` (or a TS resolution error on the import).

- [ ] **Step 3: Mint the two events**

Append to `src/domain/requirement/Requirement.events.ts`, beside the existing interfaces:

```ts
/**
 * This row no longer exists. Minted by the increment that made every undo announce, because
 * the vocabulary had no member meaning it: `RequirementInvalidated` says a figure stopped
 * being trustworthy, which is a different claim about a row that is still there.
 *
 * Published by `DeleteRequirementCommand` (the exposed removal, and `remove-references`
 * resolves through it), by `ReversibleAssignAssetCommand.undo` (which deletes the
 * requirement its own execute created) and by the delete resolutions' `remove-references`
 * arm. Carries the project so a subscriber scoped to one project can filter.
 */
export interface RequirementDeleted extends DomainEvent<'RequirementDeleted'> {
	readonly payload: RequirementEventPayload;
}

/**
 * This row was written back from a snapshot — a restore, not a creation and not a
 * recalculation.
 *
 * It exists because a restore can move NO figure at all: the `delete-anyway` arm marks a
 * referent stale, and restoring the pre-state marks it current again without touching its
 * cost, so `publishIfEffectiveCostChanged` is correctly silent and the status change would
 * otherwise reach nobody. `RequirementInvalidated` is not the substitute — it claims a
 * recalculation is OWED, which is the opposite of a restore to a `current` pre-state.
 *
 * Two publishers, and having two is what earned it its place rather than a fix needing
 * something to name: `undoDeleteResolution` (a user's undo) and `recoverInterruptedSequences`
 * (a crash recovery at load). Both compute the same split —
 * `entry.outcome === 'written' ? entry.version : 'absent'` — so a `written` restore raises
 * this and an `'absent'` one raises `RequirementCreated`: one rule covering both callers
 * rather than two descriptions of one act.
 */
export interface RequirementRestored extends DomainEvent<'RequirementRestored'> {
	readonly payload: RequirementEventPayload;
}

export function requirementDeleted(payload: RequirementEventPayload): RequirementDeleted {
	return { type: 'RequirementDeleted', payload };
}
export function requirementRestored(payload: RequirementEventPayload): RequirementRestored {
	return { type: 'RequirementRestored', payload };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/domain/requirement/requirementEvents.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add src/domain/requirement/Requirement.events.ts tests/domain/requirement/requirementEvents.test.ts
git commit -m "$(cat <<'MSG'
Mint the two events the undo path has nothing to publish

The vocabulary is RequirementCreated, RequirementRecalculated,
RequirementInvalidated and CostEstimateChanged. None means "this row is
gone", so the assign adapter's undo has nothing to raise, and none means
"this row was written back" — a delete-anyway restore returns a requirement
from stale to a current snapshot without moving its cost, so the cost helper
is correctly silent and the status change reaches nobody.

RequirementInvalidated is the tempting substitute for both and is the wrong
claim twice: a figure that stopped being trustworthy is not a row that
stopped existing, and a recalculation being OWED is the opposite of a
restore to a current pre-state.

Both carry the requirement's OWN projectId, which is the field that makes
the cross-project case addressable at all: a restore reached through a zone
event carries the ZONE's project.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 2: The exposed removal announces, and the editor bundle carries a bus

**Files:**
- Modify: `src/application/commands/requirement/DeleteRequirement.ts`
- Modify: `src/plugin/slice10Composition.ts:174`
- Modify: `src/presentation/editor/planEditorCommands.ts` (add `events` to
  `PlanEditorCommandServices`, supply it in `unavailablePlanEditorCommands`)
- Modify: `src/plugin/composition-root.ts` (supply the real bus to the editor bundle)
- Test: `tests/application/commands/requirement/deleteRequirement.test.ts`

**Interfaces:**
- Consumes: `requirementDeleted` (Task 1).
- Produces:
  ```ts
  // DeleteRequirement.ts — a second positional collaborator, the shape
  // SetRequirementQuantityOverrideCommand(requirements, events, locks) already uses.
  constructor(requirements: RequirementRepository, events: EventBus)

  // planEditorCommands.ts
  interface PlanEditorCommandServices { /* …existing… */ readonly events: EventBus; }
  ```
  Tasks 3, 4, 5 and 6 read `context.commands.events` at their construction sites.

**Why the bundle member lands here rather than in each later task.** The reversible adapters are
constructed in `presentation/editor/`, from `PlanEditorCommandServices`. Adding `events` as a
REQUIRED member once makes every construction site a build error the compiler names, which is
how this repository has already found consumers it could not have listed by hand. Adding it
per-task would mean four separate widenings of one type.

`unavailablePlanEditorCommands()` already builds a local bus at line 191 for the inner commands;
it returns that same instance. That is right rather than a shortcut: in an unrecovered session
every write refuses, so nothing is ever published, and a bus nobody subscribes to is the
truthful stand-in. It must NOT be a refusing stub — a refusal bundle is the honest stand-in only
where the real thing would also have nothing to give, and `publish` gives nothing either way.

- [ ] **Step 1: Write the failing test**

Add to `tests/application/commands/requirement/deleteRequirement.test.ts` (create the file
following the sibling tests' `createRepositoryStack` setup if it does not exist):

```ts
it('announces the removal so a project-scoped subscriber can refresh', async () => {
	const stack = createRepositoryStack();
	const seeded = await seedRequirement(stack);          // returns Loaded<Requirement>
	const seen: DomainEvent[] = [];
	stack.events.subscribe('RequirementDeleted', (event) => { seen.push(event); });

	const result = await new DeleteRequirementCommand(stack.requirements, stack.events).execute({
		requirementId: seeded.entity.id,
	});

	expectOk(result);
	expect(seen).toEqual([
		{
			type: 'RequirementDeleted',
			payload: { requirementId: seeded.entity.id, projectId: seeded.entity.projectId },
		},
	]);
});

// The pair, not the count: "an event was raised" is equally true of a build that raises it
// before the write and then fails to delete.
it('announces nothing when the delete refuses', async () => {
	const stack = createRepositoryStack();
	const seen: DomainEvent[] = [];
	stack.events.subscribe('RequirementDeleted', (event) => { seen.push(event); });

	const result = await new DeleteRequirementCommand(stack.requirements, stack.events).execute({
		requirementId: 'requirement-does-not-exist' as RequirementId,
	});

	expect(isErr(result)).toBe(true);
	expect(seen).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/application/commands/requirement/deleteRequirement.test.ts`
Expected: FAIL — the constructor takes one argument, and no event is published.

- [ ] **Step 3: Publish, then wire**

In `src/application/commands/requirement/DeleteRequirement.ts`:

```ts
import type { EventBus } from '../../../core/events/EventBus';
import { requirementDeleted } from '../../../domain/requirement/Requirement.events';

// …

	constructor(
		private readonly requirements: RequirementRepository,
		private readonly events: EventBus,
	) {}

	async execute(
		input: DeleteRequirementInput,
	): Promise<Result<{ requirementId: RequirementId }, ReferenceError | RepositoryError>> {
		const loaded = await loadRequirement(this.requirements, input.requirementId);
		if (isErr(loaded)) return loaded;
		const deleted = await this.requirements.delete(
			input.requirementId,
			input.expected ?? loaded.value.version,
		);
		if (isErr(deleted)) return deleted;
		// AFTER the write, per SDD §32 — an event is a statement that something happened.
		// The project comes off the entity this command has already loaded, so nothing is
		// re-read to supply it.
		await this.events.publish(
			requirementDeleted({
				requirementId: input.requirementId,
				projectId: loaded.value.entity.projectId,
			}),
		);
		return ok({ requirementId: input.requirementId });
	}
```

In `src/plugin/slice10Composition.ts:174`:

```ts
		deleteRequirement: new DeleteRequirementCommand(requirements, events),
```

In `src/presentation/editor/planEditorCommands.ts`, add to `PlanEditorCommandServices`:

```ts
	/**
	 * The bus the REVERSIBLE adapters publish on. The plain commands take their own; these
	 * adapters are constructed here in `presentation/` and had no way to reach one, which is
	 * the mechanical half of why every undo and redo in this plugin announced nothing.
	 *
	 * Required rather than optional: a composition that forgets it must not compile, per the
	 * `CascadeDeps.notify` precedent.
	 */
	readonly events: EventBus;
```

and in `unavailablePlanEditorCommands()`'s returned object, beside `zones: refusingPort()`:

```ts
		// The same local bus the refusing inner commands already take. Nothing subscribes to
		// it and nothing ever publishes on it, because every write in an unrecovered session
		// refuses before it reaches a publish.
		events,
```

Then supply the real bus where `composition-root.ts` builds the editor bundle. Find it with:

```bash
grep -rn "PlanEditorCommandServices" src/plugin/
```

- [ ] **Step 4: Run the test, then the compiler**

Run: `npx vitest run tests/application/commands/requirement/deleteRequirement.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: PASS — and if it does not, the error names a construction site that must supply
`events`. Fix each; do not widen the member to optional.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Announce the exposed requirement removal, and give the editor bundle a bus

DeleteRequirementCommand had one write, no publish, no publishing caller and
no EventBus imported at all, so a deletion through the exposed command left
every subscriber holding a row that is gone. remove-references resolves
through it, so this is not an unused door.

PlanEditorCommandServices gains a REQUIRED events member in the same commit
rather than per adapter. The reversible adapters are constructed in
presentation/ from that bundle and had no way to reach a bus — the mechanical
half of why the whole undo path is silent — and making the member required
turns every construction site into an error the compiler names, rather than a
list somebody assembles.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 3: The create-zone adapter's redo announces, both halves

**Files:**
- Modify: `src/application/commands/zone/reversible-create-zone-command.ts`
- Modify: `src/presentation/editor/runtime.ts:137`
- Test: `tests/application/commands/zone/reversibleCreateZone.test.ts`

**Interfaces:**
- Consumes: `PlanEditorCommandServices.events` (Task 2).
- Produces:
  ```ts
  export interface ReversibleCreateZoneDeps {
      readonly events: EventBus;
      readonly requirements: RequirementRepository;   // the reverse lookup
      readonly logger: Logger;                        // records a refused lookup
  }
  constructor(
      createCommand: CreateCommand,
      deleteCommand: UndoDeleteCommand,
      zones: ZoneRepository,
      ledger: WriteLedger,
      input: CreateZoneInput,
      deps: ReversibleCreateZoneDeps,
  )
  ```
  A bundle rather than three more positional parameters — the adapter is already at five, and
  the sibling delete adapter's `DeleteZoneUndoDeps` is the house shape for exactly this.

**What this task fixes, in two parts.** The adapter's own docblock already records the first:
*"the redo restore publishes nothing — the sibling delete adapter argues at length that a
restore is not a creation. So create → undo → redo → undo emits one create and two deletes."*
The first `execute` and `undo` publish through the plain commands they dispatch; the redo
restores through `restoreZone` directly and announces nothing.

The second part is the cross-project case, and it is the reason the reverse lookup is here at
all. **Nothing subscribes to `ZoneCreated`** — verified: the only cascade handlers are
`onZoneGeometryChanged`, `onAssetPriceOverrideChanged` and `onAssetUpdated` — so a restore runs
no recalculation, and the event names the ZONE's project. A requirement in project A whose
`origin.zoneId` sits in project B keeps a `missingTarget` badge that a fresh read would already
have cleared. That badge is **stale UI rather than accurate state** — `missingTarget` is derived
per read from whether the origin zone loads — which is what makes it worth fixing rather than
tolerating.

**Why the adapter needs a new dependency for it.** `ReversibleCreateZoneCommand` retains
`snapshot: Loaded<Zone>` — the zone and nothing else — and its `undo` dispatches
`DeleteZoneCommand`, which resolves referents internally and hands back none. So the adapter
cannot supply that set from what it holds.

**Why not simply unfilter `ZoneCreated`.** That makes every project's summary re-read on any
zone edit anywhere in the vault — sync traffic — to serve a state only a hand edit produces. The
per-referent publish costs one reverse lookup on a USER GESTURE, a redo in an editor leaf. That
asymmetry is the whole argument.

**The lookup refuses, and the fallback is the blanket refresh.** `listByZone` takes
`getIdsByType('renovation-requirement')` — every requirement id, since the index has no zone
axis — and `filterLoaded` returns on the first read error, BEFORE the zone predicate. So one
malformed requirement note anywhere refuses it. The ordering is what makes that more than an
inconvenience: **the zone write has already succeeded**, so the adapter can neither fail the
operation nor stay silent. It records the refusal and publishes `ProjectIndexRebuilt` — the
payload-less *cannot say which entities changed, refresh anyway* signal — which is truthful
here for exactly the reason it exists.

- [ ] **Step 1: Write the failing tests**

Add to `tests/application/commands/zone/reversibleCreateZone.test.ts`:

```ts
it('announces the restore, so create/undo/redo no longer emits one create and two deletes', async () => {
	const rig = await createZoneAdapterRig();          // existing helper in this file
	const seen: string[] = [];
	rig.events.subscribe('ZoneCreated', () => { seen.push('created'); });
	rig.events.subscribe('ZoneDeleted', () => { seen.push('deleted'); });

	await rig.adapter.execute();
	await rig.adapter.undo();
	await rig.adapter.execute();                        // the redo — the silent half
	await rig.adapter.undo();

	expect(seen).toEqual(['created', 'deleted', 'created', 'deleted']);
});

it('reaches a dependent in ANOTHER project, which the zone event cannot name', async () => {
	const rig = await createZoneAdapterRig();
	await rig.adapter.execute();
	// A hand-edited requirement in project A whose origin zone lives in project B: the
	// residue Decision 3 accepts as honest, and the one row ZoneCreated's filter drops.
	const foreign = await rig.seedRequirementInOtherProject(rig.adapter.createdZoneId!);
	await rig.adapter.undo();

	const seen: unknown[] = [];
	rig.events.subscribe('RequirementInvalidated', (event) => { seen.push(event); });
	await rig.adapter.execute();

	expect(seen).toEqual([
		{ type: 'RequirementInvalidated', payload: { requirementId: foreign.entity.id } },
	]);
});

it('falls back to the blanket refresh when the reverse lookup refuses', async () => {
	const rig = await createZoneAdapterRig();
	await rig.adapter.execute();
	await rig.adapter.undo();
	// The zone write will still succeed; only the lookup after it refuses.
	rig.requirements.failListByZone(vaultUnreadable());

	const seen: string[] = [];
	rig.events.subscribe('ProjectIndexRebuilt', () => { seen.push('rebuilt'); });
	rig.events.subscribe('RequirementInvalidated', () => { seen.push('invalidated'); });
	const result = await rig.adapter.execute();

	// The write stands. The adapter cannot fail an operation that already succeeded.
	expectOk(result);
	expect(seen).toEqual(['rebuilt']);
	expect(rig.logger.errors()).toContainEqual(
		expect.objectContaining({ event: 'zone.restore.referents-unreadable' }),
	);
});
```

If `createZoneAdapterRig` has no `failListByZone` or `seedRequirementInOtherProject`, add them
to the rig in this same commit. **A fake must not be thinner than the real thing** — the
refusal arm is the one this task exists to handle, and a rig that cannot produce it makes the
guard untestable.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/application/commands/zone/reversibleCreateZone.test.ts`
Expected: FAIL — the first on `['created','deleted','deleted']` (the redo is silent), the second
and third on the constructor arity.

- [ ] **Step 3: Implement**

In `src/application/commands/zone/reversible-create-zone-command.ts`:

```ts
import type { EventBus } from '../../../core/events/EventBus';
import type { Logger } from '../../ports/Logger';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import { zoneCreated } from '../../../domain/zone/Zone.events';
import { requirementInvalidated } from '../../../domain/requirement/Requirement.events';
import { projectIndexRebuilt } from '../../events/projectIndex.events';

/**
 * What the redo half needs that the create half does not. A bundle rather than three more
 * positional parameters — this adapter is already at five, and `DeleteZoneUndoDeps` is the
 * sibling's shape for the same reason.
 */
export interface ReversibleCreateZoneDeps {
	readonly events: EventBus;
	/**
	 * The reverse lookup, and a NEW dependency rather than bookkeeping this adapter already
	 * has: it retains `snapshot: Loaded<Zone>` and nothing else, and its `undo` dispatches
	 * `DeleteZoneCommand`, which resolves the referents internally and hands back none.
	 */
	readonly requirements: RequirementRepository;
	readonly logger: Logger;
}
```

Add `private readonly deps: ReversibleCreateZoneDeps` as the sixth constructor parameter, then
replace the restore arm of `execute()`:

```ts
		const written = await restoreZone(this.zones, this.ledger, snapshot);
		if (isErr(written)) return written;
		this.snapshot = written.value;
		this.generation = this.ledger.generation(written.value.entity.id);
		await this.announceRestore(written.value);
		return ok('wrote');
```

and add the method:

```ts
	/**
	 * A restore is a write, and until this existed it was a write nobody heard. Two events,
	 * because they answer two different questions and neither subsumes the other.
	 *
	 * `ZoneCreated` is what the plain command would have raised, and it is filtered by every
	 * consumer to the ZONE's project. That is right for the zone and insufficient for its
	 * dependents: nothing subscribes to `ZoneCreated` at all today (the cascade handlers are
	 * `onZoneGeometryChanged`, `onAssetPriceOverrideChanged` and `onAssetUpdated`), so a
	 * dependent in ANOTHER project — a hand-edited requirement whose `origin.zoneId` sits
	 * here — keeps a `missingTarget` badge a fresh read would already have cleared.
	 *
	 * So the surviving dependents get `RequirementInvalidated`, which carries the
	 * requirement's own id and claims a recalculation is OWED. That is truthful rather than a
	 * name picked off the list: the dependents that SURVIVE a delete resolution are exactly
	 * the ones `delete-anyway` marked stale through `markStalePersisted`, and restoring the
	 * zone does not un-mark them, so one is genuinely owed and can now actually succeed.
	 *
	 * **Where it over-claims, stated rather than left to be found:** a hand-edited requirement
	 * pointing at a zone id that never existed, whose id a later redo happens to create. That
	 * row was never marked stale, so "a recalculation is owed" is stronger than its state
	 * supports. It takes a hand edit and a coincidence of ids, and the alternative is minting
	 * a neutral "this row may read differently" event, which is one gap with two callers and
	 * belongs to whatever forces it rather than to a fix for a naming mistake.
	 */
	private async announceRestore(restored: Loaded<Zone>): Promise<void> {
		const zone = restored.entity;
		await this.deps.events.publish(
			zoneCreated({ zoneId: zone.id, planId: zone.planId, projectId: zone.projectId }),
		);

		const referents = await this.deps.requirements.listByZone(zone.id);
		if (isErr(referents)) {
			// The zone write has ALREADY succeeded, so this cannot fail the operation — and
			// staying silent leaves a cross-project dependent stale, which is the state the
			// per-referent publish exists to prevent. `listByZone` walks every requirement id
			// in the vault and refuses on the first unreadable one, so this needs a malformed
			// note that has nothing to do with this zone.
			//
			// `ProjectIndexRebuilt` is the payload-less "cannot say which entities changed,
			// refresh anyway" arm, and it is the truthful signal here for exactly that reason:
			// the adapter genuinely cannot say which requirements were affected. Every
			// project's summary re-reads once, on a path needing a malformed note AND a zone
			// restore in the same session.
			this.deps.logger.error('zone.restore.referents-unreadable', {
				zoneId: zone.id,
				cause: referents.error,
			});
			await this.deps.events.publish(projectIndexRebuilt());
			return;
		}

		for (const referent of referents.value) {
			await this.deps.events.publish(requirementInvalidated(referent.entity.id));
		}
	}
```

Then update `src/presentation/editor/runtime.ts:137` to pass the sixth argument:

```ts
					const command = new ReversibleCreateZoneCommand(
						context.commands.createZone,
						context.commands.deleteZone,
						context.commands.zones,
						ledger,
						{ /* …unchanged input… */ },
						{
							events: context.commands.events,
							requirements: context.commands.requirementEdits.requirements,
							logger: context.commands.logger,
						},
					);
```

Finally, **update the adapter's class docblock**: the "Known asymmetry in the EVENT stream"
paragraph is now false. Replace it with what is true — the redo announces, and the residue is
the over-claim named in `announceRestore`. A docblock describing a fixed defect reads as a live
one.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run tests/application/commands/zone/reversibleCreateZone.test.ts`
Expected: PASS.

Then **watch the fallback bite**: temporarily replace the `isErr(referents)` body with
`return;` and re-run. Expected: the third case fails at its `expect(seen).toEqual(['rebuilt'])`
assertion — not at a setup error. Restore.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Announce the zone restore, and reach the dependent in the other project

This adapter's own docblock had recorded the first half for three slices:
the redo restores through restoreZone directly, so create/undo/redo/undo
emitted one create and two deletes. It publishes ZoneCreated now and the
paragraph asserting otherwise is gone rather than left reading as live.

The second half is the cross-project case. Nothing subscribes to ZoneCreated
at all, and the event names the zone's project — so a requirement in project
A whose origin zone sits in B keeps a missingTarget badge a fresh read would
already have cleared. Stale UI rather than accurate state, which is what
makes it worth fixing. The surviving dependents are exactly the ones
delete-anyway marked stale, so RequirementInvalidated is truthful: a
recalculation is genuinely owed and can now succeed.

The reverse lookup is a new dependency rather than bookkeeping the adapter
had — it retains the zone snapshot alone. And it can refuse: listByZone
walks every requirement id in the vault and returns on the first unreadable
one. The zone write has already succeeded by then, so the adapter can
neither fail nor stay silent; it records the refusal and publishes
ProjectIndexRebuilt, the payload-less "cannot say which, refresh anyway"
signal that is exactly the truth here.

Unfiltering ZoneCreated is the cheap alternative and is declined: it makes
every project re-read on any zone edit in the vault, to serve a state only a
hand edit produces.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 4: The delete-zone adapter's UNDO announces the zone it restores

**Files:**
- Modify: `src/application/commands/zone/reversible-delete-zone-command.ts`
- Modify: `src/presentation/editor/inspector-wiring.ts:95`
- Test: `tests/application/commands/zone/reversibleDeleteZone.test.ts`

**Interfaces:**
- Consumes: `PlanEditorCommandServices.events` (Task 2).
- Produces: `DeleteZoneUndoDeps` gains `readonly events: EventBus`. **Task 5 threads that same
  member down into `UndoSequenceOps` and adds nothing further to this interface.**

**Which half is silent, measured rather than assumed.** `execute()` dispatches
`this.deleteCommand` on the FIRST call and on every redo alike — it re-reads the zone, takes a
fresh `expected` off the ledger and dispatches again — and the plain `DeleteZoneCommand`
publishes `ZoneDeleted` at its own line 126. **So this adapter's deletes are already
announced.** The silent half is its `undo()`: the zone comes back through `restoreZone` inside
the `restoreEntity` callback, straight against `ZoneRepository`, and nothing publishes.

This is the exact mirror of Task 3, which is what makes the pair coherent: the create adapter's
`undo` dispatches the plain delete (announced) and its redo restores (silent, Task 3); this
adapter's `execute` dispatches the plain delete (announced) and its `undo` restores (silent,
here).

**The cross-project dependents are NOT this task's**, and saying so is what keeps the two tasks
from each doing half of one job. This `undo` restores the requirements through
`undoDeleteResolution`, which Task 5 makes announce per referent — so the requirement in project
A is reached there, by an event carrying A. Adding a reverse lookup here as well would publish
the same fact twice from two places.

- [ ] **Step 1: Write the failing test**

Add to `tests/application/commands/zone/reversibleDeleteZone.test.ts`:

```ts
it('announces the zone it restores, which is the half that does not go through a command', async () => {
	const rig = await deleteZoneAdapterRig();
	const seen: string[] = [];
	rig.events.subscribe('ZoneCreated', () => { seen.push('created'); });
	rig.events.subscribe('ZoneDeleted', () => { seen.push('deleted'); });

	await rig.adapter.execute();
	await rig.adapter.undo();
	await rig.adapter.execute();          // the redo re-dispatches the plain command

	expect(seen).toEqual(['deleted', 'created', 'deleted']);
});

// The rollback path: `undoDeleteResolution` can fail after `restoreEntity` succeeded, and its
// compensation deletes the zone again. Announcing a restore that was taken back is a lie the
// event stream cannot retract.
it('announces nothing for a restore its own rollback undid', async () => {
	const rig = await deleteZoneAdapterRig({ failRequirementRestore: true });
	await rig.adapter.execute();
	const seen: string[] = [];
	rig.events.subscribe('ZoneCreated', () => { seen.push('created'); });

	expect(isErr(await rig.adapter.undo())).toBe(true);

	expect(seen).toEqual([]);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/application/commands/zone/reversibleDeleteZone.test.ts`
Expected: the first FAILS on `['deleted', 'deleted']` — the restore is silent. The second may
pass vacuously today (nothing is ever published, so nothing can be published wrongly); that is
expected and it becomes load-bearing in Step 4.

- [ ] **Step 3: Implement**

In `src/application/commands/zone/reversible-delete-zone-command.ts`, add to
`DeleteZoneUndoDeps`:

```ts
	/**
	 * The bus this adapter's `undo` announces on. Its `execute` needs none: that half
	 * dispatches the plain `DeleteZoneCommand`, on the first call and on every redo alike,
	 * and that command publishes `ZoneDeleted` itself. The restore is the half that goes
	 * straight to the repository port, which is where the whole undo/redo path was silent.
	 */
	readonly events: EventBus;
```

Then publish AFTER the whole undo succeeds, using the box the method already keeps:

```ts
		if (isErr(undone)) return undone;

		if (restored.value !== null) {
			this.snapshot = restored.value;
			// After `undoDeleteResolution` returned ok, never inside `restoreEntity`. That
			// callback runs FIRST and its write is compensated by `removeAgain` when a later
			// requirement restore fails — so publishing there would announce a zone that the
			// rollback deletes again one step later, and an event stream cannot retract.
			const zone = restored.value.entity;
			await this.undoDeps.events.publish(
				zoneCreated({ zoneId: zone.id, planId: zone.planId, projectId: zone.projectId }),
			);
		}
		return ok('wrote');
```

with `import { zoneCreated } from '../../../domain/zone/Zone.events';` and
`import type { EventBus } from '../../../core/events/EventBus';`.

In `src/presentation/editor/inspector-wiring.ts:95`, add to the `undoDeps` literal:

```ts
							events: context.commands.events,
```

- [ ] **Step 4: Run them, then watch the ordering bite**

Run: `npx vitest run tests/application/commands/zone/reversibleDeleteZone.test.ts tests/application/commands/zone/reversibleDeleteZoneWithReferents.test.ts`
Expected: PASS.

Then move the `publish` INTO the `restoreEntity` callback, immediately after
`restored.value = written.value`, and re-run. Expected: the rollback case goes RED. **This is
the ordering a reviewer cannot see from the diff**, so it is proven rather than argued.
Restore.

If the rig has no `failRequirementRestore`, add it in this commit — a fake that cannot produce
the rollback makes the guard untestable.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Announce the zone the delete adapter's undo restores

Measured rather than assumed which half was silent: execute() dispatches the
plain DeleteZoneCommand on the first call and on every redo alike, and that
command publishes ZoneDeleted itself. The silent half is undo(), where the
zone comes back through restoreZone straight against the repository port.

The exact mirror of the create adapter: there the undo dispatches a command
and the redo restores; here the execute dispatches and the undo restores.

Published after undoDeleteResolution returns ok, never inside restoreEntity:
that callback runs first and its write is compensated by removeAgain when a
later requirement restore fails, so publishing there announces a zone the
rollback deletes again one step later. Watched red with the publish moved
inside.

The cross-project dependents are deliberately not handled here — this undo
restores its requirements through undoDeleteResolution, which announces per
referent, so adding a reverse lookup would publish one fact from two places.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 5: `undoDeleteResolution` announces per requirement it restores

**Files:**
- Modify: `src/application/reference/undoDeleteResolution.ts`
- Modify: `src/presentation/editor/inspector-wiring.ts` (thread `events` into `UndoSequenceOps`)
- Test: `tests/application/reference/undoDeleteResolution.test.ts`

**Interfaces:**
- Consumes: `requirementRestored` (Task 1), `DeleteZoneUndoDeps.events` (Task 4).
- Produces: `UndoSequenceOps` gains `readonly events: EventBus`. Task 10 reuses the identical
  split — see below.

**The wording this fixes was reported three times.** The spec bullet said *"publishes for the
requirements it restores"* — a ROLE, with no event named — and the same wording was reported and
fixed at the zone-restore path and at recovery before this sibling was reached.

**Why nothing else reaches project A.** A `delete-anyway` undo returns the requirement from
`stale` to a `current` snapshot **without its effective cost moving**, so
`publishIfEffectiveCostChanged` is correctly silent; and `ZoneCreated` is correctly filtered to
the zone's project. Each half is independently correct behaviour, which is exactly what makes
the gap invisible: nothing is misbehaving anywhere, and A's Overview keeps a stale badge after
an ordinary undo.

**The split is not a new judgement.** `undoDeleteResolution` already computes
`entry.outcome === 'written' ? entry.version : 'absent'` at `restoreOne`, and `recoverOne`
computes the same expression. So: `'written'` → `RequirementRestored`; `'absent'` →
`RequirementCreated` (the forward sequence had REMOVED that referent, so putting it back is a
creation). **One rule covering both callers rather than two descriptions of one act.**

- [ ] **Step 1: Write the failing tests**

```ts
it('announces a written restore even when no figure moved', async () => {
	// delete-anyway: the resolution marked the referent stale; the undo marks it current
	// again and changes no cost. The cost helper is correctly silent, so this event is the
	// only signal there is.
	const rig = await undoResolutionRig({ resolution: 'delete-anyway' });
	const seen: unknown[] = [];
	rig.events.subscribe('RequirementRestored', (event) => { seen.push(event); });
	rig.events.subscribe('CostEstimateChanged', () => { throw new Error('cost must not move'); });

	expectOk(await undoDeleteResolution(rig.ops, rig.sequence, rig.locks));

	expect(seen).toEqual([
		{
			type: 'RequirementRestored',
			payload: { requirementId: rig.referent.entity.id, projectId: rig.referent.entity.projectId },
		},
	]);
});

it('announces a requirement put back from absent as a creation', async () => {
	// remove-references DELETED the referent, so the undo inserts it: a creation, not a
	// restore, and the two say different things to a subscriber.
	const rig = await undoResolutionRig({ resolution: 'remove-references' });
	const seen: string[] = [];
	rig.events.subscribe('RequirementCreated', () => { seen.push('created'); });
	rig.events.subscribe('RequirementRestored', () => { seen.push('restored'); });

	expectOk(await undoDeleteResolution(rig.ops, rig.sequence, rig.locks));

	expect(seen).toEqual(['created']);
});

// The rollback path: a partial failure leaves the vault as the delete left it, so it must
// not leave subscribers believing a restore stood.
it('announces nothing for a restore that was rolled back', async () => {
	const rig = await undoResolutionRig({ resolution: 'delete-anyway', failSecondRestore: true });
	const seen: unknown[] = [];
	rig.events.subscribe('RequirementRestored', (event) => { seen.push(event); });

	expect(isErr(await undoDeleteResolution(rig.ops, rig.sequence, rig.locks))).toBe(true);
	expect(seen).toEqual([]);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/application/reference/undoDeleteResolution.test.ts`
Expected: FAIL — no events at all.

- [ ] **Step 3: Implement**

`UndoSequenceOps` gains `readonly events: EventBus`. **Publish after the whole sequence
succeeds, not inside `restoreOne`** — that is what makes the third case pass: `restoreOne`'s
writes can still be rolled back by a later failure, and an event published from inside it would
be a statement about a write that gets undone one iteration later. Collect the
`(requirementId, projectId, outcome)` triples as the loop runs and publish them in the `try`'s
`return ok(undefined)` arm:

```ts
	const announced: { readonly snapshot: Loaded<Requirement>; readonly created: boolean }[] = [];
	// …inside the loop, after `done.push(restored.value)`:
	announced.push({ snapshot, created: entry.outcome !== 'written' });
	// …replacing `return ok(undefined)`:
	for (const { snapshot, created } of announced) {
		const payload = {
			requirementId: snapshot.entity.id,
			projectId: snapshot.entity.projectId,
		};
		await ops.events.publish(created ? requirementCreated(payload) : requirementRestored(payload));
	}
	return ok(undefined);
```

Add to the function's docblock a fourth bullet beside the existing three, saying why the
announcements are deferred to the end: **the contract is that a failure part-way leaves the
vault exactly as the delete left it, and an event is a statement that something happened.**

- [ ] **Step 4: Run and watch them pass, then mutate**

Run: `npx vitest run tests/application/reference/undoDeleteResolution.test.ts`
Expected: PASS.

Then move the publish INTO `restoreOne` and re-run. Expected: the rollback case goes red. This
is the ordering that a reviewer cannot see from the diff, so it is proven rather than argued.
Restore.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Name the events an undone delete resolution raises

The spec had said "publishes for the requirements it restores" — a role with
no event named — for three rounds, and this was the third site with that
wording.

A delete-anyway undo is where it bites: the requirement returns from stale to
a current snapshot without its effective cost moving, so
publishIfEffectiveCostChanged is correctly silent, and ZoneCreated is
correctly filtered to the zone's project. Both halves right, and nothing
reaches a dependent in another project.

The written/absent split is not a new judgement — undoDeleteResolution
already computes `entry.outcome === 'written' ? entry.version : 'absent'`,
and so does recoverOne, so one rule covers both callers.

Published after the whole sequence succeeds rather than inside restoreOne: a
failure part-way rolls back to the state the delete left, and an event is a
statement that something happened. Watched red with the publish moved inside.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 6: The assign adapter announces both directions

**Files:**
- Modify: `src/application/commands/requirement/reversible-assign-asset-command.ts`
- Modify: `src/presentation/editor/inspector-wiring.ts:118`
- Test: `tests/application/commands/requirement/reversibleAssignAsset.test.ts`

**Interfaces:**
- Consumes: `requirementDeleted` (Task 1), `PlanEditorCommandServices.events` (Task 2).
- Produces: `ReversibleAssignDeps` gains `readonly events: EventBus`.

`redoCreate` publishes `RequirementCreated`; `undo` publishes `RequirementDeleted` when it
actually deleted. **`undo` on a `'found'` outcome writes nothing and must announce nothing** —
that is the `DispatchOutcome` distinction this repository already makes, and publishing there
would tell a subscriber a row is gone that was never this gesture's to remove.

- [ ] **Step 1: Write the failing tests**

```ts
it('announces the re-created requirement on redo', async () => {
	const rig = await assignAdapterRig();
	const seen: unknown[] = [];
	rig.events.subscribe('RequirementCreated', (event) => { seen.push(event); });

	await rig.adapter.execute();          // the plain command publishes this one
	await rig.adapter.undo();
	seen.length = 0;
	await rig.adapter.execute();          // redoCreate — the silent half

	expect(seen).toHaveLength(1);
});

it('announces the removal its own undo performed', async () => {
	const rig = await assignAdapterRig();
	await rig.adapter.execute();
	const seen: unknown[] = [];
	rig.events.subscribe('RequirementDeleted', (event) => { seen.push(event); });

	await rig.adapter.undo();

	expect(seen).toEqual([
		{
			type: 'RequirementDeleted',
			payload: { requirementId: rig.createdId(), projectId: rig.projectId },
		},
	]);
});

// An already-linked pair writes nothing, so its undo removes nothing.
it('announces nothing when its execute found an existing link', async () => {
	const rig = await assignAdapterRig({ alreadyLinked: true });
	await rig.adapter.execute();
	const seen: unknown[] = [];
	rig.events.subscribe('RequirementDeleted', (event) => { seen.push(event); });

	await rig.adapter.undo();

	expect(seen).toEqual([]);
});
```

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run tests/application/commands/requirement/reversibleAssignAsset.test.ts`
Expected: FAIL on all three (constructor arity, then missing events).

- [ ] **Step 3: Implement**

Add `readonly events: EventBus` to `ReversibleAssignDeps`. In `redoCreate`, after the save
succeeds, publish `requirementCreated({ requirementId, projectId })` from the snapshot the
adapter holds. In `undo`, publish `requirementDeleted(...)` **only** in the `kind: 'created'`
arm, after the delete succeeds. Pass `events: context.commands.events` at
`inspector-wiring.ts:118`.

- [ ] **Step 4: Run and watch pass**

Run: `npx vitest run tests/application/commands/requirement/reversibleAssignAsset.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Announce both directions of the assign adapter

redoCreate re-saves the snapshot through the repository port and undo deletes
through it; both were silent. The undo is the reason RequirementDeleted had
to be minted — the vocabulary has no other member meaning a row is gone.

A 'found' outcome wrote nothing, so its undo removes nothing and announces
nothing: publishing there would report a deletion that never happened.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 7: The override adapters' undo announces the cost it moved

**Files:**
- Modify: `src/application/commands/requirement/reversible-override-commands.ts`
- Modify: `src/presentation/editor/inspector-wiring.ts` (both override construction sites)
- Test: `tests/application/commands/requirement/reversibleOverrides.test.ts`

**Interfaces:**
- Consumes: `publishIfEffectiveCostChanged(events, requirement, previous)` — already exported
  from `src/application/commands/requirement/SetRequirementQuantityOverride.ts`.
- Produces: both override adapter constructors gain an `EventBus`.

**Use the existing helper, do not re-derive.** `publishIfEffectiveCostChanged` compares
`previous.amount`/`previous.currency` against `effectiveValue(requirement.estimatedCost)` and
publishes nothing when they match — truthful rather than a gap. Re-spelling that comparison here
is the second-derivation defect this repository has already paid for twice.

A cost-override undo changes the effective total directly; a quantity-override undo reprices the
calculated cost. Both move a figure, and both restore through the repository port.

- [ ] **Step 1: Write the failing test**

```ts
it.each(['quantity', 'cost'] as const)(
	'announces the cost an undone %s override moves back',
	async (kind) => {
		const rig = await overrideAdapterRig(kind);
		await rig.adapter.execute();
		const seen: unknown[] = [];
		rig.events.subscribe('CostEstimateChanged', (event) => { seen.push(event); });

		await rig.adapter.undo();

		expect(seen).toHaveLength(1);
	},
);

// The helper's own truthfulness, asserted here because this is the caller that relies on it.
it('announces nothing when an undo restores the identical figure', async () => {
	const rig = await overrideAdapterRig('cost', { overrideEqualsCalculated: true });
	await rig.adapter.execute();
	const seen: unknown[] = [];
	rig.events.subscribe('CostEstimateChanged', (event) => { seen.push(event); });

	await rig.adapter.undo();

	expect(seen).toEqual([]);
});
```

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run tests/application/commands/requirement/reversibleOverrides.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Each adapter's `undo` already holds the post-write `Snapshot` (`{ entity, postVersion }`). Read
the live requirement's effective cost BEFORE the restore write — that is where `previous`
lives — then call `publishIfEffectiveCostChanged(this.events, restored, previous)` after the
save succeeds.

- [ ] **Step 4: Run and watch pass**

Run: `npx vitest run tests/application/commands/requirement/reversibleOverrides.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Announce the cost an undone override moves back

Both override adapters restore through the repository port, so both were
silent while moving the one figure the read model most cares about.

Through publishIfEffectiveCostChanged rather than a second comparison: the
helper already exists for exactly this, and it publishes nothing when the
figures match, which is truthful rather than a gap. Re-spelling it here is
the second-derivation defect this repository has paid for twice.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 8: The delete resolution announces per referent it touched

**Files:**
- Modify: `src/application/reference/deleteResolution.ts`
- Test: `tests/application/reference/deleteResolutions.test.ts`

**Interfaces:**
- Consumes: `requirementDeleted` (Task 1), `requirementInvalidated`.
- Produces: `ResolutionOps<TEntity>` gains `readonly events: EventBus`. Task 9 threads it in
  from `DeleteAssetDeps`, which already carries a bus.

**The cross-project case is the whole reason.** This file has four writes and no `publish` of
any spelling, and it is reached from BOTH the zone delete and the asset delete. A requirement in
project A whose `origin.zoneId` sits in project B is marked stale here, and the only event that
follows is `ZoneDeleted` carrying B. A's Overview keeps its old total and its old stale count.

**One seam, three arms.** `applyResolutionToRequirement` is the switch that performs every
per-referent write, and it holds `requirement: Loaded<Requirement>` — so the referent's own
`projectId` is already in hand and nothing is re-read to supply it:

| arm | what it wrote | event | why that one |
|---|---|---|---|
| `remove-references` | `removeRequirement` deleted it | `RequirementDeleted` | the row is gone, which is the claim no existing member made |
| `delete-anyway` | `markStalePersisted` | `RequirementInvalidated` | a recalculation is now literally what is owed |
| `reassign` | `repointAndMarkStale` | `RequirementInvalidated` | its figures were derived against the target it no longer points at |

- [ ] **Step 1: Write the failing tests**

Every case seeds the referent in a **different project** from the entity being deleted. A
same-project fixture passes against a build that publishes nothing new, because the zone event
already covers it — so a same-project test certifies the defect.

```ts
it.each([
	['remove-references', 'RequirementDeleted'],
	['delete-anyway', 'RequirementInvalidated'],
	['reassign', 'RequirementInvalidated'],
] as const)('the %s arm announces %s for a referent in another project', async (resolution, type) => {
	const rig = await resolutionRig({ resolution, referentInOtherProject: true });
	const seen: unknown[] = [];
	rig.events.subscribe(type, (event) => { seen.push(event); });

	expectOk(await runDeleteResolution(rig.ops, rig.input));

	expect(seen).toHaveLength(1);
});

it('names the REFERENT’s project, not the deleted entity’s', async () => {
	// The one assertion that discriminates a correct payload from a plausible one: taking the
	// project off the entity being deleted compiles, reads fine, and reaches the wrong pane.
	const rig = await resolutionRig({ resolution: 'remove-references', referentInOtherProject: true });
	const seen: { payload: { projectId: string } }[] = [];
	rig.events.subscribe('RequirementDeleted', (event) => { seen.push(event as never); });

	expectOk(await runDeleteResolution(rig.ops, rig.input));

	expect(seen[0]?.payload.projectId).toBe(rig.referentProjectId);
	expect(seen[0]?.payload.projectId).not.toBe(rig.deletedEntityProjectId);
});

// A resolution that fails part-way is compensated back to the pre-state, so it must not leave
// subscribers believing referent 1 was removed.
it('announces nothing for referents a failed resolution compensated', async () => {
	const rig = await resolutionRig({
		resolution: 'remove-references',
		referentCount: 2,
		failSecondReferent: true,
	});
	const seen: unknown[] = [];
	rig.events.subscribe('RequirementDeleted', (event) => { seen.push(event); });

	expect(isErr(await runDeleteResolution(rig.ops, rig.input))).toBe(true);

	expect(seen).toEqual([]);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/application/reference/deleteResolutions.test.ts`
Expected: the first three FAIL with 0 events. The fourth passes vacuously today and becomes
load-bearing at Step 4.

- [ ] **Step 3: Implement**

Add to `ResolutionOps<TEntity>`:

```ts
	/**
	 * Announced per referent, and the reason is the CROSS-PROJECT case. A requirement in
	 * project A whose `origin.zoneId` sits in project B is marked stale here, and the only
	 * event that used to follow was `ZoneDeleted` carrying B — so A's surfaces kept a total
	 * and a stale count that this resolution had already invalidated.
	 */
	readonly events: EventBus;
```

Have `applyResolutionToRequirement` return the event alongside its progress entry rather than
publishing inline — the resolution is compensated on failure, and an event is a statement that
something happened:

```ts
type AppliedStep = {
	readonly progress: SequenceProgress;
	/** Held until the whole sequence succeeds; see `applyAll`. */
	readonly announcement: DomainEvent;
};
```

Each arm builds its own, from the referent it already holds:

```ts
		case 'remove-references': {
			const removed = await ops.removeRequirement(requirement);
			if (isErr(removed)) return err(removed.error);
			return ok({
				progress: { id: requirement.entity.id, outcome: 'deleted' },
				// The project comes off the REFERENT, never off the entity being deleted:
				// a shared asset has no single project, and a zone's project is precisely
				// the one this event exists to reach past.
				announcement: requirementDeleted({
					requirementId: requirement.entity.id,
					projectId: requirement.entity.projectId,
				}),
			});
		}
```

with `delete-anyway` and `reassign` both building
`requirementInvalidated(requirement.entity.id)`.

`applyAll` collects the announcements beside the progress entries; `runDeleteResolution`
publishes them **after `deleteEntity` has returned ok** — the sequence's last mutation, and the
point past which nothing will be compensated:

```ts
	for (const announcement of applied.announcements) {
		await ops.events.publish(announcement);
	}
```

**Name the residue where the code is**, because deferring buys one silence: if a compensation
itself fails — the `markUncompensated` path — writes are left behind and nothing is announced
about them. That case already has its own channel through the save indicator's
`leftWritesBehind`, and closing it here would mean announcing writes whose extent this function
does not know.

- [ ] **Step 4: Run the whole reference suite, then mutate**

Run: `npx vitest run tests/application/reference/`
Expected: PASS across the directory. `deleteResolutionEngine`, `interleaving`,
`compensationRestore`, `deleteResolutions` and `deleteAssetRefusals` all drive this engine and
will each need an `events` member in their ops fixtures — the compiler names every one.

Then publish inline inside `applyResolutionToRequirement` and re-run. Expected: the compensation
case goes RED. Restore.

Then change the payload to `projectId: ops.entityId`-derived and re-run. Expected: the
names-the-referent's-project case goes RED. **Both mutations, because a payload that is merely
plausible reads exactly like a correct one.**

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Announce each referent a delete resolution touches

Four writes, no publish of any spelling anywhere in the file, reached from
both the zone delete and the asset delete. A requirement in project A whose
origin zone sits in project B is marked stale here, and the only event that
followed was ZoneDeleted carrying B.

One event per arm, chosen by what the arm actually did: remove-references
deletes the row, so RequirementDeleted — the claim no existing member made;
delete-anyway marks it stale, which is precisely a recalculation being owed;
reassign repoints it, so figures derived against the old target are
invalidated.

The project comes off the REFERENT and never off the entity being deleted. A
shared catalogue asset has no single project, and a zone's project is exactly
the one these events exist to reach past — so the payload is asserted
against both, since a plausible one reads like a correct one.

Published after deleteEntity returns ok, the sequence's last mutation and the
point past which nothing is compensated. Watched red with the publish inline.
The residue is named at the code: a compensation that itself fails leaves
writes behind and announces nothing, which already has its own channel.

Every case seeds the referent in a different project from the deleted entity
— a same-project fixture passes against a build that publishes nothing new.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 9: `DeleteAsset`'s resolution paths announce at requirement level

**Files:**
- Modify: `src/application/commands/asset/DeleteAsset.ts`
- Test: `tests/application/reference/deleteAssetRefusals.test.ts` (or a sibling asset-delete test)

**Interfaces:**
- Consumes: Task 8's `ResolutionOps.events` — `DeleteAssetDeps` already carries `events`, so
  this is a THREADING task rather than a new dependency.

`DeleteAsset` publishes `assetDeleted({ assetId })` at line 134, and that payload **carries no
project id**, so it cannot stand for the requirements its resolution touched. With Task 8 in
place the resolution announces them itself; this task's job is to confirm the bus reaches it and
to assert the pair.

- [ ] **Step 1: Write the failing test**

```ts
it('reaches the requirements its resolution touched, which assetDeleted cannot name', async () => {
	// A shared catalogue asset referenced from two projects: assetDeleted carries no project
	// at all, so without requirement-level events neither project's summary can be reached.
	const rig = await deleteAssetRig({ referentsInProjects: ['project-a', 'project-b'] });
	const seen: unknown[] = [];
	rig.events.subscribe('RequirementDeleted', (event) => { seen.push(event); });

	expectOk(await rig.command.execute({ assetId: rig.assetId, resolution: 'remove-references' }));

	expect(seen).toHaveLength(2);
});
```

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run tests/application/reference/deleteAssetRefusals.test.ts`
Expected: FAIL — 0 events, unless Task 8's threading already reaches this caller, in which case
it passes immediately. **If it passes, that is the finding, not a shortcut:** confirm by
mutation (remove `events` from the ops bundle `DeleteAsset` hands the resolution and watch it
go red), then keep the case as the pair-assertion it is and note in the commit that Task 8
covered the write and this covers the reach.

- [ ] **Step 3: Implement**

Pass `events: this.ops.events` into the resolution ops bundle `DeleteAsset` builds.

- [ ] **Step 4: Run and watch pass**

Run: `npx vitest run tests/application/`
Expected: PASS.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Let the asset delete's resolution announce at requirement level

assetDeleted({ assetId }) carries no project id, so it cannot stand for the
requirements a resolution touched — and a catalogue asset is shared across
projects by design, so there is no single project it could have named.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 10: Crash recovery announces, and `RecoveryDeps.events` is required

**Files:**
- Modify: `src/application/reference/recoverInterruptedSequences.ts`
- Modify: `src/plugin/RenovationPlannerPlugin.ts:693`
- Test: `tests/application/reference/recovery.test.ts`

**Interfaces:**
- Consumes: `requirementRestored`, `requirementCreated` (Task 1);
  `publishIfEffectiveCostChanged` (Task 7's helper).
- Produces: `RecoveryDeps` gains `readonly events: EventBus` — **REQUIRED**.

**The ordering is what makes this worse than the other silent writers.** `startPersistence`
publishes `projectIndexRebuilt()` at `RenovationPlannerPlugin.ts:680` and launches
`recoverInterruptedSequences` fire-and-forget at 693 — *after*. So the one blanket signal a
summary subscribes to has already fired by the time recovery writes anything, and the writes it
then makes are plugin-owned: the index updates synchronously and `EchoWindow` suppresses the
vault event, so `ProjectIndexEntryChanged` cannot stand in either. **An Overview mounted at
startup reads the pre-recovery vault and stays on it for the life of the leaf.**

**Awaiting recovery before announcing the rebuild is the tempting alternative and is declined.**
It is the smaller diff and it puts vault reads — unbounded in the number of interrupted
markers — on the path that gates every view's hydration. Startup latency for every user, to
serve a state that exists only after a crash mid-deletion. It would also leave the writes
themselves silent for any subscriber that mounts later.

**Two events per restore, and both are needed.** `RequirementRestored` unconditionally for
every `written` restore, because *this row was written back* is true whatever the figures did —
this is the event that fixes the `delete-anyway` case, where the status returns to `current` and
no cost moves. `CostEstimateChanged` **additionally**, through
`publishIfEffectiveCostChanged`, when the effective cost actually moved. The two say different
things and a subscriber wanting the delta still gets it.

**Nothing is fabricated, and an earlier draft got this wrong by specifying from a name rather
than a payload.** `CostEstimateChanged` requires `previous: Money` and `current: Money`;
`SequenceProgress` is `{ id, outcome, version }` and retains no figure, and
`marker.affectedBefore` holds the BEFORE snapshot — which is what recovery restores, so it
supplies `current` and never `previous`. So recovery **reads the live requirement before it
saves**, which is where `previous` actually lives. That read stays only to serve the cost event.

- [ ] **Step 1: Write the failing tests**

```ts
it('announces a status-only restore, which no cost event can carry', async () => {
	// delete-anyway left the referent stale; the pre-state is current; no figure moves.
	const rig = await recoveryRig({ marker: interruptedDeleteAnyway() });
	const seen: unknown[] = [];
	rig.events.subscribe('RequirementRestored', (event) => { seen.push(event); });
	rig.events.subscribe('CostEstimateChanged', () => { throw new Error('no figure moved'); });

	await recoverInterruptedSequences(rig.deps);

	expect(seen).toEqual([
		{
			type: 'RequirementRestored',
			payload: { requirementId: rig.referentId, projectId: rig.projectId },
		},
	]);
});

it('announces a requirement put back from absent as a creation', async () => {
	const rig = await recoveryRig({ marker: interruptedRemoveReferences() });
	const seen: string[] = [];
	rig.events.subscribe('RequirementCreated', () => { seen.push('created'); });
	rig.events.subscribe('RequirementRestored', () => { seen.push('restored'); });

	await recoverInterruptedSequences(rig.deps);

	expect(seen).toEqual(['created']);
});

it('announces the cost too when the restore actually moved one', async () => {
	const rig = await recoveryRig({ marker: interruptedWithMovedCost() });
	const seen: string[] = [];
	rig.events.subscribe('RequirementRestored', () => { seen.push('restored'); });
	rig.events.subscribe('CostEstimateChanged', () => { seen.push('cost'); });

	await recoverInterruptedSequences(rig.deps);

	expect(seen).toEqual(['restored', 'cost']);
});

it('announces nothing for a refused restore', async () => {
	const rig = await recoveryRig({ marker: interruptedDeleteAnyway(), failSave: true });
	const seen: unknown[] = [];
	rig.events.subscribe('RequirementRestored', (event) => { seen.push(event); });

	await recoverInterruptedSequences(rig.deps);

	expect(seen).toEqual([]);
	expect(rig.logger.errors()).toContainEqual(
		expect.objectContaining({ event: 'sequence.recovery.restore-refused' }),
	);
});

// A COMPLETED sequence is not rolled back, so it announces nothing — the guard recoverOne's
// docblock exists for, asserted so a build that starts publishing here fails.
it('announces nothing for a marker describing a completed sequence', async () => {
	const rig = await recoveryRig({ marker: { ...interruptedDeleteAnyway(), entityDeleted: true } });
	const seen: unknown[] = [];
	rig.events.subscribe('RequirementRestored', (event) => { seen.push(event); });

	await recoverInterruptedSequences(rig.deps);

	expect(seen).toEqual([]);
});
```

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run tests/application/reference/recovery.test.ts`
Expected: FAIL — `RecoveryDeps` has no `events`.

- [ ] **Step 3: Implement**

```ts
export interface RecoveryDeps {
	readonly markers: SequenceMarkerStore;
	readonly requirements: RequirementRepository;
	/**
	 * REQUIRED rather than optional, per the `CascadeDeps.notify` precedent: an optional
	 * collaborator makes a composition that forgets it compile, pass, and say nothing.
	 *
	 * Recovery is the silent writer whose ORDERING makes it the worst of them.
	 * `startPersistence` publishes `projectIndexRebuilt()` and only then launches this
	 * fire-and-forget, so the one blanket signal a summary subscribes to has already fired;
	 * and these writes are plugin-owned, so the index updates synchronously and `EchoWindow`
	 * suppresses the vault event, leaving `ProjectIndexEntryChanged` unable to stand in.
	 * Nothing downstream can compensate.
	 */
	readonly events: EventBus;
	readonly logger: Logger;
}
```

In `recoverOne`'s restore loop, after `const saved = await deps.requirements.save(...)`:

```ts
			if (isErr(saved)) {
				deps.logger.error('sequence.recovery.restore-refused', { /* …unchanged… */ });
				continue;
			}
			const payload = {
				requirementId: snapshot.entity.id,
				projectId: snapshot.entity.projectId,
			};
			// Unconditional for a written restore: "this row was written back" is true
			// whatever the figures did, and the delete-anyway case moves no figure at all —
			// which is exactly the case that used to reach nobody.
			await deps.events.publish(
				expected === 'absent' ? requirementCreated(payload) : requirementRestored(payload),
			);
```

and, for the cost half, read the live requirement BEFORE the save (that is where `previous`
lives) and call `publishIfEffectiveCostChanged(deps.events, saved.value.entity, previous)`
after it. Skip the pre-read for the `'absent'` case — there is no previous figure, and
`RequirementCreated` is the whole statement.

Then `src/plugin/RenovationPlannerPlugin.ts:693`:

```ts
			void recoverInterruptedSequences({
				markers: persistence.markers,
				requirements: persistence.requirements,
				events: this.root.eventBus,
				logger: this.root.logger,
			});
```

Check the exact bus accessor with `grep -n "eventBus" src/plugin/composition-root.ts`.

- [ ] **Step 4: Run and watch pass**

Run: `npx vitest run tests/application/reference/recovery.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Announce what crash recovery restores

One write, no publish, and no EventBus on RecoveryDeps at all. The ordering
is what makes it the worst of the silent writers: startPersistence publishes
projectIndexRebuilt() and only then launches this fire-and-forget, so the one
blanket signal a summary subscribes to has already fired — and these writes
are plugin-owned, so the index updates synchronously and EchoWindow
suppresses the vault event. Nothing downstream can compensate; a surface
mounted at startup reads the pre-recovery vault for the life of the leaf.

Awaiting recovery before announcing the rebuild is the smaller diff and is
declined: it puts vault reads unbounded in the number of interrupted markers
on the path that gates every view's hydration, and would still leave these
writes silent for a subscriber mounting later.

RequirementRestored unconditionally for a written restore — the delete-anyway
case moves no figure, so the cost event is correctly silent and this is the
only signal there is. CostEstimateChanged additionally when a figure did
move, through publishIfEffectiveCostChanged, with the live pre-read that
supplies `previous`; an earlier draft specified that event from its NAME and
its payload turned out unfillable from the marker.

events is REQUIRED, per the CascadeDeps.notify precedent.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 11: The sweep, as a category check with one named carve-out

**Files:**
- Create: `tests/application/events/writerPublishSweep.test.ts`

**Interfaces:**
- Consumes: every preceding task.
- Produces: nothing importable — this is the instrument that holds the property for code not
  yet written.

**Why a test and not a comment.** This defect was found by a sweep, and the sweep was wrong four
times in a row, each correction measured with an instrument that could not see the next layer:
a sample of ADAPTERS → a FILTER that was itself a sample (`UndoableCommand|Reversible` answers a
narrower question than *every write path that publishes nothing*) → a METRIC counting literal
`publish(` syntax, which attributed `SetRequirementCostOverride`'s announcement to the file its
HELPER lives in → an ENUMERATION that trailed its own correct count of thirteen and accounted
for eleven, leaving `recoverInterruptedSequences` named nowhere.

**So the metric must be about the EFFECT, not the spelling.** Count a file as publishing if it
reaches a bus at all — `\.publish\(` OR a call to a known publishing helper
(`publishIfEffectiveCostChanged`) OR an `EventBus` import that the file actually uses. Assert
the finds-something-at-all property, because an instrument that reaches nothing looks exactly
like a clean tree.

**One carve-out, asserted by exact key set** — the repository's shape for every other carve-out
table. `ReversibleSetPlanBackground` writes and deliberately does not publish: a background is
not a cost input, so it moves nothing a summary shows; what it moves is the Plan Editor's own
picture in a second leaf on the same plan. **A carve-out for a path that has since been fixed
reads as a live exception**, so the exact-key-set assertion is what makes the list honest in
both directions.

- [ ] **Step 1: Write the test, and drive the instrument against fixtures FIRST**

```ts
/**
 * Every write path in `src/application` announces, with one named exception.
 *
 * **What this reads and what it therefore cannot see**, stated at the top because a category
 * check that overstates its reach is worse than none: it reads source TEXT for a write call
 * (`.save(`, `.delete(`, `.markStale(`, `.restoreZone(`) and for evidence that the file
 * reaches a bus. A file that writes through a differently-named port method, or publishes
 * through a helper this list does not know, is invisible to it. The fixtures below are what
 * stop it reaching nothing, which is the failure mode that looks exactly like a clean tree.
 */
const WRITE = /\.(save|delete|markStale|restoreZone)\(/;
const PUBLISH = /\.publish\(|publishIfEffectiveCostChanged\(/;

/**
 * Files that write and deliberately do not publish. Asserted by EXACT KEY SET, so a
 * carve-out whose path has since been fixed fails here rather than reading on as a live
 * exception.
 */
const CARVE_OUTS: Readonly<Record<string, string>> = {
	'src/application/commands/plan/ReversibleSetPlanBackground.ts':
		'A background is not a cost input, so it moves nothing a project summary shows. What it '
		+ 'moves is the Plan Editor’s own picture in a second leaf on the same plan, which is '
		+ 'that surface’s decision rather than this increment’s.',
};
```

Then: three fixtures driven through the predicates before `src/` is walked (a file that writes
and publishes; one that writes and does not; one that publishes through the helper), an
assertion that the walk found a non-trivial number of writing files at all, the exact-key-set
assertion on `CARVE_OUTS`, and the sweep itself.

- [ ] **Step 2: Run it and watch it fail**

Temporarily add a `CARVE_OUTS` entry for a path that does not exist and run:
`npx vitest run tests/application/events/writerPublishSweep.test.ts`
Expected: FAIL at the exact-key-set assertion. Remove it.

Then revert Task 10's publish (comment it out) and re-run.
Expected: FAIL naming `recoverInterruptedSequences.ts`. Restore.

**Both directions, watched.** A sweep that only fails when something is missing does not prove
its carve-out list is current.

- [ ] **Step 3: Make it pass**

Run it against the real tree and resolve whatever it names. Every name is either a genuine gap a
preceding task missed — **fix it, do not carve it out** — or a helper whose caller publishes
(`WriteLedger`, `ReferenceLocks`, `restore-zone.ts`), which the predicate should exclude by a
stated RULE rather than by a list of three filenames.

- [ ] **Step 4: Run the whole application suite**

Run: `npx vitest run tests/application/`
Expected: PASS.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Hold "every writer announces" as a category, not as a list

This defect was found by a sweep and the sweep was wrong four times running,
each correction measured with an instrument blind to the next layer: a sample
of adapters, then a filter that was itself a sample, then a metric counting
literal publish( syntax that attributed a file's announcement to the file its
helper lives in, then an enumeration that trailed its own correct count of
thirteen and accounted for eleven.

So the property is checked at the forbidden thing rather than by naming the
places, the metric asks about the EFFECT rather than a spelling, and the
instrument is driven against fixtures before it is pointed at src/ — an
instrument that reaches nothing looks exactly like a clean tree.

ReversibleSetPlanBackground is the one carve-out, asserted by exact key set
so a carve-out whose path has since been fixed fails here instead of reading
on as a live exception. Watched red in both directions.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 12: `RequirementRepository.listByProject`

> **Increment 2 foundation.** This ships with unit tests and no production caller. Read the
> *Why this is increment 1 of two* section above before starting.

**Files:**
- Modify: `src/application/ports/RequirementRepository.ts`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianRequirementRepository.ts`
- Modify: `src/infrastructure/persistence/in-memory/InMemoryRequirementRepository.ts`
- Test: `tests/application/repositories/requirementListByProject.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RequirementListing {
      readonly loaded: readonly Loaded<Requirement>[];
      readonly refused: number;
  }
  // on RequirementRepository:
  listByProject(projectId: ProjectId): Promise<Result<RequirementListing, RepositoryError>>;
  ```
  Mirrors `ZoneListing` exactly, which is the point: skip-and-count is already this
  repository's shape for a read-model listing, and a second spelling of it would be a second
  answer to one question.

**`listByZone` is NOT touched.** Widening the shared method would remove the error
`DeleteZoneCommand` relies on before `runDeleteResolution` — an unreadable requirement
referencing the zone being deleted would not be seen, and the zone would be deleted leaving it
orphaned — and `AssignAssetCommand` leans on the same strict result against a duplicate
assignment. **A read concern must not weaken a write guarantee.**

**The project axis is MIXED, so the listing intersects it with the type.**
`InMemoryProjectIndex.index()` adds every entry carrying a `projectId` to `idsByProject` —
plans, zones and requirements alike — so `getIdsByProject` alone would try to parse a plan as a
requirement. `ObsidianZoneRepository.listByProject` already shows the house pattern; take it:

```ts
	listByProject(projectId: ProjectId): Promise<Result<RequirementListing, RepositoryError>> {
		const requirements = new Set<string>(
			this.deps.index.getIdsByType('renovation-requirement').map(String),
		);
		const ids = this.deps.index
			.getIdsByProject(projectId)
			.filter((id) => requirements.has(String(id))) as RequirementId[];
		return this.listTolerantly(ids);
	}
```

**Skip-and-count, not propagate**, which is the whole difference from `listByZone`: one bad note
is counted once, and only if it is this project's. Unscoped ids meant every per-zone call hit
the same malformed note, so aggregating counted it once per zone — and counted another
project's note against this project.

- [ ] **Step 1: Write the failing tests**

```ts
// Run against BOTH implementations, so the two cannot answer differently.
describe.each([
	['in-memory', createRepositoryStack],
	['obsidian', openFixtureVault],
])('listByProject (%s)', (_name, open) => {
	it('returns this project’s requirements and nothing else', async () => { /* … */ });

	it('counts an unreadable note instead of refusing the whole list', async () => {
		// The difference from listByZone, and the reason this method exists.
	});

	it('counts only THIS project’s unreadable note', async () => {
		// Two malformed notes, one per project. Unscoped ids would count both.
	});

	it('does not try to parse a plan as a requirement', async () => {
		// getIdsByProject is a MIXED axis: plans, zones and requirements all carry a projectId.
		// Without the type intersection this inflates `refused` on every ordinary project.
	});

	it('leaves listByZone strict', async () => {
		// The write guarantee: DeleteZoneCommand relies on this error.
		const listed = await repo.listByZone(zoneId);
		expect(isErr(listed)).toBe(true);
	});
});
```

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run tests/application/repositories/requirementListByProject.test.ts`
Expected: FAIL — the method does not exist.

- [ ] **Step 3: Implement in the port and both implementations**

Add the interface member with a docblock stating the strict/tolerant asymmetry AND why
`listByZone` keeps its contract, then both implementations. Adding the port member makes any
unimplemented repository a build error, which is how both get done.

- [ ] **Step 4: Run and watch pass, then mutate**

Run: `npx vitest run tests/application/repositories/requirementListByProject.test.ts`
Expected: PASS.

Then drop the type intersection and re-run. Expected: the plan case goes red. **Both arms of a
filter, because a filter has two ways to be wrong and the suite only ever covers the one
somebody thought about.**

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Add a tolerant, project-scoped requirement listing

listByZone takes every requirement id in the vault and returns on the first
read error, before the zone predicate. Widening it was the first fix and is
the wrong shape three ways: DeleteZoneCommand relies on that strict error
before runDeleteResolution, so a read concern was about to weaken a write
guarantee; unscoped ids count one bad note once per zone, and count another
project's note against this project; and per-zone delegation costs
zones x all-requirements reads.

So listByProject is new and listByZone is untouched. Skip-and-count over
ZoneListing's shape rather than a second spelling of it, and the mixed
project axis is intersected with the type — getIdsByProject returns plans and
zones too, so the axis alone would try to parse a plan as a requirement.

Ships with tests and no production caller: GetProjectSummary is its first,
in the increment that follows on this branch.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 13: Extract the per-row builder

> **Increment 2 foundation**, as Task 12. Its second caller is `GetProjectSummary`.

**Files:**
- Create: `src/application/queries/buildRequirementRow.ts`
- Modify: `src/application/queries/GetRequirementsForZone.ts`
- Test: `tests/application/queries/buildRequirementRow.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RequirementRowDeps {
      readonly assets: AssetRepository;
      readonly zones: ZoneRepository;
      readonly overrides: AssetPriceOverrideRepository;
      readonly logger: Logger;
  }
  export async function buildRequirementRow(
      deps: RequirementRowDeps,
      requirement: Requirement,
      projectCurrency: Currency | null,
      overrideMemo: Map<ProjectId, ReadonlyMap<AssetId, Loaded<AssetPriceOverride>>>,
  ): Promise<Result<RequirementInspectorDTO, RepositoryError>>;
  ```
  `RequirementInspectorDTO` and its helpers move with it.

**This task is a PURE EXTRACTION — no behaviour change.** The tolerance additions
(`referentsUnreadable`, `projectId` on the DTO, `projectOverride: Money | null | 'unresolved'`)
belong to increment 2, where the summary is what needs them and where their tests can assert
against a surface. Landing them here would be a behaviour change to the Inspector with no
consumer for the new information.

**What the extraction buys, which is the whole point.** A summary re-deriving its own row would
have been silently one input behind from the day the price-override increment merged, and
nothing here would have failed. The currency increment recorded exactly what a second derivation
costs: `inputsStillMatch` hand-spelled the three comparisons `assetMatchesCalculatedFrom`
already made, so a field added to one left the other comparing the old three. Delegating makes
the project total and the Inspector row unable to disagree about whether a figure is stale,
**by construction rather than by care**.

- [ ] **Step 1: Characterise the current behaviour before moving anything**

Run: `npx vitest run tests/application/queries/ --coverage`
Record which cases cover `buildRow` and what `coverage-final.json` says for
`GetRequirementsForZone.ts`. **A pure extraction must not move a coverage number**, and that is
the check that it really was pure.

- [ ] **Step 2: Move the code**

Move `buildRow`, `buildUnitCostGroup`, `isStaleReading`, `RequirementInspectorDTO` and their
imports into `src/application/queries/buildRequirementRow.ts`, converting the private methods
into a module-level function taking `RequirementRowDeps`. Re-export
`RequirementInspectorDTO` from `GetRequirementsForZone.ts` so no consumer's import path moves —
a rename of a widely-imported type is a different change and does not belong in an extraction.

`GetRequirementsForZone.execute` keeps its own per-`execute` currency memo unchanged: it still
walks one zone at a time for the Inspector, where rows can name different projects, and that is
the case the memo was written for.

- [ ] **Step 3: Run the existing suite unchanged**

Run: `npx vitest run tests/application/queries/`
Expected: PASS with **no test edited**. If a case needed changing, the extraction was not pure —
find out why before proceeding.

- [ ] **Step 4: Add the builder's own cases and re-measure**

Add `tests/application/queries/buildRequirementRow.test.ts` covering the builder directly: a
current row, a stale row by persisted marker, a stale row by `calculatedFrom` mismatch, a row
whose asset is gone (`missingTarget: 'asset'`, `unitCost: null`), and a row whose project
currency is `null`.

Run: `npx vitest run tests/application/queries/ --coverage`
Expected: PASS, and the per-file figures for the new module at or above what
`GetRequirementsForZone.ts` measured in Step 1. **Read `coverage-final.json` for the changed
files** — functions has ~1 unit of headroom, and the summary line cannot see one function.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Extract the per-row builder so two callers cannot derive a row differently

A pure extraction: no behaviour change, no test edited, and the coverage
figures re-measured against the pre-move baseline to prove it.

The argument is what the price-override increment already cost once. A
summary re-deriving its own row would have been silently one input behind
from the day that increment merged, and nothing here would have failed —
exactly as inputsStillMatch hand-spelled the three comparisons
assetMatchesCalculatedFrom already made, so a field added to one left the
other comparing the old three.

The tolerance additions the summary needs — referentsUnreadable, the DTO's
projectId, and an unresolved project override — are deliberately NOT here.
They are a behaviour change with no consumer until GetProjectSummary exists.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
```

---

## Task 14: The account

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-02-project-home-design.md`

**Interfaces:** none.

- [ ] **Step 1: Write the `CLAUDE.md` section**

A new section recording what this increment established, written as RULES rather than as a list
of files, per this repository's own standard. At minimum:

- **Every undo and redo was invisible to every subscriber, and it was one defect at thirteen
  sites.** The forward commands publish; the reversible adapters restore through the repository
  PORTS, a boundary this file already records as deliberately raw — and publishing was never
  part of that path. When a boundary is carved out for one reason, ask what ELSE travelled
  through the carve-out.
- **A sweep's own filter can be a sample, and so can its metric, and so can the enumeration
  under a correct count.** Four layers, each correction measured with an instrument blind to the
  next. The remedy is the category test in `tests/application/events/writerPublishSweep.test.ts`
  and its exact-key-set carve-out.
- **Minting an event has two ends.** The publisher, the payload and the subscriber list can each
  be right about everything they name while the two halves never meet. `RequirementRestored`
  shipped with two publishers, a test row and no subscriber, and every file read correctly.
- **A count is only as complete as the question it counts over.**

Update the "three workspace surfaces" style counts only if this increment moved one; it does
not.

- [ ] **Step 2: Amend the spec**

Add an *Amendment* section to
`docs/superpowers/specs/2026-09-02-project-home-design.md` recording the split: Decision 7 and
the two read-model foundations landed as their own increment, with this plan named, and Decision
7's remaining half — `projectSummaryChangeSource` SUBSCRIBING to what is now published — carried
into increment 2.

**Write the carried obligation explicitly**, because the spec's own hardest-won lesson is that a
deferral recorded in prose is a deferral nothing fires: `RequirementDeleted` and
`RequirementRestored` are published and subscribed to by nothing, which is the exact state this
document describes as *"a feature that reads correct in every file"*.

- [ ] **Step 3: Verify every claim you wrote**

For each "the only place X" or count in the new prose, run the grep in the same edit and write
the sentence from what it printed.

- [ ] **Step 4: Full gate**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-02-project-home-design.md
git commit -m "$(cat <<'MSG'
Record what the publishing increment established

Rules rather than a list of files, and the carried obligation stated
explicitly: the two minted events have publishers and no subscriber, which is
the state this spec itself describes as a feature that reads correct in every
file while the two halves never meet. Increment 2 closes it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SxdVGjk59oi24VxVp4HWPx
MSG
)"
git push -u origin claude/plan-editor-user-journey-jak1fl
```

---

## Self-review notes

**Spec coverage.** Decision 7's undo/redo section maps to Tasks 1–11; its two carve-outs
(`ReversibleSetPlanBackground`, and the helpers whose callers publish) to Task 11. Decision 2's
row-builder delegation maps to Task 13. *The walk is project-scoped* maps to Task 12. **Not
covered, and deliberately so** — every part of Decision 7 that SUBSCRIBES
(`projectSummaryChangeSource`, its three lists, its coalescing), all of Decisions 1, 3, 4, 5, 6
and 8, and the DTO tolerance additions. Those are increment 2.

**Carried into increment 2, so nothing is rediscovered:**

1. `projectSummaryChangeSource` must subscribe to `RequirementDeleted` and
   `RequirementRestored`, or both events are published to nobody.
2. `RequirementInspectorDTO` gains `projectId`, `referentsUnreadable`, and
   `unitCost.projectOverride: Money | null | 'unresolved'`; the builder tolerates a failed
   referent read; `projectOverrides` tolerates a refused `listByProject`.
3. `recalculable` is defined from `RecalculateRequirementCommand`'s EXTRACTED precondition check
   — not re-derived — and `blocked` gets its own badge.
4. `GetProjectSummary`'s three walks are each rooted at the project, none reached through
   another.
5. `RenovationProjectView.getState` must serialize `section`, not only parse it.
6. `AssetPriceList` renders at `ProjectDetail.vue:154` and that is its ONLY production render —
   the split must place it, or the per-project price editor is deleted.

**Residues this increment leaves standing, each named at its code rather than only here:**

- `listByZone` stays strict, so one bad requirement note still blanks the Plan Editor's
  Requirements panel for every zone. Pre-existing; fixing it means deciding what a partial
  Inspector panel shows, which is the Plan Editor's surface to design.
- `registerOnZoneGeometryChanged`'s abort path publishes no requirement event when `listByZone`
  refuses — the second face of the same residue, and not silent to the user
  (`cascadeAborted` raises a warning notice).
- Task 3's `RequirementInvalidated` over-claims for a hand-edited requirement pointing at a zone
  id that never existed whose id a later redo happens to create.
- `recoverOne`'s two-marker-write residue is untouched.
