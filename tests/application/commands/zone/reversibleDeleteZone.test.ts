import { describe, expect, it } from 'vitest';
import { dispatchingEventBus, makeDeleteZoneCommand, zoneUndoDeps } from '../../../helpers/slice10';
import { ReversibleDeleteZoneCommand } from '../../../../src/application/commands/zone/reversible-delete-zone-command';
import { SessionWriteLedger, type WriteLedger } from '../../../../src/application/editor/WriteLedger';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import {
	expectErr,
	expectOk,
	injectedPersistenceError,
	RecordingEventBus,
} from '../../../helpers/domain';
import { makePlan, makeZone, squareAt } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { CommandHistory } from '../../../../src/presentation/editor/tools/command-history';
import { MoveSpatialObjectCommand } from '../../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleMoveZoneCommand } from '../../../../src/presentation/editor/tools/reversible-move-zone-command';

/**
 * Design slice 8 — `ReversibleDeleteZoneCommand` (docs/tasks/08-zone-editing.md,
 * "Deleting a zone", DoD 8/9). With no entity able to reference a Zone yet,
 * `affectedBefore` is empty and the undo is a single restore write whose compensation is
 * never reached.
 */

/** Fails the next N saves — the one fault DoD 9 needs, injected at the port. */
class FlakySave extends InMemoryZoneRepository {
	failuresLeft = 0;
	override save(
		zone: Parameters<InMemoryZoneRepository['save']>[0],
		expected: Parameters<InMemoryZoneRepository['save']>[1],
	) {
		if (this.failuresLeft > 0) {
			this.failuresLeft -= 1;
			return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
		}
		return super.save(zone, expected);
	}
}

describe('ReversibleDeleteZoneCommand', () => {
	// A REAL dispatching bus, not a recording-only one: the new announce cases below
	// subscribe to it and need a handler that actually runs, exactly as the sibling create
	// adapter's own rig does.
	const wired = async () => {
		const zones = new FlakySave();
		const events = dispatchingEventBus();
		const ledger: WriteLedger = new SessionWriteLedger();
		const plan = makePlan({ projectId: createProjectId() });
		const zone = makeZone({ projectId: plan.projectId, planId: plan.id });
		await zones.save(zone, 'absent');
		const makeCommand = () =>
			new ReversibleDeleteZoneCommand(
				makeDeleteZoneCommand(zones, events),
				zones,
				ledger,
				{ zoneId: zone.id },
				zoneUndoDeps(undefined, undefined, events),
			);
		return { zones, events, zone, ledger, makeCommand };
	};

	it('deletes through the plain command and publishes ZoneDeleted', async () => {
		const { zones, events, zone, makeCommand } = await wired();

		expect(expectOk(await makeCommand().execute())).toBe('wrote');
		expect(expectOk(await zones.getById(zone.id))).toBeNull();
		expect(events.published.map((event) => event.type)).toEqual(['ZoneDeleted']);
	});

	it('undo resurrects the EXACT entity — same id, same type, identical geometry (DoD 8)', async () => {
		const { zones, zone, makeCommand } = await wired();
		const before = expectOk(await zones.getById(zone.id));
		if (before === null) throw new Error('expected the seeded zone to exist');

		const reversible = makeCommand();
		await reversible.execute();
		await reversible.undo();

		const after = expectOk(await zones.getById(zone.id));
		if (after === null) throw new Error('expected the undo to restore the zone');
		expect(after.entity.id).toBe(before.entity.id);
		expect(after.entity.name).toBe(before.entity.name);
		expect(after.entity.zoneType).toBe(before.entity.zoneType);
		expect(after.entity.status).toBe(before.entity.status);
		expect(after.entity.geometry.points).toEqual(before.entity.geometry.points);
	});

	// This used to be titled "undo publishes NOTHING — a restore is not a creation", on the
	// argument that a restore is not a creation and announcing it as one would be a lie.
	// True of the ENTITY and beside the point for the SIGNAL: nothing downstream of
	// `ZoneCreated` distinguishes "minted" from "brought back", and every one of those
	// consumers needs to hear that the zone exists again regardless of which write produced
	// it — which is the gap the create adapter's own `announceRestore` was built to close on
	// its side (design slice 8's review pass) and this adapter still had, silently, until
	// this task. See `reversible-delete-zone-command.ts`'s own docblock for why the publish
	// sits AFTER the whole undo succeeds rather than inside `restoreEntity`.
	it('undo announces the restore as ZoneCreated, the half that bypasses the command layer', async () => {
		const { zones, events, zone, makeCommand } = await wired();

		const reversible = makeCommand();
		await reversible.execute();
		expect(events.published.map((event) => event.type)).toEqual(['ZoneDeleted']);

		events.clear();
		await reversible.undo();

		expect(events.published.map((event) => event.type)).toEqual(['ZoneCreated']);
		expect(expectOk(await zones.getById(zone.id))).not.toBeNull();
	});

	it('announces the zone it restores, which is the half that does not go through a command', async () => {
		const { events, makeCommand } = await wired();
		const seen: string[] = [];
		events.subscribe('ZoneCreated', () => {
			seen.push('created');
		});
		events.subscribe('ZoneDeleted', () => {
			seen.push('deleted');
		});

		const reversible = makeCommand();
		await reversible.execute();
		await reversible.undo();
		await reversible.execute(); // the redo re-dispatches the plain command

		expect(seen).toEqual(['deleted', 'created', 'deleted']);
	});

	it('redo deletes again, against the state the restore wrote', async () => {
		const { zones, events, zone, makeCommand } = await wired();

		const reversible = makeCommand();
		await reversible.execute();
		await reversible.undo();
		events.clear();
		await reversible.execute(); // the redo path

		expect(expectOk(await zones.getById(zone.id))).toBeNull();
		expect(events.published.map((event) => event.type)).toEqual(['ZoneDeleted']);
	});

	it('a failed undo leaves the vault exactly as the delete left it, and retrying succeeds (DoD 9)', async () => {
		const { zones, zone, makeCommand } = await wired();
		const history = new CommandHistory();

		await history.run(makeCommand());
		expect(expectOk(await zones.getById(zone.id))).toBeNull();

		zones.failuresLeft = 1;
		const failedUndo = await history.undo();
		expect(failedUndo.ok).toBe(false);
		// Still on undoStack (slice 6): a failed undo keeps its command retryable...
		expect(history.canUndo).toBe(true);
		// ...and the vault is exactly as the delete left it, not half-restored.
		expect(expectOk(await zones.getById(zone.id))).toBeNull();

		// Retrying once the fault clears is a retry, not a repair.
		expect(expectOk(await history.undo())).toBe('wrote');
		expect(expectOk(await zones.getById(zone.id))?.entity.geometry.points).toEqual(squareAt().points);
	});

	it('refuses an undo when nothing has been deleted yet', async () => {
		const { makeCommand } = await wired();
		const error = expectErr(await makeCommand().undo());
		expect(error.code).toBe('zone.nothing-to-undo');
	});
	it('a successful delete FORGETS the ledger entry rather than keeping a dead revision', async () => {
		// The note is gone, so there is no revision to remember. Keeping the pre-delete one
		// leaves the ledger answering a version for a note that does not exist — and the
		// first half to present it as an expectation (slice 10's cascade-aware delete is the
		// named candidate) refuses a legitimate undo against a revision nothing has.
		const { zones, zone, ledger, makeCommand } = await wired();
		const loaded = expectOk(await zones.getById(zone.id));
		if (loaded === null) throw new Error('expected the seeded zone to exist');
		ledger.record(zone.id, loaded.version);
		expect(ledger.lastWritten(zone.id)).not.toBeNull();

		expect(expectOk(await makeCommand().execute())).toBe('wrote');

		expect(ledger.lastWritten(zone.id)).toBeNull();
	});

	it('undo records the RESTORED version, so a redo presents what the last write left', async () => {
		const { zone, ledger, makeCommand } = await wired();
		const reversible = makeCommand();
		await reversible.execute();

		await reversible.undo();

		// The ledger is what every sibling adapter reads its expectation from; a restore
		// that went unrecorded hands the next move command a stale version.
		expect(ledger.lastWritten(zone.id)).not.toBeNull();
	});
});

/**
 * **This adapter takes NEITHER half of the generation guard, and that is a measurement rather
 * than an omission** — the sibling adapters all take one, so its absence is exactly what a
 * later reader would tidy away. Both halves of the sandwich (`WriteLedger`'s five steps) are
 * already closed here by mechanisms this adapter had before:
 *
 * - it cannot be the SECOND gesture, the one that writes past a peer and advances the tip.
 *   Its forward delete is conditioned on `ledger.lastWritten`, so a foreign write since our
 *   last one makes the delete itself refuse — there is no successful write to record and no
 *   tip for a later undo to match;
 * - it cannot be the FIRST gesture, the one whose inverse goes stale. Its undo restores
 *   through `restoreZone`, which writes `'absent'`, and its Requirement restores present the
 *   expectations the forward resolution's own result reported. Every one of them refuses a
 *   foreign write on its own.
 *
 * Both are asserted, because "it refused" is the same word for two different mechanisms and
 * an argument in prose is what goes stale.
 */
const seededZone = async () => {
	const zones = new InMemoryZoneRepository();
	const events = new RecordingEventBus();
	const ledger: WriteLedger = new SessionWriteLedger();
	const plan = makePlan({ projectId: createProjectId() });
	const zone = makeZone({ projectId: plan.projectId, planId: plan.id, geometry: squareAt(0, 0) });
	await zones.save(zone, 'absent');
	return { zones, events, ledger, zone, move: new MoveSpatialObjectCommand(zones, events) };
};

describe('a foreign write around a delete gesture', () => {
	it('refuses the delete itself when a peer wrote since this history last did', async () => {
		const { zones, events, ledger, zone, move } = await seededZone();
		const history = new CommandHistory();
		expectOk(await history.run(new ReversibleMoveZoneCommand(move, ledger, zone.id, squareAt(10, 10), squareAt(0, 0))));

		expectOk(await move.execute({ zoneId: zone.id, geometry: squareAt(50, 50) }));

		const deletion = new ReversibleDeleteZoneCommand(
			makeDeleteZoneCommand(zones, events),
			zones,
			ledger,
			{ zoneId: zone.id },
			zoneUndoDeps(),
		);
		expect(expectErr(await history.run(deletion)).code).toBe('zone.revision-conflict');
		expect(expectOk(await zones.getById(zone.id))).not.toBeNull();
	});

	it('refuses to restore over a note that arrived at the deleted id', async () => {
		const { zones, events, ledger, zone } = await seededZone();
		const deletion = new ReversibleDeleteZoneCommand(
			makeDeleteZoneCommand(zones, events),
			zones,
			ledger,
			{ zoneId: zone.id },
			zoneUndoDeps(),
		);
		expect(expectOk(await deletion.execute())).toBe('wrote');

		// A note now holds that id again — a peer re-creating it, or a sync bringing it back
		// with different contents. Written through the repository at the SAME id, because a
		// restore keyed on anything else would not be a restore at all.
		const arrived = expectOk(zone.withGeometry(squareAt(99, 99)));
		expectOk(await zones.save(arrived, 'absent'));

		expect(expectErr(await deletion.undo()).code).toBe('zone.revision-conflict');
		expect(expectOk(await zones.getById(zone.id))?.entity.geometry).toEqual(squareAt(99, 99));
	});
});
