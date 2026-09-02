import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { AssignAssetCommand } from '../../../../src/application/commands/requirement/AssignAsset';
import { SetAssetPriceOverrideCommand } from '../../../../src/application/commands/asset-price/SetAssetPriceOverride';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryAssetPriceOverrideRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { currencyOf, of as moneyOf } from '../../../../src/core/money/Money';
import { expectOk, RecordingEventBus } from '../../../helpers/domain';
import { makeAsset, makePlan, makeProject, makeZone } from '../../../helpers/entities';

/** 4 m × 2.5 m — exactly 10 m², no rounding anywhere. `assignAsset.test.ts`'s rectangle. */
const TEN_SQUARE_METERS = [
	{ x: 0, y: 0 },
	{ x: 4000, y: 0 },
	{ x: 4000, y: 2500 },
	{ x: 0, y: 2500 },
];

/** A GBP project, a zone in it, and an EUR-priced asset from the shared library. */
async function seed() {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const requirements = new InMemoryRequirementRepository();
	const overrides = new InMemoryAssetPriceOverrideRepository();
	const events = new RecordingEventBus();
	const locks = new ReferenceLocks();

	const project = expectOk(
		await projects.save(makeProject({ currency: currencyOf('GBP') }), 'absent'),
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
				unitCost: moneyOf('24.00', 'EUR'),
				wasteFactorDefault: new Decimal('0.10'),
			}),
			'absent',
		),
	);

	return {
		requirements,
		projectId: project.entity.id,
		zoneId: zone.entity.id,
		assetId: asset.entity.id,
		assignAsset: new AssignAssetCommand({ zones, assets, requirements, events, locks, projects, overrides }),
		setOverride: new SetAssetPriceOverrideCommand({ overrides, projects, assets, events, locks }),
	};
}

/**
 * The Issue's own close condition, asserted end to end rather than argued:
 *
 *   "an assign that refuses on a currency mismatch, then a price override in the project's
 *    currency, then the SAME assign succeeding — satisfaction demonstrated rather than
 *    asserted."
 *
 * It is APPLICATION-level and mounts nothing, which is what lets it land here rather than
 * waiting for the surface. What it does NOT prove is that a user can reach it; that is Task 9,
 * and it is a different claim.
 */
describe('a price override satisfies the pipeline refusal', () => {
	it('turns a refused assign into a successful one, denominated in the project currency', async () => {
		const { assignAsset, setOverride, requirements, projectId, zoneId, assetId } = await seed();

		const first = await assignAsset.execute({ zoneId, assetId });
		expect(first.ok).toBe(false);
		if (first.ok) throw new Error('unreachable');
		expect(first.error.code).toBe('cost.currency-mismatch');

		// Nothing was created — the refusal is BEFORE any arithmetic and before any save.
		expect(expectOk(await requirements.listByZone(zoneId))).toHaveLength(0);

		expectOk(
			await setOverride.execute({
				projectId,
				assetId,
				unitCost: moneyOf('19.50', 'GBP'),
				expected: 'absent',
			}),
		);

		const second = expectOk(await assignAsset.execute({ zoneId, assetId }));
		expect(second.created).toBe(true);
		expect(second.requirement.estimatedCost.calculated.currency).toBe('GBP');
		// Derived from the OVERRIDE, not the catalogue default. `calculatedFrom.unitCost` is
		// `deriveRequirementFigures`'s own input, verbatim (`deriveRequirementFigures.ts:92`) —
		// never rounded, unlike `estimatedCost.calculated`/`.effective` — and that input is the
		// override's `unitCost`, which was minted through `moneyOf` (Task 1's normalization
		// note): '19.50' normalizes to '19.5'.
		expect(second.requirement.calculatedFrom.unitCost.amount).toBe('19.5');
		expect(second.requirement.calculatedFrom.unitCost.currency).toBe('GBP');
	});

	/**
	 * The other direction, so the witness is not green merely because the pipeline now accepts
	 * everything: an override in the WRONG currency cannot be created at all, so it can never
	 * become a way around the refusal.
	 */
	it('cannot be satisfied by an override in the asset currency', async () => {
		const { assignAsset, setOverride, projectId, zoneId, assetId } = await seed();

		const refused = await setOverride.execute({
			projectId,
			assetId,
			unitCost: moneyOf('24.00', 'EUR'),
			expected: 'absent',
		});
		expect(refused.ok).toBe(false);

		const still = await assignAsset.execute({ zoneId, assetId });
		expect(still.ok).toBe(false);
	});
});
