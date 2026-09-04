import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ok, err } from '../../../../src/core/result/Result';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createRoomFromDraft, type RoomCreationDeps } from '../../../../src/presentation/editor/add/roomCreation';
import { useRoomDraftStore } from '../../../../src/presentation/editor/add/room-draft-store';
import { SessionWriteLedger } from '../../../../src/application/editor/WriteLedger';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryRequirementRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { CreateZoneCommand } from '../../../../src/application/commands/zone/CreateZone';
import { makeDeleteZoneCommand } from '../../../helpers/slice10';
import { makePlan, makeProject } from '../../../helpers/entities';
import { RecordingEventBus, expectOk, injectedPersistenceError } from '../../../helpers/domain';
import { lines, recorder } from '../../../helpers/logger';
import { isTechnicalFault } from '../../../../src/core/errors/technical-fault';
import { mapDispatchFaults, type ToolDispatcher } from '../../../../src/presentation/editor/report-failure';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';

/**
 * Every fixture dispatcher goes through the REAL `mapDispatchFaults`, because
 * `RoomCreationDeps.dispatcher` is the branded `ToolDispatcher` and nothing outside that
 * module can mint the brand — which is the whole mechanism, and the reason `runtime.ts`'s own
 * unwrapped composition is now a build error rather than a review question. The event name is
 * this file's own; the leaf passes `editor.dispatch.faulted`.
 */
const toolDispatcher = (run: (command: UndoableCommand) => Promise<DispatchResult>): ToolDispatcher =>
	mapDispatchFaults({ run }, recorder, 'test.room.faulted');

/**
 * `RoomCreationDeps.commands` widened past the brief's original `Pick<…, 'createZone' |
 * 'deleteZone' | 'zones'>`: `ReversibleCreateZoneCommand`'s constructor takes a fifth
 * `ReversibleCreateZoneDeps` argument (`zones`, `events`, `requirements`, `logger`), which
 * `registerEditorTools.ts`'s draw-polygon completion already builds from
 * `context.commands.events` / `.requirementEdits.requirements` / `.logger` — mirrored here
 * rather than re-derived. `requirements` is shared between the delete command and the
 * restore-referents lookup, exactly as the real composition root shares one repository
 * across both.
 */
async function deps(overrides: Partial<RoomCreationDeps> = {}) {
	const planId = createPlanId();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const requirements = new InMemoryRequirementRepository();
	const project = makeProject({});
	await plans.save(makePlan({ projectId: project.id, id: planId }), 'absent');
	const events = new RecordingEventBus();
	const createZone = new CreateZoneCommand(zones, plans, events);
	const draft = useRoomDraftStore();
	draft.beginTask('Room 1');
	const dispatched: unknown[] = [];
	const base: RoomCreationDeps = {
		planId,
		commands: {
			createZone,
			deleteZone: makeDeleteZoneCommand(zones, events, requirements),
			zones,
			events,
			requirementEdits: { requirements },
			logger: recorder,
		},
		ledger: new SessionWriteLedger(),
		dispatcher: toolDispatcher((command) => { dispatched.push(command); return command.execute(); }),
		draft,
		selection: { select: vi.fn<RoomCreationDeps['selection']['select']>() },
		defaultName: () => 'Room 2',
		returnToSelect: vi.fn<RoomCreationDeps['returnToSelect']>(),
		reportRejected: vi.fn<RoomCreationDeps['reportRejected']>(),
	};
	return { d: { ...base, ...overrides }, zones, dispatched, draft };
}

describe('createRoomFromDraft', () => {
	beforeEach(() => setActivePinia(createPinia()));

	it('an invalid draft dispatches nothing', async () => {
		const { d, dispatched } = await deps();
		expect(await createRoomFromDraft(d)).toBe('invalid');
		expect(dispatched).toHaveLength(0);
	});

	/**
	 * `RoomDraftStore.valid` checks nothing about finiteness (`room-draft-store.ts`'s own
	 * docblock says so), so a rect whose side is non-finite is `valid: true` and
	 * `geometry: null` at once — the one way `!draft.valid || geometry === null` is true
	 * with its FIRST disjunct false, which the "an invalid draft" case above cannot reach
	 * (there `valid` alone is false).
	 */
	it('a valid-shaped but non-finite rect is still invalid, and dispatches nothing', async () => {
		const { d, draft, dispatched } = await deps();
		draft.setRect({ x: 0, y: 0, width: Infinity, depth: 1000 });
		expect(draft.valid).toBe(true);
		expect(draft.geometry).toBeNull();
		expect(await createRoomFromDraft(d)).toBe('invalid');
		expect(dispatched).toHaveLength(0);
	});

	it('a valid draft dispatches exactly one command, selects the new id, and returns to Select', async () => {
		const { d, zones, dispatched, draft } = await deps();
		draft.setName(' Kitchen ');
		draft.setRect({ x: 1000, y: 2000, width: 4200, depth: 3800 });
		expect(await createRoomFromDraft(d)).toBe('created');
		expect(dispatched).toHaveLength(1);
		const listed = expectOk(await zones.listByPlan(d.planId)).loaded;
		expect(listed).toHaveLength(1);
		expect(listed[0].entity.name).toBe('Kitchen');
		expect(listed[0].entity.zoneType).toBe('Room');
		expect(listed[0].entity.geometry.points).toEqual([
			{ x: 1000, y: 2000 }, { x: 5200, y: 2000 }, { x: 5200, y: 5800 }, { x: 1000, y: 5800 },
		]);
		expect(d.selection.select).toHaveBeenCalledWith([listed[0].entity.id]);
		expect(d.returnToSelect).toHaveBeenCalledTimes(1);
	});

	it('the numeric route and a drag of the same size produce identical geometry', async () => {
		const a = await deps();
		a.draft.setRect({ x: 800, y: 100, width: 4200, depth: 3800 });
		await createRoomFromDraft(a.d);
		setActivePinia(createPinia());
		const b = await deps();
		b.draft.commitDimension('width', '4.2', () => ({ x: 2900, y: 2000 }));
		b.draft.commitDimension('depth', '3.8', () => ({ x: 2900, y: 2000 }));
		await createRoomFromDraft(b.d);
		const pa = expectOk(await a.zones.listByPlan(a.d.planId)).loaded[0].entity.geometry.points;
		const pb = expectOk(await b.zones.listByPlan(b.d.planId)).loaded[0].entity.geometry.points;
		expect(pb).toEqual(pa);
	});

	it('keepAdding: the room is selected, the draft restarts with the next default name, Select is not returned to', async () => {
		const { d, draft } = await deps();
		draft.setKeepAdding(true);
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		expect(await createRoomFromDraft(d)).toBe('created');
		expect(d.selection.select).toHaveBeenCalledTimes(1);
		expect(d.returnToSelect).not.toHaveBeenCalled();
		expect(draft.rect).toBeNull();
		expect(draft.name).toBe('Room 2');
		expect(draft.keepAdding).toBe(true); // an explicit choice survives one creation
	});

	/**
	 * **A continuation that crosses an `await` re-checks whether its task is still its own** —
	 * `DrawPolygonTool` and `CalibrateTool` each carry a generation counter for exactly this,
	 * and this async path was written without one.
	 *
	 * The window is DELIBERATELY open: `roomCreation.ts`'s own header argues that Cancel must
	 * stay live while a write is in flight, because disabling it strands a user behind a fault
	 * they cannot escape. So a user can cancel, reactivate Room and draw again before the
	 * first write resolves — and the stale continuation then read the NEW task's `keepAdding`
	 * and either called `beginTask` (clearing the rectangle the user had just drawn) or
	 * `returnToSelect` (ending a task they had just started). Neither is a vault defect; both
	 * destroy work the user can see.
	 *
	 * Driven through the real `beginTask`, which is the door a cancel-and-redraw actually goes
	 * through, rather than by poking a counter — so the case would still hold if the token
	 * moved somewhere else in the store. The dispatcher's promise is held open with an
	 * explicit resolver, because the whole subject is the state DURING the await.
	 */
	it('a completion from a superseded task leaves the replacement task alone', async () => {
		let release: (() => void) | undefined;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const { d, draft } = await deps();
		const inner = d.dispatcher;
		const held = toolDispatcher(async (command) => { await gate; return inner.run(command); });

		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		const inFlight = createRoomFromDraft({ ...d, dispatcher: held });

		// The user cancels and starts another room while the first write is still in flight.
		draft.beginTask('Room 7');
		draft.setKeepAdding(true);
		draft.setRect({ x: 9000, y: 9000, width: 2000, depth: 2000 });

		release?.();
		expect(await inFlight).toBe('superseded');

		// The replacement task is untouched: its rectangle, its name and its checkbox.
		expect(draft.rect).toEqual({ x: 9000, y: 9000, width: 2000, depth: 2000 });
		expect(draft.name).toBe('Room 7');
		expect(draft.keepAdding).toBe(true);
		expect(d.returnToSelect).not.toHaveBeenCalled();
	});

	/**
	 * The other half, so the guard above is not a blanket refusal: the write still LANDED and
	 * the new Room is still selected. `roomCreation.ts`'s header says so ("the write still
	 * lands and the new Room is still selected"), and only a case can keep it true — a guard
	 * that returned early before selecting would pass the case above and silently drop the
	 * selection this one asserts.
	 */
	it('a superseded completion still wrote the room and still selects it', async () => {
		let release: (() => void) | undefined;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const { d, draft, zones } = await deps();
		const inner = d.dispatcher;
		const held = toolDispatcher(async (command) => { await gate; return inner.run(command); });

		draft.setName('Kitchen');
		draft.setRect({ x: 1000, y: 2000, width: 4200, depth: 3800 });
		const inFlight = createRoomFromDraft({ ...d, dispatcher: held });
		draft.beginTask('Room 7');
		release?.();
		expect(await inFlight).toBe('superseded');

		const listed = expectOk(await zones.listByPlan(d.planId)).loaded;
		expect(listed).toHaveLength(1);
		expect(listed[0].entity.name).toBe('Kitchen');
		expect(d.selection.select).toHaveBeenCalledTimes(1);
	});

	/**
	 * **Cancel during a write left the store permanently unable to submit.** Cancel is live
	 * mid-dispatch by design (the header says why), and it reaches `reset()` through
	 * `deactivate()` — which bumps `taskToken`, so the `finally` below correctly declines to
	 * clear a flag belonging to a task that no longer exists, and `reset()` did not clear it
	 * either. The next `valid` was false for the life of the leaf, hidden only because every
	 * route back into the room tool happens to call `beginTask`, which does clear it.
	 *
	 * Driven through `reset()` rather than through a poked flag, because that is the door the
	 * gesture actually takes, and asserted on the CONSEQUENCE — the next draft is creatable —
	 * rather than on the flag alone, so a build that clears it somewhere unrelated still has to
	 * make the store usable.
	 */
	it('a task reset while a write is in flight leaves the store able to submit the next room', async () => {
		let release: (() => void) | undefined;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const { d, draft } = await deps();
		const inner = d.dispatcher;
		const held = toolDispatcher(async (command) => { await gate; return inner.run(command); });

		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		const inFlight = createRoomFromDraft({ ...d, dispatcher: held });
		draft.reset(); // the tool's own `deactivate()`, which Cancel reaches through `setTool`
		release?.();
		expect(await inFlight).toBe('superseded');

		expect(draft.submitting).toBe(false);
		draft.setName('Kitchen');
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		expect(draft.valid).toBe(true);
	});

	it('a refused write reports once, keeps the draft, and stays in the task', async () => {
		const { d, draft } = await deps({
			dispatcher: toolDispatcher(() => Promise.resolve(err(injectedPersistenceError()))),
		});
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		expect(await createRoomFromDraft(d)).toBe('refused');
		expect(d.reportRejected).toHaveBeenCalledTimes(1);
		expect(d.returnToSelect).not.toHaveBeenCalled();
		expect(draft.rect).not.toBeNull();
		expect(draft.submitting).toBe(false);
	});

	/**
	 * The door's fault half, and the reason `RoomCreationDeps.dispatcher` is typed
	 * `ToolDispatcher` rather than structurally.
	 *
	 * `withSaveStateTracking` RE-THROWS a technical fault by design and both callers launch
	 * this detached (`void runtime.createRoom()`), so a throw below the dispatcher was an
	 * unhandled rejection: no notice, no log line, and the Create button silently doing
	 * nothing. `mapDispatchFaults` is the one seam that closes it — the brand is what stops a
	 * surface composing around the unwrapped dispatcher, which is exactly what `runtime.ts`
	 * had done.
	 *
	 * So the contract is the tools': the action does NOT catch. A branded dispatcher cannot
	 * reject, the mapped fault arrives as a resolved failed `Result` indistinguishable in
	 * SHAPE from a refusal, and it takes the same `'refused'` arm — reported ONCE through
	 * `reportRejected`, logged ONCE by `faultError` under the caller's event name, with
	 * `submitting` cleared by the same `finally` a refusal clears it by.
	 */
	it('a THROWN fault below the dispatcher is mapped, logged once, reported once and answers refused', async () => {
		const before = lines.length;
		const { d, draft } = await deps({
			dispatcher: toolDispatcher(() => Promise.reject(new Error('the vault went away'))),
		});
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });

		expect(await createRoomFromDraft(d)).toBe('refused');

		expect(d.reportRejected).toHaveBeenCalledTimes(1);
		const reported = vi.mocked(d.reportRejected).mock.calls[0][0];
		// STAMPED, so `reportDispatchFailure` gives it its own sentence rather than a "Save
		// error" badge with no cause.
		expect(isTechnicalFault(reported)).toBe(true);
		// The raw cause reaches the log and nowhere else, under the wrapping caller's event.
		expect(lines.slice(before).map((line) => line.event)).toEqual(['test.room.faulted']);
		expect(lines.slice(before).at(0)?.context?.cause).toBeInstanceOf(Error);
		// The draft survives the fault exactly as it survives a refusal, and the task stands.
		expect(draft.submitting).toBe(false);
		expect(draft.rect).not.toBeNull();
		expect(d.returnToSelect).not.toHaveBeenCalled();
	});

	it('a second call while the first is in flight is dropped', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const { d, draft } = await deps({
			dispatcher: toolDispatcher(async (command) => { await gate; return command.execute(); }),
		});
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		const first = createRoomFromDraft(d);
		expect(await createRoomFromDraft(d)).toBe('busy');
		release();
		expect(await first).toBe('created');
	});

	/**
	 * `command.createdZoneId` reads the adapter's own captured snapshot, which only exists
	 * once `execute()` has actually run — a dispatcher that resolves `ok('wrote')` WITHOUT
	 * calling `command.execute()` is the one way to reach that `null` with an otherwise
	 * successful dispatch, which is the false arm of `if (createdId !== null)`.
	 */
	it('a dispatcher that never runs the command creates nothing to select, and still returns to Select', async () => {
		const { d, draft } = await deps({
			dispatcher: toolDispatcher(() => Promise.resolve(ok('wrote'))),
		});
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		expect(await createRoomFromDraft(d)).toBe('created');
		expect(d.selection.select).not.toHaveBeenCalled();
		expect(d.returnToSelect).toHaveBeenCalledTimes(1);
	});
});
