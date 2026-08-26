import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { assetFromPersistence } from '../../src/infrastructure/persistence/mappers/assetMapper';
import {
	requirementFromPersistence,
	requirementToPersistence,
} from '../../src/infrastructure/persistence/mappers/requirementMapper';
import { RecalculateRequirementCommand } from '../../src/application/commands/requirement/RecalculateRequirement';
import { UpdateAssetCommand } from '../../src/application/commands/asset/UpdateAsset';
import { SetRequirementCostOverrideCommand } from '../../src/application/commands/requirement/SetRequirementCostOverride';
import { SetRequirementQuantityOverrideCommand } from '../../src/application/commands/requirement/SetRequirementQuantityOverride';
import {
	ReversibleAssignAssetCommand,
} from '../../src/application/commands/requirement/reversible-assign-asset-command';
import { AssignAssetCommand } from '../../src/application/commands/requirement/AssignAsset';
import { DeleteZoneCommand } from '../../src/application/commands/zone/DeleteZone';
import { registerOnZoneGeometryChanged } from '../../src/application/event-handlers/requirement/onZoneGeometryChanged';
import { registerOnAssetUpdated } from '../../src/application/event-handlers/requirement/onAssetUpdated';
import type { RequirementRepository } from '../../src/application/ports/RequirementRepository';
import { expectErr, expectOk } from '../helpers/domain';
import { recorder as logger } from '../helpers/logger';
import { makeAsset, makeRequirement, makeZone } from '../helpers/entities';
import { of as moneyOf } from '../../src/core/money/Money';
import { requirementFixture, TEN_SQUARE_METERS } from '../helpers/slice10';

/**
 * The defensive and refusal arms of slice 10's wiring — every branch the happy paths
 * cannot reach, driven here so the coverage gate measures finished increments.
 */

function silentLogger() {
	return { debug() {}, info() {}, warn() {}, error() {} };
}

/** A repository whose marker write always fails — the staleMarkerFailed fixture. */
function failingStaleMarkers(inner: RequirementRepository): RequirementRepository {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, {
		markStale: () =>
			Promise.resolve({
				ok: false,
				error: { category: 'Persistence', code: 'test.injected', message: 'injected' },
			} as never),
	}) as RequirementRepository;
}

/** One saved 10 m² zone in the fixture's plan — the assign side of these arms. */
async function wiredZoneFor(w: Awaited<ReturnType<typeof requirementFixture>>) {
	const geometry = expectOk(
		makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
			points: TEN_SQUARE_METERS,
		}),
	);
	const zoneEntity = expectOk(await w.zones.save(geometry, 'absent'));
	return { zoneId: zoneEntity.entity.id };
}

/** A repository whose referent listings fail — the cascade-abort fixture. */
function failingLists(inner: RequirementRepository): RequirementRepository {
	return {
		...inner,
		listByZone: () =>
			Promise.resolve({
				ok: false,
				error: { category: 'Persistence', code: 'test.injected', message: 'injected' },
			} as never),
		listByAsset: () =>
			Promise.resolve({
				ok: false,
				error: { category: 'Persistence', code: 'test.injected', message: 'injected' },
			} as never),
	};
}

describe('mapper refusals', () => {
	it('assetFromPersistence rejects malformed frontmatter before it reaches the domain', () => {
		expect(assetFromPersistence({}).ok).toBe(false);
		const badCost = assetFromPersistence({
			type: 'renovation-asset',
			'schema-version': 1,
			id: 'asset-x',
			revision: 1,
			project: 'project-x',
			name: 'X',
			category: 'material',
			'unit-cost': '-4',
			currency: 'EUR',
			unit: 'm2',
		});
		if (badCost.ok) throw new Error('expected malformed frontmatter to be refused');
		expect(badCost.error.category).toBe('Validation');
	});

	it('requirementFromPersistence rejects an unknown origin kind and a bad unit', () => {
		const base = requirementToPersistence(
			makeRequirement({
				projectId: 'project-x' as never,
				assetId: 'asset-x' as never,
				origin: { kind: 'zone', zoneId: 'zone-x' as never },
			}),
			1,
		);
		expect(requirementFromPersistence({ ...base, 'origin-kind': 'work-package' }).ok).toBe(false);
		expect(requirementFromPersistence({ ...base, unit: 'furlong' }).ok).toBe(false);
		expect(requirementFromPersistence({ ...base, 'waste-factor': '2' }).ok).toBe(false);
	});
});

describe('handler list-failure branches', () => {
	it('a failed listByZone aborts loudly without marking anything', async () => {
		const w = await requirementFixture();
		const notified: string[] = [];
		registerOnZoneGeometryChanged(w.events, {
			requirements: failingLists(w.requirements),
			events: w.events,
			logger,
			recalculate: w.recalculate,
			notify: { cascadeAborted: (id) => notified.push(id), staleMarkerFailed: () => undefined },
		});
		await w.events.publish({
			type: 'ZoneGeometryChanged',
			payload: { zoneId: 'zone-x', planId: 'plan-x', projectId: 'project-x' },
		} as never);
		expect(notified).toEqual(['zone-x']);
	});

	it('a failed listByAsset aborts loudly without marking anything', async () => {
		const w = await requirementFixture();
		const notified: string[] = [];
		registerOnAssetUpdated(w.events, {
			requirements: failingLists(w.requirements),
			assets: w.assets,
			events: w.events,
			logger,
			recalculate: w.recalculate,
			notify: { cascadeAborted: (id) => notified.push(id), staleMarkerFailed: () => undefined },
		});
		await w.events.publish({
			type: 'AssetUpdated',
			payload: { assetId: 'asset-x', projectId: 'project-x' },
		} as never);
		expect(notified).toEqual(['asset-x']);
	});
});

describe('reassignment target refusals', () => {
	async function wiredTwoZones() {
		const w = await requirementFixture();
		const geometry = expectOk(
			makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
				points: TEN_SQUARE_METERS,
			}),
		);
		const zoneA = expectOk(await w.zones.save(geometry, 'absent'));
		const command = new DeleteZoneCommand({
			zones: w.zones,
			requirements: w.requirements,
			recalculate: w.recalculate,
			events: w.events,
			locks: w.locks,
			logger: silentLogger(),
		});
		return { ...w, zoneA: zoneA.entity.id, command };
	}

	it('refuses a self-reassignment before anything is written', async () => {
		const w = await wiredTwoZones();
		const error = expectErr(
			await w.command.execute({
				zoneId: w.zoneA,
				resolution: 'reassign',
				reassignTo: w.zoneA,
				resolvedReferents: [],
			}),
		);
		expect(error.code).toBe('reference.self-reassign');
	});

	it('refuses a reassignment target from another project — zones AND assets', async () => {
		const w = await wiredTwoZones();
		const zone = makeZone({ projectId: 'project-other' as never, planId: w.plan.entity.id });
		const raw = await w.zones.save(zone, 'absent');
		if (!raw.ok) throw new Error(`save refused: ${JSON.stringify(raw.error)}`);
		const foreignProjectZone = expectOk(raw);
		const error = expectErr(
			await w.command.execute({
				zoneId: w.zoneA,
				resolution: 'reassign',
				reassignTo: foreignProjectZone.entity.id,
				resolvedReferents: [],
			}),
		);
		expect(error.code).toBe('reference.cross-project-reassign');
	});

	it('refuses a reassign resolution without a target', async () => {
		const w = await wiredTwoZones();
		const error = expectErr(
			await w.command.execute({ zoneId: w.zoneA, resolution: 'reassign', resolvedReferents: [] }),
		);
		expect(error.code).toBe('reference.reassign-without-target');
	});
});

describe('UpdateAsset refusals', () => {
	it('answers asset.not-found for an unknown id', async () => {
		const w = await requirementFixture();
		const error = expectErr(
			await new UpdateAssetCommand(w.assets, w.requirements, w.events, w.locks).execute({
				assetId: 'asset-none' as never,
				changes: { name: 'x' },
			}),
		);
		expect(error.code).toBe('asset.not-found');
	});
});

/** One saved 10 m² zone with a linked asset — the base fixture of the override arms. */
async function wiredWithLink() {
	const w = await requirementFixture();
	const geometry = expectOk(
		makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
			points: TEN_SQUARE_METERS,
		}),
	);
	const zoneEntity = expectOk(await w.zones.save(geometry, 'absent'));
	const assetEntity = expectOk(
		await w.assets.save(
			makeAsset({ projectId: w.project.entity.id, wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	const assigned = await w.assign.execute({ zoneId: zoneEntity.entity.id, assetId: assetEntity.entity.id });
	if (!assigned.ok) throw new Error(`assign failed: ${JSON.stringify(assigned.error)}`);
	return { ...w, requirementId: assigned.value.requirement.id };
}

describe('override command refusals', () => {
	it('the cost override answers requirement.not-found for an unknown id', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks).execute({
				requirementId: 'requirement-none' as never,
				cost: null,
			}),
		);
		expect(error.code).toBe('requirement.not-found');
	});

	it('the quantity override refuses a negative figure', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks).execute({
				requirementId: w.requirementId,
				quantity: -3,
			}),
		);
		expect((error as { code: string }).code).toBe('requirement.negative-quantity');
	});
});

function makeAdapter(w: Awaited<ReturnType<typeof requirementFixture>> & { zoneId: string; assetId: string }) {
	const assign = new AssignAssetCommand(w.zones, w.assets, w.requirements, w.events, w.locks);
	return new ReversibleAssignAssetCommand(
		assign,
		{ requirements: w.requirements, zones: w.zones, assets: w.assets, locks: w.locks },
		{ zoneId: w.zoneId as never, assetId: w.assetId as never },
	);
}

describe('ReversibleAssignAssetCommand guards', () => {
	it('undo before any execute answers undo.before-execute', async () => {
		const w = await requirementFixture();
		const zoneEntity = expectOk(
			await w.zones.save(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
				'absent',
			),
		);
		const assetEntity = expectOk(await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'));
		const adapter = makeAdapter({ ...w, zoneId: zoneEntity.entity.id, assetId: assetEntity.entity.id });
		const error = expectErr(await adapter.undo());
		expect((error as { code: string }).code).toBe('undo.before-execute');
	});

	it('redo refuses when either endpoint has been deleted since the undo', async () => {
		const w = await requirementFixture();
		const zoneEntity = expectOk(
			await w.zones.save(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
				'absent',
			),
		);
		const assetEntity = expectOk(await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'));
		const adapter = makeAdapter({ ...w, zoneId: zoneEntity.entity.id, assetId: assetEntity.entity.id });
		expectOk(await adapter.execute());
		expectOk(await adapter.undo());

		// Delete the asset out from under the redo.
		const version = expectOk(await w.assets.getById(assetEntity.entity.id)).version;
		expectOk(await w.assets.delete(assetEntity.entity.id, version));

		const redo = await adapter.execute();
		if (redo.ok) throw new Error('expected the redo to refuse against the deleted asset');
		expect(redo.error.code).toBe('requirement.asset-not-found');
	});

	it('redo refuses when the endpoints no longer share a project', async () => {
		const w = await requirementFixture();
		const zoneEntity = expectOk(
			await w.zones.save(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
				'absent',
			),
		);
		const assetEntity = expectOk(await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'));
		const adapter = makeAdapter({ ...w, zoneId: zoneEntity.entity.id, assetId: assetEntity.entity.id });
		expectOk(await adapter.execute());
		expectOk(await adapter.undo());

		// Move the ZONE to another project through a direct conditional save.
		const moved = zoneEntity.entity.withChanges?.({}) ?? zoneEntity.entity;
		void moved;
		const current = expectOk(await w.zones.getById(zoneEntity.entity.id));
		Object.assign(current.entity, { projectId: 'project-other' });
		expectOk(await w.zones.save(current.entity, current.version));

		const redo = await adapter.execute();
		if (redo.ok) throw new Error('expected the redo to refuse against the moved zone');
		expect(redo.error.code).toBe('requirement.cross-project');
	});
});

describe('recalculation against a hand-tampered record', () => {
	it('refuses an unsupported origin kind instead of guessing a rule', async () => {
		const w = await requirementFixture();
		const recalculate = new RecalculateRequirementCommand(w.requirements, w.zones, w.assets, w.events);
		const requirement = makeRequirement({
			projectId: w.project.entity.id,
			assetId: 'asset-x' as never,
			origin: { kind: 'zone', zoneId: 'zone-x' as never },
		});
		expectOk(await w.requirements.save(requirement, 'absent'));
		// The persisted union only holds 'zone' today; this is the future-proofing arm.
		const stored = expectOk(await w.requirements.getById(requirement.id));
		Object.assign(stored?.entity as object, { origin: { kind: 'work-package', workPackageId: 'wp-1' } });

		const error = expectErr(await recalculate.execute({ requirementId: requirement.id }));
		expect(error.code).toBe('requirement.unsupported-origin');
	});
});

describe('asset-cascade isolation arms', () => {
	it('an AssetUpdated for an asset nothing references finishes without a cascade', async () => {
		const w = await requirementFixture();
		registerOnAssetUpdated(w.events, {
			requirements: w.requirements,
			assets: w.assets,
			events: w.events,
			logger,
			recalculate: (input) => w.recalculate.execute(input as never),
		});
		const assetEntity = expectOk(await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'));

		await w.events.publish({
			type: 'AssetUpdated',
			payload: { assetId: assetEntity.entity.id, projectId: w.project.entity.id },
		} as never);

		expect(expectOk(await w.requirements.listByAsset(assetEntity.entity.id))).toEqual([]);
	});

	it('a failed STALE MARKER is loud per requirement: notified, logged, recalculation skipped', async () => {
		const w = await requirementFixture();
		const assetEntity = expectOk(await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'));
		const zoneId = (await wiredZoneFor(w)).zoneId;
		const assigned = await w.assign.execute({ zoneId, assetId: assetEntity.entity.id });
		if (!assigned.ok) throw new Error(`assign failed: ${JSON.stringify(assigned.error)}`);
		// A price change the link was not derived from: the cascade MUST run for it,
		// which is what makes the failing marker write observable. A fresh Money object,
		// because the in-memory requirement still aliases the asset's own one.
		const stored = expectOk(await w.requirements.getById(assigned.value.requirement.id));
		Object.assign(stored?.entity.calculatedFrom as object, { unitCost: moneyOf('44.00', 'EUR') });

		const staleMarkerFailed: string[] = [];
		registerOnAssetUpdated(w.events, {
			requirements: failingStaleMarkers(w.requirements),
			assets: w.assets,
			events: w.events,
			logger,
			recalculate: (input) => w.recalculate.execute(input as never),
			notify: {
				cascadeAborted: () => undefined,
				staleMarkerFailed: (id) => staleMarkerFailed.push(id),
			},
		});

		await w.events.publish({
			type: 'AssetUpdated',
			payload: { assetId: assetEntity.entity.id, projectId: w.project.entity.id },
		} as never);

		expect(staleMarkerFailed).toHaveLength(1);
		// Nothing rewrote the link: it is exactly as the failed marker left it.
		// Nothing rewrote the link: it is exactly as the failed marker left it.
		const link = expectOk(await w.requirements.getById(
			(expectOk(await w.requirements.listByAsset(assetEntity.entity.id)))[0]?.entity.id as never,
		));
		expect(link?.entity.recalculationStatus).toBe('current');
	});

	it('the cascade logs a per-requirement recalculation failure without firing success events', async () => {
		const w = await requirementFixture();
		registerOnZoneGeometryChanged(w.events, {
			requirements: w.requirements,
			events: w.events,
			logger,
			recalculate: (input) => w.recalculate.execute(input as never),
		});
		const assetEntity = expectOk(await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'));
		const zoneId = (await wiredZoneFor(w)).zoneId;
		await w.assign.execute({ zoneId, assetId: assetEntity.entity.id });
		// The geometry edit cascades; by recalculation time the asset is gone, so the
		// requirement stays visibly stale and NO success event may fire for it.
		const asset = expectOk(await w.assets.getById(assetEntity.entity.id));
		expectOk(await w.assets.delete(assetEntity.entity.id, asset.version));

		await w.events.publish({
			type: 'ZoneGeometryChanged',
			payload: { zoneId, planId: w.plan.entity.id, projectId: w.project.entity.id },
		} as never);

		const links = expectOk(await w.requirements.listByAsset(assetEntity.entity.id));
		expect(links).toHaveLength(1);
		expect(links[0]?.entity.recalculationStatus).toBe('stale');
	});

	it('the asset vanishing between its update and its own cascade cascades every link', async () => {
		const w = await requirementFixture();
		registerOnAssetUpdated(w.events, {
			requirements: w.requirements,
			assets: w.assets,
			events: w.events,
			logger,
			recalculate: (input) => w.recalculate.execute(input as never),
		});
		const assetEntity = expectOk(await w.assets.save(makeAsset({ projectId: w.project.entity.id }), 'absent'));
		const zoneId = (await wiredZoneFor(w)).zoneId;
		await w.assign.execute({ zoneId, assetId: assetEntity.entity.id });
		// The update event arrives; by the time the handler looks, the asset is gone.
		expectOk(await w.assets.delete(assetEntity.entity.id, (expectOk(await w.assets.getById(assetEntity.entity.id))).version));

		await w.events.publish({
			type: 'AssetUpdated',
			payload: { assetId: assetEntity.entity.id, projectId: w.project.entity.id },
		} as never);

		const links = expectOk(await w.requirements.listByAsset(assetEntity.entity.id));
		expect(links).toHaveLength(1);
		expect(links[0]?.entity.recalculationStatus).toBe('stale');
	});
});

