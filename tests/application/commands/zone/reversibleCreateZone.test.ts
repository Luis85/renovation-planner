import { describe, expect, it, vi } from 'vitest';
import { makeDeleteZoneCommand } from '../../../helpers/slice10';
import { recorder } from '../../../helpers/logger';
import { CreateZoneCommand } from '../../../../src/application/commands/zone/CreateZone';
import { MoveSpatialObjectCommand } from '../../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleCreateZoneCommand } from '../../../../src/application/commands/zone/reversible-create-zone-command';
import { SessionWriteLedger, type WriteLedger } from '../../../../src/application/editor/WriteLedger';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { err } from '../../../../src/core/result/Result';
import type { PersistenceError } from '../../../../src/core/errors/AppError';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryRequirementRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { expectErr, expectOk, injectedPersistenceError, RecordingEventBus } from '../../../helpers/domain';
import { makePlan, makeRequirement, squareAt } from '../../../helpers/entities';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { createPolygon } from '../../../../src/core/geometry/Polygon';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import type { ZoneId } from '../../../../src/domain/zone/ZoneId';
import { CommandHistory } from '../../../../src/presentation/editor/tools/command-history';
import { ReversibleMoveZoneCommand } from '../../../../src/presentation/editor/tools/reversible-move-zone-command';

/**
 * Design slice 8 — `ReversibleCreateZoneCommand` (docs/tasks/08-zone-editing.md,
 * "Un-creating a zone"). The DoD's headline sequences are asserted by ID, never merely by
 * "a zone exists again": the fresh-identity bug this adapter exists to prevent passes
 * that weaker assertion.
 */

/**
 * The rig every case in this file shares. `events` is a REAL dispatching bus rather than
 * `RecordingEventBus` (which only records and never delivers) — the redo-announces cases
 * below subscribe to it and need a handler that actually runs. `requirements` is the
 * reverse lookup `announceRestore` reads and the same repository `DeleteZoneCommand`
 * resolves referents through, so a foreign requirement seeded into it is visible to both.
 */
async function wired() {
	const plans = new InMemoryPlanRepository();
	const plan = makePlan({ projectId: createProjectId() });
	await plans.save(plan, 'absent');
	const zones = new InMemoryZoneRepository();
	const requirements = new InMemoryRequirementRepository();
	const events = createEventBus();
	const ledger: WriteLedger = new SessionWriteLedger();
	const logger = {
		debug: vi.fn<(event: string, context?: Record<string, unknown>) => void>(),
		info: vi.fn<(event: string, context?: Record<string, unknown>) => void>(),
		warn: vi.fn<(event: string, context?: Record<string, unknown>) => void>(),
		error: vi.fn<(event: string, context?: Record<string, unknown> & { cause?: unknown }) => void>(),
	};
	const makeCommand = () =>
		new ReversibleCreateZoneCommand(
			new CreateZoneCommand(zones, plans, events),
			makeDeleteZoneCommand(zones, events, requirements),
			ledger,
			{ planId: plan.id, name: 'Living room', zoneType: 'Room', geometry: squareAt() },
			{ zones, events, requirements, logger },
		);
	/**
	 * A hand-edited requirement in ANOTHER project whose `origin.zoneId` names the given
	 * zone — Decision 3's honest residue, and the one row `ZoneCreated`'s per-project
	 * filter drops. Never a referent the delete resolution consented to.
	 */
	async function seedRequirementInOtherProject(zoneId: ZoneId) {
		return expectOk(
			await requirements.save(
				makeRequirement({
					projectId: createProjectId(),
					assetId: createAssetId(),
					origin: { kind: 'zone', zoneId },
				}),
				'absent',
			),
		);
	}
	return { zones, ledger, makeCommand, events, requirements, logger, seedRequirementInOtherProject };
}

/**
 * `ReversibleCreateZoneCommand.createdZoneId` is a `ZoneId | null`, and it is the branded id
 * every read below then passes to `zones.getById`. Typed as `string | null` this helper
 * silently un-branded it — which nothing could notice while `tests/**` went unchecked, and
 * which is the whole reason the brand exists.
 */
function expectId(id: ZoneId | null): ZoneId {
	if (id === null) throw new Error('expected the command to have created its zone');
	return id;
}

describe('ReversibleCreateZoneCommand', () => {
	it('creates through the plain command and exposes the created id', async () => {
		const { zones, makeCommand } = await wired();

		const command = makeCommand();
		expect(expectOk(await command.execute())).toBe('wrote');
		const zoneId = expectId(command.createdZoneId);
		expect(expectOk(await zones.getById(zoneId))?.entity.name).toBe('Living room');
	});

	it('undo removes the zone; redo restores THE SAME ID', async () => {
		const { zones, makeCommand } = await wired();

		const command = makeCommand();
		await command.execute();
		const createdId = expectId(command.createdZoneId);
		expect(expectOk(await command.undo())).toBe('wrote');
		expect(expectOk(await zones.getById(createdId))).toBeNull();

		await command.execute(); // the redo path
		const restored = expectOk(await zones.getById(createdId));
		expect(restored?.entity.id).toBe(createdId);
		expect(restored?.entity.name).toBe('Living room');
	});

	it('survives create → move → undo → undo → redo → redo with the move landing on the same entity', async () => {
		const { zones, ledger, makeCommand } = await wired();
		const history = new CommandHistory();

		const create = makeCommand();
		await history.run(create);
		const zoneId = expectId(create.createdZoneId);
		const original = expectOk(await zones.getById(zoneId))?.entity;
		if (original === undefined) throw new Error('expected the created zone to exist');

		const moved = expectOk(
			createPolygon(original.geometry.points.map((point) => ({ x: point.x + 100, y: point.y + 100 }))),
		);
		await history.run(
			new ReversibleMoveZoneCommand(
				new MoveSpatialObjectCommand(zones, new RecordingEventBus()),
				ledger,
				zoneId,
				moved,
				original.geometry,
			),
		);

		// undo #1 backs out the move; undo #2 un-creates.
		expect(expectOk(await history.undo())).toBe('wrote');
		expect(expectOk(await history.undo())).toBe('wrote');
		expect(expectOk(await zones.getById(zoneId))).toBeNull();

		// redo #1 re-creates THE SAME entity; redo #2 replays the move against its ID.
		expect(expectOk(await history.redo())).toBe('wrote');
		expect(expectOk(await history.redo())).toBe('wrote');
		const restored = expectOk(await zones.getById(zoneId));
		expect(restored?.entity.id).toBe(zoneId);
		expect(restored?.entity.geometry.points).toEqual(moved.points);
	});

	/**
	 * **The SANDWICH: a foreign write between this creation and its undo, with one of this
	 * history's own gestures in between.** Undoing a creation DELETES the zone, and the delete
	 * is conditional on the ledger's tip — which the intervening gesture's own undo has just
	 * advanced to a version the store really holds. So without the generation the delete
	 * succeeds and takes the peer's edit with it, silently. `WriteLedger` walks all five steps.
	 *
	 * The detector here is the MOVE adapter rather than this one: a freshly minted id has no
	 * prior ledger entry for a first execute to disagree with, so a creation can observe
	 * nothing. What protects it is a sibling's observation, which is the whole reason the
	 * counter lives on the shared ledger rather than on each adapter.
	 */
	it('refuses to un-create a zone something outside this history has written', async () => {
		const { zones, ledger, makeCommand } = await wired();
		const events = new RecordingEventBus();
		const move = new MoveSpatialObjectCommand(zones, events);
		const history = new CommandHistory();

		const creation = makeCommand();
		expectOk(await history.run(creation));
		const zoneId = expectId(creation.createdZoneId);

		// A peer leaf, or a synced change, through the plain command.
		expectOk(await move.execute({ zoneId, geometry: squareAt(50, 50) }));

		const drag = new ReversibleMoveZoneCommand(move, ledger, zoneId, squareAt(60, 60), squareAt(50, 50));
		expectOk(await history.run(drag));
		expectOk(await history.undo());

		const error = expectErr(await history.undo());
		expect(error.code).toBe('undo.superseded');
		// The zone is still there, which is the consequence the refusal buys.
		expect(expectOk(await zones.getById(zoneId))?.entity.geometry).toEqual(squareAt(50, 50));
	});

	it('refuses an undo when nothing has been executed yet', async () => {
		const { makeCommand } = await wired();
		const error = expectErr(await makeCommand().undo());
		expect(error.code).toBe('zone.nothing-to-undo');
	});

	it('undo falls back to the snapshot version when the ledger has no entry for the zone', async () => {
		const plans = new InMemoryPlanRepository();
		const plan = makePlan({ projectId: createProjectId() });
		await plans.save(plan, 'absent');
		const zones = new InMemoryZoneRepository();
		const events = new RecordingEventBus();
		// A ledger that never answers: the adapter must fall back to the version its own
		// execute captured, and the undo must still land.
		const silentLedger: WriteLedger = {
			lastWritten: () => null,
			record: () => undefined,
			forget: () => undefined,
			// A ledger that never answers has never seen anything either, so its generation
			// stays where a gesture found it and the guard cannot fire. Spelled out rather than
			// left to a partial object, because the point of this fake is that it answers
			// NOTHING and a missing member would answer `undefined` instead.
			generation: () => 0,
			observe: () => 0,
		};
		const command = new ReversibleCreateZoneCommand(
			new CreateZoneCommand(zones, plans, events),
			makeDeleteZoneCommand(zones, events),
			silentLedger,
			{ planId: plan.id, name: 'Living room', zoneType: 'Room', geometry: squareAt() },
			{ zones, events, requirements: new InMemoryRequirementRepository(), logger: recorder },
		);

		await command.execute();
		expect(expectOk(await command.undo())).toBe('wrote');
		expect(await zones.getById(command.createdZoneId as never)).toMatchObject({ value: null });
	});

	it('propagates a failed create without capturing a snapshot', async () => {
		const plans = new InMemoryPlanRepository();
		const plan = makePlan({ projectId: createProjectId() });
		await plans.save(plan, 'absent');
		class FailingSave extends InMemoryZoneRepository {
			override save() {
				return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
			}
		}
		const zones = new FailingSave();
		const events = new RecordingEventBus();
		const command = new ReversibleCreateZoneCommand(
			new CreateZoneCommand(zones, plans, events),
			makeDeleteZoneCommand(new InMemoryZoneRepository(), events),
			new SessionWriteLedger(),
			{ planId: plan.id, name: 'Living room', zoneType: 'Room', geometry: squareAt() },
			{ zones, events, requirements: new InMemoryRequirementRepository(), logger: recorder },
		);

		expect(expectErr(await command.execute()).code).toBe('test.injected-failure');
		expect(command.createdZoneId).toBeNull();
	});

	it('announces the restore, so create/undo/redo no longer emits one create and two deletes', async () => {
		const rig = await wired();
		const command = rig.makeCommand();
		const seen: string[] = [];
		rig.events.subscribe('ZoneCreated', () => {
			seen.push('created');
		});
		rig.events.subscribe('ZoneDeleted', () => {
			seen.push('deleted');
		});

		await command.execute();
		await command.undo();
		await command.execute(); // the redo — the silent half
		await command.undo();

		expect(seen).toEqual(['created', 'deleted', 'created', 'deleted']);
	});

	// **Seed the referent AFTER the undo, and the ordering is load-bearing rather than
	// stylistic.** `ReversibleCreateZoneCommand.undo()` dispatches `DeleteZoneCommand` with
	// `{ zoneId, expected }` and NO `resolution`, and `applyResolutionToRequirement`'s
	// `case undefined` refuses with `reference.resolution-required` whenever live referents
	// exist. So seeding first makes the undo refuse, the zone stay, and the next `execute()`
	// attempt an `'absent'` restore that also refuses — a test that cannot pass against any
	// implementation of this task.
	//
	// Seeding after the undo is the honest reconstruction of the case anyway: the scenario is
	// a HAND-EDITED requirement pointing at a zone id, which is a thing that appears in the
	// vault independently of this gesture, not a referent the delete path ever consented to.
	it('reaches a dependent in ANOTHER project, which the zone event cannot name', async () => {
		const rig = await wired();
		const command = rig.makeCommand();
		await command.execute();
		const zoneId = command.createdZoneId;
		if (zoneId === null) throw new Error('expected the creation to record its zone');
		await command.undo();
		// A hand-edited requirement in project A whose origin zone lives in project B: the
		// residue Decision 3 accepts as honest, and the one row ZoneCreated's filter drops.
		const foreign = await rig.seedRequirementInOtherProject(zoneId);

		const seen: unknown[] = [];
		rig.events.subscribe('RequirementInvalidated', (event) => {
			seen.push(event);
		});
		await command.execute();

		expect(seen).toEqual([
			{ type: 'RequirementInvalidated', payload: { requirementId: foreign.entity.id } },
		]);
	});

	// A THROWN lookup, not a refused one. The ports are raw at this boundary, so a vault fault
	// arrives as a rejection — and letting it escape leaves the zone restored, the command
	// stuck on the redo stack, and the retry refused by `restoreZone`'s `'absent'` condition.
	it('falls back to the blanket refresh when the reverse lookup FAULTS', async () => {
		const rig = await wired();
		const command = rig.makeCommand();
		await command.execute();
		await command.undo();
		rig.requirements.listByZone = () => Promise.reject(new Error('vault exploded'));

		const seen: string[] = [];
		rig.events.subscribe('ProjectIndexRebuilt', () => {
			seen.push('rebuilt');
		});
		const result = await command.execute();

		// Resolved, never rejected: the zone write already succeeded.
		expectOk(result);
		expect(seen).toEqual(['rebuilt']);
	});

	it('falls back to the blanket refresh when the reverse lookup refuses', async () => {
		const rig = await wired();
		const command = rig.makeCommand();
		await command.execute();
		await command.undo();
		// The zone write will still succeed; only the lookup after it refuses.
		const refusal: PersistenceError = {
			category: 'Persistence',
			code: 'requirement.unreadable',
			message: 'A requirement note could not be read.',
		};
		rig.requirements.listByZone = () => Promise.resolve(err(refusal));

		const seen: string[] = [];
		rig.events.subscribe('ProjectIndexRebuilt', () => {
			seen.push('rebuilt');
		});
		rig.events.subscribe('RequirementInvalidated', () => {
			seen.push('invalidated');
		});
		const result = await command.execute();

		// The write stands. The adapter cannot fail an operation that already succeeded.
		expectOk(result);
		expect(seen).toEqual(['rebuilt']);
		expect(rig.logger.error).toHaveBeenCalledWith(
			'zone.restore.referents-unreadable',
			expect.objectContaining({ cause: refusal }),
		);
	});
});
