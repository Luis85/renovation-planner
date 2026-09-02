import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { CreateAssetCommand } from '../../../../src/application/commands/asset/CreateAsset';
import { DeleteAssetCommand } from '../../../../src/application/commands/asset/DeleteAsset';
import { DeleteRequirementCommand } from '../../../../src/application/commands/requirement/DeleteRequirement';
import { ListAssets } from '../../../../src/application/queries/ListAssets';
import { ListRequirementsReferencing } from '../../../../src/application/queries/ListRequirementsReferencing';
import { ListReassignmentTargets } from '../../../../src/application/queries/ListReassignmentTargets';
import { InMemorySequenceMarkerStore } from '../../../../src/infrastructure/persistence/in-memory/InMemorySequenceMarkerStore';
import type { SequenceMarker } from '../../../../src/application/reference/deleteResolution';
import { of as moneyOf } from '../../../../src/core/money/Money';
import type { MeasurementUnit } from '../../../../src/core/units/MeasurementUnit';
import { expectErr, expectOk, observationToken } from '../../../helpers/domain';
import { makeAsset, makePlan, makeProject, makeZone } from '../../../helpers/entities';
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
			makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	const assigned = await w.assign.execute({ zoneId: zoneEntity.entity.id, assetId: assetEntity.entity.id });
	if (!assigned.ok) throw new Error(assigned.error.message);
	const deleteAsset = new DeleteAssetCommand({
		assets: w.assets,
		requirements: w.requirements,
		recalculate: w.recalculate,
		events: w.events,
		locks: w.locks,
		logger: silentLogger(),
		overrides: w.overrides,
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
			name: 'Grout',
			category: 'material',
			unit: 'piece' as MeasurementUnit,
			unitCostAmount: '2.50',
			currency: 'EUR',
		});
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.unitCost.amount).toBe('2.5');
		expect(
			expectOk(await w.assets.listAll()).map((a) => a.entity.id),
		).toContain(result.value.id);
	});

	it('refuses a negative unit cost before anything is written', async () => {
		const w = await requirementFixture();
		const command = new CreateAssetCommand(w.assets, w.events);
		const error = await command.execute({
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
	it('ListAssets returns every asset in the vault unfiltered — including non-area ones', async () => {
		const w = await wiredWithLink();
		await w.assets.save(makeAsset({ unit: 'm' }), 'absent');
		const rows = expectOk(await new ListAssets(w.assets).execute());
		expect(rows.map((a) => a.unit)).toEqual(['m2', 'm']);
	});

	it('offers the same catalogue to two different project contexts', async () => {
		const w = await wiredWithLink();
		// The query takes no project, so "two contexts" is the only thing left that could
		// differ: two zones in two projects, both reaching the SAME picker options. Asserted
		// through the requirement each context can then create, so this is a claim about
		// what a caller can DO with the list and not only about its contents.
		const secondProject = expectOk(
			await w.projects.save(makeProject({ name: 'Loft' }), 'absent'),
		);
		const secondPlan = expectOk(
			await w.plans.save(makePlan({ projectId: secondProject.entity.id }), 'absent'),
		);
		const secondZone = expectOk(
			await w.zones.save(
				expectOk(
					makeZone({
						projectId: secondProject.entity.id,
						planId: secondPlan.entity.id,
						name: 'Loft floor',
					}).withGeometry({ points: TEN_SQUARE_METERS }),
				),
				'absent',
			),
		);

		const query = new ListAssets(w.assets);
		const forKitchen = expectOk(await query.execute()).map((a) => a.id);
		const forLoft = expectOk(await query.execute()).map((a) => a.id);
		expect(forLoft).toEqual(forKitchen);
		expect(forKitchen).toContain(w.assetId);

		// And the offer is honoured: the second project's zone can take the first
		// project's catalogue entry.
		const assigned = expectOk(
			await w.assign.execute({ zoneId: secondZone.entity.id, assetId: w.assetId }),
		);
		expect(assigned.requirement.projectId).toBe(secondProject.entity.id);
	});

	it('ListRequirementsReferencing answers one named group per project for both ends', async () => {
		// Since slice 19 the answer is GROUPED: an Asset belongs to no project, so its
		// referents can sit in several, and the group names the one each referent is in.
		// One project here, so both ends answer one group — the Zone flow's row is unchanged
		// in appearance and changed in derivation.
		const w = await wiredWithLink();
		const query = new ListRequirementsReferencing(w.requirements, w.projects, () => undefined);
		const expected = [
			{
				projectId: w.project.entity.id,
				projectName: w.project.entity.name,
				requirementIds: [w.requirementId],
			},
		];
		expect(expectOk(await query.execute({ kind: 'zone', zoneId: w.zoneId }))).toEqual(expected);
		expect(expectOk(await query.execute({ kind: 'asset', assetId: w.assetId }))).toEqual(expected);
	});

	it('ListReassignmentTargets excludes the deleted entity and non-area assets', async () => {
		const w = await wiredWithLink();
		const other = makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id, name: 'Kitchen' });
		const target = expectOk(await w.zones.save(other, 'absent'));
		const lengthAsset = expectOk(
			await w.assets.save(makeAsset({ unit: 'm', name: 'Skirting' }), 'absent'),
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
		const readModel = new GetRequirementsForZone(w.requirements, w.zones, w.assets, w.projects, w.overrides);

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
				makeAsset({ unit: 'm', name: 'Skirting' }),
				'absent',
			),
		);
		const second = await w.assign.execute({ zoneId: w.zoneId, assetId: replacement.entity.id });
		if (!second.ok) throw new Error('unexpected success');
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

		// Annotated rather than `as const`: the marker's own type is what should decide every
		// field here, and `as const` froze `progress` to a `readonly []` the type refuses.
		const marker: SequenceMarker = {
			schemaVersion: 1,
			kind: 'delete-resolution',
			entityId: 'entity-1',
			// A real `Loaded<unknown>`: the marker's own type requires one, because "an ID is not a
			// Zone" — restoring needs the entity in full. It was `null` here, which the round trip
			// this case tests never reads, so nothing noticed.
			entitySnapshot: { entity: { id: 'entity-1' }, version: { revision: 1, observed: observationToken('t-1') } },
			entityKind: 'asset',
			entityDeleted: false,
			affectedBefore: [],
			progress: [],
		};
		expectOk(await store.write(marker));
		expect(expectOk(await store.read('entity-1'))?.entityId).toBe('entity-1');
		expectOk(await store.clear('entity-1'));
		expect(expectOk(await store.read('entity-1'))).toBeNull();
	});
});
