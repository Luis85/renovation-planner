import { describe, expect, it, vi } from 'vitest';
import { err } from '../../../src/core/result/Result';
import { Decimal } from 'decimal.js';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { SetAssetPriceOverrideCommand } from '../../../src/application/commands/asset-price/SetAssetPriceOverride';
import { registerOnAssetUpdated } from '../../../src/application/event-handlers/requirement/onAssetUpdated';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { AssetPriceOverride } from '../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId, type AssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { assetUpdated } from '../../../src/domain/asset/Asset.events';
import { createMoney, currencyOf, of as moneyOf } from '../../../src/core/money/Money';
import { expectOk } from '../../helpers/domain';
import { dispatchingEventBus, TEN_SQUARE_METERS } from '../../helpers/slice10';
import { makeAsset, makePlan, makeProject, makeZone } from '../../helpers/entities';

/**
 * Amendment 1 item 7's last clause: the false-mismatch regression `onAssetUpdated` carries
 * once an override exists — `assetMatchesCalculatedFrom` compares `calculatedFrom.unitCost`
 * (the EFFECTIVE cost an override put there) against the catalogue default, so an overridden
 * requirement mismatches permanently unless the comparison is corrected to the effective cost
 * (Decision 5).
 */

function silentLogger() {
	return { debug() {}, info() {}, warn() {}, error() {} };
}

/**
 * One world: repositories, a real dispatching bus, the cascade wired with a SPY standing in
 * for recalculation (this suite is about which requirements the cascade decides to touch, not
 * about what recalculation itself does), and `addProject`/`addZone` for building the specific
 * project shapes each case needs.
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

	const recalculate = vi.fn<() => Promise<{ ok: true }>>(() => Promise.resolve({ ok: true }));
	registerOnAssetUpdated(events, {
		requirements,
		assets,
		overrides,
		events,
		logger: silentLogger(),
		recalculate,
	});

	const assign = new AssignAssetCommand({ zones, assets, requirements, events, locks, projects, overrides });
	const setOverride = new SetAssetPriceOverrideCommand({ overrides, projects, assets, events, locks });

	async function addZone(projectId: Parameters<typeof makeZone>[0]['projectId'], planId: Parameters<typeof makeZone>[0]['planId']) {
		return expectOk(
			await zones.save(
				expectOk(makeZone({ projectId, planId }).withGeometry({ points: TEN_SQUARE_METERS })),
				'absent',
			),
		);
	}

	async function addProject(currency: string) {
		const project = expectOk(await projects.save(makeProject({ currency: currencyOf(currency) }), 'absent'));
		const plan = expectOk(await plans.save(makePlan({ projectId: project.entity.id }), 'absent'));
		const zone = await addZone(project.entity.id, plan.entity.id);
		return { project, plan, zone };
	}

	return { projects, plans, zones, assets, requirements, overrides, events, locks, recalculate, assign, setOverride, addProject, addZone };
}

describe('onAssetUpdated with price overrides', () => {
	/** The false-mismatch regression: without the correction this recalculates forever. */
	it('skips an overridden requirement when only the catalogue price moved', async () => {
		const w = await makeWorld();
		const asset = expectOk(await w.assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'));
		const { project, zone } = await w.addProject('GBP');
		expectOk(
			await w.setOverride.execute({
				projectId: project.entity.id,
				assetId: asset.entity.id,
				unitCost: moneyOf('19.50', 'GBP'),
				expected: 'absent',
			}),
		);
		const assigned = expectOk(await w.assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id }));

		// The asset's OWN EUR price changes; project A's override is untouched, so the
		// effective cost it prices from is unchanged.
		const repriced = expectOk(asset.entity.withChanges({ unitCost: moneyOf('50.00', 'EUR') }));
		const saved = expectOk(await w.assets.save(repriced, asset.version));
		await w.events.publish(assetUpdated({ assetId: saved.entity.id }));

		expect(w.recalculate).not.toHaveBeenCalled();
		expect(expectOk(await w.requirements.getById(assigned.requirement.id))?.entity.recalculationStatus)
			.toBe('current');
	});

	/**
	 * The arm that stops the WRONG cheap fix being reintroduced. An `AssetUpdated` carries a
	 * unit change too, and an override says nothing about the unit — `assetMatchesCalculatedFrom`
	 * compares the unit symbol regardless of any override in force.
	 */
	it('does NOT skip an overridden requirement when the asset unit changed', async () => {
		const w = await makeWorld();
		const asset = expectOk(await w.assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'));
		const { project, zone } = await w.addProject('GBP');
		expectOk(
			await w.setOverride.execute({
				projectId: project.entity.id,
				assetId: asset.entity.id,
				unitCost: moneyOf('19.50', 'GBP'),
				expected: 'absent',
			}),
		);
		await w.assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id });

		// A real MeasurementUnit ('piece', matching `domainValidation.test.ts`'s own example)
		// rather than the brief's illustrative 'ft2', which is not a value this codebase's
		// `MeasurementUnit` union accepts.
		const changed = expectOk(asset.entity.withChanges({ unit: 'piece' }));
		const saved = expectOk(await w.assets.save(changed, asset.version));
		await w.events.publish(assetUpdated({ assetId: saved.entity.id }));

		expect(w.recalculate).toHaveBeenCalledTimes(1);
	});

	it('still recalculates a non-overridden requirement when the catalogue price moved', async () => {
		const w = await makeWorld();
		const asset = expectOk(await w.assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'));

		const { project: projectA, zone: zoneA } = await w.addProject('GBP');
		expectOk(
			await w.setOverride.execute({
				projectId: projectA.entity.id,
				assetId: asset.entity.id,
				unitCost: moneyOf('19.50', 'GBP'),
				expected: 'absent',
			}),
		);
		await w.assign.execute({ zoneId: zoneA.entity.id, assetId: asset.entity.id });

		// Project B: the asset's own EUR currency, no override — priced from the catalogue.
		const { zone: zoneB } = await w.addProject('EUR');
		const assignedB = expectOk(await w.assign.execute({ zoneId: zoneB.entity.id, assetId: asset.entity.id }));

		const repriced = expectOk(asset.entity.withChanges({ unitCost: moneyOf('50.00', 'EUR') }));
		const saved = expectOk(await w.assets.save(repriced, asset.version));
		await w.events.publish(assetUpdated({ assetId: saved.entity.id }));

		expect(w.recalculate).toHaveBeenCalledWith(
			expect.objectContaining({ requirementId: assignedB.requirement.id }),
		);
		// Project A's override absorbed the change; project B's did not. Exactly one link
		// recalculates — this is what proves the skip is NARROWED to the project that changed,
		// not merely that project B's happens to be among however many fired.
		expect(w.recalculate).toHaveBeenCalledTimes(1);
	});

	/**
	 * The duplicate-winner rule reaches this map too. With `new Map(list.map(...))` the skip
	 * test compares against whichever note came last in `listByAsset` order while recalculation
	 * resolves the highest id, so an overridden requirement false-invalidates on enumeration
	 * order alone. Seed two notes for one pair, lower id last.
	 */
	it('skips using the same override recalculation would resolve, when the pair is duplicated', async () => {
		const w = await makeWorld();
		const asset = expectOk(await w.assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'));
		const { project, zone } = await w.addProject('GBP');

		// The winner — highest id, the one `getForPair` and recalculation would resolve, and
		// the one this assign derives its figures from.
		const winner = expectOk(
			AssetPriceOverride.create({
				id: createAssetPriceOverrideId(),
				projectId: project.entity.id,
				assetId: asset.entity.id,
				unitCost: moneyOf('19.50', 'GBP'),
			}),
		);
		await w.overrides.save(winner, 'absent');
		const assigned = expectOk(await w.assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id }));

		// A second note for the SAME pair, saved AFTER the winner (last in `listByAsset`'s
		// enumeration order) but with a deliberately LOWER id, so `winningDuplicate` still
		// resolves the winner above while a `new Map(list.map(...))` shape would resolve this
		// one — at a different price — instead.
		const duplicate = expectOk(
			AssetPriceOverride.create({
				id: 'assetprice-00000000000000000000000000' as AssetPriceOverrideId,
				projectId: project.entity.id,
				assetId: asset.entity.id,
				unitCost: moneyOf('99.00', 'GBP'),
			}),
		);
		await w.overrides.save(duplicate, 'absent');

		await w.events.publish(assetUpdated({ assetId: asset.entity.id }));

		expect(w.recalculate).not.toHaveBeenCalled();
		expect(expectOk(await w.requirements.getById(assigned.requirement.id))?.entity.recalculationStatus)
			.toBe('current');
	});

	/**
	 * The pre-existing string-comparison defect (`deriveRequirementFigures.ts`), made more
	 * reachable by a second writer of the compared field: the SAME override, re-saved with the
	 * same value spelled without its trailing zero (`createMoney` keeps a string verbatim;
	 * `moneyOf` normalizes it). Watched failing against the string comparison before the
	 * `sameMoney` fix — see task-6-report.md.
	 */
	it('does not recalculate when the recorded and current unit costs are the same value spelled differently', async () => {
		const w = await makeWorld();
		const asset = expectOk(await w.assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'));
		const { project, zone } = await w.addProject('GBP');

		const seeded = expectOk(
			AssetPriceOverride.create({
				id: createAssetPriceOverrideId(),
				projectId: project.entity.id,
				assetId: asset.entity.id,
				unitCost: expectOk(createMoney('19.50', 'GBP')),
			}),
		);
		const saved = expectOk(await w.overrides.save(seeded, 'absent'));

		const assigned = expectOk(await w.assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id }));
		expect(assigned.requirement.calculatedFrom.unitCost.amount).toBe('19.50');

		// Re-save the identical price, spelled without the trailing zero — same value,
		// different string.
		const respelled = expectOk(saved.entity.withUnitCost(moneyOf('19.5', 'GBP')));
		expect(respelled.unitCost.amount).toBe('19.5');
		await w.overrides.save(respelled, saved.version);

		await w.events.publish(assetUpdated({ assetId: asset.entity.id }));

		expect(w.recalculate).not.toHaveBeenCalled();
	});

	/** One read for the whole fan-out, not one per requirement. */
	it('reads the overrides once however many requirements the asset has', async () => {
		const w = await makeWorld();
		const asset = expectOk(await w.assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'));

		const { project: projectA, zone: zoneA } = await w.addProject('GBP');
		expectOk(
			await w.setOverride.execute({
				projectId: projectA.entity.id,
				assetId: asset.entity.id,
				unitCost: moneyOf('19.50', 'GBP'),
				expected: 'absent',
			}),
		);
		await w.assign.execute({ zoneId: zoneA.entity.id, assetId: asset.entity.id });

		const { project: projectB, plan: planB, zone: zoneB } = await w.addProject('EUR');
		await w.assign.execute({ zoneId: zoneB.entity.id, assetId: asset.entity.id });
		// A second zone in project B — a third requirement, still two projects and one asset.
		const zoneB2 = await w.addZone(projectB.entity.id, planB.entity.id);
		await w.assign.execute({ zoneId: zoneB2.entity.id, assetId: asset.entity.id });

		const spy = vi.spyOn(w.overrides, 'listByAsset');
		await w.events.publish(assetUpdated({ assetId: asset.entity.id })); // 3 requirements across 2 projects
		expect(spy).toHaveBeenCalledTimes(1);
	});

	/**
	 * Same recovery as an unreadable ASSET (`cascade.test.ts`'s "logs a vanished asset and a
	 * faulted asset READ as different things"): treat every link as changed, because
	 * recalculation will refuse against an endpoint it cannot establish and leave each
	 * requirement visibly stale — the honest outcome for a read this handler could not
	 * perform at all.
	 */
	it('treats every link as changed when the overrides read fails', async () => {
		// A standalone wiring rather than `makeWorld()`, which registers its own handler on
		// the SAME bus with a WORKING overrides port — a second registration alongside it
		// would double-count every dispatch through the shared `recalculate` spy.
		const projects = new InMemoryProjectRepository();
		const plans = new InMemoryPlanRepository();
		const zones = new InMemoryZoneRepository();
		const assets = new InMemoryAssetRepository();
		const requirements = new InMemoryRequirementRepository();
		const overrides = new InMemoryAssetPriceOverrideRepository();
		const events = dispatchingEventBus();
		const locks = new ReferenceLocks();

		const project = expectOk(await projects.save(makeProject({ currency: currencyOf('EUR') }), 'absent'));
		const plan = expectOk(await plans.save(makePlan({ projectId: project.entity.id }), 'absent'));
		const zone = expectOk(
			await zones.save(
				expectOk(makeZone({ projectId: project.entity.id, planId: plan.entity.id }).withGeometry({ points: TEN_SQUARE_METERS })),
				'absent',
			),
		);
		const asset = expectOk(await assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'));

		const assign = new AssignAssetCommand({ zones, assets, requirements, events, locks, projects, overrides });
		const assigned = expectOk(await assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id }));

		const recalculate = vi.fn<() => Promise<{ ok: true }>>(() => Promise.resolve({ ok: true }));
		const failingOverrides = Object.assign(Object.create(Object.getPrototypeOf(overrides)), overrides, {
			listByAsset: () =>
				Promise.resolve(
					err({ category: 'Persistence', code: 'test.injected-failure', message: 'Injected.' }),
				),
		}) as typeof overrides;
		registerOnAssetUpdated(events, {
			requirements,
			assets,
			overrides: failingOverrides,
			events,
			logger: silentLogger(),
			recalculate,
		});

		await events.publish(assetUpdated({ assetId: asset.entity.id }));

		expect(recalculate).toHaveBeenCalledWith(
			expect.objectContaining({ requirementId: assigned.requirement.id }),
		);
	});
});
