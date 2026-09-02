import { describe, expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { RecalculateRequirementCommand } from '../../../src/application/commands/requirement/RecalculateRequirement';
import { SetAssetPriceOverrideCommand } from '../../../src/application/commands/asset-price/SetAssetPriceOverride';
import { SetRequirementCostOverrideCommand } from '../../../src/application/commands/requirement/SetRequirementCostOverride';
import { GetRequirementsForZone } from '../../../src/application/queries/GetRequirementsForZone';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { AssetPriceOverride } from '../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { createMoney, currencyOf, of as moneyOf } from '../../../src/core/money/Money';
import { expectErr, expectOk, injectedPersistenceError, RecordingEventBus } from '../../helpers/domain';
import { makeAsset, makePlan, makeProject, makeRequirement, makeZone } from '../../helpers/entities';
import { err } from '../../../src/core/result/Result';

/** Matches the pattern `queryRefusals.test.ts` uses for the zone and asset endpoints. */
function overridePort<T extends object>(inner: T, patch: Record<string, unknown>): T {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, patch) as T;
}

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
	const overrides = new InMemoryAssetPriceOverrideRepository();
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
			overrides,
		}).execute({ zoneId: zone.entity.id, assetId: asset.entity.id }),
	);

	return {
		projects,
		zones,
		requirements,
		assets,
		overrides,
		projectId: project.entity.id,
		zoneId: zone.entity.id,
		assetId: asset.entity.id,
		query: new GetRequirementsForZone(requirements, zones, assets, projects, overrides),
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

	/**
	 * The project is an endpoint like the zone and the asset: gone reads "stale", never
	 * "current" for a figure this query cannot re-derive. `loadProjectCurrency`'s own
	 * `zone.value === null` short-circuit is not reached here on purpose — the ZONE still
	 * resolves; only the PROJECT it points at is absent — so this exercises
	 * `project.value?.entity.currency ?? null` on a genuinely missing project.
	 */
	it('reads stale once the zone points at a project that is gone', async () => {
		const w = await seeded();
		const loadedProject = expectOk(await w.projects.getById(w.projectId));
		if (loadedProject === null) throw new Error('the project was seeded');
		expectOk(await w.projects.delete(w.projectId, loadedProject.version));

		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});

	/**
	 * A project that FAILS to read is not the same as one that is gone: `isErr(project)`
	 * propagates the `RepositoryError` up through `execute`, exactly like an asset or zone
	 * read failure elsewhere in this query — it does not resolve to "stale".
	 */
	it('propagates a failed project read rather than reporting stale', async () => {
		const w = await seeded();
		const projects = overridePort(w.projects, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const query = new GetRequirementsForZone(w.requirements, w.zones, w.assets, projects, w.overrides);

		const error = expectErr(await query.execute(w.zoneId));
		expect(error.code).toBe('test.injected-failure');
	});
});

/**
 * A GBP project with its own price override on an EUR-catalogue asset — the read-model
 * side of Decision 5's correction. `assetMatchesCalculatedFrom` must be compared against
 * the EFFECTIVE cost this project priced the asset at, not the catalogue default, or an
 * overridden requirement mismatches permanently and reads "stale" forever.
 */
async function seededWithOverride() {
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
				makeZone({ projectId: project.entity.id, planId: plan.entity.id }).withGeometry({
					points: TEN_SQUARE_METERS,
				}),
			),
			'absent',
		),
	);
	const asset = expectOk(
		await assets.save(
			makeAsset({ unitCost: moneyOf('24.00', 'EUR'), wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);

	const setOverride = new SetAssetPriceOverrideCommand({ overrides, projects, assets, events, locks });
	const overrideResult = expectOk(
		await setOverride.execute({
			projectId: project.entity.id,
			assetId: asset.entity.id,
			unitCost: moneyOf('19.50', 'GBP'),
			expected: 'absent',
		}),
	);

	const assign = new AssignAssetCommand({ zones, assets, requirements, events, locks, projects, overrides });
	const assigned = expectOk(await assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id }));

	return {
		projects,
		plans,
		zones,
		assets,
		requirements,
		overrides,
		events,
		locks,
		project,
		plan,
		zone,
		asset,
		overrideResult,
		requirementId: assigned.requirement.id,
		setOverride,
		query: new GetRequirementsForZone(requirements, zones, assets, projects, overrides),
	};
}

describe("a project's own price override is part of what a figure was calculated from", () => {
	/** The false-mismatch regression, read-model side. */
	it('reports current for a requirement derived from its project price override', async () => {
		const w = await seededWithOverride();
		const rows = expectOk(await w.query.execute(w.zone.entity.id));
		expect(rows[0]?.recalculationStatus).toBe('current');
	});

	it('reports stale for an overridden requirement whose override has since moved', async () => {
		const w = await seededWithOverride();
		expectOk(
			await w.setOverride.execute({
				projectId: w.project.entity.id,
				assetId: w.asset.entity.id,
				unitCost: moneyOf('21.00', 'GBP'),
				expected: { id: w.overrideResult.override.id, version: w.overrideResult.version },
			}),
		);
		const rows = expectOk(await w.query.execute(w.zone.entity.id));
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});

	/**
	 * The pre-existing string-comparison defect, on the read-model side: the SAME override
	 * note, re-saved with the same value spelled without its trailing zero. `createMoney`
	 * keeps a string verbatim; `moneyOf` normalizes it — so seeding the override directly
	 * with `createMoney('19.50', …)` records `calculatedFrom.unitCost` as `19.50`, and
	 * re-saving the identical price through `withUnitCost`/`moneyOf` spells the CURRENT
	 * override `19.5`. Watched failing against the string comparison before the `sameMoney`
	 * fix — see task-6-report.md.
	 */
	it('reports current when the recorded and current unit costs are the same value spelled differently', async () => {
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
					makeZone({ projectId: project.entity.id, planId: plan.entity.id }).withGeometry({
						points: TEN_SQUARE_METERS,
					}),
				),
				'absent',
			),
		);
		const asset = expectOk(
			await assets.save(
				makeAsset({ unitCost: moneyOf('24.00', 'EUR'), wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);

		const seededOverride = expectOk(
			AssetPriceOverride.create({
				id: createAssetPriceOverrideId(),
				projectId: project.entity.id,
				assetId: asset.entity.id,
				unitCost: expectOk(createMoney('19.50', 'GBP')),
			}),
		);
		const saved = expectOk(await overrides.save(seededOverride, 'absent'));

		const assign = new AssignAssetCommand({ zones, assets, requirements, events, locks, projects, overrides });
		const assigned = expectOk(await assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id }));
		expect(assigned.requirement.calculatedFrom.unitCost.amount).toBe('19.50');

		// Re-save the identical price, spelled without the trailing zero — same value,
		// different string.
		const respelled = expectOk(saved.entity.withUnitCost(moneyOf('19.5', 'GBP')));
		expect(respelled.unitCost.amount).toBe('19.5');
		await overrides.save(respelled, saved.version);

		const query = new GetRequirementsForZone(requirements, zones, assets, projects, overrides);
		const rows = expectOk(await query.execute(zone.entity.id));
		expect(rows[0]?.recalculationStatus).toBe('current');
	});

	/**
	 * The memo's own case. Resolving the override per (project, asset) PAIR rather than once
	 * per CALL is what fixes the read/write disagreement above, and it would otherwise cost
	 * one override read per requirement. A single zone cannot hold two requirements on the
	 * same asset through `AssignAssetCommand` (it is idempotent on that pair), so the second
	 * requirement is hand-seeded — the memo's own question is only whether the SAME pair
	 * recurs, which either route produces identically.
	 */
	it('reads each (project, asset) pair once for a zone with repeated assets', async () => {
		const w = await seededWithOverride();
		// A second requirement in the SAME zone, referencing the SAME (project, asset) pair —
		// the "repeated" half, which the memo must serve from cache rather than re-reading.
		expectOk(
			await w.requirements.save(
				makeRequirement({
					projectId: w.project.entity.id,
					assetId: w.asset.entity.id,
					origin: { kind: 'zone', zoneId: w.zone.entity.id },
				}),
				'absent',
			),
		);

		// A DIFFERENT asset, in the SAME project, with its OWN override — a genuinely
		// different PAIR. This is what a memo keyed on the project ALONE cannot tell apart
		// from the pair above: it would answer this row with the first asset's cached
		// override rather than reading its own, and it would do so in only ONE call rather
		// than two — which is why the assertion below is on the COUNT, not only the value.
		const otherAsset = expectOk(
			await w.assets.save(
				makeAsset({ unitCost: moneyOf('24.00', 'EUR'), wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);
		expectOk(
			await w.setOverride.execute({
				projectId: w.project.entity.id,
				assetId: otherAsset.entity.id,
				unitCost: moneyOf('30.00', 'GBP'),
				expected: 'absent',
			}),
		);
		const assign = new AssignAssetCommand({
			zones: w.zones,
			assets: w.assets,
			requirements: w.requirements,
			events: w.events,
			locks: w.locks,
			projects: w.projects,
			overrides: w.overrides,
		});
		expectOk(await assign.execute({ zoneId: w.zone.entity.id, assetId: otherAsset.entity.id }));

		const spy = vi.spyOn(w.overrides, 'getForPair');
		const rows = expectOk(await w.query.execute(w.zone.entity.id));

		expect(rows).toHaveLength(3);
		// One call for the repeated (project, asset X) pair — served from cache the second
		// time — plus one for the genuinely different (project, asset Y) pair. TWO, not one
		// and not three.
		expect(spy).toHaveBeenCalledTimes(2);
	});

	/**
	 * **The precedence, with BOTH overrides live.** The price override replaces an INPUT,
	 * the requirement override replaces the OUTPUT — moving the price must move
	 * `cost.calculated` and must NOT move `cost.effective`. A case with only one override
	 * live passes against either precedence, which is why this one carries both.
	 */
	it('moves calculated but not effective when the price changes under a requirement override', async () => {
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
					makeZone({ projectId: project.entity.id, planId: plan.entity.id }).withGeometry({
						points: TEN_SQUARE_METERS,
					}),
				),
				'absent',
			),
		);
		// Priced in the project's own currency directly, so the assign below needs no
		// override yet — the requirement's figures start derived from the 24.00 catalogue.
		const asset = expectOk(
			await assets.save(
				makeAsset({ unitCost: moneyOf('24.00', 'GBP'), wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);

		const assign = new AssignAssetCommand({ zones, assets, requirements, events, locks, projects, overrides });
		const assigned = expectOk(await assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id }));
		const requirementId = assigned.requirement.id;

		const setCostOverride = new SetRequirementCostOverrideCommand(requirements, events, locks);
		expectOk(await setCostOverride.execute({ requirementId, cost: moneyOf('500.00', 'GBP') }));

		const setOverride = new SetAssetPriceOverrideCommand({ overrides, projects, assets, events, locks });
		const recalculate = new RecalculateRequirementCommand({ requirements, zones, assets, events, projects, overrides });
		const query = new GetRequirementsForZone(requirements, zones, assets, projects, overrides);
		const rowFor = async () => {
			const rows = expectOk(await query.execute(zone.entity.id));
			const row = rows[0];
			if (row === undefined) throw new Error('expected the zone to hold one row');
			return row;
		};

		const before = await rowFor();
		expect(before.cost.effective.amount).toBe('500');

		expectOk(
			await setOverride.execute({
				projectId: project.entity.id,
				assetId: asset.entity.id,
				unitCost: moneyOf('19.50', 'GBP'),
				expected: 'absent',
			}),
		);
		expectOk(await recalculate.execute({ requirementId }));

		const after = await rowFor();
		expect(after.cost.calculated.amount).not.toBe(before.cost.calculated.amount);
		expect(after.cost.effective.amount).toBe('500');

		// Read the input through `calculatedFrom`, the persisted provenance, rather than
		// through the DTO's own `unitCost` group — that group is Task 8's and does not exist
		// at this task boundary. The override's own unit cost was minted through `moneyOf`:
		// '19.50' is '19.5'.
		const persisted = expectOk(await requirements.getById(requirementId));
		expect(persisted?.entity.calculatedFrom.unitCost.amount).toBe('19.5');
	});
});
