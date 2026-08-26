import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { err } from '../../../../src/core/result/Result';
import { AssignAssetCommand } from '../../../../src/application/commands/requirement/AssignAsset';
import { RecalculateRequirementCommand } from '../../../../src/application/commands/requirement/RecalculateRequirement';
import { UpdateAssetCommand } from '../../../../src/application/commands/asset/UpdateAsset';
import { CreateAssetCommand } from '../../../../src/application/commands/asset/CreateAsset';
import { SetRequirementCostOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementCostOverride';
import { SetRequirementQuantityOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementQuantityOverride';
import { DeleteRequirementCommand } from '../../../../src/application/commands/requirement/DeleteRequirement';
import {
	assetMatchesCalculatedFrom,
	deriveRequirementFigures,
} from '../../../../src/application/commands/requirement/deriveRequirementFigures';
import { ListReassignmentTargets } from '../../../../src/application/queries/ListReassignmentTargets';
import { of as moneyOf } from '../../../../src/core/money/Money';
import type { PersistenceError } from '../../../../src/core/errors/AppError';
import type { RequirementRepository } from '../../../../src/application/ports/RequirementRepository';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset, makeRequirement, makeZone } from '../../../helpers/entities';
import { requirementFixture, TEN_SQUARE_METERS } from '../../../helpers/slice10';

/**
 * The refusal and error-propagation arms of slice 10's requirement commands: every seam
 * is injected once, and each test asserts the outcome the caller sees -- never merely
 * that a line ran.
 */

function injectedPersistenceError(): PersistenceError {
	return { category: 'Persistence', code: 'test.injected-failure', message: 'Injected.' };
}

/** A port double that keeps the inner's behaviour and overrides the patched members. */
function overridePort<T extends object>(inner: T, patch: Record<string, unknown>): T {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, patch) as T;
}

/**
 * A repository whose reads advance the observed token behind the caller's back -- the
 * stand-in for "another tab wrote between your read and your write", which turns the
 * NEXT conditional save into an external-modification conflict.
 */
function withConflictingReads(inner: RequirementRepository): RequirementRepository {
	return overridePort(inner, {
		getById: async (id: never) => {
			const result = await inner.getById(id);
			if (result.ok && result.value !== null) inner.poke(id);
			return result;
		},
	});
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
async function wiredZoneFor(w: Awaited<ReturnType<typeof requirementFixture>>) {
	const geometry = expectOk(
		makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
			points: TEN_SQUARE_METERS,
		}),
	);
	const zoneEntity = expectOk(await w.zones.save(geometry, 'absent'));
	return { zoneId: zoneEntity.entity.id };
}

describe('AssignAssetCommand refusals', () => {
	it('answers requirement.asset-not-found for an unknown asset', async () => {
		const w = await wiredWithLink();
		const assigning = new AssignAssetCommand(w.zones, w.assets, w.requirements, w.events, w.locks);
		const error = expectErr(await assigning.execute({ zoneId: w.zoneId, assetId: 'asset-none' as never }));
		expect(error.code).toBe('requirement.asset-not-found');
	});

	it('propagates a failed asset read', async () => {
		const w = await wiredWithLink();
		const assets = overridePort(w.assets, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assigning = new AssignAssetCommand(w.zones, assets, w.requirements, w.events, w.locks);
		const error = expectErr(await assigning.execute({ zoneId: w.zoneId, assetId: w.assetId }));
		expect(error.code).toBe('test.injected-failure');
	});

	it('propagates a failed zone read', async () => {
		const w = await wiredWithLink();
		const zones = overridePort(w.zones, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assigning = new AssignAssetCommand(zones, w.assets, w.requirements, w.events, w.locks);
		const error = expectErr(await assigning.execute({ zoneId: w.zoneId, assetId: w.assetId }));
		expect(error.code).toBe('test.injected-failure');
	});

	it('propagates a failed referent listing', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			listByZone: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assigning = new AssignAssetCommand(w.zones, w.assets, requirements, w.events, w.locks);
		const otherZone = expectOk(
			await w.zones.save(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
				'absent',
			),
		);
		const error = expectErr(
			await assigning.execute({ zoneId: otherZone.entity.id, assetId: w.assetId }),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('answers requirement.area-failed when the zone cannot be measured', async () => {
		const w = await wiredWithLink();
		const otherZone = expectOk(
			await w.zones.save(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
				'absent',
			),
		);
		const stored = expectOk(await w.zones.getById(otherZone.entity.id));
		Object.assign(stored?.entity as object, {
			area: () => ({ ok: false, error: { category: 'Calculation', code: 'test.no-area', message: 'x' } }),
		});
		const assigning = new AssignAssetCommand(w.zones, w.assets, w.requirements, w.events, w.locks);
		const error = expectErr(
			await assigning.execute({ zoneId: otherZone.entity.id, assetId: w.assetId }),
		);
		expect(error.code).toBe('requirement.area-failed');
	});

	it('refuses when the derivation fails against a hand-tampered asset', async () => {
		const w = await wiredWithLink();
		const otherZone = expectOk(
			await w.zones.save(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
				'absent',
			),
		);
		// A negative waste default cannot come from Asset.create; a hand edit or a bad
		// migration can still land one, and the pipeline must refuse it.
		const stored = expectOk(await w.assets.getById(w.assetId));
		Object.assign(stored?.entity as object, { wasteFactorDefault: new Decimal('-0.10') });
		const assigning = new AssignAssetCommand(w.zones, w.assets, w.requirements, w.events, w.locks);
		const error = expectErr(
			await assigning.execute({ zoneId: otherZone.entity.id, assetId: w.assetId }),
		);
		expect((error as { code: string }).code).toContain('negative');
	});

	it('propagates a failed create save instead of reporting success', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			save: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assigning = new AssignAssetCommand(w.zones, w.assets, requirements, w.events, w.locks);
		const otherZone = expectOk(
			await w.zones.save(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
				'absent',
			),
		);
		const error = expectErr(
			await assigning.execute({ zoneId: otherZone.entity.id, assetId: w.assetId }),
		);
		expect(error.code).toBe('test.injected-failure');
	});
});

describe('UpdateAssetCommand refusals', () => {
	it('propagates a failed asset read', async () => {
		const w = await wiredWithLink();
		const assets = overridePort(w.assets, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new UpdateAssetCommand(assets, w.requirements, w.events, w.locks).execute({
				assetId: w.assetId,
				changes: { name: 'x' },
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('refuses changes whose merged entity fails validation', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new UpdateAssetCommand(w.assets, w.requirements, w.events, w.locks).execute({
				assetId: w.assetId,
				changes: { wasteFactorDefault: new Decimal('-1') },
			}),
		);
		expect(error.category).toBe('Validation');
	});

	it('a unit-kind change on an UNREFERENCED asset re-reads under the lock and saves', async () => {
		const w = await wiredWithLink();
		const spare = expectOk(
			await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'),
		);
		const updated = expectOk(
			await new UpdateAssetCommand(w.assets, w.requirements, w.events, w.locks).execute({
				assetId: spare.entity.id,
				changes: { unit: 'piece' },
			}),
		);
		expect(updated.unit).toBe('piece');
	});

	it('the kind-change re-read answers asset.not-found when the asset vanished under the lock', async () => {
		const w = await wiredWithLink();
		const spare = expectOk(
			await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'),
		);
		let reads = 0;
		const assets = overridePort(w.assets, {
			getById: async (id: never) => {
				reads += 1;
				if (reads === 2) return { ok: true, value: null } as const;
				return await w.assets.getById(id);
			},
		});
		const error = expectErr(
			await new UpdateAssetCommand(assets, w.requirements, w.events, w.locks).execute({
				assetId: spare.entity.id,
				changes: { unit: 'piece' },
			}),
		);
		expect(error.code).toBe('asset.not-found');
	});

	it('the kind-change re-read propagates its failure', async () => {
		const w = await wiredWithLink();
		const spare = expectOk(
			await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'),
		);
		let reads = 0;
		const assets = overridePort(w.assets, {
			getById: async (id: never) => {
				reads += 1;
				if (reads === 2) return err(injectedPersistenceError()) as never;
				return await w.assets.getById(id);
			},
		});
		const error = expectErr(
			await new UpdateAssetCommand(assets, w.requirements, w.events, w.locks).execute({
				assetId: spare.entity.id,
				changes: { unit: 'piece' },
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('the kind-change re-read re-validates what it actually read', async () => {
		const w = await wiredWithLink();
		const spare = expectOk(
			await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'),
		);
		let reads = 0;
		const assets = overridePort(w.assets, {
			getById: async (id: never) => {
				reads += 1;
				const loaded = await w.assets.getById(id);
				// Another writer lands an invalid field between the two reads.
				if (reads === 2 && loaded.ok && loaded.value !== null) {
					Object.assign(loaded.value.entity as object, { wasteFactorDefault: new Decimal('-1') });
				}
				return loaded;
			},
		});
		const error = expectErr(
			await new UpdateAssetCommand(assets, w.requirements, w.events, w.locks).execute({
				assetId: spare.entity.id,
				changes: { unit: 'piece' },
			}),
		);
		expect(error.category).toBe('Validation');
	});

	it('the kind-change referent check propagates a failed listing', async () => {
		const w = await wiredWithLink();
		const spare = expectOk(
			await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'),
		);
		const requirements = overridePort(w.requirements, {
			listByAsset: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new UpdateAssetCommand(w.assets, requirements, w.events, w.locks).execute({
				assetId: spare.entity.id,
				changes: { unit: 'piece' },
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('an edit overtaken by another writer refuses with a conflict instead of clobbering', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new UpdateAssetCommand(withConflictingReads(w.assets), w.requirements, w.events, w.locks).execute({
				assetId: w.assetId,
				changes: { name: 'Renamed tile' },
			}),
		);
		expect(error.category).toBe('Validation');
	});
});

describe('override command refusals beyond not-found', () => {
	it('the quantity override propagates a failed read', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new SetRequirementQuantityOverrideCommand(requirements, w.events).execute({
				requirementId: w.requirementId,
				quantity: 3,
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('the quantity override answers requirement.not-found for an unknown id', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new SetRequirementQuantityOverrideCommand(w.requirements, w.events).execute({
				requirementId: 'requirement-none' as never,
				quantity: 3,
			}),
		);
		expect(error.code).toBe('requirement.not-found');
	});

	it('the quantity override refuses when the cost pipeline refuses its inputs', async () => {
		const w = await wiredWithLink();
		// A hand-tampered negative recorded price: the pipeline refuses a negative unit
		// price even though the Money type itself is signed.
		const stored = expectOk(await w.requirements.getById(w.requirementId));
		Object.assign(stored?.entity.calculatedFrom.unitCost as object, { amount: '-5.00' });
		const error = expectErr(
			await new SetRequirementQuantityOverrideCommand(w.requirements, w.events).execute({
				requirementId: w.requirementId,
				quantity: 3,
			}),
		);
		expect((error as { code: string }).code).toContain('negative');
	});

	it('the quantity override propagates a lost race on its conditional save', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new SetRequirementQuantityOverrideCommand(
				withConflictingReads(w.requirements),
				w.events,
			).execute({ requirementId: w.requirementId, quantity: 3 }),
		);
		expect(error.category).toBe('Validation');
	});

	it('a quantity override keeps an existing cost override while re-pricing the estimate', async () => {
		const w = await wiredWithLink();
		const cost = new SetRequirementCostOverrideCommand(w.requirements, w.events);
		expectOk(await cost.execute({ requirementId: w.requirementId, cost: moneyOf('99.99', 'EUR') }));

		const quantity = new SetRequirementQuantityOverrideCommand(w.requirements, w.events);
		const updated = expectOk(
			await quantity.execute({ requirementId: w.requirementId, quantity: 5 }),
		);
		expect(updated.estimatedCost.override?.amount).toBe('99.99');
		// The CALCULATED figure was re-run against the new effective quantity; the
		// user's override sits beside it, untouched.
		expect(updated.quantity.override?.value.toString()).toBe('5');
	});

	it('the cost override propagates a failed read', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new SetRequirementCostOverrideCommand(requirements, w.events).execute({
				requirementId: w.requirementId,
				cost: moneyOf('10.00', 'EUR'),
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('the cost override propagates a lost race on its conditional save', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new SetRequirementCostOverrideCommand(withConflictingReads(w.requirements), w.events).execute({
				requirementId: w.requirementId,
				cost: moneyOf('10.00', 'EUR'),
			}),
		);
		expect(error.category).toBe('Validation');
	});
});

describe('RecalculateRequirementCommand refusals', () => {
	it('propagates a failed read', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new RecalculateRequirementCommand(requirements, w.zones, w.assets, w.events).execute({
				requirementId: w.requirementId,
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('wraps a vanished zone as requirement.zone-gone', async () => {
		const w = await wiredWithLink();
		const zone = expectOk(await w.zones.getById(w.zoneId));
		expectOk(await w.zones.delete(w.zoneId, zone.version));
		const error = expectErr(await w.recalculate.execute({ requirementId: w.requirementId }));
		expect(error.category).toBe('Calculation');
		expect((error as { code: string }).code).toBe('requirement.zone-gone');
	});

	it('wraps a vanished asset as requirement.asset-gone', async () => {
		const w = await wiredWithLink();
		const asset = expectOk(await w.assets.getById(w.assetId));
		expectOk(await w.assets.delete(w.assetId, asset.version));
		const error = expectErr(await w.recalculate.execute({ requirementId: w.requirementId }));
		expect((error as { code: string }).code).toBe('requirement.asset-gone');
	});

	it('wraps a failing area computation as requirement.area-failed', async () => {
		const w = await wiredWithLink();
		const stored = expectOk(await w.zones.getById(w.zoneId));
		Object.assign(stored?.entity as object, {
			area: () => ({ ok: false, error: { category: 'Calculation', code: 'test.no-area', message: 'x' } }),
		});
		const error = expectErr(await w.recalculate.execute({ requirementId: w.requirementId }));
		expect((error as { code: string }).code).toBe('requirement.area-failed');
	});

	it('refuses figures a hand-tampered waste factor cannot produce', async () => {
		const w = await wiredWithLink();
		const stored = expectOk(await w.requirements.getById(w.requirementId));
		Object.assign(stored?.entity as object, { wasteFactor: new Decimal('-0.05') });
		const error = expectErr(await w.recalculate.execute({ requirementId: w.requirementId }));
		expect((error as { code: string }).code).toContain('negative');
	});

	it('propagates a lost race on its conditional save', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new RecalculateRequirementCommand(
				withConflictingReads(w.requirements),
				w.zones,
				w.assets,
				w.events,
			).execute({ requirementId: w.requirementId }),
		);
		expect(error.category).toBe('Validation');
	});
});

describe('DeleteRequirementCommand error propagation', () => {
	it('propagates a failed read', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new DeleteRequirementCommand(requirements).execute({ requirementId: w.requirementId }),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('propagates a refused delete', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			delete: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new DeleteRequirementCommand(requirements).execute({ requirementId: w.requirementId }),
		);
		expect(error.code).toBe('test.injected-failure');
	});
});

describe('deriveRequirementFigures stage refusals', () => {
	it('refuses a negative raw area at the measurement stage', () => {
		const result = deriveRequirementFigures({
			zoneAreaMm2: -1000,
			assetUnit: 'm2',
			unitCost: moneyOf('45.00', 'EUR'),
			wasteFactor: new Decimal('0.10'),
		});
		expect(result).toMatchObject({ ok: false, error: { code: 'quantity.negative' } });
	});

	it('refuses a negative waste factor at the waste stage', () => {
		const result = deriveRequirementFigures({
			zoneAreaMm2: 10_000_000,
			assetUnit: 'm2',
			unitCost: moneyOf('45.00', 'EUR'),
			wasteFactor: new Decimal('-0.10'),
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected a refusal');
		expect(result.error.code).toContain('negative');
	});

	it('refuses a negative recorded price at the cost stage', () => {
		const result = deriveRequirementFigures({
			zoneAreaMm2: 10_000_000,
			assetUnit: 'm2',
			unitCost: moneyOf('-45.00', 'EUR'),
			wasteFactor: new Decimal('0.10'),
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected a refusal');
		expect(result.error.code).toContain('cost.negative');
	});

	it('assetMatchesCalculatedFrom compares amount, currency AND unit symbol', () => {
		const calculatedFrom = {
			zoneArea: { value: new Decimal(10), unit: 'm2' as const },
			unitCost: moneyOf('45.00', 'EUR'),
			assetUnit: 'm2' as const,
		};
		expect(assetMatchesCalculatedFrom(calculatedFrom, { unitCost: moneyOf('45.00', 'EUR'), unit: 'm2' })).toBe(true);
		expect(assetMatchesCalculatedFrom(calculatedFrom, { unitCost: moneyOf('30.00', 'EUR'), unit: 'm2' })).toBe(false);
		expect(assetMatchesCalculatedFrom(calculatedFrom, { unitCost: moneyOf('45.00', 'USD'), unit: 'm2' })).toBe(false);
		expect(assetMatchesCalculatedFrom(calculatedFrom, { unitCost: moneyOf('45.00', 'EUR'), unit: 'm' })).toBe(false);
	});
});

describe('CreateAssetCommand save refusals', () => {
	it('propagates a refused create save', async () => {
		const w = await requirementFixture();
		const assets = overridePort(w.assets, {
			save: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new CreateAssetCommand(assets, w.events).execute({
				projectId: w.project.entity.id,
				name: 'Grout',
				category: 'material',
				unit: 'piece',
				unitCostAmount: '2.50',
				currency: 'EUR',
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});
});

describe('InMemoryRequirementRepository.markStale validation arm', () => {
	it('refuses to mark stale a record whose fields no longer construct', async () => {
		const w = await requirementFixture();
		const { zoneId } = await wiredZoneFor(w);
		const requirement = makeRequirement({
			projectId: w.project.entity.id,
			assetId: 'asset-x' as never,
			origin: { kind: 'zone', zoneId },
		});
		expectOk(await w.requirements.save(requirement, 'absent'));
		// A hand edit that breaks the smart constructor must fail the MARKER WRITE,
		// loudly -- not silently leave the entity as it was.
		const stored = expectOk(await w.requirements.getById(requirement.id));
		Object.assign(stored?.entity as object, { requiredDate: 'not a date' });

		const error = expectErr(await w.requirements.markStale(requirement.id));
		expect(error.code).toBe('requirement.mark-stale-invalid');
	});
});

describe('picker query supplement', () => {
	it('ListReassignmentTargets maps area-kind assets other than the deleted one', async () => {
		const w = await wiredWithLink();
		const replacement = expectOk(
			await w.assets.save(
				makeAsset({ projectId: w.project.entity.id, wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);
		const targets = expectOk(
			await new ListReassignmentTargets(w.zones, w.assets).execute({ kind: 'asset', assetId: w.assetId }),
		);
		expect(targets.map((target) => target.id)).toEqual([replacement.entity.id]);
	});
});
