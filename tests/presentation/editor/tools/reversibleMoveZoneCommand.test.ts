import { describe, expect, it, vi } from 'vitest';
import { MoveSpatialObjectCommand, type MoveSpatialObjectInput } from '../../../../src/application/commands/zone/MoveSpatialObject';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { SessionWriteLedger } from '../../../../src/application/editor/WriteLedger';
import { CommandHistory } from '../../../../src/presentation/editor/tools/command-history';
import { ReversibleMoveZoneCommand } from '../../../../src/presentation/editor/tools/reversible-move-zone-command';
import { expectErr, expectOk, RecordingEventBus } from '../../../helpers/domain';
import { makeZone, squareAt } from '../../../helpers/entities';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';

const wired = () => {
	const zones = new InMemoryZoneRepository();
	const events = new RecordingEventBus();
	const ledger = new SessionWriteLedger();
	const history = new CommandHistory();
	const move = new MoveSpatialObjectCommand(zones, events);
	return { zones, events, ledger, history, move };
};

const seed = async (zones: InMemoryZoneRepository) => {
	const zone = makeZone({
		projectId: 'project-seed' as ProjectId,
		planId: 'plan-seed' as PlanId,
		geometry: squareAt(0, 0),
	});
	await zones.save(zone, 'absent');
	return zone;
};

describe('ReversibleMoveZoneCommand', () => {
	it('undoes two sibling adapters touching the same zone, in order', async () => {
		// The case a per-adapter memory field fails (spec: "The expectation is the
		// history's, not the adapter's"): adapter A moves the zone, adapter B moves it
		// again, and both undos must succeed even though B's write happened after A's.
		const { zones, ledger, history, move } = wired();
		const zone = await seed(zones);

		const adapterA = new ReversibleMoveZoneCommand(
			move,
			ledger,
			zone.id,
			squareAt(10, 10),
			squareAt(0, 0),
		);
		const adapterB = new ReversibleMoveZoneCommand(
			move,
			ledger,
			zone.id,
			squareAt(20, 20),
			squareAt(10, 10),
		);

		expectOk(await history.run(adapterA));
		expectOk(await history.run(adapterB));

		expectOk(await history.undo());
		expectOk(await history.undo());

		expect(expectOk(await zones.getById(zone.id))?.entity.geometry).toEqual(squareAt(0, 0));
	});

	it('refuses an undo against a foreign write, and leaves the command on the undo stack', async () => {
		const { zones, ledger, history, move } = wired();
		const zone = await seed(zones);

		const adapterA = new ReversibleMoveZoneCommand(
			move,
			ledger,
			zone.id,
			squareAt(10, 10),
			squareAt(0, 0),
		);

		expectOk(await history.run(adapterA));
		zones.poke(zone.id); // a hand edit, outside this history

		const error = expectErr(await history.undo());
		expect(error.code).toBe('zone.external-modification');
		expect(expectOk(await zones.getById(zone.id))?.entity.geometry).toEqual(squareAt(10, 10));
		expect(history.canUndo).toBe(true);
	});

	/**
	 * **The SANDWICH: a foreign write between two of this history's own gestures.** The
	 * existing case above catches a peer write with nothing of ours after it — the ledger
	 * still names the version we wrote, so the store refuses. This one is what that check
	 * cannot see: our own SECOND gesture writes past the peer and its undo advances the
	 * ledger to a version the store really holds, so the FIRST gesture's undo matches the tip
	 * and puts a pre-peer polygon back with no refusal anywhere. `WriteLedger` walks all five
	 * steps; here they are, in the order a user produces them.
	 *
	 * Both halves asserted, and the middle undo is the half that keeps this honest: gesture
	 * two's own inverse post-dates the peer, so it must SUCCEED, and a build that refused
	 * everything after a foreign write would pass a case that only checked the refusal.
	 */
	it('refuses an undo whose inverse predates a write this history did not make', async () => {
		const { zones, ledger, history, move } = wired();
		const zone = await seed(zones);

		const gestureOne = new ReversibleMoveZoneCommand(
			move,
			ledger,
			zone.id,
			squareAt(10, 10),
			squareAt(0, 0),
		);
		expectOk(await history.run(gestureOne));

		// A peer leaf, or a synced change: the plain command, touching no ledger of ours.
		expectOk(await move.execute({ zoneId: zone.id, geometry: squareAt(50, 50) }));

		// The user's next drag starts from what their leaf now shows, which is the peer's
		// geometry — `ZoneGeometryChanged` reaches every leaf on this plan.
		const gestureTwo = new ReversibleMoveZoneCommand(
			move,
			ledger,
			zone.id,
			squareAt(60, 60),
			squareAt(50, 50),
		);
		expectOk(await history.run(gestureTwo));

		expectOk(await history.undo());
		expect(expectOk(await zones.getById(zone.id))?.entity.geometry).toEqual(squareAt(50, 50));

		const error = expectErr(await history.undo());
		expect(error.code).toBe('undo.superseded');
		expect(expectOk(await zones.getById(zone.id))?.entity.geometry).toEqual(squareAt(50, 50));
		expect(history.canUndo).toBe(true);
	});

	it('carries no expectation on the first execute(), and one on every dispatch after', async () => {
		const { zones, ledger, move } = wired();
		const zone = await seed(zones);
		const spy = {
			execute: vi.fn<(input: MoveSpatialObjectInput) => ReturnType<typeof move.execute>>(
				(input) => move.execute(input),
			),
		};

		const adapter = new ReversibleMoveZoneCommand(
			spy as unknown as typeof move,
			ledger,
			zone.id,
			squareAt(10, 10),
			squareAt(0, 0),
		);

		await adapter.execute();
		expect(spy.execute.mock.calls[0]?.[0]?.expected).toBeUndefined();

		await adapter.undo();
		expect(spy.execute.mock.calls[1]?.[0]?.expected).toBeDefined();

		await adapter.execute();
		expect(spy.execute.mock.calls[2]?.[0]?.expected).toBeDefined();
	});

	it('returns a failed forward move unchanged and records nothing in the ledger', async () => {
		const { zones, ledger, move } = wired();
		const zone = await seed(zones);

		const adapter = new ReversibleMoveZoneCommand(
			move,
			ledger,
			zone.id,
			{ points: [] },
			squareAt(0, 0),
		);

		const error = expectErr(await adapter.execute());
		expect(error.code).toBe('polygon-too-few-points');
		expect(ledger.lastWritten(zone.id)).toBeNull();
	});
});
