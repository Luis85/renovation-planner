import { describe, expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import {
	buildRequirementRow,
	type RequirementRowDeps,
} from '../../../src/application/queries/buildRequirementRow';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryAssetRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { currencyOf, of as moneyOf } from '../../../src/core/money/Money';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { expectOk } from '../../helpers/domain';
import { makeAsset, makePlan, makeProject, makeZone, makeRequirement } from '../../helpers/entities';
import { TEN_SQUARE_METERS } from '../../helpers/slice10';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import type { Loaded } from '../../../src/application/ports/versioning';
import type { AssetPriceOverride } from '../../../src/domain/asset-price/AssetPriceOverride';

/** Matches the pattern `requirementStaleness.test.ts` uses for the same port. */
type LogLine = (event: string, context?: Record<string, unknown>) => void;
function spyLogger(): { debug: LogLine; info: LogLine; warn: LogLine; error: LogLine } {
	return {
		debug: vi.fn<LogLine>(),
		info: vi.fn<LogLine>(),
		warn: vi.fn<LogLine>(),
		error: vi.fn<LogLine>(),
	};
}

function emptyOverrideMemo(): Map<ProjectId, ReadonlyMap<AssetId, Loaded<AssetPriceOverride>>> {
	return new Map();
}

/**
 * One EUR project, one 10 m² zone, one EUR asset at 45.00/m² — the same scenario
 * `requirementStaleness.test.ts` seeds, built here directly rather than through
 * `AssignAssetCommand`: this suite is about the builder's own contract, not about the
 * command that happens to call it in production.
 */
async function seeded() {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const overrides = new InMemoryAssetPriceOverrideRepository();

	const project = expectOk(
		await projects.save(makeProject({ currency: currencyOf('EUR') }), 'absent'),
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
			makeAsset({ unitCost: moneyOf('45.00', 'EUR'), wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);

	const deps: RequirementRowDeps = { assets, zones, overrides, logger: spyLogger() };
	return { deps, project, zone, asset };
}

describe('buildRequirementRow', () => {
	it('reports current for a row whose zone, asset and project currency all agree', async () => {
		const w = await seeded();
		const requirement = makeRequirement({
			projectId: w.project.entity.id,
			assetId: w.asset.entity.id,
			origin: { kind: 'zone', zoneId: w.zone.entity.id },
		});

		const row = expectOk(
			await buildRequirementRow(w.deps, requirement, currencyOf('EUR'), emptyOverrideMemo()),
		);

		expect(row.recalculationStatus).toBe('current');
		expect(row.requirementId).toBe(requirement.id);
		expect(row.assetId).toBe(w.asset.entity.id);
		expect(row.assetName).toBe(w.asset.entity.name);
		expect(row.missingTarget).toBeNull();
		expect(row.unitCost?.catalogue.amount).toBe('45');
		expect(row.unitCost?.projectOverride).toBeNull();
		expect(row.unitCost?.effective.amount).toBe('45');
	});

	/**
	 * The PERSISTED marker: `recalculationStatus === 'stale'` on the requirement itself,
	 * with every input otherwise agreeing. `isStaleReading`'s first check is one-way — it
	 * cannot be talked back to `current` by inputs that happen to match.
	 */
	it('reports stale by the persisted marker even while every input still matches', async () => {
		const w = await seeded();
		const requirement = makeRequirement({
			projectId: w.project.entity.id,
			assetId: w.asset.entity.id,
			origin: { kind: 'zone', zoneId: w.zone.entity.id },
			recalculationStatus: 'stale',
		});

		const row = expectOk(
			await buildRequirementRow(w.deps, requirement, currencyOf('EUR'), emptyOverrideMemo()),
		);

		expect(row.recalculationStatus).toBe('stale');
	});

	/**
	 * A `calculatedFrom` MISMATCH: the requirement records an 8 m² derivation while its
	 * zone is genuinely 10 m² — no persisted marker involved, so this is `inputsStillMatch`'s
	 * own comparison catching the drift.
	 */
	it('reports stale when the recorded zone area no longer matches the zone', async () => {
		const w = await seeded();
		const requirement = makeRequirement({
			projectId: w.project.entity.id,
			assetId: w.asset.entity.id,
			origin: { kind: 'zone', zoneId: w.zone.entity.id },
			// The zone is genuinely 10 m² (`seeded()`'s `TEN_SQUARE_METERS`); this requirement
			// records an 8 m² derivation instead — a `calculatedFrom` explicitly out of step
			// with the zone, rather than the persisted marker `makeRequirement` also accepts.
			calculatedFrom: {
				zoneArea: { value: new Decimal(8), unit: 'm2' },
				unitCost: moneyOf('45.00', 'EUR'),
				assetUnit: 'm2',
			},
		});

		const row = expectOk(
			await buildRequirementRow(w.deps, requirement, currencyOf('EUR'), emptyOverrideMemo()),
		);

		expect(row.recalculationStatus).toBe('stale');
	});

	/**
	 * The Asset end gone: `missingTarget: 'asset'` and `unitCost: null` are what make the
	 * row renderable at all rather than a failed read, per this DTO's own docblock.
	 */
	it('renders a row for a requirement whose asset is gone, with no unit cost group', async () => {
		const w = await seeded();
		const goneAssetId = createAssetId();
		const requirement = makeRequirement({
			projectId: w.project.entity.id,
			assetId: goneAssetId,
			origin: { kind: 'zone', zoneId: w.zone.entity.id },
		});

		const row = expectOk(
			await buildRequirementRow(w.deps, requirement, currencyOf('EUR'), emptyOverrideMemo()),
		);

		expect(row.missingTarget).toBe('asset');
		expect(row.assetName).toBeNull();
		expect(row.unitCost).toBeNull();
		expect(row.recalculationStatus).toBe('stale');
	});

	/**
	 * A `null` project currency — the caller's own answer for a project that is gone, or
	 * for one that failed to resolve into a cached value. `isStaleReading` treats it as a
	 * missing endpoint exactly like a missing zone or asset: stale, never current.
	 */
	it('reports stale when the caller hands in a null project currency', async () => {
		const w = await seeded();
		const requirement = makeRequirement({
			projectId: w.project.entity.id,
			assetId: w.asset.entity.id,
			origin: { kind: 'zone', zoneId: w.zone.entity.id },
		});

		const row = expectOk(
			await buildRequirementRow(w.deps, requirement, null, emptyOverrideMemo()),
		);

		expect(row.recalculationStatus).toBe('stale');
		// The unitCost group is unaffected — it does not read the currency at all.
		expect(row.unitCost?.catalogue.amount).toBe('45');
	});
});
