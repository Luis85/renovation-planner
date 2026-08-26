import { Decimal } from 'decimal.js';
import type { RequirementRepository } from '../../../../src/application/ports/RequirementRepository';
import { expectOk } from '../../../helpers/domain';
import { makeAsset, makeZone } from '../../../helpers/entities';
import { requirementFixture, TEN_SQUARE_METERS } from '../../../helpers/slice10';

/**
 * The seams the requirement-command refusal suites inject through, shared by
 * `requirementRefusals.test.ts` and `recalculateAndDerivation.test.ts` so a fixture
 * change lands once.
 */

/** A port double that keeps the inner's behaviour and overrides the patched members. */
export function overridePort<T extends object>(inner: T, patch: Record<string, unknown>): T {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, patch) as T;
}

/**
 * A repository whose reads advance the observed token behind the caller's back -- the
 * stand-in for "another tab wrote between your read and your write", which turns the
 * NEXT conditional save into an external-modification conflict.
 */
export function withConflictingReads(inner: RequirementRepository): RequirementRepository {
	return overridePort(inner, {
		getById: async (id: never) => {
			const result = await inner.getById(id);
			if (result.ok && result.value !== null) inner.poke(id);
			return result;
		},
	});
}

export async function wiredWithLink() {
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
			makeAsset({ projectId: w.project.entity.id, wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	const assigned = await w.assign.execute({ zoneId: zoneEntity.entity.id, assetId: assetEntity.entity.id });
	if (!assigned.ok) throw new Error(`assign failed: ${JSON.stringify(assigned.error)}`);
	return {
		...w,
		zoneId: zoneEntity.entity.id,
		assetId: assetEntity.entity.id,
		requirementId: assigned.value.requirement.id,
	};
}

/** One saved 10 square-meter zone in the fixture's plan -- shared by the arms below. */
export async function wiredZoneFor(w: Awaited<ReturnType<typeof requirementFixture>>) {
	const geometry = expectOk(
		makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
			points: TEN_SQUARE_METERS,
		}),
	);
	const zoneEntity = expectOk(await w.zones.save(geometry, 'absent'));
	return { zoneId: zoneEntity.entity.id };
}
