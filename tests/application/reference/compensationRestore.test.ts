import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { err, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryAssetRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import { DeleteAssetCommand } from '../../../src/application/commands/asset/DeleteAsset';
import type { EntityVersion, Loaded } from '../../../src/application/ports/versioning';
import { expectErr, expectOk } from '../../helpers/domain';
import { makeAsset, makeRequirement, makeZone } from '../../helpers/entities';
import type { Zone } from '../../../src/domain/zone/Zone';
import { recorder as logger } from '../../helpers/logger';
import { requirementFixture, TEN_SQUARE_METERS } from '../../helpers/slice10';

/**
 * The compensation half of the delete-resolution sequence: a forward write COMPLETES
 * (its progress is recorded), a later step fails, and the restore must actually PUT THE
 * SNAPSHOT BACK — presenting the version the forward write recorded. Every earlier
 * compensation test injected its failure into the FIRST per-referent step, so progress
 * was empty and this success path never ran.
 */

// Generic over the ID as well as the repository, and constrained STRUCTURALLY on the one
// method this touches. Constraining to the union of the two concrete repositories made
// `repo.delete` a union of function types, and a call through one of those accepts only the
// INTERSECTION of its parameters — `never` for two differently-branded ids — so the
// pass-through could not be written at all.
function failOnceDelete<TId, R extends { delete(id: TId, expected: EntityVersion): Promise<Result<void, AppError>> }>(
	repo: R,
): R {
	const inner = repo.delete.bind(repo);
	let armed = true;
	repo.delete = ((id: Parameters<typeof inner>[0], expected: Parameters<typeof inner>[1]) => {
		if (armed) {
			armed = false;
			return Promise.resolve(
				err({ category: 'Persistence', code: 'test.injected-delete', message: 'injected' }),
			);
		}
		return inner(id, expected);
	}) as typeof repo.delete;
	return repo;
}

async function wiredZoneWithReferent() {
	const w = await requirementFixture();
	const zone: Loaded<Zone> = expectOk(
		await w.zones.save(
			expectOk(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
					points: TEN_SQUARE_METERS,
				}),
			),
			'absent',
		),
	);
	return { ...w, zone };
}

describe('a completed forward write is restored when a later step fails', () => {
	it('DeleteZone: the removed referent comes back when the zone note itself cannot be deleted', async () => {
		const w = await wiredZoneWithReferent();
		const asset = expectOk(await w.assets.save(makeAsset(), 'absent'));
		const requirement = expectOk(
			await w.requirements.save(
				makeRequirement({
					projectId: w.project.entity.id,
					assetId: asset.entity.id,
					origin: { kind: 'zone', zoneId: w.zone.entity.id },
				}),
				'absent',
			),
		);

		// A second repository holding the same zone, whose FIRST delete fails after the
		// referent removal has already completed.
		const zones = failOnceDelete(new InMemoryZoneRepository());
		await zones.save(w.zone.entity, 'absent');

		const error = expectErr(
			await new DeleteZoneCommand({
				zones,
				requirements: w.requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger,
			}).execute({
				zoneId: w.zone.entity.id,
				resolution: 'remove-references',
				resolvedReferents: [requirement.entity.id],
			}),
		);
		expect(error.code).toBe('test.injected-delete');

		// Compensated FOR REAL: the deleted referent was put back, not merely left alone.
		expect(expectOk(await w.requirements.getById(requirement.entity.id))).not.toBeNull();
	});

	it('DeleteAsset: the removed referent comes back when the asset note itself cannot be deleted', async () => {
		const w = await wiredZoneWithReferent();
		const asset = expectOk(
			await w.assets.save(
				makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);
		const assigned = await w.assign.execute({ zoneId: w.zone.entity.id, assetId: asset.entity.id });
		if (!assigned.ok) throw new Error(String(assigned.error));
		const requirementId = assigned.value.requirement.id;

		const assets = failOnceDelete(new InMemoryAssetRepository());
		await assets.save(asset.entity, 'absent');

		const error = expectErr(
			await new DeleteAssetCommand({
				assets,
				requirements: w.requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger,
				overrides: w.overrides,
			}).execute({
				assetId: asset.entity.id,
				resolution: 'remove-references',
				resolvedReferents: [requirementId],
			}),
		);
		expect(error.code).toBe('test.injected-delete');

		expect(expectOk(await w.requirements.getById(requirementId))).not.toBeNull();
	});
});
