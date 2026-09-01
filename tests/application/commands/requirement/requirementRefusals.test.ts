import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { err } from '../../../../src/core/result/Result';
import { AssignAssetCommand } from '../../../../src/application/commands/requirement/AssignAsset';
import { UpdateAssetCommand } from '../../../../src/application/commands/asset/UpdateAsset';
import { SetRequirementCostOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementCostOverride';
import { SetRequirementQuantityOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementQuantityOverride';
import { of as moneyOf } from '../../../../src/core/money/Money';
import { expectErr, expectOk, injectedPersistenceError } from '../../../helpers/domain';
import { makeAsset, makeZone } from '../../../helpers/entities';
import {
	overridePort,
	withConflictingReads,
	wiredWithLink,
} from './refusalFixtures';

/**
 * The refusal and error-propagation arms of slice 10's requirement commands: every seam
 * is injected once, and each test asserts the outcome the caller sees -- never merely
 * that a line ran. The recalculation, derivation and picker arms live in
 * `recalculateAndDerivation.test.ts`.
 */

describe('AssignAssetCommand refusals', () => {
	it('answers requirement.asset-not-found for an unknown asset', async () => {
		const w = await wiredWithLink();
		const assigning = new AssignAssetCommand({ zones: w.zones, assets: w.assets, requirements: w.requirements, events: w.events, locks: w.locks, projects: w.projects });
		const error = expectErr(await assigning.execute({ zoneId: w.zoneId, assetId: 'asset-none' as never }));
		expect(error.code).toBe('requirement.asset-not-found');
	});

	it('propagates a failed asset read', async () => {
		const w = await wiredWithLink();
		const assets = overridePort(w.assets, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assigning = new AssignAssetCommand({ zones: w.zones, assets, requirements: w.requirements, events: w.events, locks: w.locks, projects: w.projects });
		const error = expectErr(await assigning.execute({ zoneId: w.zoneId, assetId: w.assetId }));
		expect(error.code).toBe('test.injected-failure');
	});

	it('propagates a failed zone read', async () => {
		const w = await wiredWithLink();
		const zones = overridePort(w.zones, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assigning = new AssignAssetCommand({ zones, assets: w.assets, requirements: w.requirements, events: w.events, locks: w.locks, projects: w.projects });
		const error = expectErr(await assigning.execute({ zoneId: w.zoneId, assetId: w.assetId }));
		expect(error.code).toBe('test.injected-failure');
	});

	it('propagates a failed referent listing', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			listByZone: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assigning = new AssignAssetCommand({ zones: w.zones, assets: w.assets, requirements, events: w.events, locks: w.locks, projects: w.projects });
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
		const assigning = new AssignAssetCommand({ zones: w.zones, assets: w.assets, requirements: w.requirements, events: w.events, locks: w.locks, projects: w.projects });
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
		const assigning = new AssignAssetCommand({ zones: w.zones, assets: w.assets, requirements: w.requirements, events: w.events, locks: w.locks, projects: w.projects });
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
		const assigning = new AssignAssetCommand({ zones: w.zones, assets: w.assets, requirements, events: w.events, locks: w.locks, projects: w.projects });
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

	it('propagates a failed project read', async () => {
		const w = await wiredWithLink();
		const projects = overridePort(w.projects, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const assigning = new AssignAssetCommand({ zones: w.zones, assets: w.assets, requirements: w.requirements, events: w.events, locks: w.locks, projects });
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

	it("answers requirement.project-not-found when the zone's project has vanished", async () => {
		const w = await wiredWithLink();
		const otherZone = expectOk(
			await w.zones.save(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
				'absent',
			),
		);
		expectOk(await w.projects.delete(w.project.entity.id, w.project.version));
		const assigning = new AssignAssetCommand({ zones: w.zones, assets: w.assets, requirements: w.requirements, events: w.events, locks: w.locks, projects: w.projects });
		const error = expectErr(
			await assigning.execute({ zoneId: otherZone.entity.id, assetId: w.assetId }),
		);
		expect(error.code).toBe('requirement.project-not-found');
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
			await w.assets.save(makeAsset(), 'absent'),
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
			await w.assets.save(makeAsset(), 'absent'),
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
			await w.assets.save(makeAsset(), 'absent'),
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
			await w.assets.save(makeAsset(), 'absent'),
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
			await w.assets.save(makeAsset(), 'absent'),
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
			await new SetRequirementQuantityOverrideCommand(requirements, w.events, w.locks).execute({
				requirementId: w.requirementId,
				quantity: 3,
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('the quantity override answers requirement.not-found for an unknown id', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks).execute({
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
			await new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks).execute({
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
				w.locks,
			).execute({ requirementId: w.requirementId, quantity: 3 }),
		);
		expect(error.category).toBe('Validation');
	});

	it('a quantity override keeps an existing cost override while re-pricing the estimate', async () => {
		const w = await wiredWithLink();
		const cost = new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks);
		expectOk(await cost.execute({ requirementId: w.requirementId, cost: moneyOf('99.99', 'EUR') }));

		const quantity = new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks);
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
			await new SetRequirementCostOverrideCommand(requirements, w.events, w.locks).execute({
				requirementId: w.requirementId,
				cost: moneyOf('10.00', 'EUR'),
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('the cost override propagates a lost race on its conditional save', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new SetRequirementCostOverrideCommand(withConflictingReads(w.requirements), w.events, w.locks).execute({
				requirementId: w.requirementId,
				cost: moneyOf('10.00', 'EUR'),
			}),
		);
		expect(error.category).toBe('Validation');
	});
});
