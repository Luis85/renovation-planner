import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { err } from '../../../src/core/result/Result';
import { DeleteAssetCommand } from '../../../src/application/commands/asset/DeleteAsset';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { expectErr, expectOk } from '../../helpers/domain';
import { makeAsset, makeZone } from '../../helpers/entities';
import { requirementFixture, TEN_SQUARE_METERS } from '../../helpers/slice10';

/**
 * The per-kind closures DeleteAssetCommand hands unDeleteResolution: the
 * reassignment-target validation, the repoint and markStale persistence arms, and the
 * compensation-facing restore. The engine's own arms live in
 * deleteResolutionEngine.test.ts; each failure here is injected at exactly one seam.
 */

function silentLogger() {
	return { debug() {}, info() {}, warn() {}, error() {} };
}

function injectedPersistenceError(): PersistenceError {
	return { category: 'Persistence', code: 'test.injected-failure', message: 'Injected.' };
}

/** A port double that keeps the inner's behaviour and overrides the patched members. */
function overridePort<T extends object>(inner: T, patch: Record<string, unknown>): T {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, patch) as T;
}
async function wiredAssetWithLink() {
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
	const command = new DeleteAssetCommand({
		assets: w.assets,
		requirements: w.requirements,
		recalculate: w.recalculate,
		events: w.events,
		locks: w.locks,
		logger: silentLogger(),
		overrides: w.overrides,
	});
	return {
		...w,
		zoneId: zoneEntity.entity.id,
		assetId: assetEntity.entity.id,
		requirementId: assigned.value.requirement.id,
		command,
	};
}
describe('DeleteAssetCommand closure refusals', () => {
	it('propagates a failed asset load before anything else happens', async () => {
		const w = await wiredAssetWithLink();
		const assets = overridePort(w.assets, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new DeleteAssetCommand({
				assets,
				requirements: w.requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
				overrides: w.overrides,
			}).execute({ assetId: w.assetId as never }),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('refuses reassignment to the asset itself', async () => {
		const w = await wiredAssetWithLink();
		const error = expectErr(
			await w.command.execute({
				assetId: w.assetId,
				resolution: 'reassign',
				reassignTo: w.assetId,
				resolvedReferents: [],
			}),
		);
		expect(error.code).toBe('reference.self-reassign');
	});

	it('answers reference.reassign-target-gone for an unknown target asset', async () => {
		const w = await wiredAssetWithLink();
		const error = expectErr(
			await w.command.execute({
				assetId: w.assetId,
				resolution: 'reassign',
				reassignTo: createAssetId(),
				resolvedReferents: [],
			}),
		);
		expect(error.code).toBe('reference.reassign-target-gone');
	});

	it('propagates a failed target lookup during validation', async () => {
		const w = await wiredAssetWithLink();
		const assets = overridePort(w.assets, {
			getById: (id: never) =>
				String(id) === w.assetId
					? w.assets.getById(id)
					: Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new DeleteAssetCommand({
				assets,
				requirements: w.requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
				overrides: w.overrides,
			}).execute({
				assetId: w.assetId,
				resolution: 'reassign',
				reassignTo: createAssetId(),
				resolvedReferents: [],
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('the repoint refuses when the requirement vanished between listing and writing', async () => {
		const w = await wiredAssetWithLink();
		const replacement = expectOk(
			await w.assets.save(
				makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);
		let listed = false;
		const requirements = overridePort(w.requirements, {
			listByAsset: async (assetId: never) => {
				const result = await w.requirements.listByAsset(assetId);
				listed = true;
				return result;
			},
			getById: async (id: never) => {
				if (listed && String(id) === w.requirementId) {
					return { ok: true, value: null } as const;
				}
				return await w.requirements.getById(id);
			},
		});
		const error = expectErr(
			await new DeleteAssetCommand({
				assets: w.assets,
				requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
				overrides: w.overrides,
			}).execute({
				assetId: w.assetId,
				resolution: 'reassign',
				reassignTo: replacement.entity.id,
				resolvedReferents: [w.requirementId as never],
			}),
		);
		expect(error.code).toBe('requirement.not-found');
	});

	it('the repoint propagates a failed requirement read', async () => {
		const w = await wiredAssetWithLink();
		const replacement = expectOk(
			await w.assets.save(
				makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);
		let listed = false;
		const requirements = overridePort(w.requirements, {
			listByAsset: async (assetId: never) => {
				const result = await w.requirements.listByAsset(assetId);
				listed = true;
				return result;
			},
			getById: async (id: never) => {
				if (listed && String(id) === w.requirementId) return err(injectedPersistenceError()) as never;
				return await w.requirements.getById(id);
			},
		});
		const error = expectErr(
			await new DeleteAssetCommand({
				assets: w.assets,
				requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
				overrides: w.overrides,
			}).execute({
				assetId: w.assetId,
				resolution: 'reassign',
				reassignTo: replacement.entity.id,
				resolvedReferents: [w.requirementId as never],
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('a failed repoint save compensates (nothing written yet) and fails the command', async () => {
		const w = await wiredAssetWithLink();
		const replacement = expectOk(
			await w.assets.save(
				makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);
		const requirements = overridePort(w.requirements, {
			save: async (requirement: never, expected: never) => {
				if (expected !== 'absent') return err(injectedPersistenceError()) as never;
				return await w.requirements.save(requirement, expected);
			},
		});
		const error = expectErr(
			await new DeleteAssetCommand({
				assets: w.assets,
				requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
				overrides: w.overrides,
			}).execute({
				assetId: w.assetId,
				resolution: 'reassign',
				reassignTo: replacement.entity.id,
				resolvedReferents: [w.requirementId as never],
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(expectOk(await w.assets.getById(w.assetId))).not.toBeNull();
	});

	it.each([
		{ name: 'null', value: null, code: 'requirement.not-found' },
		{ name: 'a read failure', value: 'error', code: 'test.injected-failure' },
	])("markStalePersisted answers a persistence failure when its reread answers $name", async ({ value, code }) => {
		const w = await wiredAssetWithLink();
		let markedStale = false;
		const requirements = overridePort(w.requirements, {
			markStale: async (id: never) => {
				const result = await w.requirements.markStale(id);
				markedStale = true;
				return result;
			},
			getById: async (id: never) => {
				if (markedStale && String(id) === w.requirementId) {
					return (value === null ? { ok: true, value: null } : err(injectedPersistenceError())) as never;
				}
				return await w.requirements.getById(id);
			},
		});
		const error = expectErr(
			await new DeleteAssetCommand({
				assets: w.assets,
				requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
				overrides: w.overrides,
			}).execute({
				assetId: w.assetId,
				resolution: 'delete-anyway',
				resolvedReferents: [w.requirementId as never],
			}),
		);
		expect(error.code).toBe(code);
	});

	it('a restore that cannot write during compensation is logged and the cause stands', async () => {
		const w = await wiredAssetWithLink();
		// A second ZONE assigned to the SAME asset: two referents on one asset, so the
		// forward sequence has a completed write in `progress` when the second one fails.
		const otherZone = expectOk(
			await w.zones.save(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
				'absent',
			),
		);
		const second = await w.assign.execute({ zoneId: otherZone.entity.id, assetId: w.assetId });
		if (!second.ok) throw new Error('unexpected assign failure');

		let marks = 0;
		const requirements = overridePort(w.requirements, {
			markStale: async (id: never) => {
				marks += 1;
				if (marks === 2) return err(injectedPersistenceError()) as never;
				return await w.requirements.markStale(id);
			},
			save: async (requirement: never, expected: never) => {
				if (expected !== 'absent') return err(injectedPersistenceError()) as never;
				return await w.requirements.save(requirement, expected);
			},
		});
		const error = expectErr(
			await new DeleteAssetCommand({
				assets: w.assets,
				requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
				overrides: w.overrides,
			}).execute({
				assetId: w.assetId,
				resolution: 'delete-anyway',
				resolvedReferents: [w.requirementId, second.value.requirement.id] as never,
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});
});

/**
 * Design slice 19 deleted the ASSET half of `reference.cross-project-reassign` and kept the
 * ZONE half, because an Asset stopped belonging to a project and a Zone did not. Both halves
 * are asserted HERE, in one file, because a later reader looking at either alone would read
 * the asymmetry as an oversight and tidy it back into symmetry — which is exactly what
 * design slice 10's rewritten criterion predicted somebody would do.
 */
describe('the reassignment-target project rule is asymmetric', () => {
	it('accepts an asset reassignment target the deleted asset shares no project with', async () => {
		const w = await wiredAssetWithLink();
		// Through design slice 18 this was "an asset from another project" and was refused.
		// There is no other project to be from now: one library serves every project.
		const other = expectOk(
			await w.assets.save(
				makeAsset({ name: 'Cheaper tile', wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);

		expectOk(
			await w.command.execute({
				assetId: w.assetId,
				resolution: 'reassign',
				reassignTo: other.entity.id,
				resolvedReferents: [w.requirementId],
			}),
		);

		const repointed = expectOk(await w.requirements.getById(w.requirementId));
		expect(repointed?.entity.assetId).toBe(other.entity.id);
	});

	it('still refuses a ZONE reassignment target from another project', async () => {
		const w = await requirementFixture();
		const zoneA = expectOk(
			await w.zones.save(
				expectOk(
					makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
						points: TEN_SQUARE_METERS,
					}),
				),
				'absent',
			),
		);
		const foreignZone = expectOk(
			await w.zones.save(
				makeZone({ projectId: 'project-other' as never, planId: w.plan.entity.id }),
				'absent',
			),
		);
		const deleteZone = new DeleteZoneCommand({
			zones: w.zones,
			requirements: w.requirements,
			recalculate: w.recalculate,
			events: w.events,
			locks: w.locks,
			logger: silentLogger(),
		});

		const error = expectErr(
			await deleteZone.execute({
				zoneId: zoneA.entity.id,
				resolution: 'reassign',
				reassignTo: foreignZone.entity.id,
				resolvedReferents: [],
			}),
		);
		expect(error.code).toBe('reference.cross-project-reassign');
	});
});
