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

/**
 * The shape `listProjectAssetPrices.test.ts` already uses for the same port: assertable
 * rather than silent, because `GetRequirementsForZone` carries the duplicate diagnostic
 * itself since Ruling 10 and one case below asserts on it.
 */
type LogLine = (event: string, context?: Record<string, unknown>) => void;
function spyLogger(): { debug: LogLine; info: LogLine; warn: LogLine; error: LogLine } {
	return {
		debug: vi.fn<LogLine>(),
		info: vi.fn<LogLine>(),
		warn: vi.fn<LogLine>(),
		error: vi.fn<LogLine>(),
	};
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
	const logger = spyLogger();

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
		logger,
		projectId: project.entity.id,
		zoneId: zone.entity.id,
		assetId: asset.entity.id,
		query: new GetRequirementsForZone({ requirements, zones, assets, projects, overrides, logger }),
	};
}

describe("a project's currency is part of what a figure was calculated from", () => {
	/**
	 * The `unitCost` group's `projectOverride: null` state — a fresh, un-overridden row, so
	 * `catalogue` and `effective` both read the asset's own price and there is no project
	 * price to show. Value-level rather than presence-only: the reviewer's mutation (swap
	 * `effective` for the CURRENT resolution) is invisible here on purpose, because the two
	 * agree while nothing has moved — the divergent case lives in the override describe
	 * block below, where an override is set but a recalculation has not yet run.
	 */
	it('reads current while the currencies agree', async () => {
		const w = await seeded();
		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('current');
		expect(rows[0]?.unitCost?.catalogue.amount).toBe('45');
		expect(rows[0]?.unitCost?.catalogue.currency).toBe('EUR');
		expect(rows[0]?.unitCost?.projectOverride).toBeNull();
		expect(rows[0]?.unitCost?.effective.amount).toBe('45');
		expect(rows[0]?.unitCost?.effective.currency).toBe('EUR');
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
		const query = new GetRequirementsForZone({
			requirements: w.requirements,
			zones: w.zones,
			assets: w.assets,
			projects,
			overrides: w.overrides,
			logger: w.logger,
		});

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
	const logger = spyLogger();

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
		logger,
		requirementId: assigned.requirement.id,
		setOverride,
		query: new GetRequirementsForZone({ requirements, zones, assets, projects, overrides, logger }),
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

		const query = new GetRequirementsForZone({ requirements, zones, assets, projects, overrides, logger: spyLogger() });
		const rows = expectOk(await query.execute(zone.entity.id));
		expect(rows[0]?.recalculationStatus).toBe('current');
	});

	/**
	 * **The memo's own case, and the only instrument that can see Ruling 10 at all** — a row
	 * renders identically whether the override resolution is keyed on the pair or on the
	 * project, so the COUNT is the whole of the evidence.
	 *
	 * It used to spy on `getForPair` and expect TWO calls: one per distinct pair, memoised
	 * across the repeat. `ObsidianAssetPriceOverrideRepository.getForPair` calls
	 * `listByProject` and filters, so those two calls were two full hydrations of every price
	 * note in the project. The memo is keyed on the PROJECT now and holds the whole
	 * resolution, so the same zone costs ONE `listByProject` and no `getForPair` at all.
	 *
	 * The three rows below are the shape the pair-keyed memo needed and this one still needs:
	 * a REPEATED pair (which a project-keyed memo must not re-read) and a genuinely DIFFERENT
	 * pair in the same project (which it must still resolve to its OWN override rather than to
	 * the first row's). A single zone cannot hold two requirements on the same asset through
	 * `AssignAssetCommand` — it is idempotent on that pair — so the repeat is hand-seeded.
	 *
	 * The per-row VALUES are asserted beside the count, because a count alone is equally true
	 * of a build that answers every row the first asset's override.
	 */
	it('reads one project list for a zone with repeated and distinct assets', async () => {
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
		// different PAIR. A memo keyed on the project alone, holding one pair's ANSWER,
		// could not tell it from the pair above; keyed on the project and holding a
		// `Map<AssetId, …>`, it resolves each asset to its own override out of one read.
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

		const listSpy = vi.spyOn(w.overrides, 'listByProject');
		const pairSpy = vi.spyOn(w.overrides, 'getForPair');
		const rows = expectOk(await w.query.execute(w.zone.entity.id));

		expect(rows).toHaveLength(3);
		// ONE list for the one project all three rows belong to — not one per row, and not
		// one per distinct pair. Defeating the memo (dropping the `memo.get` short-circuit
		// in `projectOverrides`) reads 3 here.
		expect(listSpy).toHaveBeenCalledTimes(1);
		// And the pair lookup is gone from this path entirely, which is the read that cost
		// a whole project hydration each time it was made.
		expect(pairSpy).not.toHaveBeenCalled();

		// The values, beside the count: each row resolves to its OWN asset's override out of
		// that one read. A project-keyed memo holding one pair's ANSWER would give all three
		// rows 19.5, and would still read ONE list.
		const forX = rows.filter((r) => r.assetId === w.asset.entity.id);
		const forY = rows.filter((r) => r.assetId === otherAsset.entity.id);
		expect(forX).toHaveLength(2);
		expect(forY).toHaveLength(1);
		expect(forX.map((r) => r.unitCost?.projectOverride?.amount)).toEqual(['19.5', '19.5']);
		expect(forY[0]?.unitCost?.projectOverride?.amount).toBe('30');
	});

	/**
	 * **The duplicate diagnostic, carried rather than dropped.** Before Ruling 10 this path's
	 * warning came from inside `ObsidianAssetPriceOverrideRepository.getForPair`; this query
	 * no longer calls it, so `winnersBy`'s REQUIRED `onDuplicate` is where the same
	 * `asset-price.duplicate-pair` line is raised now — the same event and the same context.
	 *
	 * More than one note for one pair is a state nothing structurally prevents (ids are ULIDs
	 * and these are user-editable markdown files), so the extra notes are seeded directly
	 * rather than through the command, which would refuse. THREE in total here — the
	 * fixture's own override plus two — because `count` is the whole bucket and a fixture of
	 * two would not tell a count of the duplicates from a count of the extras.
	 * `winningDuplicate` takes the HIGHEST id, so the row also proves WHICH note won: a
	 * warning with the wrong winner is a warning about the wrong price.
	 */
	it('warns once and resolves the highest id when a project has several notes for one pair', async () => {
		const w = await seededWithOverride();
		const duplicate = (amount: string) =>
			expectOk(
				AssetPriceOverride.create({
					id: createAssetPriceOverrideId(),
					projectId: w.project.entity.id,
					assetId: w.asset.entity.id,
					unitCost: moneyOf(amount, 'GBP'),
				}),
			);
		// `createAssetPriceOverrideId` is monotonic, so `lowerId` really does sort below
		// `higherId` — and they are SAVED in the opposite order, so `VersionedStore.values()`
		// (insertion order, which is what `listByProject` answers) ends with the LOWER id.
		// That is what makes the value assertion below able to tell `winnersBy` from
		// `new Map(list.map(...))`: the two pick different notes here, where a save order
		// matching the id order would let both spellings pass.
		const lowerId = duplicate('31.00');
		const higherId = duplicate('32.00');
		expectOk(await w.overrides.save(higherId, 'absent'));
		expectOk(await w.overrides.save(lowerId, 'absent'));
		// Derived from the IDS rather than assumed to be a save position: the rule is
		// `winningDuplicate`'s highest id, so the assertion has to state that rule.
		const winner = [w.overrideResult.override, lowerId, higherId].reduce((best, o) =>
			o.id > best.id ? o : best,
		);
		expect(winner.unitCost.amount).toBe('32');

		const rows = expectOk(await w.query.execute(w.zone.entity.id));

		expect(rows[0]?.unitCost?.projectOverride?.amount).toBe(winner.unitCost.amount);
		expect(w.logger.warn).toHaveBeenCalledTimes(1);
		expect(w.logger.warn).toHaveBeenCalledWith('asset-price.duplicate-pair', {
			projectId: w.project.entity.id,
			assetId: w.asset.entity.id,
			count: 3,
		});
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
		const query = new GetRequirementsForZone({ requirements, zones, assets, projects, overrides, logger: spyLogger() });
		const rowFor = async () => {
			const rows = expectOk(await query.execute(zone.entity.id));
			const row = rows[0];
			if (row === undefined) throw new Error('expected the zone to hold one row');
			return row;
		};

		const before = await rowFor();
		expect(before.cost.effective.amount).toBe('500');
		// Fresh, un-overridden: `projectOverride` null, `catalogue` and `effective` agree at
		// the asset's own price.
		expect(before.unitCost?.catalogue.amount).toBe('24');
		expect(before.unitCost?.projectOverride).toBeNull();
		expect(before.unitCost?.effective.amount).toBe('24');

		expectOk(
			await setOverride.execute({
				projectId: project.entity.id,
				assetId: asset.entity.id,
				unitCost: moneyOf('19.50', 'GBP'),
				expected: 'absent',
			}),
		);

		/**
		 * **The discriminating row.** The override is set but `recalculate` has not run yet,
		 * so `unitCost` reads two different truths at once: `projectOverride` is the price
		 * that was JUST set (a live read of the override repository, independent of the
		 * requirement's own persisted state), while `effective` is `calculatedFrom.unitCost`
		 * — still the OLD catalogue price, because nothing has re-derived the requirement's
		 * figures since the assign. `effective` (24) and the CURRENT resolution
		 * `projectOverride ?? catalogue` (19.5) genuinely diverge here — this is the case the
		 * reviewer's mutation (`effective: effective.override ?? assetEntity.unitCost`, the
		 * wrong, current-resolution value) cannot pass: that mutation would read 19.5 here
		 * where the persisted provenance is 24.
		 */
		const midway = await rowFor();
		expect(midway.unitCost?.catalogue.amount).toBe('24');
		expect(midway.unitCost?.projectOverride?.amount).toBe('19.5');
		expect(midway.unitCost?.projectOverride?.currency).toBe('GBP');
		expect(midway.unitCost?.effective.amount).toBe('24');

		expectOk(await recalculate.execute({ requirementId }));

		const after = await rowFor();
		expect(after.cost.calculated.amount).not.toBe(before.cost.calculated.amount);
		expect(after.cost.effective.amount).toBe('500');
		// Recalculate re-derives the figures, so `effective` (the newly-persisted provenance)
		// converges with the current resolution — `catalogue` and `projectOverride` are
		// unmoved from the midway read.
		expect(after.unitCost?.catalogue.amount).toBe('24');
		expect(after.unitCost?.projectOverride?.amount).toBe('19.5');
		expect(after.unitCost?.effective.amount).toBe('19.5');

		// Read the input through `calculatedFrom`, the persisted provenance, too — the same
		// figure the DTO's `unitCost.effective` above now reads. The override's own unit cost
		// was minted through `moneyOf`: '19.50' is '19.5'.
		const persisted = expectOk(await requirements.getById(requirementId));
		expect(persisted?.entity.calculatedFrom.unitCost.amount).toBe('19.5');
	});
});
