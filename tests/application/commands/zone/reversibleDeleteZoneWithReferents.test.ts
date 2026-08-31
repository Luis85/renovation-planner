import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { DeleteZoneCommand } from '../../../../src/application/commands/zone/DeleteZone';
import { ReversibleDeleteZoneCommand } from '../../../../src/application/commands/zone/reversible-delete-zone-command';
import { SessionWriteLedger } from '../../../../src/application/editor/WriteLedger';
import { leftWritesBehind } from '../../../../src/application/commands/DispatchOutcome';
import { CommandHistory } from '../../../../src/presentation/editor/tools/command-history';
import type { Requirement } from '../../../../src/domain/requirement/Requirement';
import type { RequirementId } from '../../../../src/domain/requirement/RequirementId';
import type { Expected } from '../../../../src/application/ports/versioning';
import { expectErr, expectOk, injectedPersistenceError } from '../../../helpers/domain';
import { makeAsset, makeZone } from '../../../helpers/entities';
import { recorder as logger } from '../../../helpers/logger';
import { requirementFixture, TEN_SQUARE_METERS } from '../../../helpers/slice10';
import { InMemoryRequirementRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';

/**
 * Design slice 10 widens slice 8's delete adapter: a Zone can be referenced now, so its
 * `undo()` is the compensated multi-entity sequence run backwards — the entity first, then
 * every Requirement the resolution touched, in the exact reverse of the order the
 * resolution wrote them ("Compensated multi-entity sequences" in
 * `docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md`).
 *
 * The sibling `reversibleDeleteZone.test.ts` still covers the unreferenced case, where
 * `affectedBefore` is empty and the whole sequence collapses to one write.
 */

/**
 * Fails the Nth save FROM THE MOMENT IT IS ARMED — the fault a partial-undo compensation
 * needs. Counting from construction would count the fixture's own assignment writes, so
 * "the second restore" would land on whatever save happened to be second overall.
 */
class FailNthSave extends InMemoryRequirementRepository {
	private failOnSave = 0;
	private saves = 0;

	arm(nth: number): void {
		this.saves = 0;
		this.failOnSave = nth;
	}

	override save(requirement: Requirement, expected: Expected) {
		this.saves += 1;
		if (this.saves === this.failOnSave) {
			return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
		}
		return super.save(requirement, expected);
	}
}

/**
 * Fails the Nth requirement DELETE and every requirement SAVE from the moment it is armed —
 * the exact pair that leaves a delete resolution half-written: one referent removed, the next
 * refusing, and the compensating restore of the first refusing too. Both faults are needed,
 * which is the point of the rig: a removal failure alone compensates cleanly and the vault
 * ends at its pre-state.
 */
class FailRemovalAndRestore extends FailNthSave {
	private deletes = 0;
	private failOnDelete = 0;

	armHalfWritten(nth: number): void {
		this.deletes = 0;
		this.failOnDelete = nth;
		// From here the FIRST save is the compensating restore, so failing it strands the
		// removal that already landed.
		this.arm(1);
	}

	/** Arms the removal failure alone, leaving compensation able to succeed. */
	armRecoverable(nth: number): void {
		this.deletes = 0;
		this.failOnDelete = nth;
		this.arm(0);
	}

	override delete(id: Parameters<InMemoryRequirementRepository['delete']>[0], expected: Parameters<InMemoryRequirementRepository['delete']>[1]) {
		this.deletes += 1;
		if (this.deletes === this.failOnDelete) {
			return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
		}
		return super.delete(id, expected);
	}
}

/** Fails the zone repository's next `delete` — the compensating write of the undo's entity half. */
class FailZoneDelete extends InMemoryZoneRepository {
	failDeleteOnce = false;

	override delete(id: Parameters<InMemoryZoneRepository['delete']>[0], expected: Parameters<InMemoryZoneRepository['delete']>[1]) {
		if (this.failDeleteOnce) {
			this.failDeleteOnce = false;
			return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
		}
		return super.delete(id, expected);
	}
}

async function wired(assetCount: number, requirements = new FailNthSave()) {
	const zones = new FailZoneDelete();
	const w = { ...(await requirementFixture(requirements, zones)), zones };
	const zone = expectOk(
		await w.zones.save(
			expectOk(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
					points: TEN_SQUARE_METERS,
				}),
			),
			'absent',
		),
	);
	const referents: RequirementId[] = [];
	for (let i = 0; i < assetCount; i += 1) {
		const asset = expectOk(
			await w.assets.save(
				makeAsset({
					name: `Asset ${i}`,
					wasteFactorDefault: new Decimal('0.10'),
				}),
				'absent',
			),
		);
		const assigned = await w.assign.execute({
			zoneId: zone.entity.id,
			assetId: asset.entity.id,
		});
		if (!assigned.ok) throw new Error(String(assigned.error));
		referents.push(assigned.value.requirement.id);
	}

	const ledger = new SessionWriteLedger();
	const plain = new DeleteZoneCommand({
		zones: w.zones,
		requirements: w.requirements,
		recalculate: w.recalculate,
		events: w.events,
		locks: w.locks,
		logger,
	});
	const makeCommand = (resolution: 'remove-references' | 'delete-anyway') =>
		new ReversibleDeleteZoneCommand(plain, w.zones, ledger, {
			zoneId: zone.entity.id,
			resolution,
			resolvedReferents: referents,
		}, { requirements: w.requirements, locks: w.locks, logger });

	/** Every referencing requirement as it stands now, keyed by id — the comparison subject. */
	const snapshotAll = async () => {
		const out: Record<string, unknown> = {};
		for (const id of referents) {
			out[id] = expectOk(await w.requirements.getById(id))?.entity ?? null;
		}
		return out;
	};

	return { ...w, zone, referents, ledger, makeCommand, snapshotAll };
}

describe('ReversibleDeleteZoneCommand over a referenced zone', () => {
	it('undo restores the zone AND every requirement the resolution removed', async () => {
		const w = await wired(2);
		const before = await w.snapshotAll();
		const command = w.makeCommand('remove-references');

		expect(expectOk(await command.execute())).toBe('wrote');
		expect(expectOk(await w.zones.getById(w.zone.entity.id))).toBeNull();
		expect(await w.snapshotAll()).toEqual({ [w.referents[0]]: null, [w.referents[1]]: null });

		expect(expectOk(await command.undo())).toBe('wrote');

		// The whole pre-delete state, not just the zone's own fields.
		expect(await w.snapshotAll()).toEqual(before);
		expect(expectOk(await w.zones.getById(w.zone.entity.id))?.entity.geometry.points)
			.toEqual(TEN_SQUARE_METERS);
	});

	it('undo of a delete-anyway restores using the versions the RESOLUTION wrote, not the pre-state ones', async () => {
		// `delete-anyway` marks each referent stale, so every requirement's revision moved
		// under the command's own writes. An undo presenting the pre-resolution version
		// conflicts against the command's own effect — no race involved.
		const w = await wired(2);
		const before = await w.snapshotAll();
		const command = w.makeCommand('delete-anyway');

		expect(expectOk(await command.execute())).toBe('wrote');
		expect(expectOk(await command.undo())).toBe('wrote');

		expect(await w.snapshotAll()).toEqual(before);
		expect(expectOk(await w.zones.getById(w.zone.entity.id))?.entity.geometry.points)
			.toEqual(TEN_SQUARE_METERS);
	});

	/**
	 * **The stamp, end to end through the real adapter — the half a predicate test cannot
	 * prove.** `affectsSaveState` reading a stamped error is one thing; the stamp surviving
	 * `compensate` → `DeleteZoneCommand` → `ReversibleDeleteZoneCommand.execute` is another,
	 * and every hop between them returns the failed `Result` rather than rebuilding it. A hop
	 * that started reconstructing the error would drop the stamp with nothing else failing —
	 * exactly the shape of "a guard on the door nobody dispatches through".
	 *
	 * The vault really is left half-written here: the first requirement is deleted, the second
	 * removal refuses, and the restore of the first refuses too. Asserted on the VAULT as well
	 * as on the flag, so the test cannot pass on a stamp applied to a vault that is actually intact.
	 */
	it('a delete whose compensation fails reports its refusal as having left writes behind', async () => {
		const requirements = new FailRemovalAndRestore();
		const w = await wired(2, requirements);
		requirements.armHalfWritten(2);

		const refused = expectErr(await w.makeCommand('remove-references').execute());

		expect(leftWritesBehind(refused)).toBe(true);
		// The vault matches the claim: one referent gone, one still standing.
		const after = await w.snapshotAll();
		expect(after[w.referents[0]]).toBeNull();
		expect(after[w.referents[1]]).not.toBeNull();
	});

	/**
	 * The counterpart at the same level: compensation SUCCEEDS, so the vault is back at its
	 * pre-state and the refusal is not stamped. Without this case the one above would pass just
	 * as well against a `compensate` that stamped unconditionally, which is the false badge
	 * this whole shape was chosen to avoid.
	 */
	it('a delete whose compensation succeeds reports its refusal as pre-write', async () => {
		const requirements = new FailRemovalAndRestore();
		const w = await wired(2, requirements);
		const before = await w.snapshotAll();
		requirements.armRecoverable(2);

		const refused = expectErr(await w.makeCommand('remove-references').execute());

		expect(leftWritesBehind(refused)).toBe(false);
		expect(await w.snapshotAll()).toEqual(before);
	});

	it('an undo that fails part-way leaves the vault exactly as the delete left it, and stays undoable', async () => {
		const w = await wired(2);
		const history = new CommandHistory();

		expect(expectOk(await history.run(w.makeCommand('remove-references')))).toBe('wrote');
		const afterDelete = { zone: expectOk(await w.zones.getById(w.zone.entity.id)), requirements: await w.snapshotAll() };
		expect(afterDelete.zone).toBeNull();

		// The second requirement restore fails; the first one and the zone must be rolled back.
		(w.requirements as FailNthSave).arm(2);
		const failed = await history.undo();

		expect(failed.ok).toBe(false);
		expect(history.canUndo).toBe(true);
		expect(expectOk(await w.zones.getById(w.zone.entity.id))).toBeNull();
		expect(await w.snapshotAll()).toEqual(afterDelete.requirements);
	});

	it('a resolution whose consented set moved is refused, and nothing is snapshotted for undo', async () => {
		const w = await wired(1);
		// A second referent appears after the set the adapter was constructed with.
		const extra = expectOk(
			await w.assets.save(makeAsset({ name: 'Late' }), 'absent'),
		);
		const assigned = await w.assign.execute({ zoneId: w.zone.entity.id, assetId: extra.entity.id });
		if (!assigned.ok) throw new Error(String(assigned.error));

		const command = w.makeCommand('remove-references');
		const error = expectErr(await command.execute());

		expect(error.code).toBe('reference.set-changed');
		expect(expectOk(await w.zones.getById(w.zone.entity.id))).not.toBeNull();
		// Nothing was deleted, so there is nothing to undo — the adapter never took a snapshot.
		expect(expectErr(await command.undo()).code).toBe('zone.nothing-to-undo');
	});

	it('a rollback whose ZONE delete also fails returns the original failure', async () => {
		const w = await wired(2);
		const command = w.makeCommand('remove-references');
		expect(expectOk(await command.execute())).toBe('wrote');

		// The second requirement restore fails, and so does the compensating zone delete —
		// the vault is left half-restored and the caller is told about the FIRST fault.
		(w.requirements as FailNthSave).arm(2);
		w.zones.failDeleteOnce = true;

		const error = expectErr(await command.undo());

		expect(error.code).toBe('test.injected-failure');
		// The zone the compensation could not remove is still there, which is exactly why the
		// failure is logged rather than swallowed.
		expect(expectOk(await w.zones.getById(w.zone.entity.id))).not.toBeNull();
	});

	it('undo refuses rather than clobbers a requirement that moved underneath it', async () => {
		const w = await wired(1);
		const command = w.makeCommand('delete-anyway');
		expect(expectOk(await command.execute())).toBe('wrote');

		// Another writer lands an edit on the stranded requirement.
		const live = expectOk(await w.requirements.getById(w.referents[0]));
		if (live === null) throw new Error('expected the stranded requirement to survive');
		const edited = expectOk(await w.requirements.save(live.entity, live.version));

		const error = expectErr(await command.undo());
		expect(error.category).toBe('Validation');
		expect(expectOk(await w.requirements.getById(w.referents[0]))?.version.revision)
			.toBe(edited.version.revision);
	});
});
