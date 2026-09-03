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
| `tests/application/events/reversibleWritePathCensus.test.ts` | The census: one behavioural row per adapter and direction, plus a crude over-inclusive discovery that forces an explicit disposition for every adapter class in `src/**`. `ReversibleSetPlanBackground` is a row asserting it publishes nothing. |
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

> **DONE** — commit `bc0ad1c`, review clean. Start at Task 2.

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

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/domain/requirement/requirementEvents.test.ts`
Expected: FAIL — `requirementDeleted is not a function` (or a TS resolution error on the import).

- [x] **Step 3: Mint the two events**

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

- [x] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/domain/requirement/requirementEvents.test.ts`
Expected: PASS, 2 tests.

- [x] **Step 5: Full gate, then commit**

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

> **DONE** — commits `71826d0` + `2dc929b` (one fix round), review clean. Start at Task 3.

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

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/application/commands/requirement/deleteRequirement.test.ts`
Expected: FAIL — the constructor takes one argument, and no event is published.

- [x] **Step 3: Publish, then wire**

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

- [x] **Step 4: Run the test, then the compiler**

Run: `npx vitest run tests/application/commands/requirement/deleteRequirement.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: PASS — and if it does not, the error names a construction site that must supply
`events`. Fix each; do not widen the member to optional.

- [x] **Step 5: Full gate, then commit**

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

> **DONE** — commit `40405c3`, review clean, no fix round. Start at Task 4.

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

- [x] **Step 1: Write the failing tests**

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

// **Seed the referent AFTER the undo, and the ordering is load-bearing rather than
// stylistic.** `ReversibleCreateZoneCommand.undo()` dispatches `DeleteZoneCommand` with
// `{ zoneId, expected }` and NO `resolution`, and `applyResolutionToRequirement`'s
// `case undefined` refuses with `reference.resolution-required` whenever live referents
// exist. So seeding first makes the undo refuse, the zone stay, and the next `execute()`
// attempt an `'absent'` restore that also refuses — a test that cannot pass against any
// implementation of this task. Reported against the first draft, which did exactly that.
//
// Seeding after the undo is the honest reconstruction of the case anyway: the scenario is a
// HAND-EDITED requirement pointing at a zone id, which is a thing that appears in the vault
// independently of this gesture, not a referent the delete path ever consented to.
it('reaches a dependent in ANOTHER project, which the zone event cannot name', async () => {
	const rig = await createZoneAdapterRig();
	await rig.adapter.execute();
	const zoneId = rig.adapter.createdZoneId!;
	await rig.adapter.undo();
	// A hand-edited requirement in project A whose origin zone lives in project B: the
	// residue Decision 3 accepts as honest, and the one row ZoneCreated's filter drops.
	const foreign = await rig.seedRequirementInOtherProject(zoneId);

	const seen: unknown[] = [];
	rig.events.subscribe('RequirementInvalidated', (event) => { seen.push(event); });
	await rig.adapter.execute();

	expect(seen).toEqual([
		{ type: 'RequirementInvalidated', payload: { requirementId: foreign.entity.id } },
	]);
});

// A THROWN lookup, not a refused one. The ports are raw at this boundary, so a vault fault
// arrives as a rejection — and letting it escape leaves the zone restored, the command stuck
// on the redo stack, and the retry refused by `restoreZone`'s `'absent'` condition.
it('falls back to the blanket refresh when the reverse lookup FAULTS', async () => {
	const rig = await createZoneAdapterRig();
	await rig.adapter.execute();
	await rig.adapter.undo();
	rig.requirements.throwFromListByZone(new Error('vault exploded'));

	const seen: string[] = [];
	rig.events.subscribe('ProjectIndexRebuilt', () => { seen.push('rebuilt'); });
	const result = await rig.adapter.execute();

	// Resolved, never rejected: the zone write already succeeded.
	expectOk(result);
	expect(seen).toEqual(['rebuilt']);
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

- [x] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/application/commands/zone/reversibleCreateZone.test.ts`
Expected: FAIL — the first on `['created','deleted','deleted']` (the redo is silent), the second
and third on the constructor arity.

- [x] **Step 3: Implement**

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

		// `listByZone` can REJECT as well as refuse. The repository ports are raw at this
		// boundary — `CLAUDE.md` records that carve-out, and it is the reason a vault fault
		// arrives here as a throw rather than as a coded `Result`. Letting it escape is worse
		// than the silence this method exists to fix: `execute()` would reject with the zone
		// already restored, `CommandHistory` would leave the command on the REDO stack, and the
		// retry would hit `restoreZone`'s `'absent'` condition against a zone that is now
		// present — an existing zone that history can neither undo nor redo. Reported by review
		// against the first draft of this method, which handled `isErr` and nothing else.
		const referents = await this.deps.requirements
			.listByZone(zone.id)
			// `persistenceError` from `application/errors.ts`, NOT `faultError`. An earlier draft
			// of this plan wrote `faultError(code, cause)` here and at Task 10; that function
			// exists only in `presentation/notices/notify.ts`, takes `(cause, logger, event)`,
			// and is unreachable from `application/` under the layer ban. Found by the
			// implementer against the compiler rather than by review.
			.catch((cause: unknown) =>
				err(persistenceError('zone.restore.referents-faulted', 'The zone restore could not enumerate referents.', cause)));
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

- [x] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run tests/application/commands/zone/reversibleCreateZone.test.ts`
Expected: PASS.

Then **watch the fallback bite**: temporarily replace the `isErr(referents)` body with
`return;` and re-run. Expected: the third case fails at its `expect(seen).toEqual(['rebuilt'])`
assertion — not at a setup error. Restore.

- [x] **Step 5: Full gate, then commit**

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

> **DONE** — commit `6b683dc`, review clean, no fix round. Start at Task 5.

**Files:**
- Modify: `src/application/commands/zone/reversible-delete-zone-command.ts`
- Modify: `src/presentation/editor/inspector-wiring.ts:95`
- Modify: `tests/helpers/slice10.ts` — its typed `zoneUndoDeps()` factory builds this bundle, and
  the required member makes it a compile error. So does the inline literal in
  `reversibleDeleteZoneWithReferents.test.ts`, which Step 4 runs and which exercises `undo()`:
  left alone it either fails typechecking or reaches `this.undoDeps.events.publish` with no bus.
  Reported by review; the compiler names both regardless, which is what the required member is for.
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

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/application/commands/zone/reversibleDeleteZone.test.ts`
Expected: the first FAILS on `['deleted', 'deleted']` — the restore is silent. The second may
pass vacuously today (nothing is ever published, so nothing can be published wrongly); that is
expected and it becomes load-bearing in Step 4.

- [x] **Step 3: Implement**

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

- [x] **Step 4: Run them, then watch the ordering bite**

Run: `npx vitest run tests/application/commands/zone/reversibleDeleteZone.test.ts tests/application/commands/zone/reversibleDeleteZoneWithReferents.test.ts`
Expected: PASS.

Then move the `publish` INTO the `restoreEntity` callback, immediately after
`restored.value = written.value`, and re-run. Expected: the rollback case goes RED. **This is
the ordering a reviewer cannot see from the diff**, so it is proven rather than argued.
Restore.

If the rig has no `failRequirementRestore`, add it in this commit — a fake that cannot produce
the rollback makes the guard untestable.

- [x] **Step 5: Full gate, then commit**

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
- Modify: `src/application/commands/zone/reversible-delete-zone-command.ts` — the `UndoSequenceOps`
  literal in its `undo()` (around line 159) is the ONLY construction site of that bundle in
  `src/`; an earlier draft named `inspector-wiring.ts` here, which builds `DeleteZoneUndoDeps`
  (Task 4's bundle) and not this one.
- Modify: every TEST that builds `UndoSequenceOps` — the required member makes each a compile
  error the compiler names. Do not weaken it to optional to make them pass.
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
	// COLLECTED, never thrown. `createEventBus`'s `deliver` wraps every handler in a `.catch`
	// and swallows what it caught (EventBus.ts, "isolated at BOTH layers"), so a throwing
	// subscriber asserts NOTHING — `publish` still resolves and the case passes whether or not
	// the forbidden event was emitted. Reported against the first draft, which threw here.
	const costs: unknown[] = [];
	rig.events.subscribe('CostEstimateChanged', (event) => { costs.push(event); });

	expectOk(await undoDeleteResolution(rig.ops, rig.sequence, rig.locks));

	expect(seen).toEqual([
		{
			type: 'RequirementRestored',
			payload: { requirementId: rig.referent.entity.id, projectId: rig.referent.entity.projectId },
		},
	]);
	expect(costs).toEqual([]);
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

**And fix the stale revision, which is a behavioural bug this task would otherwise ship.**
Reported against the first draft, which added publication and nothing else. `redoCreate()` saves
a NEW repository revision, while the `created` outcome still holds the FIRST execute's version —
so on `execute → undo → redo → undo`, the second undo presents a stale `expected`, the delete
refuses, and no `RequirementDeleted` is published because the write never happened. The event gap
is the symptom; the stale version is the cause, and adding the publish without it produces a
cycle that is silent for a *correct* reason, which is the worst of both.

`redoCreate` must update the recorded version from `saved.value.version`. The case is the FULL
four-operation cycle — execute, undo, redo, undo — asserting the second undo SUCCEEDS and
publishes. A two-operation case passes against the stale version and proves nothing about it.

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
- Modify: `src/application/commands/zone/DeleteZone.ts` — it calls `runDeleteResolution` at line
  79 and builds the ops bundle at 114, and it already holds `this.ops.events` (it publishes
  `zoneDeleted` at 126), so threading is one line. **Without it Task 8 cannot compile**: making
  `ResolutionOps.events` required breaks both production callers, and Task 9 wires only the
  ASSET one. Reported twice — first by this plan's own pre-flight scan, whose ruling never
  reached this list, and then by review against the omission that ruling was meant to fix.
- Modify: every TEST that builds a `ResolutionOps` bundle — `deleteResolutionEngine`,
  `interleaving`, `compensationRestore`, `deleteResolutions` and `deleteAssetRefusals` all drive
  this engine. The compiler names each one.
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
| `reassign` | `repointAndMarkStale`, then `recalculateInline` | **depends on the recalculation outcome** | see below — announcing unconditionally makes the event false exactly when the recalculation worked |

- [ ] **Step 1: Write the failing tests**

Every case seeds the referent in a **different project** from the entity being deleted. A
same-project fixture passes against a build that publishes nothing new, because the zone event
already covers it — so a same-project test certifies the defect.

```ts
it.each([
	['remove-references', 'RequirementDeleted'],
	['delete-anyway', 'RequirementInvalidated'],
	// `reassign` is NOT in this table — its event depends on the inline recalculation's
	// outcome and gets its own pair of cases below.
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

with `delete-anyway` building `requirementInvalidated(requirement.entity.id)`.

**`reassign` cannot answer before it acts, and the first draft had it lying.** Reported: that arm
repoints, marks stale, and then runs `recalculateInline`. When that recalculation SUCCEEDS,
`RecalculateRequirementCommand` has already saved the row as `current` and published
`RequirementRecalculated` itself — so a `RequirementInvalidated` announced afterwards claims a
recalculation is OWED for a row that is current and freshly derived. That event's own docblock
defines it as the transient notification that one is owed; publishing it here makes it false at
the moment it is sent.

So this arm's announcement is chosen from the outcome the step already computes:

- recalculation **succeeded** → announce NOTHING from here. The recalculate command published
  `RequirementRecalculated`, and `CostEstimateChanged` if the figure moved. A second event would
  be a duplicate or a contradiction.
- recalculation **refused** → `RequirementInvalidated` is truthful: the row was repointed, its
  stale marker is persisted, and a recalculation is genuinely still owed. This is the failure the
  existing code already logs as `requirement.reassignment-recalculation.failed` and deliberately
  does not fail the sequence for.

Two cases, one per outcome, and the second drives a REFUSING `recalculateInline` — a single
success case passes against a build that always invalidates, which is the defect being fixed.

**A successful inline recalculation announces BEFORE the sequence commits, and that is
pre-existing rather than this task's doing — but this task is what makes it visible, so it is
answered here.** Reported and verified at both ends: `RecalculateRequirement.ts:144-155`
publishes `RequirementRecalculated` and then `publishIfEffectiveCostChanged` immediately after
its own save; and `runDeleteResolution` calls `compensate(...)` when a LATER referent fails
(`deleteResolution.ts:455`) or when `deleteEntity` fails (`:458`). So a reassignment that
recalculated successfully and was then rolled back has already told every subscriber about a
state the vault no longer holds, and nothing follows to correct it — an open Inspector refreshes
onto a temporary reassignment and keeps it.

**Buffering the recalculate command's events is the reported remedy and is declined here.** That
command has its own callers — the geometry cascade, the price cascade, the asset-update
handler — and giving it a suppressible bus for one caller's benefit changes a shared contract
from inside a resolution. It is also a larger change than this increment's subject.

**A compensating announcement is what ships**, and it lives entirely in this file: when
`compensate` successfully rolls a referent back, publish **`RequirementRestored`** for it.

**Not `RequirementInvalidated`, and the first draft of this paragraph said `Invalidated` — the
third time in this document that an event was chosen from its role rather than its contract, and
the second time in the same task.** `compensate` writes the pre-state SNAPSHOT back, which for a
row that was `current` before the resolution restores it to `current`. Claiming a recalculation
is owed for that row is false in exactly the way the arm above was just corrected for.
`RequirementRestored` — minted by this increment for precisely a snapshot write, with two
publishers already — says what happened and needs no new vocabulary. Reported.

**Announce only for referents whose restore actually SUCCEEDED**, which `compensate` already
knows per entry. A blanket announcement after a partial rollback would claim restoration for rows
still holding their intermediate state.

### The rollback this rests on cannot succeed today, and that is a PRE-EXISTING defect

Reported, and verified at the source rather than reasoned about:

- `ResolutionOps.recalculateInline(requirementId): Promise<Result<unknown, AppError>>`
  (`deleteResolution.ts:130`) returns **no revision**.
- `repointAndMarkStale` returns the revision ITS OWN save produced (`:115`), and
  `applyResolutionToRequirement` records that one in `SequenceProgress` (`:325`).
- `recalculateInline` then runs (`:330`) and **saves again**, bumping the revision past what
  `progress` holds.

So on the `reassign` arm, whenever the inline recalculation SUCCEEDS, the recorded expectation is
already stale — and `compensate`'s `restoreRequirement` presents it and is refused. **A
successfully-recalculated reassignment cannot be rolled back at all**, with or without any event
this increment adds. That is a data-integrity defect on `main`, not an event defect, and it is
older than this plan.

**This increment does NOT fix it**, and the reason is scope rather than difficulty: the fix is to
return the recalculation's saved revision and record it, which changes a shared `ResolutionOps`
signature and the engine's progress accounting — a correctness change to the compensation engine
that deserves its own increment, its own cases and its own review, not a paragraph inside an
announcement task.

**What that means for the announcement, stated so it is not read as more than it is:** on the
`reassign`-succeeded path the rollback refuses, so no restore happens, so no `RequirementRestored`
is published — which is truthful. The compensating announcement is real for every other arm
(`remove-references`, `delete-anyway`, and `reassign` whose recalculation refused), and its case
must therefore be built on one of THOSE rather than on the reassign-succeeded path the earlier
draft named. A case built on the broken path would fail for a reason that has nothing to do with
this task.

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
	// Collected rather than thrown — see the sibling case: the bus swallows handler throws.
	const costs: unknown[] = [];
	rig.events.subscribe('CostEstimateChanged', (event) => { costs.push(event); });

	await recoverInterruptedSequences(rig.deps);

	expect(seen).toEqual([
		{
			type: 'RequirementRestored',
			payload: { requirementId: rig.referentId, projectId: rig.projectId },
		},
	]);
	expect(costs).toEqual([]);
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

**The pre-read is BEST-EFFORT and must not gate the restore.** Reported against the first draft
of this task, and it is the sharper half of the whole design: a malformed live note is exactly
what `getById` refuses and exactly what `save(snapshot.entity, expected)` can still overwrite,
because the save conditions on the index revision rather than on a successful parse. So gating
the restore on the pre-read would refuse to recover **precisely the rows recovery exists for**
— and worse, a rejection propagates to `recoverInterruptedSequences`' outer `catch`, abandoning
every marker after this one, for want of an OPTIONAL cost payload.

So: a failed pre-read is logged and the restore proceeds. `RequirementRestored` still goes out,
because the row really was written back; only `CostEstimateChanged` is omitted, because the
delta genuinely cannot be computed. Spell it as a value rather than a control-flow branch —
`previous` is `Money | null`, and `null` means *no cost event*, never *do not restore*:

```ts
			// Best-effort, never a gate. A malformed live note is what this refuses AND what
			// the save below can still overwrite, so failing here would abandon the row that
			// most needs recovering — and the throw would take every later marker with it.
			// `.catch` as well as `isErr`, because this port is raw at this boundary and a vault
			// fault arrives as a REJECTION. Without it the direct `await` exits before the save
			// and the outer catch abandons every later marker — which is the exact defect the
			// best-effort rule was written to fix, reintroduced by the fix for it. Reported.
			const live = expected === 'absent'
				? null
				: await deps.requirements
						.getById(snapshot.entity.id)
						// `persistenceError` from `application/errors.ts` — see Task 3's note: `faultError`
						// is presentation-only and takes a different shape entirely.
						.catch((cause: unknown) =>
							err(persistenceError('sequence.recovery.cost-baseline-faulted', 'The cost baseline could not be read.', cause)));
			const previous = live !== null && isOk(live) && live.value !== null
				? effectiveValue(live.value.entity.estimatedCost)
				: null;
			if (live !== null && isErr(live)) {
				deps.logger.warn('sequence.recovery.cost-baseline-unreadable', {
					requirementId: snapshot.entity.id,
					cause: live.error,
				});
			}
```

Two cases cover it — a REFUSED pre-read and a REJECTED one, because they arrive through
different arms and a case for one passes against a build that mishandles the other. Each asserts
that the marker still restores, still raises `RequirementRestored`, raises no
`CostEstimateChanged`, and **leaves the following marker processed** — that last clause is what pins the outer-catch consequence, and a case asserting
only the first three passes against a build that aborts the rest of the run.

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

## Task 11: The census, behavioural per direction, with a static check on the ENUMERATION

**Files:**
- Create: `tests/application/events/reversibleWritePathCensus.test.ts`

**Interfaces:**
- Consumes: every preceding task.
- Produces: nothing importable — this is the instrument that holds the property for code not
  yet written.

### Read this before writing anything: the instrument has been wrong four times

This defect was found by a sweep, and every version of the sweep has been a **containment
boolean at a finer grain**:

1. a sample of ADAPTERS;
2. a FILTER that was itself a sample (`UndoableCommand|Reversible` answers a narrower question
   than *every write path that publishes nothing*);
3. a METRIC counting literal `publish(` syntax, which attributed `SetRequirementCostOverride`'s
   announcement to the file its HELPER lives in;
4. an ENUMERATION that trailed its own correct count of thirteen and accounted for eleven;
5. this task's first draft — a per-FILE grep, which passes when one of a reversible adapter's
   two directions loses its publication;
6. this task's second draft — a per-FUNCTION AST walk, **which review then showed has the
   identical defect one level down**: a method with writes in both branches and a publish in
   only one branch still reduces to *contains a write* AND *contains a publish*, and passes.

**The refinement is not converging, and a seventh grain is not the answer.** The next one is
control-flow reachability — real static analysis, in a test file, with its own blind spots, as
the fourth iteration of an instrument that has been wrong three times in three rounds. This
repository's own rule is that an instrument which overstates its reach is worse than none,
because it certifies the gap.

**So the design inverts.** Text scanning does the one thing it is reliable at — finding files —
and BEHAVIOUR settles the thing only behaviour can: whether a given direction of a given
adapter actually announced. Both review rounds offered exactly this as the alternative
("or retain explicit behavioral coverage for every direction"), and it is taken.

**A second, concrete finding forced the same conclusion**, and it is the one that makes the
static sweep unshippable rather than merely weak. Verified at the source:
`ReferenceLocks.ts:181` `this.waiters.delete(wake)`, `ReferenceLocks.ts:198` `map.delete(id)`
and `WriteLedger.ts:164` `this.versions.delete(id)` are `Map`/`Set` operations whose receiver
is not the bare `this` node — so the receiver rule does not exclude them and all three classify
as persistence writes. Those functions publish nothing, so **the sweep as specified could not
pass** without carve-outs that contradict its own exact-key-set contract. Distinguishing a
`Map.delete` from a `RequirementRepository.delete` by text means knowing the receiver's TYPE,
which is the type checker's job and not a regex's.

### What to build

**Part A — the behavioural census.** One table, one row per (module, direction), each row a real
test that drives the real path against an in-memory stack and asserts the events it must raise.
The table is the specification; the rows are the proof.

| module | direction | must publish |
|---|---|---|
| `reversible-create-zone-command` | execute (first) | `ZoneCreated` |
| `reversible-create-zone-command` | execute (redo) | `ZoneCreated` + per-referent `RequirementInvalidated`, or `ProjectIndexRebuilt` on a refused/faulted lookup |
| `reversible-create-zone-command` | undo | `ZoneDeleted` |
| `reversible-delete-zone-command` | execute (first and redo) | `ZoneDeleted` |
| `reversible-delete-zone-command` | undo | `ZoneCreated` + `RequirementRestored`/`RequirementCreated` per restored referent |
| `reversible-assign-asset-command` | execute (first) | `RequirementCreated` |
| `reversible-assign-asset-command` | execute (redo) | `RequirementCreated` |
| `reversible-assign-asset-command` | undo (created) | `RequirementDeleted` |
| `reversible-assign-asset-command` | undo (found) | nothing — it wrote nothing |
| `reversible-override-commands` (quantity) | undo | `CostEstimateChanged` when the figure moves |
| `reversible-override-commands` (cost) | undo | `CostEstimateChanged` when the figure moves |
| `ReversibleCalibratePlan` | execute | its existing event |
| `ReversibleCalibratePlan` | undo | its existing event |
| `MoveSpatialObject` | execute | `ZoneGeometryChanged` |
| `MoveSpatialObject` | undo | `ZoneGeometryChanged` |
| `ReversibleAssetGeometryEdit` (in `ReversibleAssetDesignCommands.ts`) | execute | its existing events |
| `ReversibleAssetGeometryEdit` | undo | its existing events |
| `ReversibleAssetNoteEdit` | execute | its existing events |
| `ReversibleAssetNoteEdit` | undo | its existing events |
| `ReversibleAssetBackgroundEdit` | execute | its existing events |
| `ReversibleAssetBackgroundEdit` | undo | its existing events |
| `ReversibleSetPlanBackground` | execute, undo | **nothing — the carve-out** |

**Read the last four groups from the tree rather than from this table**: they are adapters this
increment does not otherwise touch, and the table is written from a census taken while planning.
Where a row's "existing event" differs from what the code actually publishes, **the code is
right and this table is stale** — fix the table, and say so in your report.

Duplicating an assertion that a Task 3–10 test already makes is fine and intended. This file is
the CENSUS: one place a reader sees every direction and what it owes. Duplicating an assertion
is not the duplication this repository warns about, which is duplicated logic.

**Part B — the static check, narrowed to the one question text can answer.** Not *does this
publish*, but *is this path in the table at all*:

```ts
/**
 * Every reversible write path in `src/application` is enumerated in the census above.
 *
 * **This is deliberately NOT a check that anything publishes.** Four versions of that check
 * shipped as containment booleans at successively finer grain — file, then function — and each
 * passed the exact regression it existed to prevent, because "the body contains a publish" is
 * not "this path publishes". Whether a direction announces is settled by its ROW above, which
 * drives it and looks.
 *
 * What text CAN answer reliably is which modules exist, and that is the whole of this check:
 * a new reversible adapter fails here for being unenumerated, and its author then has to write
 * a row — which is the "holds for code not yet written" property the sweep was reaching for,
 * relocated to the question a scan can actually settle.
 */
```

**Over-discover and force an explicit disposition — the fifth granularity finding is what
retired the discover-precisely approach.** Reported, and both halves verified at the source:

- **The scan root was wrong.** `ReversibleMoveZoneCommand` is declared at
  `src/presentation/editor/tools/reversible-move-zone-command.ts:63` and `implements
  UndoableCommand`. A walk over `src/application/**` cannot see it at all.
- **A declaration scan cannot see an INHERITED member.** `ReversibleOverrideBase` is abstract
  and declares `execute` and `undo`; `ReversibleSetRequirementQuantityOverrideCommand` and
  `ReversibleSetRequirementCostOverrideCommand` extend it and declare NEITHER. So the walk finds
  the abstract base and misses both concrete adapters — the ones the census is about.

Chasing those two would be the fifth refinement of one idea in six rounds (file → function →
module → class → layer-and-inheritance), and each refinement has been correct about the axis it
was given and blind to the next. **So the discovery inverts to the posture the rest of this file
already takes: over-refuse rather than under-refuse.**

Discovery is deliberately CRUDE and over-inclusive, and **the unit is the CLASS, not the
file** — keying it by file was reported as the sixth instance of this same defect, because
adding an adapter class to an already-disposed module leaves the file-key set unchanged and the
assertion passes without a behavioural row. The inversion was right and I applied it at the
wrong grain, which is this plan's own recurring shape one more time.

So: every `class <Name>` declared in any file under `src/**` that mentions an `undo` member,
**plus the transitive `extends` closure of that set** — repeatedly add any class whose
`extends <Name>` names a class already in it, until it stops growing.

The closure is what the seventh round of this finding forced, and the hole it closes is exact: a
standalone file holding only `class NewAdapter extends ReversibleBase {}` declares a class and
mentions no `undo` anywhere, so a file-mentions-`undo` filter never scans it and the exact-key
assertion passes with no behavioural row. The claim that inherited adapters were covered was
true only when a base or sibling happened to put the word in the same file. The closure is cheap
— measured, `src/**` holds 111 class declarations and only **20** of them extend anything at all
— and it is still textual: no type resolution, no layer list, no export filter.

Dispositioning all 111 classes was the alternative and is refused: it taxes every future
unrelated class in the codebase with a census entry, which is a cost paid by people who are not
touching adapters.

**And here is the sentence this task has been missing for seven rounds, which matters more than
the closure.** The behavioural rows in Part A are the GUARANTEE. This discovery is a TRIPWIRE
with stated limits, not a proof of completeness — and every previous version of this section
claimed completeness and was wrong within one round, on an axis the previous fix had not
modelled. Six of those claims are in this file's own git history. So, stated rather than
claimed away, what the tripwire does NOT catch:

- an adapter that is not a `class` at all — an object literal or a factory return satisfying
  `UndoableCommand` structurally;
- a class reaching `undo` neither by the word appearing in its file nor by an `extends` chain
  rooted in such a file;
- a direction added to a class that already has a disposition, if that disposition's `rows:`
  list is not updated — which the table cross-check catches only for directions it names.

Each of those is a real way a silent adapter could enter the tree, and the answer to all three
is the same: **the census table is maintained by people, and the tripwire only lowers the odds
of forgetting.** A reader who needs the guarantee reads Part A.

Every discovered CLASS must carry an explicit entry in a `DISPOSITIONS` map:

```ts
/**
 * Every CLASS declared in a `src/**` file that mentions an `undo` member, and what the census
 * does about it. Keyed `<repo-relative file>::<ClassName>`, because a file key cannot see a
 * class ADDED to a file that already has one — reported, and the sixth instance of one defect.
 *
 * Two shapes, and a class must be one of them:
 *
 *   'rows: execute, undo'        — the table above carries a behavioural row per direction
 *   'not an adapter: <reason>'   — e.g. CommandHistory, which CALLS undo rather than being one
 *
 * Asserted by EXACT KEY SET in both directions: a class with no entry fails, and an entry for a
 * class that no longer exists fails. That is what makes a NEW adapter fail here until somebody
 * writes its rows — in any layer, exported or not, declaring its members or inheriting them,
 * and in a file that already holds three of them.
 *
 * Crude on purpose. Precise discovery was tried and reported wrong five times, each time on an
 * axis the previous fix had not modelled; this one cannot be wrong about an axis because it
 * models none — it reads `class` and `undo` and nothing else.
 */
```

Assert the discovery found a non-trivial number of classes, because an instrument that reaches
nothing looks exactly like a clean tree. **And assert that every class carrying a `rows:`
disposition actually appears in the census table, with a row per direction that disposition
names**, so a disposition cannot claim coverage the
table does not provide — the two halves must agree or the check is a pair of lists nodding at
each other.

**The carve-out stays and keeps its exact-key-set assertion.** `ReversibleSetPlanBackground` is
in the table with "nothing" as its expected events and a reason: a background is not a cost
input, so it moves nothing a project summary shows; what it moves is the Plan Editor's own
picture in a second leaf on the same plan, which is that surface's decision. Its ROW asserts
that nothing is published — a carve-out that is itself a behavioural assertion, so a build that
starts publishing there fails rather than quietly diverging from its own documentation.

- [ ] **Step 1: Take the census from the tree, not from the table above**

Before writing a single case, list every module under `src/application/**` exposing an `undo`,
and diff that list against the table. Write the result into your report. If the tree holds an
adapter the table omits, the table was wrong — add it.

- [ ] **Step 2: Write Part B first, and watch it fail**

The enumeration check is the cheap half and it fails immediately (the table starts empty).
Then watch it fail the two ways that matter, which is what the first draft could not do:

1. Add a fake adapter class to an ALREADY-DISPOSED file — `ReversibleAssetDesignCommands.ts`,
   which already holds three — and confirm it is reported as an undisposed CLASS. Both a
   module-granular check and a file-keyed dispositions map pass this mutation; those were
   findings four and six, and this is the red neither could produce.
2. Add a fake adapter in `src/presentation/**` that INHERITS `execute`/`undo` from a base and
   declares neither, IN ITS OWN FILE mentioning `undo` nowhere, and confirm it is still reported
   as an undisposed class. That is findings five and seven together — wrong layer, inherited
   members, and a file the word never appears in — and it is the mutation both the
   declaration-based draft and the file-mentions-undo draft passed.
3. Delete a `DISPOSITIONS` entry whose file still exists, and confirm the exact-key-set
   assertion fails; then add one for a file that does not exist, and confirm it fails the other
   way.

- [ ] **Step 3: Write the rows**

One `it` per table row, driving the real adapter against an in-memory stack. Use the rigs the
Task 3–10 test files already established rather than inventing new ones (see the controller's
Ruling 3 — helper names in this plan are illustrative, the assertions are binding).

- [ ] **Step 4: Watch the census bite where the draft could not**

Comment out the publish in **one direction only** of `ReversibleCalibratePlan.ts` and re-run.
Expected: that direction's row goes RED while the other stays green. This is the finding-4
regression, and it is the red neither the per-file nor the per-function draft could produce.
Restore.

Then do the same for one BRANCH of a method that writes in two branches, if the tree holds one.
Expected: RED. If no such method exists today, say so in your report rather than inventing one.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add -A
git commit -m "$(cat <<'MSG'
Census every reversible write path behaviourally, and scan only the enumeration

The sweep has now been wrong four times and every version was a containment
boolean at a finer grain: a sample of adapters, a filter that was a sample, a
metric counting publish( syntax, an enumeration that trailed its own count —
then this task's per-file draft, and then its per-function draft, which review
showed has the identical defect one level down. A method with writes in two
branches and a publish in one still reduces to "contains a write" and
"contains a publish", and passes.

A seventh grain is control-flow reachability: real static analysis, in a test
file, as the fourth iteration of an instrument wrong three rounds running. An
instrument that overstates its reach certifies the gap.

So the design inverts. Text answers the one question it is reliable on —
which modules exist — and behaviour settles the one only behaviour can: did
this direction announce. One row per (module, direction), each driving the
real path; the static half checks that every adapter in the tree HAS a row, so
a new one fails for being unenumerated.

A second finding made the static sweep unshippable rather than merely weak:
ReferenceLocks' waiters.delete / map.delete and WriteLedger's versions.delete
are Map and Set operations whose receiver is not bare `this`, so they classify
as persistence writes and publish nothing — the sweep could not have passed
without carve-outs contradicting its own exact-key-set contract. Telling a
Map.delete from a repository delete by text means knowing the receiver's TYPE,
which is the type checker's job and not a regex's.

The carve-out is now a behavioural row asserting that nothing is published, so
a build that starts publishing there fails rather than diverging from its own
documentation.

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

**The matrix was wrong in the first draft and the correction is the point of having one.**
Both `createRepositoryStack` (`tests/helpers/vault.ts:611`) and `openFixtureVault`
(`tests/helpers/fixtureVault.ts:584`) construct `new ObsidianRequirementRepository(...)` — the
first over `FakeVault`, the second over a disk-backed vault. So a matrix of those two compares
one implementation against itself over two hosts, and `InMemoryRequirementRepository.listByProject`
would have shipped with **no behavioural coverage at all** under a comment claiming both were
compared. An in-memory implementation returning every project's requirements passes that suite.
Reported by review.

Three cases, not two, and they are not interchangeable: the in-memory repository is exercised
DIRECTLY, and the unreadable-note behaviour stays on the vault-backed rows, because a repository
with no notes behind it has no malformed note to refuse.

```ts
// The two REAL implementations, plus the second host. `createRepositoryStack` and
// `openFixtureVault` both build ObsidianRequirementRepository — over FakeVault and over disk —
// so listing only those two compares one implementation against itself.
describe.each([
	['in-memory', openInMemoryRequirements],   // InMemoryRequirementRepository, directly
	['obsidian/fake-vault', createRepositoryStack],
	['obsidian/disk', openFixtureVault],
])('listByProject (%s)', (_name, open) => {
	it('returns this project’s requirements and nothing else', async () => { /* … */ });

	// The two unreadable-note cases are VAULT-BACKED ONLY — skip them for the in-memory row
	// rather than faking a refusal into it. A repository with no notes behind it cannot produce
	// a malformed one, and a stub that pretends to would be testing the stub.
	it.runIf(hasVault)('counts an unreadable note instead of refusing the whole list', async () => {
		// The difference from listByZone, and the reason this method exists.
	});

	it.runIf(hasVault)('counts only THIS project’s unreadable note', async () => {
		// Two malformed notes, one per project. Unscoped ids would count both.
	});

	it('does not try to parse a plan as a requirement', async () => {
		// getIdsByProject is a MIXED axis: plans, zones and requirements all carry a projectId.
		// Without the type intersection this inflates `refused` on every ordinary project.
	});

	// Vault-backed only, for the same reason as the two above and missed when they were
	// scoped — `InMemoryRequirementRepository.listByZone` always answers ok() and has no
	// unreadable-note state that could produce the strict error this asserts, so the
	// in-memory row would be permanently red after a CORRECT implementation. Reported;
	// scoping two of three cases and not the third is this plan's own partial-fix shape.
	it.runIf(hasVault)('leaves listByZone strict', async () => {
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
  next. The remedy is the census in `tests/application/events/reversibleWritePathCensus.test.ts`
  and its per-class dispositions.
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
