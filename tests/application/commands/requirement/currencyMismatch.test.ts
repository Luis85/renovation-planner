import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { AssignAssetCommand } from '../../../../src/application/commands/requirement/AssignAsset';
import { RecalculateRequirementCommand } from '../../../../src/application/commands/requirement/RecalculateRequirement';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { currencyOf, of as moneyOf } from '../../../../src/core/money/Money';
import { expectErr, expectOk, RecordingEventBus } from '../../../helpers/domain';
import { makeAsset, makePlan, makeProject, makeZone } from '../../../helpers/entities';

/** 4 m × 2.5 m — exactly 10 m², no rounding anywhere. `assignAsset.test.ts`'s rectangle. */
const TEN_SQUARE_METERS = [
	{ x: 0, y: 0 },
	{ x: 4000, y: 0 },
	{ x: 4000, y: 2500 },
	{ x: 0, y: 2500 },
];

async function seed(projectCurrency: string, assetCurrency: string) {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const requirements = new InMemoryRequirementRepository();
	const events = new RecordingEventBus();

	const project = expectOk(
		await projects.save(makeProject({ currency: currencyOf(projectCurrency) }), 'absent'),
	);
	const plan = expectOk(await plans.save(makePlan({ projectId: project.entity.id }), 'absent'));
	const zone = expectOk(
		await zones.save(
			expectOk(
				makeZone({
					projectId: project.entity.id,
					planId: plan.entity.id,
					name: 'Bathroom',
				}).withGeometry({ points: TEN_SQUARE_METERS }),
			),
			'absent',
		),
	);
	const asset = expectOk(
		await assets.save(
			makeAsset({
				unitCost: moneyOf('45.00', assetCurrency),
				wasteFactorDefault: new Decimal('0.10'),
			}),
			'absent',
		),
	);

	return {
		assets,
		requirements,
		zoneId: zone.entity.id,
		assetId: asset.entity.id,
		assign: new AssignAssetCommand({
			zones,
			assets,
			requirements,
			events,
			locks: new ReferenceLocks(),
			projects,
		}),
		recalculate: new RecalculateRequirementCommand(requirements, zones, assets, events, projects),
	};
}

describe('a pairing whose price is not in the project currency', () => {
	it('refuses the assignment and creates no requirement', async () => {
		const w = await seed('EUR', 'GBP');

		const result = await w.assign.execute({ zoneId: w.zoneId, assetId: w.assetId });

		expect(expectErr(result).code).toBe('cost.currency-mismatch');
		// Nothing was written. The refusal is pre-write, which is what keeps the save
		// indicator neutral rather than badging data nobody touched.
		expect(expectOk(await w.requirements.listByZone(w.zoneId))).toHaveLength(0);
	});

	it('succeeds when they agree, so the test is not green because it refuses everything', async () => {
		const w = await seed('EUR', 'EUR');

		const result = await w.assign.execute({ zoneId: w.zoneId, assetId: w.assetId });

		expect(expectOk(result).created).toBe(true);
		// 10 m² × 1.10 waste = 11 m²; × 45.00 EUR = 495.00 EUR.
		expect(expectOk(result).requirement.estimatedCost.calculated.amount).toBe('495.00');
		expect(expectOk(result).requirement.estimatedCost.calculated.currency).toBe('EUR');
	});

	it('RecalculateRequirement refuses it too, reading the project itself', async () => {
		// Assign in EUR, then re-denominate the ASSET and recalculate. The command must read
		// the project's currency rather than trusting the requirement's own recorded one.
		const w = await seed('EUR', 'EUR');
		const created = expectOk(await w.assign.execute({ zoneId: w.zoneId, assetId: w.assetId }));
		const loaded = expectOk(await w.assets.getById(w.assetId));
		if (loaded === null) throw new Error('the asset was seeded');
		expectOk(
			await w.assets.save(
				expectOk(loaded.entity.withChanges({ unitCost: moneyOf('45.00', 'GBP') })),
				loaded.version,
			),
		);

		const result = await w.recalculate.execute({ requirementId: created.requirement.id });

		expect(expectErr(result).code).toBe('cost.currency-mismatch');
	});
});
