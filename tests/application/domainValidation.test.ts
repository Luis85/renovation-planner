import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { Asset } from '../../src/domain/asset/Asset';
import { createMoney, of as moneyOf } from '../../src/core/money/Money';
import { RecalculateRequirementCommand } from '../../src/application/commands/requirement/RecalculateRequirement';
import { GetRequirementsForZone } from '../../src/application/queries/GetRequirementsForZone';
import type { RequirementRepository } from '../../src/application/ports/RequirementRepository';
import type { Loaded } from '../../src/application/ports/versioning';
import type { Requirement } from '../../src/domain/requirement/Requirement';
import { expectErr, expectFound, expectOk } from '../helpers/domain';
import type { Result } from '../../src/core/result/Result';
import type { ValidationError } from '../../src/core/errors/AppError';
import { makeAsset, makeZone } from '../helpers/entities';
import { requirementFixture, TEN_SQUARE_METERS } from '../helpers/slice10';
import { recorder } from '../helpers/logger';

/**
 * The domain's own refusals and the recalculation command's edge branches — the arms a
 * happy-path wiring never reaches.
 */

const VALID_ASSET = {
	name: 'Tile',
	category: 'material' as const,
	unit: 'm2' as const,
	unitCost: moneyOf('45.00', 'EUR'),
};

function requirementFromRaw(base: Requirement, areaM2: Decimal): Result<Requirement, ValidationError> {
	const quantity = { calculated: { value: base.quantity.calculated.value, unit: base.unit } };
	return base.withRecalculation(quantity.calculated, base.estimatedCost.calculated, {
		...base.calculatedFrom,
		zoneArea: { value: areaM2, unit: base.unit },
	});
}


async function wiredRecalculate() {
	const w = await requirementFixture();
	const zoneEntity = expectOk(
		await w.zones.save(
			expectOk(makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({ points: TEN_SQUARE_METERS })),
			'absent',
		),
	);
	const assetEntity = expectOk(
		await w.assets.save(
			makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	return {
		...w,
		zoneId: zoneEntity.entity.id,
		zoneVersion: zoneEntity.version,
		assetId: assetEntity.entity.id,
		recalculate: new RecalculateRequirementCommand({
			requirements: w.requirements,
			zones: w.zones,
			assets: w.assets,
			events: w.events,
			projects: w.projects,
			overrides: w.overrides,
		}),
	};
}

describe('Asset validation', () => {
	it('refuses an empty name, an unknown category, a negative price and out-of-range waste', () => {
		expect(Asset.create({ id: 'asset-1' as never, ...VALID_ASSET, name: '   ' }).ok).toBe(false);
		const badCategory = Asset.create({
			id: 'asset-1' as never,
			...VALID_ASSET,
			category: 'vehicle' as never,
		});
		if (badCategory.ok) throw new Error('unexpected success');
		expect(badCategory.error.code).toBe('asset.unknown-category');

		const negative = Asset.create({
			id: 'asset-1' as never,
			...VALID_ASSET,
			// `Money` itself permits a negative amount — `AMOUNT_PATTERN` admits the sign — so
			// this construction succeeds and it is `Asset.create` that refuses, which is the
			// refusal under test. It read `createMoney(...).value ?? moneyOf(...)` until
			// `tests/**` was type-checked: `.value` does not exist on the un-narrowed union, so
			// the fallback was there to absorb a refusal that never comes.
			unitCost: expectOk(createMoney('-5.00', 'EUR')),
		});
		if (negative.ok) throw new Error('unexpected success');
		expect(negative.error.code).toBe('asset.negative-unit-cost');
	});

	it('refuses a waste factor above 1 with the percentage hint', () => {
		const result = Asset.create({
			id: 'asset-1' as never,
			...VALID_ASSET,
			wasteFactorDefault: new Decimal('10'),
		});
		if (result.ok) throw new Error('unexpected success');
		expect(result.error.code).toBe('asset.waste-factor-default-above-one');
		expect(result.error.message).toContain('fraction');
	});

	it('withChanges re-validates the whole entity', () => {
		const asset = expectOk(Asset.create({ id: 'asset-1' as never, ...VALID_ASSET }));
		const broken = asset.withChanges({ wasteFactorDefault: new Decimal('2') });
		expect(broken.ok).toBe(false);
		const fine = asset.withChanges({ name: 'Better tile', notes: null });
		if (!fine.ok) throw new Error(fine.error.message);
		expect(fine.value.name).toBe('Better tile');
		expect(fine.value.unitCost.amount).toBe('45');
	});
});

describe('RecalculateRequirementCommand edges', () => {
	it('answers requirement.not-found for an unknown id', async () => {
		const w = await wiredRecalculate();
		const error = expectErr(await w.recalculate.execute({ requirementId: 'requirement-x' as never }));
		expect(error.category).toBe('Reference');
	});

	it('a dangling zone leaves the requirement stale rather than crashing', async () => {
		const w = await wiredRecalculate();
		const assigned = await w.assign.execute({ zoneId: w.zoneId, assetId: w.assetId });
		if (!assigned.ok) throw new Error('unexpected success');

		// Delete the zone OUT FROM UNDER the requirement (bare delete would refuse; this
		// is the delete-anyway shape).
		expectOk(
			await new (await import('../../src/application/commands/zone/DeleteZone')).DeleteZoneCommand({
				zones: w.zones,
				requirements: w.requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger: { debug() {}, info() {}, warn() {}, error() {} },
			}).execute({
				zoneId: w.zoneId,
				resolution: 'delete-anyway',
				resolvedReferents: [assigned.value.requirement.id],
			}),
		);
		const failed = await w.recalculate.execute({ requirementId: assigned.value.requirement.id });
		expect(failed.ok).toBe(false);

		const stored = expectOk(await w.requirements.getById(assigned.value.requirement.id));
		expect(stored?.entity.recalculationStatus).toBe('stale');
	});

	it('a hand-edited non-area asset refuses recalculation instead of relabeling area', async () => {
		const w = await wiredRecalculate();
		const assigned = await w.assign.execute({ zoneId: w.zoneId, assetId: w.assetId });
		if (!assigned.ok) throw new Error('unexpected success');

		// Bypass the update guard by writing the note directly through save().
		const mutated = expectFound(await w.assets.getById(w.assetId));
		const changed = mutated.entity.withChanges({ unit: 'piece' });
		if (!changed.ok) throw new Error('unexpected success');
		expectOk(await w.assets.save(changed.value, expectFound(await w.assets.getById(w.assetId)).version));

		const error = expectErr(await w.recalculate.execute({ requirementId: assigned.value.requirement.id }));
		expect(error.code).toBe('requirement.unit-not-area');
	});
});

describe('GetRequirementsForZone readings', () => {
	class FailingListRepository implements Pick<RequirementRepository, 'listByZone'> {
		listByZone(): Promise<never> {
			return Promise.reject(new Error('unused'));
		}
	}

	it('reports current when marker AND calculatedFrom match the live entities', async () => {
		const w = await requirementFixture();
		const zoneEntity = expectOk(
			await w.zones.save(
				expectOk(makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({ points: TEN_SQUARE_METERS })),
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
		if (!assigned.ok) throw new Error('unexpected success');

		const readModel = new GetRequirementsForZone({ requirements: w.requirements, zones: w.zones, assets: w.assets, projects: w.projects, overrides: w.overrides, logger: recorder });
		const rows = expectOk(await readModel.execute(zoneEntity.entity.id));
		expect(rows[0]?.recalculationStatus).toBe('current');
	});

	it('never reports current for a figure it cannot re-derive', async () => {
		// Direct construction: a requirement whose recorded area no longer matches its
		// zone, while the persisted marker still says current.
		const w = await requirementFixture();
		const zoneEntity = expectOk(
			await w.zones.save(
				expectOk(makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({ points: TEN_SQUARE_METERS })),
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
		if (!assigned.ok) throw new Error('unexpected success');

		// Hand-edit the persisted record's calculated-from-area to something else.
		const loaded = expectFound(await w.requirements.getById(assigned.value.requirement.id));
		const tampered: Loaded<Requirement> = {
			entity: expectOk(
				requirementFromRaw(loaded.entity, new Decimal('99')),
			),
			version: loaded.version,
		};
		expectOk(await w.requirements.save(tampered.entity, loaded.version));

		const readModel = new GetRequirementsForZone({ requirements: w.requirements, zones: w.zones, assets: w.assets, projects: w.projects, overrides: w.overrides, logger: recorder });
		const rows = expectOk(await readModel.execute(zoneEntity.entity.id));
		expect(rows[0]?.recalculationStatus).toBe('stale');
		void FailingListRepository;
	});
});