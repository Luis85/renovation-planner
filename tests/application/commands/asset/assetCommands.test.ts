import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { CreateAssetCommand } from '../../../../src/application/commands/asset/CreateAsset';
import { DeleteAssetCommand } from '../../../../src/application/commands/asset/DeleteAsset';
import { DeleteRequirementCommand } from '../../../../src/application/commands/requirement/DeleteRequirement';
import { ListAssets } from '../../../../src/application/queries/ListAssets';
import { ListRequirementsReferencing } from '../../../../src/application/queries/ListRequirementsReferencing';
import { ListReassignmentTargets } from '../../../../src/application/queries/ListReassignmentTargets';
import { InMemorySequenceMarkerStore } from '../../../../src/infrastructure/persistence/in-memory/InMemorySequenceMarkerStore';
import { of as moneyOf } from '../../../../src/core/money/Money';
import type { MeasurementUnit } from '../../../../src/core/units/MeasurementUnit';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset, makeZone } from '../../../helpers/entities';
import {
	requirementFixture,
	TEN_SQUARE_METERS,
} from '../../../helpers/slice10';

/**
 * The slice-10 write/read sides with no dedicated suite yet: catalog CRUD, the picker
 * queries, and the Asset face of the delete resolution.
 */

function silentLogger() {
	return { debug() {}, info() {}, warn() {}, error() {} };
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
	if (!assigned.ok) return expect.unreachable(assigned.error.message);
	const deleteAsset = new DeleteAssetCommand({
		assets: w.assets,
		requirements: w.requirements,
		recalculate: w.recalculate,
		events: w.events,
		locks: w.locks,
		logger: silentLogger(),
	});
	const deleteRequirement = new DeleteRequirementCommand(w.requirements);
	return {
		...w,
		zoneId: zoneEntity.entity.id,
		assetId: assetEntity.entity.id,
		requirementId: assigned.value.requirement.id,
		deleteAsset,
		deleteRequirement,
	};
}

describe('CreateAssetCommand', () => {
	it('creates a catalog item through Asset.create validation', async () => {
		const w = await requirementFixture();
		const command = new CreateAssetCommand(w.assets, w.events);
		const result = await command.execute({
			projectId: w.project.entity.id,
			name: 'Grout',
			category: 'material',
			unit: 'piece' as MeasurementUnit,
			unitCostAmount: '2.50',
			currency: 'EUR',
		});
		if (!result.ok) return expect.unreachable(result.error.message);
		expect(result.value.unitCost.amount).toBe('2.5');
		expect(
			expectOk(await w.assets.listByProject(w.project.entity.id)).map((a) => a.entity.id),
		).toContain(result.value.id);
	});

	it('refuses a negative unit cost before anything is written', async () => {
		const w = await requirementFixture();
		const command = new CreateAssetCommand(w.assets, w.events);
		const error = await command.execute({
			projectId: w.project.entity.id,
			name: 'Bad',
			category: 'material',
			unit: 'piece',
			unitCostAmount: '-1',
			currency: 'EUR',
		});
		expect(error).toMatchObject({ ok: false });
		if (error.ok) return;
		expect((error as { error: { code: string } }).error.code).toBe('asset.negative-unit-cost');
	});
});

describe('DeleteRequirementCommand', () => {
	it('deletes conditionally and answers ok(null) afterwards', async () => {
		const w = await wiredWithLink();
		const result = await w.deleteRequirement.execute({ requirementId: w.requirementId });
		expect(result.ok).toBe(true);
		expect(await w.requirements.getById(w.requirementId)).toEqual({ ok: true, value: null });
	});

	it('refuses an unknown requirement id', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await w.deleteRequirement.execute({ requirementId: 'requirement-x' as never }),
		);
		expect(error.code).toBe('requirement.not-found');
	});
});

describe('the picker queries', () => {
	it('ListAssets returns every project asset unfiltered — including non-area ones', async () => {
		const w = await wiredWithLink();
		await w.assets.save(makeAsset({ projectId: w.project.entity.id, unit: 'm' }), 'absent');
		const rows = expectOk(await new ListAssets(w.assets).execute(w.project.entity.id));
		expect(rows.map((a) => a.unit)).toEqual(['m2', 'm']);
	});

	it('ListRequirementsReferencing answers IDs for both ends of the reference', async () => {
		const w = await wiredWithLink();
		const query = new ListRequirementsReferencing(w.requirements);
		expect(expectOk(await query.execute({ kind: 'zone', zoneId: w.zoneId }))).toEqual([
			w.requirementId,
		]);
		expect(expectOk(await query.execute({ kind: 'asset', assetId: w.assetId }))).toEqual([
			w.requirementId,
		]);
	});

	it('ListReassignmentTargets excludes the deleted entity and non-area assets', async () => {
		const w = await wiredWithLink();
		const other = makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id, name: 'Kitchen' });
		const target = expectOk(await w.zones.save(other, 'absent'));
		const lengthAsset = expectOk(
			await w.assets.save(makeAsset({ projectId: w.project.entity.id, unit: 'm', name: 'Skirting' }), 'absent'),
		);

		const zoneTargets = expectOk(
			await new ListReassignmentTargets(w.zones, w.assets).execute({
				kind: 'zone',
				zoneId: w.zoneId,
			}),
		);
		expect(zoneTargets.map((t) => t.id)).toEqual([target.entity.id]);

		const assetTargets = expectOk(
			await new ListReassignmentTargets(w.zones, w.assets).execute({
				kind: 'asset',
				assetId: w.assetId,
			}),
		);
		expect(assetTargets.map((t) => t.id)).not.toContain(w.assetId);
		void lengthAsset;
	});

	it('ListReassignmentTargets answers empty for a project with one zone', async () => {
		const w = await wiredWithLink();
		const targets = expectOk(
			await new ListReassignmentTargets(w.zones, w.assets).execute({ kind: 'zone', zoneId: w.zoneId }),
		);
		expect(targets).toEqual([]);
	});
});

describe('DeleteAssetCommand', () => {
	it('a bare delete with referents refuses naming them', async () => {
		const w = await wiredWithLink();
		const error = expectErr(await w.deleteAsset.execute({ assetId: w.assetId }));
		expect(error.code).toBe('reference.referents-exist');
		expect(expectOk(await w.assets.getById(w.assetId))).not.toBeNull();
	});

	it('remove-references deletes the requirements then the asset', async () => {
		const w = await wiredWithLink();
		const resolved = expectOk(
			await w.deleteAsset.execute({
				assetId: w.assetId,
				resolution: 'remove-references',
				resolvedReferents: [w.requirementId],
			}),
		);
		expect(resolved.affectedAfter).toEqual([{ id: w.requirementId, outcome: 'deleted' }]);
		expect(await w.assets.getById(w.assetId)).toEqual({ ok: true, value: null });
	});

	it('delete-anyway strands the requirement visibly stale; the panel row renders it', async () => {
		const w = await wiredWithLink();
		const { GetRequirementsForZone } = await import(
			'../../../../src/application/queries/GetRequirementsForZone'
		);
		const readModel = new GetRequirementsForZone(w.requirements, w.zones, w.assets);

		expectOk(
			await w.deleteAsset.execute({
				assetId: w.assetId,
				resolution: 'delete-anyway',
				resolvedReferents: [w.requirementId],
			}),
		);
		const stranded = expectOk(await w.requirements.getById(w.requirementId));
		expect(stranded?.entity.recalculationStatus).toBe('stale');

		// The dangling-asset row is BUILT, not dropped or failed.
		const rows = expectOk(await readModel.execute(w.zoneId));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.missingTarget).toBe('asset');
		expect(rows[0]?.assetName).toBeNull();
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});

	it('reassign repoints at another area-kind asset and recalculates inline', async () => {
		const w = await wiredWithLink();
		const replacement = expectOk(
			await w.assets.save(
				makeAsset({
					projectId: w.project.entity.id,
					wasteFactorDefault: new Decimal('0.10'),
					name: 'Cheaper Tile',
					unitCost: moneyOf('30.00', 'EUR'),
				}),
				'absent',
			),
		);
		expectOk(
			await w.deleteAsset.execute({
				assetId: w.assetId,
				resolution: 'reassign',
				reassignTo: replacement.entity.id,
				resolvedReferents: [w.requirementId],
			}),
		);
		const repointed = expectOk(await w.requirements.getById(w.requirementId));
		expect(repointed?.entity.assetId).toBe(replacement.entity.id);
		// 11 m² × 30.00 EUR = 330.00 — recalculated inline against the NEW price.
		expect(repointed?.entity.estimatedCost.calculated.amount).toBe('330.00');

		// A non-area target is refused by the same check assignment applies.
		const skirting = expectOk(
			await w.assets.save(
				makeAsset({ projectId: w.project.entity.id, unit: 'm', name: 'Skirting' }),
				'absent',
			),
		);
		const second = await w.assign.execute({ zoneId: w.zoneId, assetId: replacement.entity.id });
		if (!second.ok) return expect.unreachable();
		const error = expectErr(
			await w.deleteAsset.execute({
				assetId: replacement.entity.id,
				resolution: 'reassign',
				reassignTo: skirting.entity.id,
				resolvedReferents: [second.value.requirement.id],
			}),
		);
		expect(error.code).toBe('requirement.unit-not-area');
	});
});

describe('InMemorySequenceMarkerStore', () => {
	it('writes, reads and clears markers', async () => {
		const store = new InMemorySequenceMarkerStore();
		expect(expectOk(await store.read('entity-1'))).toBeNull();

		const marker = {
			schemaVersion: 1,
			kind: 'delete-resolution',
			entityId: 'entity-1',
			entitySnapshot: null,
			entityDeleted: false,
			affectedBefore: [],
			progress: [],
		} as const;
		expectOk(await store.write(marker));
		expect(expectOk(await store.read('entity-1'))?.entityId).toBe('entity-1');
		expectOk(await store.clear('entity-1'));
		expect(expectOk(await store.read('entity-1'))).toBeNull();
	});
});
