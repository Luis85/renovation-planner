import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { err } from '../../../src/core/result/Result';
import { GetRequirementsForZone } from '../../../src/application/queries/GetRequirementsForZone';
import { ListAssets } from '../../../src/application/queries/ListAssets';
import { ListRequirementsReferencing } from '../../../src/application/queries/ListRequirementsReferencing';
import { ListReassignmentTargets } from '../../../src/application/queries/ListReassignmentTargets';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import type { RequirementRepository } from '../../../src/application/ports/RequirementRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { expectErr, expectFound, expectOk } from '../../helpers/domain';
import { makeAsset, makeZone } from '../../helpers/entities';
import { requirementFixture, TEN_SQUARE_METERS } from '../../helpers/slice10';

/**
 * The read side's refusal and staleness arms. The staleness reading is the interesting
 * half: persisted marker, missing endpoints, a failed measurement and a changed unit
 * symbol must each read "stale" — never "current" for figures the query cannot re-derive.
 */

function injectedPersistenceError(): PersistenceError {
	return { category: 'Persistence', code: 'test.injected-failure', message: 'Injected.' };
}

function overridePort<T extends object>(inner: T, patch: Record<string, unknown>): T {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, patch) as T;
}

/**
 * Slice 19's grouping gave this query two more collaborators. Neither is reached on the
 * arm under test here — the requirement listing fails before any project is named — so
 * they are supplied as the narrowest things that satisfy the signature, and the grouping's
 * own behaviour is asserted in `listRequirementsReferencing.test.ts`.
 */
function referencingQuery(requirements: RequirementRepository): ListRequirementsReferencing {
	return new ListRequirementsReferencing(
		requirements,
		new InMemoryProjectRepository(),
		() => undefined,
	);
}

async function wiredWithLink() {
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
	if (!assigned.ok) throw new Error('unexpected assign failure');
	return {
		...w,
		zoneId: zoneEntity.entity.id,
		assetId: assetEntity.entity.id,
		requirementId: assigned.value.requirement.id,
		query: new GetRequirementsForZone(w.requirements, w.zones, w.assets),
	};
}

describe('GetRequirementsForZone error propagation', () => {
	it('propagates a failed requirement listing', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			listByZone: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new GetRequirementsForZone(requirements, w.zones, w.assets).execute(w.zoneId),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('propagates a failed asset read while building a row', async () => {
		const w = await wiredWithLink();
		const assets = overridePort(w.assets, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new GetRequirementsForZone(w.requirements, w.zones, assets).execute(w.zoneId),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('propagates a failed origin-zone read', async () => {
		const w = await wiredWithLink();
		const zones = overridePort(w.zones, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new GetRequirementsForZone(w.requirements, zones, w.assets).execute(w.zoneId),
		);
		expect(error.code).toBe('test.injected-failure');
	});
});

describe('GetRequirementsForZone staleness readings', () => {
	it('a requirement whose ZONE is gone reads stale without failing the row', async () => {
		const w = await wiredWithLink();
		const zone = expectFound(await w.zones.getById(w.zoneId));
		expectOk(await w.zones.delete(w.zoneId, zone.version));

		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.missingTarget).toBeNull();
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});

	it('a failed area computation reads stale instead of trusting the stored figure', async () => {
		const w = await wiredWithLink();
		const stored = expectOk(await w.zones.getById(w.zoneId));
		Object.assign(stored?.entity as object, {
			area: () => ({ ok: false, error: { category: 'Calculation', code: 'test.no-area', message: 'x' } }),
		});
		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});

	it('a NEGATIVE recomputed area reads stale — a figure nothing can re-derive', async () => {
		const w = await wiredWithLink();
		const stored = expectOk(await w.zones.getById(w.zoneId));
		Object.assign(stored?.entity as object, {
			area: () => ({ ok: true, value: -5 }),
		});
		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});

	it('a unit-symbol change between the record and the asset reads stale', async () => {
		const w = await wiredWithLink();
		// A hand edit relabels the recorded derivation's dimension; the numbers alone
		// still match, which is exactly why the SYMBOL is compared.
		const stored = expectOk(await w.requirements.getById(w.requirementId));
		Object.assign(stored?.entity.calculatedFrom as object, { assetUnit: 'm' });
		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});

	it('a requirement whose origin kind this version does not represent renders stale', async () => {
		const w = await wiredWithLink();
		// The union only holds 'zone' today; a future kind must not crash the row build.
		const requirements = overridePort(w.requirements, {
			listByZone: async (zoneId: never) => {
				const listed = await w.requirements.listByZone(zoneId);
				if (listed.ok) {
					for (const loaded of listed.value) {
						Object.assign(loaded.entity as object, {
							origin: { kind: 'work-package', workPackageId: 'wp-1' },
						});
					}
				}
				return listed;
			},
		});
		const rows = expectOk(
			await new GetRequirementsForZone(requirements, w.zones, w.assets).execute(w.zoneId),
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});
});

describe('picker query refusals', () => {
	it('ListAssets propagates a failed listing', async () => {
		const w = await wiredWithLink();
		const assets = overridePort(w.assets, {
			listAll: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(await new ListAssets(assets).execute());
		expect(error.code).toBe('test.injected-failure');
	});

	it('ListRequirementsReferencing propagates failures for both ends of the reference', async () => {
		const w = await wiredWithLink();
		const failingZones = overridePort(w.requirements, {
			listByZone: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const zoneError = expectErr(
			await referencingQuery(failingZones).execute({ kind: 'zone', zoneId: w.zoneId }),
		);
		expect(zoneError.code).toBe('test.injected-failure');

		const failingAssets = overridePort(w.requirements, {
			listByAsset: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assetError = expectErr(
			await referencingQuery(failingAssets).execute({ kind: 'asset', assetId: w.assetId }),
		);
		expect(assetError.code).toBe('test.injected-failure');
	});

	it('ListReassignmentTargets propagates its lookups and answers empty for an unknown entity', async () => {
		const w = await wiredWithLink();
		const targets = new ListReassignmentTargets(w.zones, w.assets);

		const zonesFailing = overridePort(w.zones, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const zoneReadError = expectErr(
			await new ListReassignmentTargets(zonesFailing, w.assets).execute({ kind: 'zone', zoneId: w.zoneId }),
		);
		expect(zoneReadError.code).toBe('test.injected-failure');

		const assetsFailing = overridePort(w.assets, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assetReadError = expectErr(
			await new ListReassignmentTargets(w.zones, assetsFailing).execute({ kind: 'asset', assetId: w.assetId }),
		);
		expect(assetReadError.code).toBe('test.injected-failure');

		const zonesListFailing = overridePort(w.zones, {
			listByProject: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const zoneListError = expectErr(
			await new ListReassignmentTargets(zonesListFailing, w.assets).execute({ kind: 'zone', zoneId: w.zoneId }),
		);
		expect(zoneListError.code).toBe('test.injected-failure');

		const assetsListFailing = overridePort(w.assets, {
			listAll: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assetListError = expectErr(
			await new ListReassignmentTargets(w.zones, assetsListFailing).execute({ kind: 'asset', assetId: w.assetId }),
		);
		expect(assetListError.code).toBe('test.injected-failure');

		// An unknown entity is not there to be excluded from its own target list, and the
		// zone case has no project to list from either: empty, not an error.
		const unknownZone = expectOk(await targets.execute({ kind: 'zone', zoneId: 'zone-none' as never }));
		expect(unknownZone).toEqual([]);
		const unknownAsset = expectOk(await targets.execute({ kind: 'asset', assetId: 'asset-none' as never }));
		expect(unknownAsset).toEqual([]);
	});
});
