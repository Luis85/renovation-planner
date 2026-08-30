import { describe, expect, it } from 'vitest';
import { makeDeleteZoneCommand, zoneUndoDeps } from '../../../helpers/slice10';
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
	const wired = async () => {
		const zones = new FlakySave();
		const events = new RecordingEventBus();
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
				zoneUndoDeps(),
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

	it('undo publishes NOTHING — a restore is not a creation', async () => {
		const { zones, events, zone, makeCommand } = await wired();

		const reversible = makeCommand();
		await reversible.execute();
		expect(events.published.map((event) => event.type)).toEqual(['ZoneDeleted']);

		events.published.length = 0;
		await reversible.undo();

		// `restore-zone.ts` saves through the repository and publishes nothing, deliberately:
		// a restore is not a creation, and anything subscribed to `ZoneCreated` would treat it
		// as one. Nothing asserted it. The redo case below clears this array immediately after
		// its own `undo()`, discarding exactly this evidence, so a restore that began emitting
		// `ZoneCreated` left every case in this file green.
		//
		// Sensitivity checked by removing the reset two lines up: the delete's own
		// `ZoneDeleted` then remains and the case fails, so the assertion reads the array
		// rather than passing on an empty one it never filled. A SOURCE mutation is not
		// available cheaply — nothing in the undo path holds an event bus, which is why
		// publishing from a restore requires wiring one, and that wiring is the change this
		// case exists to catch.
		expect(events.published).toHaveLength(0);
		expect(expectOk(await zones.getById(zone.id))).not.toBeNull();
	});

	it('redo deletes again, against the state the restore wrote', async () => {
		const { zones, events, zone, makeCommand } = await wired();

		const reversible = makeCommand();
		await reversible.execute();
		await reversible.undo();
		events.published.length = 0;
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
