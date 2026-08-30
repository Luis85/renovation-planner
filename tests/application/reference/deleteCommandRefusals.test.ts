import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { err } from '../../../src/core/result/Result';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { expectErr, expectOk } from '../../helpers/domain';
import { makeAsset, makeZone } from '../../helpers/entities';
import { requirementFixture, TEN_SQUARE_METERS } from '../../helpers/slice10';

/**
 * The per-kind closures the two delete commands hand `runDeleteResolution`: the
 * reassignment-target validation, the repoint and markStale persistence arms, and the
 * compensation-facing restore. The engine's own arms live in
 * `deleteResolutionEngine.test.ts`; each failure here is injected at exactly one seam.
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

async function wiredZoneWithLink() {
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
	const command = new DeleteZoneCommand({
		zones: w.zones,
		requirements: w.requirements,
		recalculate: w.recalculate,
		events: w.events,
		locks: w.locks,
		logger: silentLogger(),
	});
	return {
		...w,
		zoneId: zoneEntity.entity.id,
		assetId: assetEntity.entity.id,
		requirementId: assigned.value.requirement.id,
		command,
	};
}

/** A second zone/asset pair in the SAME project, usable as a reassignment target. */
async function saveTarget(w: Awaited<ReturnType<typeof wiredZoneWithLink>>) {
	return expectOk(
		await w.zones.save(
			makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
			'absent',
		),
	);
}

describe('DeleteZoneCommand closure refusals', () => {
	it('answers reference.reassign-target-gone for a target zone that does not exist', async () => {
		const w = await wiredZoneWithLink();
		const error = expectErr(
			await w.command.execute({
				zoneId: w.zoneId,
				resolution: 'reassign',
				reassignTo: createZoneId(),
				resolvedReferents: [],
			}),
		);
		expect(error.code).toBe('reference.reassign-target-gone');
	});

	it('propagates a failed target lookup made under the lock', async () => {
		const w = await wiredZoneWithLink();
		const targetId = createZoneId();
		const zones = overridePort(w.zones, {
			getById: async (id: never) => {
				if (String(id) === targetId) return err(injectedPersistenceError()) as never;
				return await w.zones.getById(id);
			},
		});
		const error = expectErr(
			await new DeleteZoneCommand({
				zones,
				requirements: w.requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
			}).execute({
				zoneId: w.zoneId,
				resolution: 'reassign',
				reassignTo: targetId,
				resolvedReferents: [],
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('the repoint propagates a failed requirement read', async () => {
		const w = await wiredZoneWithLink();
		const target = await saveTarget(w);
		let listed = false;
		const requirements = overridePort(w.requirements, {
			listByZone: async (zoneId: never) => {
				const result = await w.requirements.listByZone(zoneId);
				listed = true;
				return result;
			},
			getById: async (id: never) => {
				if (listed && String(id) === w.requirementId) return err(injectedPersistenceError()) as never;
				return await w.requirements.getById(id);
			},
		});
		const error = expectErr(
			await new DeleteZoneCommand({
				zones: w.zones,
				requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
			}).execute({
				zoneId: w.zoneId,
				resolution: 'reassign',
				reassignTo: target.entity.id,
				resolvedReferents: [w.requirementId as never],
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('the repoint refuses when the requirement vanished between listing and writing', async () => {
		const w = await wiredZoneWithLink();
		const target = await saveTarget(w);

		// The referent list is what step 1 reads; everything after it sees the
		// requirement gone — the concurrent-delete window.
		let listed = false;
		const requirements = overridePort(w.requirements, {
			listByZone: async (zoneId: never) => {
				const result = await w.requirements.listByZone(zoneId);
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
			await new DeleteZoneCommand({
				zones: w.zones,
				requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
			}).execute({
				zoneId: w.zoneId,
				resolution: 'reassign',
				reassignTo: target.entity.id,
				resolvedReferents: [w.requirementId as never],
			}),
		);
		expect(error.code).toBe('requirement.not-found');
	});

	it('a failed repoint save compensates (nothing written yet) and fails the command', async () => {
		const w = await wiredZoneWithLink();
		const target = await saveTarget(w);
		const requirements = overridePort(w.requirements, {
			save: async (requirement: never, expected: never) => {
				if (expected !== 'absent') return err(injectedPersistenceError()) as never;
				return await w.requirements.save(requirement, expected);
			},
		});
		const error = expectErr(
			await new DeleteZoneCommand({
				zones: w.zones,
				requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
			}).execute({
				zoneId: w.zoneId,
				resolution: 'reassign',
				reassignTo: target.entity.id,
				resolvedReferents: [w.requirementId as never],
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		// Compensated before any mutation: nothing stale, nothing deleted.
		expect(expectOk(await w.zones.getById(w.zoneId))).not.toBeNull();
	});

	it.each([
		{ name: 'null', value: null, code: 'requirement.not-found' },
		{ name: 'a read failure', value: 'error', code: 'test.injected-failure' },
	])('markStalePersisted answers a persistence failure when its reread answers $name', async ({ value, code }) => {
		const w = await wiredZoneWithLink();
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
			await new DeleteZoneCommand({
				zones: w.zones,
				requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
			}).execute({
				zoneId: w.zoneId,
				resolution: 'delete-anyway',
				resolvedReferents: [w.requirementId as never],
			}),
		);
		expect(error.code).toBe(code);
	});

	it('a restore that cannot write during compensation is logged and the cause stands', async () => {
		const w = await wiredZoneWithLink();
		// A SECOND asset on the same zone: two referents, so the forward sequence has a
		// completed write in `progress` when the second one fails.
		const secondAsset = expectOk(
			await w.assets.save(
				makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);
		const second = await w.assign.execute({ zoneId: w.zoneId, assetId: secondAsset.entity.id });
		if (!second.ok) throw new Error('unexpected assign failure');

		// The SECOND forward write fails, so the first one is in `progress` and its
		// compensation actually runs — and the compensation's own save refuses too.
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
			await new DeleteZoneCommand({
				zones: w.zones,
				requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: silentLogger(),
			}).execute({
				zoneId: w.zoneId,
				resolution: 'delete-anyway',
				resolvedReferents: [w.requirementId, second.value.requirement.id] as never,
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});
});