import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { GetRequirementsForZone } from '../../../src/application/queries/GetRequirementsForZone';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { currencyOf, of as moneyOf } from '../../../src/core/money/Money';
import { expectOk, RecordingEventBus } from '../../helpers/domain';
import { makeAsset, makePlan, makeProject, makeZone } from '../../helpers/entities';

const TEN_SQUARE_METERS = [
	{ x: 0, y: 0 },
	{ x: 4000, y: 0 },
	{ x: 4000, y: 2500 },
	{ x: 0, y: 2500 },
];

/** One EUR project, one zone, one EUR asset, one requirement derived from them. */
async function seeded() {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const requirements = new InMemoryRequirementRepository();
	const events = new RecordingEventBus();

	const project = expectOk(
		await projects.save(makeProject({ currency: currencyOf('EUR') }), 'absent'),
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
			makeAsset({ unitCost: moneyOf('45.00', 'EUR'), wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	expectOk(
		await new AssignAssetCommand({
			zones,
			assets,
			requirements,
			events,
			locks: new ReferenceLocks(),
			projects,
		}).execute({ zoneId: zone.entity.id, assetId: asset.entity.id }),
	);

	return {
		projects,
		assets,
		projectId: project.entity.id,
		zoneId: zone.entity.id,
		assetId: asset.entity.id,
		query: new GetRequirementsForZone(requirements, zones, assets, projects),
	};
}

describe("a project's currency is part of what a figure was calculated from", () => {
	it('reads current while the currencies agree', async () => {
		const w = await seeded();
		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('current');
	});

	it('reads stale once the project currency moves, from the PERSISTED figures', async () => {
		const w = await seeded();
		const loaded = expectOk(await w.projects.getById(w.projectId));
		if (loaded === null) throw new Error('the project was seeded');
		expectOk(
			await w.projects.save(
				expectOk(loaded.entity.withCurrency(currencyOf('GBP'))),
				loaded.version,
			),
		);

		// Re-read through the query rather than through anything held in memory: this proves
		// the comparison reads the repository's own currently-persisted value rather than one
		// captured at construction time. It is not a proof of a vault round trip — these are
		// in-memory repositories, and the frontmatter round trip for `currency` is Task 3's
		// `projectMapper.test.ts` case.
		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});

	/**
	 * The half deliberately NOT moved: `assetMatchesCalculatedFrom` already compares the
	 * asset's own currency, so a re-denominated asset invalidates with no project read at
	 * all. Asserted because "we did not touch it" is not evidence.
	 */
	it('a re-denominated ASSET still reads stale, through the comparison that already existed', async () => {
		const w = await seeded();
		const loaded = expectOk(await w.assets.getById(w.assetId));
		if (loaded === null) throw new Error('the asset was seeded');
		expectOk(
			await w.assets.save(
				expectOk(loaded.entity.withChanges({ unitCost: moneyOf('45.00', 'GBP') })),
				loaded.version,
			),
		);

		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});
});
