import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { RecalculateRequirementCommand } from '../../../src/application/commands/requirement/RecalculateRequirement';
import { registerOnZoneGeometryChanged } from '../../../src/application/event-handlers/requirement/onZoneGeometryChanged';
import { registerOnAssetUpdated } from '../../../src/application/event-handlers/requirement/onAssetUpdated';
import { GetRequirementsForZone } from '../../../src/application/queries/GetRequirementsForZone';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { assetUpdated } from '../../../src/domain/asset/Asset.events';
import { zoneGeometryChanged } from '../../../src/domain/zone/Zone.events';
import { of as moneyOf } from '../../../src/core/money/Money';
import { expectOk } from '../../helpers/domain';
import { dispatchingEventBus, failMarkStaleOnce } from '../../helpers/slice10';
import { makeAsset, makePlan, makeProject, makeZone } from '../../helpers/entities';

/**
 * The §32 chain, driven at the application layer: ZoneGeometryChanged →
 * RequirementInvalidated → RequirementRecalculated → CostEstimateChanged — in order,
 * once each, inside the awaited dispatch.
 */

/** A REAL dispatching bus that records publication order — the instrument the order test asks for. */
// `dispatchingEventBus` from the shared helper rather than a fourth copy of it: this file
// carried a character-identical one, down to the trailing cast that erased its own parameter
// types.
const recordingBus = dispatchingEventBus;

/**
 * The §32 chain, driven at the application layer: ZoneGeometryChanged →
 * RequirementInvalidated → RequirementRecalculated → CostEstimateChanged — in order,
 * once each, inside the awaited dispatch.
 */

const TEN_SQUARE_METERS = [
	{ x: 0, y: 0 },
	{ x: 4000, y: 0 },
	{ x: 4000, y: 2500 },
	{ x: 0, y: 2500 },
];
const TWELVE_SQUARE_METERS = [
	{ x: 0, y: 0 },
	{ x: 4000, y: 0 },
	{ x: 4000, y: 3000 },
	{ x: 0, y: 3000 },
];

function silentLogger() {
	return {
		debug() {}, info() {}, warn() {}, error() {},
	};
}

async function wired() {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const requirements = new InMemoryRequirementRepository();
	const overrides = new InMemoryAssetPriceOverrideRepository();
	const events = recordingBus();
	const logger = silentLogger();

	const project = expectOk(await projects.save(makeProject(), 'absent'));
	const plan = expectOk(await plans.save(makePlan({ projectId: project.entity.id }), 'absent'));
	const zone = expectOk(
		await zones.save(
			expectOk(makeZone({ projectId: project.entity.id, planId: plan.entity.id }).withGeometry({ points: TEN_SQUARE_METERS })),
			'absent',
		),
	);
	const asset = expectOk(
		await assets.save(
			makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);

	const locks = new ReferenceLocks();
	const assign = new AssignAssetCommand({ zones, assets, requirements, events, locks, projects, overrides });
	const recalculate = new RecalculateRequirementCommand({ requirements, zones, assets, events, projects, overrides });
	const deps = {
		requirements,
		events,
		logger,
		recalculate: (input: { requirementId: string }) =>
			recalculate.execute({ requirementId: input.requirementId as never }),
	};

	return {
		project, plan, zones, assets, requirements, overrides, events, logger,
		zone, asset, assign, recalculate, deps,
		readModel: new GetRequirementsForZone(requirements, zones, assets, projects, overrides),
	};
}

describe('the recalculation cascade', () => {
	it('runs the full chain in order when the zone geometry changes', async () => {
		const w = await wired();
		registerOnZoneGeometryChanged(w.events, w.deps);
		const assigned = await w.assign.execute({ zoneId: w.zone.entity.id, assetId: w.asset.entity.id });
		if (!assigned.ok) throw new Error(String(assigned.error));
		w.events.clear();

		// Edit the polygon to 12 m² through the repository the way slice 8's command does.
		const moved = w.zone.entity.withGeometry({ points: TWELVE_SQUARE_METERS });
		if (!moved.ok) throw new Error(String(moved.error));
		expectOk(await w.zones.save(moved.value, w.zone.version));
		await w.events.publish(
			zoneGeometryChanged({
				zoneId: w.zone.entity.id,
				planId: w.plan.entity.id,
				projectId: w.project.entity.id,
			}),
		);

		expect(w.events.published.map((e) => (e as { type: string }).type)).toEqual([
			'ZoneGeometryChanged',
			'RequirementInvalidated',
			'RequirementRecalculated',
			'CostEstimateChanged',
		]);

		// 12 m² × 1.10 = 13.2 m²; × 45.00 EUR = 594.00 EUR — PERSISTED, not just derived.
		const stored = expectOk(await w.requirements.getById(assigned.value.requirement.id));
		expect(stored?.entity.quantity.calculated.value.toFixed(1)).toBe('13.2');
		expect(stored?.entity.estimatedCost.calculated.amount).toBe('594.00');
	});

	it('recalculates every linked requirement after a unitCost change, and none stays current at the old price', async () => {
		const w = await wired();
		registerOnAssetUpdated(w.events, { ...w.deps, assets: w.assets, overrides: w.overrides });
		const assigned = await w.assign.execute({ zoneId: w.zone.entity.id, assetId: w.asset.entity.id });
		if (!assigned.ok) throw new Error('unexpected failure');

		const repriced = w.asset.entity.withChanges({ unitCost: moneyOf('50.00', 'EUR') });
		if (!repriced.ok) throw new Error('unexpected failure');
		const saved = expectOk(await w.assets.save(repriced.value, w.asset.version));
		await w.events.publish(
			assetUpdated({ assetId: saved.entity.id }),
		);

		const stored = expectOk(await w.requirements.getById(assigned.value.requirement.id));
		expect(stored?.entity.estimatedCost.calculated.amount).toBe('550.00'); // 11 × 50
	});

	/**
	 * **The third site of the same relabel, found by sweeping for the shape rather than by
	 * fixing the one in the report.** `redoCreate`'s two `isErr(x) || x.value === null`
	 * branches were the ones a review bot caught, because theirs escape to a caller and reach
	 * the save indicator. This one does not escape — the handler falls back to recalculating
	 * every link either way, which is conservative and right for both causes — so the defect it
	 * carries is smaller and entirely in what a developer is TOLD: one event name asserting the
	 * asset is gone, and, for the read-fault case, no cause logged at all. Slice 11's rule is
	 * that a mapped error is logged with the original that produced it, and this was the one
	 * arm with nothing to map from.
	 *
	 * Both arms are driven, because a branch split with one arm tested is how the next sweep
	 * finds this file again.
	 */
	it('logs a vanished asset and a faulted asset READ as different things', async () => {
		const events: { name: string; payload: Record<string, unknown> }[] = [];
		const logger = {
			...silentLogger(),
			error: (name: string, payload: Record<string, unknown>) => events.push({ name, payload }),
		};

		const gone = await wired();
		registerOnAssetUpdated(gone.events, {
			...gone.deps,
			logger,
			assets: { ...gone.assets, getById: () => Promise.resolve({ ok: true, value: null }) } as never,
			overrides: gone.overrides,
		});
		await gone.assign.execute({ zoneId: gone.zone.entity.id, assetId: gone.asset.entity.id });
		await gone.events.publish(
			assetUpdated({ assetId: gone.asset.entity.id }),
		);

		const faulted = await wired();
		registerOnAssetUpdated(faulted.events, {
			...faulted.deps,
			logger,
			assets: {
				...faulted.assets,
				getById: () =>
					Promise.resolve({
						ok: false,
						error: { category: 'Persistence', code: 'test.injected', message: 'unreadable' },
					}),
			} as never,
			overrides: faulted.overrides,
		});
		await faulted.assign.execute({ zoneId: faulted.zone.entity.id, assetId: faulted.asset.entity.id });
		await faulted.events.publish(
			assetUpdated({ assetId: faulted.asset.entity.id }),
		);

		const named = events.filter((e) => e.name.startsWith('requirement.cascade-asset'));
		expect(named.map((e) => e.name)).toEqual([
			'requirement.cascade-asset-gone',
			'requirement.cascade-asset-unreadable',
		]);
		// The absent case has no cause to carry; the faulted one does, and dropping it was the
		// defect — a developer got one line naming the asset and never saying why.
		expect(named[0]?.payload.cause).toBeUndefined();
		expect(named[1]?.payload.cause).toMatchObject({ code: 'test.injected' });
	});

	it('a rename that cannot change a cost rewrites nothing', async () => {
		const w = await wired();
		await w.assign.execute({ zoneId: w.zone.entity.id, assetId: w.asset.entity.id });
		const renamed = w.asset.entity.withChanges({ name: 'Just a rename' });
		if (!renamed.ok) throw new Error('unexpected failure');
		const saved = expectOk(await w.assets.save(renamed.value, w.asset.version));

		const before = expectOk(await w.requirements.listByAsset(saved.entity.id));
		await w.events.publish(assetUpdated({ assetId: saved.entity.id }));
		const after = expectOk(await w.requirements.listByAsset(saved.entity.id));

		// Same revision AND same observed token: no write happened.
		expect(after.map((r) => r.version)).toEqual(before.map((r) => r.version));
	});

	it('a failed markStale aborts its own cascade leg loudly, and the read model still says stale', async () => {
		const w = await wired();
		const assigned = await w.assign.execute({ zoneId: w.zone.entity.id, assetId: w.asset.entity.id });
		if (!assigned.ok) throw new Error('unexpected failure');
		const requirementId = assigned.value.requirement.id;

		const logged: string[] = [];
		const notified: string[] = [];
		failMarkStaleOnce(w.requirements);
		registerOnZoneGeometryChanged(w.events, {
			...w.deps,
			logger: {
				...silentLogger(),
				error(event: string) {
					logged.push(event);
				},
			},
			notify: {
				cascadeAborted: (id: string) => notified.push(`cascade:${id}`),
				staleMarkerFailed: (id: string) => notified.push(`marker:${id}`),
			},
		});
		w.events.clear();

		await w.events.publish(
			zoneGeometryChanged({
				zoneId: w.zone.entity.id,
				planId: w.plan.entity.id,
				projectId: w.project.entity.id,
			}),
		);

		expect(logged).toContain('requirement.stale-marker.failed');
		expect(notified).toEqual([`marker:${requirementId}`]);
		expect(
			w.events.published.map((e) => (e as { type: string }).type),
		).not.toContain('RequirementInvalidated');

		// The half a "nothing happened" assertion would miss: the marker write is exactly
		// what failed, so staleness must come from calculatedFrom instead. Change the
		// area, discard nothing (in-memory has no cache), and read through the read model.
		const moved = w.zone.entity.withGeometry({ points: TWELVE_SQUARE_METERS });
		if (!moved.ok) throw new Error('unexpected failure');
		expectOk(await w.zones.save(moved.value, w.zone.version));
		const rows = expectOk(await w.readModel.execute(requirementId === undefined ? '' as never : w.zone.entity.id));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});

	/**
	 * The sibling branch, and the one that was silent. `requirement.stale-marker.failed`
	 * above passes `cause: stale.error` correctly; the recalculation branch held the same
	 * typed `AppError` in scope and logged only the id — so the single line a developer
	 * ever reads about a failed background recalculation said WHICH requirement and never
	 * WHY. Design slice 11's rule is that every mapped `AppError` is logged WITH the
	 * original that produced it.
	 *
	 * Asserted on the log CONTEXT, never on the event key: the key was already correct
	 * while the defect was live, so a test checking that `logged` contains
	 * `requirement.recalculation.failed` is precisely the test this defect walked past.
	 *
	 * `recalculate` is substituted rather than provoked, because the point is the LOG and
	 * not the arithmetic: a real failure would have to be manufactured through a repository
	 * fake, which would then be what the assertion depended on.
	 */
	it('logs a failed recalculation WITH the cause it is holding', async () => {
		const w = await wired();
		const assigned = await w.assign.execute({ zoneId: w.zone.entity.id, assetId: w.asset.entity.id });
		if (!assigned.ok) throw new Error('unexpected failure');
		const requirementId = String(assigned.value.requirement.id);

		const cause = {
			category: 'Calculation',
			code: 'requirement.area-failed',
			message: 'Zone geometry could not be measured.',
		};
		const logged: { event: string; context?: Record<string, unknown> }[] = [];
		registerOnZoneGeometryChanged(w.events, {
			...w.deps,
			recalculate: () => Promise.resolve({ ok: false, error: cause }),
			logger: {
				...silentLogger(),
				error(event: string, context?: Record<string, unknown>) {
					logged.push({ event, context });
				},
			},
		});

		await w.events.publish(
			zoneGeometryChanged({
				zoneId: w.zone.entity.id,
				planId: w.plan.entity.id,
				projectId: w.project.entity.id,
			}),
		);

		const entry = logged.find((one) => one.event === 'requirement.recalculation.failed');
		expect(entry?.context).toEqual({ requirementId, cause });
	});

	it('calculatedFrom never moves a reading the other way: persisted stale stays stale on matching inputs', async () => {
		const w = await wired();
		const assigned = await w.assign.execute({ zoneId: w.zone.entity.id, assetId: w.asset.entity.id });
		if (!assigned.ok) throw new Error('unexpected failure');
		const requirementId = assigned.value.requirement.id;

		// Persist stale WITHOUT any input changing — the state after a failed
		// recalculation whose inputs happen to still match.
		expectOk(await w.requirements.markStale(requirementId));
		const rows = expectOk(await w.readModel.execute(w.zone.entity.id));
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});
});
