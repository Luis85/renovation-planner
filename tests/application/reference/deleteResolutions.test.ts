import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { expectErr, expectOk } from '../../helpers/domain';
import { makeAsset, makeZone } from '../../helpers/entities';
import { recorder as logger } from '../../helpers/logger';
import {
	failMarkStaleOnce,
	requirementFixture,
	TEN_SQUARE_METERS,
} from '../../helpers/slice10';

/**
 * The deletion & reference-integrity rules, at the command — the enforcement a script or
 * migration must not be able to walk past.
 */

async function wiredWithRequirement() {
	const w = await requirementFixture();
	const zoneEntity = expectOk(
		await w.zones.save(
			expectOk(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
					points: TEN_SQUARE_METERS,
				}),
			),
			'absent',
		),
	);
	const assetEntity = expectOk(
		await w.assets.save(
			makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	const assigned = await w.assign.execute({ zoneId: zoneEntity.entity.id, assetId: assetEntity.entity.id });
	if (!assigned.ok) throw new Error(String(assigned.error));

	const command = new DeleteZoneCommand({
		zones: w.zones,
		requirements: w.requirements,
		recalculate: w.recalculate,
		events: w.events,
		locks: w.locks,
		logger,
	});
	return {
		...w,
		zoneId: zoneEntity.entity.id,
		assetId: assetEntity.entity.id,
		requirementId: assigned.value.requirement.id,
		command,
	};
}

describe('DeleteZoneCommand reference integrity', () => {
	it('a bare delete with live referents refuses naming them — the path a script takes', async () => {
		const w = await wiredWithRequirement();
		const error = expectErr(await w.command.execute({ zoneId: w.zoneId }));
		expect(error.code).toBe('reference.referents-exist');
		expect(error.message).toContain(w.requirementId);
		// Nothing written.
		expect(expectOk(await w.zones.getById(w.zoneId))).not.toBeNull();
		expect(expectOk(await w.requirements.getById(w.requirementId))).not.toBeNull();
	});

	it('a resolution without resolvedReferents is a ValidationError', async () => {
		const w = await wiredWithRequirement();
		const error = expectErr(
			await w.command.execute({ zoneId: w.zoneId, resolution: 'remove-references' }),
		);
		expect(error.code).toBe('reference.resolution-without-set');
	});

	it('a set that moved since the dialog is refused with reference.set-changed and nothing written', async () => {
		const w = await wiredWithRequirement();
		const asset2 = expectOk(
			await w.assets.save(
				makeAsset(),
				'absent',
			),
		);
		// A second referent appears AFTER the user was shown one.
		await w.assign.execute({ zoneId: w.zoneId, assetId: asset2.entity.id });

		const error = expectErr(
			await w.command.execute({
				zoneId: w.zoneId,
				resolution: 'remove-references',
				resolvedReferents: [w.requirementId],
			}),
		);
		expect(error.code).toBe('reference.set-changed');
		expect(error.message).toContain('2');
		expect(expectOk(await w.zones.getById(w.zoneId))).not.toBeNull();
	});

	it('remove-references deletes the referencing requirements then the zone', async () => {
		const w = await wiredWithRequirement();
		const result = expectOk(
			await w.command.execute({
				zoneId: w.zoneId,
				resolution: 'remove-references',
				resolvedReferents: [w.requirementId],
			}),
		);
		expect(result.affectedAfter).toEqual([{ id: w.requirementId, outcome: 'deleted' }]);
		expect(await w.requirements.getById(w.requirementId)).toEqual({ ok: true, value: null });
		expect(await w.zones.getById(w.zoneId)).toEqual({ ok: true, value: null });
	});

	it('delete-anyway strands the requirement, visibly stale', async () => {
		const w = await wiredWithRequirement();
		expectOk(
			await w.command.execute({
				zoneId: w.zoneId,
				resolution: 'delete-anyway',
				resolvedReferents: [w.requirementId],
			}),
		);
		const stranded = expectOk(await w.requirements.getById(w.requirementId));
		expect(stranded?.entity.origin).toEqual({ kind: 'zone', zoneId: w.zoneId });
		expect(stranded?.entity.recalculationStatus).toBe('stale');
	});

	it('reassign repoints, marks stale, and recalculates INLINE to the new target figures', async () => {
		const w = await wiredWithRequirement();
		// A 20 m² target zone.
		const target = expectOk(
			await w.zones.save(
				expectOk(
					makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
						points: [
							{ x: 0, y: 0 },
							{ x: 4000, y: 0 },
							{ x: 4000, y: 5000 },
							{ x: 0, y: 5000 },
						],
					}),
				),
				'absent',
			),
		);
		expectOk(
			await w.command.execute({
				zoneId: w.zoneId,
				resolution: 'reassign',
				reassignTo: target.entity.id,
				resolvedReferents: [w.requirementId],
			}),
		);
		const repointed = expectOk(await w.requirements.getById(w.requirementId));
		expect(repointed?.entity.origin).toEqual({ kind: 'zone', zoneId: target.entity.id });
		// 20 m² × 1.10 waste = 22 m² — recalculated inline, not left for a later pass.
		expect(repointed?.entity.quantity.calculated.value.toFixed(1)).toBe('22.0');
	});

	it('a failing markStale mid-resolution compensates every write and fails the command', async () => {
		const w = await wiredWithRequirement();
		// Two referents so step 2 has a partial state to compensate.
		const asset2 = expectOk(await w.assets.save(makeAsset(), 'absent'));
		const second = await w.assign.execute({ zoneId: w.zoneId, assetId: asset2.entity.id });
		if (!second.ok) throw new Error('unexpected failure');
		const ids = [w.requirementId, second.value.requirement.id].toSorted();


		// Inject via the test seam in helpers/slice10 — production carries no test-only branch.
		failMarkStaleOnce(w.requirements);

		const error = expectErr(
			await new DeleteZoneCommand({
				zones: w.zones,
				requirements: w.requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger,
			}).execute({
				zoneId: w.zoneId,
				resolution: 'delete-anyway',
				resolvedReferents: ids,
			}),
		);
		expect(error.code).toBe('requirement.mark-stale-failed');
		// Compensated: both referents still exist, the zone still exists.
		for (const id of ids) {
			expect(expectOk(await w.requirements.getById(id))?.entity.recalculationStatus).not.toBe('stale');
		}
		expect(expectOk(await w.zones.getById(w.zoneId))).not.toBeNull();
	});

	it('an assignment dispatched DURING a delete serializes on the lock instead of dangling', async () => {
		const w = await wiredWithRequirement();
		const otherAsset = expectOk(
			await w.assets.save(makeAsset(), 'absent'),
		);

		// Start the resolution WITHOUT awaiting it, then dispatch the assignment.
		const deleting = w.command.execute({
			zoneId: w.zoneId,
			resolution: 'remove-references',
			resolvedReferents: [w.requirementId],
		});
		const assigning = new AssignAssetCommand({
			zones: w.zones,
			assets: w.assets,
			requirements: w.requirements,
			events: w.events,
			locks: w.locks,
			projects: w.projects,
		}).execute({ zoneId: w.zoneId, assetId: otherAsset.entity.id });

		const results = await Promise.all([deleting, assigning] as const);
		// Either the assignment landed first (the delete then refuses on the moved set)
		// or it waited and failed to resolve a zone that is gone — but no dangling
		// requirement survives either way.
		const [, assignment] = results;
		let originZoneId: string | null = null;
		if (assignment.ok) {
			// Assignment won the race; its requirement references a LIVE zone.
			originZoneId = (
				assignment.value.requirement.origin as unknown as { zoneId: string }
			).zoneId;
		}
		let originZoneLive = true;
		if (originZoneId !== null) {
			originZoneLive = expectOk(await w.zones.getById(originZoneId as never)) !== null;
		}
		expect(originZoneLive).toBe(true);
		const survivors = expectOk(await w.requirements.listByZone(w.zoneId));
		for (const r of survivors) {
			expect(expectOk(await w.zones.getById((r.entity.origin as { zoneId: string }).zoneId as never))).not.toBeNull();
		}
	});
});
