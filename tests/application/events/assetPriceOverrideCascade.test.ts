import { describe, expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import { err } from '../../../src/core/result/Result';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { registerOnAssetPriceOverrideChanged } from '../../../src/application/event-handlers/requirement/onAssetPriceOverrideChanged';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { assetPriceOverrideChanged } from '../../../src/domain/asset-price/AssetPriceOverride.events';
import { persistenceError } from '../../../src/application/errors';
import { expectOk } from '../../helpers/domain';
import { dispatchingEventBus, TEN_SQUARE_METERS } from '../../helpers/slice10';
import { makeAsset, makePlan, makeProject, makeZone } from '../../helpers/entities';

/**
 * The narrowing IS the difference from `onAssetUpdated`: a price override changed in one
 * project must leave every other project's requirements on the same shared asset alone.
 * That needs TWO projects sharing the asset to be visible at all — a single-project fixture
 * would pass against a cascade that drops the `.filter(...)` entirely.
 */

function silentLogger() {
	return { debug() {}, info() {}, warn() {}, error() {} };
}

/**
 * One world: repositories, a real dispatching bus, the cascade wired with a SPY standing in
 * for recalculation, and `addProject` for building the specific project/plan/zone shape each
 * case needs. Kept extensible on purpose — Task 8 adds its own case to this same file.
 */
function makeWorld() {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const requirements = new InMemoryRequirementRepository();
	const overrides = new InMemoryAssetPriceOverrideRepository();
	const events = dispatchingEventBus();
	const locks = new ReferenceLocks();
	const logger = { ...silentLogger(), error: vi.fn<(event: string, context?: Record<string, unknown>) => void>() };

	const recalculate = vi.fn<() => Promise<{ ok: true }>>(() => Promise.resolve({ ok: true }));
	registerOnAssetPriceOverrideChanged(events, {
		requirements,
		events,
		logger,
		recalculate,
	});

	const assign = new AssignAssetCommand({ zones, assets, requirements, events, locks, projects, overrides });

	async function addProject() {
		const project = expectOk(await projects.save(makeProject(), 'absent'));
		const plan = expectOk(await plans.save(makePlan({ projectId: project.entity.id }), 'absent'));
		const zone = expectOk(
			await zones.save(
				expectOk(makeZone({ projectId: project.entity.id, planId: plan.entity.id }).withGeometry({ points: TEN_SQUARE_METERS })),
				'absent',
			),
		);
		return { project, plan, zone };
	}

	return { projects, plans, zones, assets, requirements, overrides, events, locks, logger, recalculate, assign, addProject };
}

describe('onAssetPriceOverrideChanged', () => {
	it('recalculates only the requirements in the project whose price moved', async () => {
		const w = makeWorld();
		const asset = expectOk(await w.assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'));

		// Projects A and B both reference the shared asset.
		const { project: projectA, zone: zoneA } = await w.addProject();
		const { zone: zoneB } = await w.addProject();
		const assignedA = expectOk(await w.assign.execute({ zoneId: zoneA.entity.id, assetId: asset.entity.id }));
		const assignedB = expectOk(await w.assign.execute({ zoneId: zoneB.entity.id, assetId: asset.entity.id }));

		await w.events.publish(
			assetPriceOverrideChanged({ projectId: projectA.entity.id, assetId: asset.entity.id }),
		);

		expect(w.recalculate).toHaveBeenCalledTimes(1);
		expect(w.recalculate).toHaveBeenCalledWith(
			expect.objectContaining({ requirementId: assignedA.requirement.id }),
		);
		expect(w.recalculate).not.toHaveBeenCalledWith(
			expect.objectContaining({ requirementId: assignedB.requirement.id }),
		);
	});

	it('does nothing when the project references the asset nowhere', async () => {
		const w = makeWorld();
		const asset = expectOk(await w.assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'));

		// Project A holds the only assignment; project C never references the asset at all.
		const { zone: zoneA } = await w.addProject();
		await w.assign.execute({ zoneId: zoneA.entity.id, assetId: asset.entity.id });
		const { project: projectC } = await w.addProject();

		await w.events.publish(
			assetPriceOverrideChanged({ projectId: projectC.entity.id, assetId: asset.entity.id }),
		);

		expect(w.recalculate).not.toHaveBeenCalled();
	});

	it('reports a failed listing rather than recalculating nothing silently', async () => {
		const w = makeWorld();
		const asset = expectOk(await w.assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'));
		const { project: projectA } = await w.addProject();

		vi.spyOn(w.requirements, 'listByAsset').mockResolvedValue(
			err(persistenceError('test.injected-failure', 'Injected.')),
		);

		await w.events.publish(
			assetPriceOverrideChanged({ projectId: projectA.entity.id, assetId: asset.entity.id }),
		);

		expect(w.logger.error).toHaveBeenCalledWith(
			'requirement.list-by-asset.failed',
			expect.objectContaining({ assetId: asset.entity.id }),
		);
		expect(w.recalculate).not.toHaveBeenCalled();
	});
});
