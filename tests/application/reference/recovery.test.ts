import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { err } from '../../../src/core/result/Result';
import { InMemorySequenceMarkerStore } from '../../../src/infrastructure/persistence/in-memory/InMemorySequenceMarkerStore';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import { recoverInterruptedSequences } from '../../../src/application/reference/recoverInterruptedSequences';
import type { Loaded } from '../../../src/application/ports/versioning';
import { expectErr, expectOk } from '../../helpers/domain';
import { makeAsset, makeRequirement, makeZone } from '../../helpers/entities';
import { lines, recorder as logger } from '../../helpers/logger';
import { requirementFixture, TEN_SQUARE_METERS } from '../../helpers/slice10';

/**
 * The cold half of the compensated sequence: a crash between the first mutation and the
 * sequence's completion leaves a durable marker behind, and the recovery pass at load
 * restores every completed write from the pre-state — conditionally (a refused restore is
 * diagnosed, never forced) and idempotently (the marker clears once everything on it is
 * restored or surfaced, so a second pass finds nothing).
 */

function overridePort<T extends object>(inner: T, patch: Record<string, unknown>): T {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, patch) as T;
}

/**
 * A delete-anyway over TWO referents whose SECOND forward write fails: the sequence stops
 * with a completed write in `progress`, fails to fail loudly alone, leaves its durable
 * marker behind — and its in-process compensation has already put the first referent back,
 * one version PAST what `progress` recorded. Recovery therefore meets a conditional
 * restore that refuses, which is exactly the third outcome the task spec names.
 */
async function wiredAfterFailedSequence() {
	const w = await requirementFixture();
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
			makeAsset({ projectId: w.project.entity.id, wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	const assigned = await w.assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id });
	if (!assigned.ok) throw new Error('unexpected assign failure');
	const secondAsset = expectOk(await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'));
	const second = await w.assign.execute({ zoneId: zone.entity.id, assetId: secondAsset.entity.id });
	if (!second.ok) throw new Error('unexpected assign failure');

	const markers = new InMemorySequenceMarkerStore();
	let marks = 0;
	const requirements = overridePort(w.requirements, {
		markStale: async (id: never) => {
			marks += 1;
			if (marks === 2) return err({ category: 'Persistence', code: 'test.injected', message: 'injected' }) as never;
			return await w.requirements.markStale(id);
		},
	});

	expectErr(
		await new DeleteZoneCommand({
			zones: w.zones,
			requirements,
			recalculate: w.recalculate,
			events: w.events,
			locks: w.locks,
			logger,
			markers,
		}).execute({
			zoneId: zone.entity.id,
			resolution: 'delete-anyway',
			resolvedReferents: [assigned.value.requirement.id, second.value.requirement.id],
		}),
	);

	return { ...w, markers, zoneId: zone.entity.id };
}

describe('recoverInterruptedSequences', () => {
	it('rewrites each progress entry from the pre-state and restores a deleted entity', async () => {
		const w = await requirementFixture();
		const zone = expectOk(
			await w.zones.save(makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }), 'absent'),
		);
		const asset = expectOk(await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'));
		const requirement = makeRequirement({
			projectId: w.project.entity.id,
			assetId: asset.entity.id,
			origin: { kind: 'zone', zoneId: zone.entity.id },
		});
		const written = expectOk(await w.requirements.save(requirement, 'absent'));

		// The crash scenario the marker exists for: step 3 has ALREADY deleted the zone.
		expectOk(await w.zones.delete(zone.entity.id, zone.version));

		// Cold-start state: the stale-marker write landed and the process died right after,
		// so the CURRENT version of the referent is exactly what `progress` recorded. One
		// progress entry names a requirement that is not in `affectedBefore` — a forward
		// write whose append never landed — and recovery must skip it, not choke on it.
		const marked: Loaded<Requirement> = expectOk(await w.requirements.getById(requirement.id));
		const markers = new InMemorySequenceMarkerStore();
		await markers.write({
			schemaVersion: 1,
			kind: 'delete-resolution',
			entityKind: 'zone',
			entityId: String(zone.entity.id),
			entitySnapshot: { entity: zone.entity, version: zone.version } as never,
			entityDeleted: true,
			affectedBefore: [{ entity: marked.entity, version: marked.version }],
			progress: [
				{ id: written.entity.id, outcome: 'written', version: marked.version },
				{ id: written.entity.id, outcome: 'deleted' },
				{ id: 'requirement-unknown' as never, outcome: 'deleted' },
			],
		});

		await recoverInterruptedSequences({
			markers,
			requirements: w.requirements,
			zones: w.zones,
			assets: w.assets,
			logger,
		});

		// Both halves are back: the referent at its pre-state figures AND the deleted zone.
		const stored = expectOk(await w.requirements.getById(requirement.id));
		expect(stored?.entity.recalculationStatus).toBe('current');
		expect(expectOk(await w.zones.getById(zone.entity.id))).not.toBeNull();
		expect(expectOk(await markers.list())).toEqual([]);
	});

	it('is idempotent: a second pass finds no marker and changes nothing', async () => {
		const w = await wiredAfterFailedSequence();
		const deps = {
			markers: w.markers,
			requirements: w.requirements,
			zones: w.zones,
			assets: w.assets,
			logger,
		};
		await recoverInterruptedSequences(deps);
		const vaultBefore = JSON.stringify([
			expectOk(await w.zones.getById(w.zoneId)),
			expectOk(await w.markers.list()),
		]);
		await recoverInterruptedSequences(deps);
		// Nothing left to do, and nothing moved doing it: the second pass is a no-op.
		const vaultAfter = JSON.stringify([
			expectOk(await w.zones.getById(w.zoneId)),
			expectOk(await w.markers.list()),
		]);
		expect(vaultAfter).toBe(vaultBefore);
	});

	it('does NOT force a restore whose expectation no longer holds — it surfaces a diagnostic instead', async () => {
		const w = await wiredAfterFailedSequence();

		await recoverInterruptedSequences({
			markers: w.markers,
			requirements: w.requirements,
			zones: w.zones,
			assets: w.assets,
			logger,
		});

		// The in-process compensation already moved the referent past its recorded version,
		// so the conditional restore refused — loudly, without forcing, and the marker still
		// cleared once the entry was surfaced.
		const surfaced = lines.filter((line) => line.event === 'sequence.recovery.restore-refused');
		expect(surfaced.length).toBeGreaterThan(0);
		expect(expectOk(await w.markers.list())).toEqual([]);
	});

	it('restores a deleted ASSET when the marker names that kind', async () => {
		const w = await requirementFixture();
		const asset = expectOk(await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'));
		expectOk(await w.assets.delete(asset.entity.id, asset.version));

		const markers = new InMemorySequenceMarkerStore();
		await markers.write({
			schemaVersion: 1,
			kind: 'delete-resolution',
			entityKind: 'asset',
			entityId: String(asset.entity.id),
			entitySnapshot: { entity: asset.entity, version: asset.version } as never,
			entityDeleted: true,
			affectedBefore: [],
			progress: [],
		});

		await recoverInterruptedSequences({
			markers,
			requirements: w.requirements,
			zones: w.zones,
			assets: w.assets,
			logger,
		});

		expect(expectOk(await w.assets.getById(asset.entity.id))).not.toBeNull();
	});

	it('surfaces a refused ENTITY restore instead of forcing it, and still clears', async () => {
		const w = await requirementFixture();
		const zone = expectOk(
			await w.zones.save(makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }), 'absent'),
		);
		// The zone was NOT deleted; someone's edit moved it past its pre-crash revision.
		const stored = expectOk(await w.zones.getById(zone.entity.id));
		Object.assign(stored?.entity as object, { name: 'Renamed while dead' });
		expectOk(await w.zones.save(stored?.entity as never, stored?.version as never));

		const markers = new InMemorySequenceMarkerStore();
		await markers.write({
			schemaVersion: 1,
			kind: 'delete-resolution',
			entityKind: 'zone',
			entityId: String(zone.entity.id),
			entitySnapshot: { entity: zone.entity, version: zone.version } as never,
			entityDeleted: true,
			affectedBefore: [],
			progress: [],
		});

		await recoverInterruptedSequences({
			markers,
			requirements: w.requirements,
			zones: w.zones,
			assets: w.assets,
			logger,
		});

		// The out-of-band rename survived, the refusal is loud, and the marker cleared.
		const reread = expectOk(await w.zones.getById(zone.entity.id));
		expect(reread?.entity.name).toBe('Renamed while dead');
		expect(lines.filter((line) => line.event === 'sequence.recovery.entity-restore-refused').length).toBeGreaterThan(0);
		expect(expectOk(await markers.list())).toEqual([]);
	});

	it('logs a failed marker CLEAR rather than pretending recovery completed cleanly', async () => {
		const w = await requirementFixture();
		class FailingClear extends InMemorySequenceMarkerStore {
			override clear(): Promise<never> {
				return Promise.resolve(err({ category: 'Persistence', code: 'test.injected', message: 'injected' }) as never);
			}
		}
		const markers = new FailingClear();
		await markers.write({
			schemaVersion: 1,
			kind: 'delete-resolution',
			entityKind: 'asset',
			entityId: 'asset-none',
			entitySnapshot: { entity: {}, version: { revision: 1, observed: 'o' } } as never,
			entityDeleted: false,
			affectedBefore: [],
			progress: [],
		});

		await recoverInterruptedSequences({
			markers,
			requirements: w.requirements,
			zones: w.zones,
			assets: w.assets,
			logger,
		});

		expect(lines.some((line) => line.event === 'sequence.recovery.clear-failed')).toBe(true);
	});
});
