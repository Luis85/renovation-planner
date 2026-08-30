import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { UpdateAssetCommand } from '../../../src/application/commands/asset/UpdateAsset';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import { SetRequirementCostOverrideCommand } from '../../../src/application/commands/requirement/SetRequirementCostOverride';
import { of as moneyOf } from '../../../src/core/money/Money';
import { UNIT_KIND } from '../../../src/core/units/MeasurementUnit';
import type { Zone } from '../../../src/domain/zone/Zone';
import type { EntityVersion } from '../../../src/application/ports/versioning';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { expectOk, injectedPersistenceError } from '../../helpers/domain';
import { makeAsset, makeZone } from '../../helpers/entities';
import { recorder as logger } from '../../helpers/logger';
import { requirementFixture, TEN_SQUARE_METERS } from '../../helpers/slice10';

/**
 * The races the reference locks exist for, driven by dispatching one command WITHOUT
 * awaiting it and starting the other on top — which is the whole point. A test that awaited
 * the first would pass with no lock at all, because sequential execution is what a lock
 * produces and never what it is needed for.
 *
 * Each asserts an OUTCOME PAIR rather than an order: a lock does not decide who wins, only
 * that the loser sees a consistent world. Pinning the winner would make the test a
 * description of today's scheduler.
 */

/**
 * Fails the zone repository's `delete` — step 3 of a resolution — and runs `onDelete` first.
 *
 * The hook is what makes the race DETERMINISTIC rather than a guess about the scheduler:
 * "after step 2 rewrote it and before step 3 fails" is a window of one function call, and
 * dispatching the rival command from outside lands it wherever the event loop happens to
 * put it — which, measured, is before step 2 and proves nothing.
 */
class FailZoneDelete extends InMemoryZoneRepository {
	failDelete = false;
	onDelete: (() => void) | null = null;

	override delete(id: ZoneId, expected: EntityVersion) {
		if (this.failDelete) {
			this.onDelete?.();
			return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
		}
		return super.delete(id, expected);
	}
}

async function linkedFixture(zones?: InMemoryZoneRepository) {
	const w = await requirementFixture(undefined, zones);
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
	const asset = expectOk(
		await w.assets.save(
			makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	return { ...w, zone: zone as { entity: Zone; version: EntityVersion }, asset };
}

describe('two commands racing for the same reference lock', () => {
	it('an assignment during a unit-changing asset update cannot leave a non-area link', async () => {
		const w = await linkedFixture();
		const update = new UpdateAssetCommand(w.assets, w.requirements, w.events, w.locks);
		const assign = new AssignAssetCommand(w.zones, w.assets, w.requirements, w.events, w.locks);

		// The asset has NO referents yet, so the unit change is legal at the moment it starts.
		// Dispatched WITHOUT awaiting, then the assignment on top of it.
		const updating = update.execute({ assetId: w.asset.entity.id, changes: { unit: 'm' } });
		const assigning = assign.execute({ zoneId: w.zone.entity.id, assetId: w.asset.entity.id });
		const [updated, assigned] = await Promise.all([updating, assigning]);

		// Exactly one of the two can have landed, and the loser refuses.
		expect(updated.ok && assigned.ok).toBe(false);

		// Whatever the order, the invariant holds: no requirement links a non-area asset.
		// Computed rather than branched, so the assertion runs on every path — a conditional
		// `expect` is an assertion that quietly does not happen down the branch it skips.
		const live = expectOk(await w.requirements.listByAsset(w.asset.entity.id));
		const asset = expectOk(await w.assets.getById(w.asset.entity.id));
		const nonAreaLinks = UNIT_KIND[asset?.entity.unit ?? 'm2'] === 'area' ? [] : live;
		expect(nonAreaLinks).toEqual([]);
	});

	it("a resolution's compensation is not blocked by a concurrent override edit", async () => {
		const zones = new FailZoneDelete();
		const w = await linkedFixture(zones);
		const assigned = await w.assign.execute({
			zoneId: w.zone.entity.id,
			assetId: w.asset.entity.id,
		});
		if (!assigned.ok) throw new Error(String(assigned.error));
		const requirementId = assigned.value.requirement.id;
		const before = expectOk(await w.requirements.getById(requirementId));
		if (before === null) throw new Error('expected the requirement');

		const command = new DeleteZoneCommand({
			zones,
			requirements: w.requirements,
			recalculate: w.recalculate,
			events: w.events,
			locks: w.locks,
			logger,
		});
		const override = new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks);

		// Step 3 fails, so the sequence must roll step 2 back — and the override is started
		// from inside that failing delete, which is exactly the window the rule names. NOT
		// awaited there: the resolution still holds the requirement's level-2 lock, so
		// awaiting it inside its own step 3 would deadlock the resolution against itself.
		zones.failDelete = true;
		let editing: ReturnType<typeof override.execute> | null = null;
		zones.onDelete = () => {
			editing = override.execute({ requirementId, cost: moneyOf('12.34', 'EUR') });
		};

		const resolved = await command.execute({
			zoneId: w.zone.entity.id,
			resolution: 'delete-anyway',
			resolvedReferents: [requirementId],
		});
		const edited = await (editing as unknown as ReturnType<typeof override.execute>);

		// The resolution failed, and its rollback landed: the requirement is back at the
		// status it had before step 2, and the zone is still there.
		expect(resolved.ok).toBe(false);
		expect(expectOk(await w.zones.getById(w.zone.entity.id))).not.toBeNull();

		// The discriminating half, measured rather than predicted: with the lock removed the
		// compensation still lands, and it is the OVERRIDE that is refused — a legal edit
		// silently lost to a rollback it had nothing to do with, because it read the
		// post-step-2 version and the compensation superseded it. With the lock the two are
		// serialized and the override applies on top of what the rollback restored.
		//
		// What this cannot distinguish, said plainly: the instrument is the SERIALIZATION,
		// not the lock's identity. An `acquire([], [])` over an empty set suspends at the
		// same point and orders the two the same way, so this test would pass against one.
		// The regression it does catch is the realistic one — the acquire being dropped.
		expect(edited.ok).toBe(true);
		const after = expectOk(await w.requirements.getById(requirementId));
		expect(after?.entity.recalculationStatus).toBe(before.entity.recalculationStatus);
		expect(after?.entity.estimatedCost.override?.amount).toBe('12.34');
	});
});
