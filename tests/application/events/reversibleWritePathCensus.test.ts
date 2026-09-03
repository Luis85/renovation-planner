/**
 * Task 11: the behavioural half of the reversible-write-path census.
 *
 * This defect was found by a sweep, and every earlier version of the sweep was a
 * CONTAINMENT boolean at a finer grain — a sample of adapters, a filter that was itself a
 * sample, a metric counting literal `publish(` syntax, an enumeration that trailed its own
 * count, a per-file grep, a per-function AST walk. Each passed the exact regression it
 * existed to prevent, because "the body contains a publish" is not "this path publishes".
 *
 * So the design inverts: text scanning (`reversibleWritePathDiscovery.test.ts`) does the one
 * thing it is reliable at — finding which CLASSES exist — and behaviour, here, settles the
 * thing only behaviour can: whether a given direction of a given adapter actually announced.
 * `CENSUS_TABLE` (in `tests/helpers/reversibleWriteCensusTable.ts`, shared with the discovery
 * file rather than exported from either `.test.ts`, per that module's own header) is the
 * specification; the `it()`s in this file are the proof. Duplicating an assertion an earlier
 * task's own test file already makes is fine and intended — this file is the one place a
 * reader sees every direction and what it owes, never a second mechanism policing the first.
 *
 * Split from the static scan once both crossed the 450-line test budget together, along the
 * seam the brief itself names: "the table and the scan are an obvious one."
 */
import { describe, expect, it } from 'vitest';
import { of as moneyOf } from '../../../src/core/money/Money';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleCreateZoneCommand } from '../../../src/application/commands/zone/reversible-create-zone-command';
import { ReversibleDeleteZoneCommand } from '../../../src/application/commands/zone/reversible-delete-zone-command';
import { ReversibleMoveZoneCommand } from '../../../src/presentation/editor/tools/reversible-move-zone-command';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { ReversibleAssignAssetCommand } from '../../../src/application/commands/requirement/reversible-assign-asset-command';
import { SetRequirementQuantityOverrideCommand } from '../../../src/application/commands/requirement/SetRequirementQuantityOverride';
import { SetRequirementCostOverrideCommand } from '../../../src/application/commands/requirement/SetRequirementCostOverride';
import {
	ReversibleSetRequirementCostOverrideCommand,
	ReversibleSetRequirementQuantityOverrideCommand,
} from '../../../src/application/commands/requirement/reversible-override-commands';
import { ReversibleCalibratePlanCommand } from '../../../src/application/commands/plan/ReversibleCalibratePlan';
import { SetPlanBackgroundCommand } from '../../../src/application/commands/plan/SetPlanBackground';
import { ReversibleSetPlanBackgroundCommand } from '../../../src/application/commands/plan/ReversibleSetPlanBackground';
import type { VaultFileProbe } from '../../../src/application/ports/VaultFileProbe';
import { SessionWriteLedger, type WriteLedger } from '../../../src/application/editor/WriteLedger';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { expectOk, RecordingEventBus } from '../../helpers/domain';
import { makeAsset, makePlan, makeRequirement, makeZone, squareAt } from '../../helpers/entities';
import { InMemoryPlanGeometrySidecar } from '../../helpers/geometry-sidecar';
import { recorder } from '../../helpers/logger';
import {
	assignedRequirementFixture as withRequirement,
	makeDeleteZoneCommand,
	requirementFixture,
	TEN_SQUARE_METERS,
} from '../../helpers/slice10';
import { drawn, seeded } from '../../helpers/assetDesignHarness';
import { CENSUS_TABLE } from '../../helpers/reversibleWriteCensusTable';

describe('the census table names a non-trivial number of directions', () => {
	it('has more than one row per module on average, so it is not an empty scaffold', () => {
		expect(CENSUS_TABLE.length).toBeGreaterThan(15);
	});
});

async function wiredCreateZone() {
	const plans = new InMemoryPlanRepository();
	const plan = makePlan({ projectId: createProjectId() });
	await plans.save(plan, 'absent');
	const zones = new InMemoryZoneRepository();
	const requirements = new InMemoryRequirementRepository();
	const events = new RecordingEventBus();
	const ledger: WriteLedger = new SessionWriteLedger();
	const command = new ReversibleCreateZoneCommand(
		new CreateZoneCommand(zones, plans, events),
		makeDeleteZoneCommand(zones, events, requirements),
		ledger,
		{ planId: plan.id, name: 'Living room', zoneType: 'Room', geometry: squareAt() },
		{ zones, events, requirements, logger: recorder },
	);
	return { requirements, events, command };
}

describe('reversible-create-zone-command', () => {
	it('execute (first) publishes ZoneCreated', async () => {
		const { events, command } = await wiredCreateZone();

		expectOk(await command.execute());

		expect(events.published.map((event) => event.type)).toEqual(['ZoneCreated']);
	});

	it('undo publishes ZoneDeleted', async () => {
		const { events, command } = await wiredCreateZone();
		await command.execute();
		events.clear();

		expectOk(await command.undo());

		expect(events.published.map((event) => event.type)).toEqual(['ZoneDeleted']);
	});

	it('execute (redo) re-publishes ZoneCreated plus RequirementInvalidated for a cross-project referent', async () => {
		const { command, requirements, events } = await wiredCreateZone();
		await command.execute();
		const zoneId = command.createdZoneId;
		if (zoneId === null) throw new Error('expected the creation to record its zone');
		await command.undo();
		// A hand-edited requirement in another project, seeded AFTER the undo — the residue
		// the zone event's own per-project filter drops, per reversibleCreateZone.test.ts.
		const foreign = expectOk(
			await requirements.save(
				makeRequirement({ projectId: createProjectId(), assetId: makeAsset().id, origin: { kind: 'zone', zoneId } }),
				'absent',
			),
		);
		events.clear();

		expectOk(await command.execute()); // the redo

		expect(events.published).toEqual([
			{ type: 'ZoneCreated', payload: expect.objectContaining({ zoneId }) },
			{ type: 'RequirementInvalidated', payload: { requirementId: foreign.entity.id } },
		]);
	});

	it('execute (redo) falls back to ProjectIndexRebuilt when the reverse lookup faults', async () => {
		const { command, requirements, events } = await wiredCreateZone();
		await command.execute();
		await command.undo();
		requirements.listByZone = () => Promise.reject(new Error('vault exploded'));
		events.clear();

		expectOk(await command.execute());

		expect(events.published.map((event) => event.type)).toEqual(['ZoneCreated', 'ProjectIndexRebuilt']);
	});
});

async function wiredDeleteZone(referentCount: number) {
	const w = await requirementFixture();
	const zone = expectOk(
		await w.zones.save(
			expectOk(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
					points: TEN_SQUARE_METERS,
				}),
			),
			'absent',
		),
	);
	const referents: RequirementId[] = [];
	for (let index = 0; index < referentCount; index += 1) {
		const asset = expectOk(await w.assets.save(makeAsset({ name: `Asset ${index}` }), 'absent'));
		const assigned = await w.assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id });
		if (!assigned.ok) throw new Error(String(assigned.error));
		referents.push(assigned.value.requirement.id);
	}
	const ledger = new SessionWriteLedger();
	const plain = new DeleteZoneCommand({
		zones: w.zones,
		requirements: w.requirements,
		recalculate: w.recalculate,
		events: w.events,
		locks: w.locks,
		logger: recorder,
	});
	const command = new ReversibleDeleteZoneCommand(
		plain,
		w.zones,
		ledger,
		{ zoneId: zone.entity.id, resolution: 'remove-references', resolvedReferents: referents },
		{ requirements: w.requirements, locks: w.locks, logger: recorder, events: w.events },
	);
	return { ...w, command };
}

describe('reversible-delete-zone-command', () => {
	it('execute (first and redo) publishes ZoneDeleted', async () => {
		const w = await wiredDeleteZone(0);

		expectOk(await w.command.execute());
		expect(w.events.published.map((event) => event.type)).toEqual(['ZoneDeleted']);

		await w.command.undo();
		w.events.clear();
		expectOk(await w.command.execute()); // the redo

		expect(w.events.published.map((event) => event.type)).toEqual(['ZoneDeleted']);
	});

	it('undo publishes RequirementCreated per restored referent, then ZoneCreated', async () => {
		const w = await wiredDeleteZone(2);
		expectOk(await w.command.execute());
		w.events.clear();

		expectOk(await w.command.undo());

		// The referent restores fire from INSIDE `undoDeleteResolution`, before it returns
		// ok; `ZoneCreated` is published afterwards by `ReversibleDeleteZoneCommand.undo()`
		// itself — see that class's own docblock for why the zone event must be last.
		expect(w.events.published.map((event) => event.type)).toEqual([
			'RequirementCreated',
			'RequirementCreated',
			'ZoneCreated',
		]);
	});
});

async function wiredMove() {
	const zones = new InMemoryZoneRepository();
	const zone = makeZone({ projectId: createProjectId(), planId: createProjectId() as never, geometry: squareAt(0, 0) });
	await zones.save(zone, 'absent');
	const events = new RecordingEventBus();
	const move = new MoveSpatialObjectCommand(zones, events);
	const ledger: WriteLedger = new SessionWriteLedger();
	const adapter = new ReversibleMoveZoneCommand(move, ledger, zone.id, squareAt(10, 10), squareAt(0, 0));
	return { events, adapter };
}

describe('MoveSpatialObject, driven through ReversibleMoveZoneCommand', () => {
	it('execute publishes ZoneGeometryChanged', async () => {
		const { events, adapter } = await wiredMove();

		expectOk(await adapter.execute());

		expect(events.published.map((event) => event.type)).toEqual(['ZoneGeometryChanged']);
	});

	it('undo publishes ZoneGeometryChanged', async () => {
		const { events, adapter } = await wiredMove();
		await adapter.execute();
		events.clear();

		expectOk(await adapter.undo());

		expect(events.published.map((event) => event.type)).toEqual(['ZoneGeometryChanged']);
	});
});

async function wiredAssign() {
	const w = await withRequirement(); // an existing zone/asset pair, one requirement already assigned
	const existing = expectOk(await w.requirements.getById(w.requirementId));
	if (existing === null) throw new Error('expected the fixture requirement to exist');
	const existingAssetId = existing.entity.assetId;
	const secondAsset = expectOk(await w.assets.save(makeAsset({ name: 'Second asset' }), 'absent'));
	const assign = new AssignAssetCommand({
		zones: w.zones,
		assets: w.assets,
		requirements: w.requirements,
		events: w.events,
		locks: w.locks,
		projects: w.projects,
		overrides: w.overrides,
	});
	const adapterFor = (assetId: typeof secondAsset.entity.id) =>
		new ReversibleAssignAssetCommand(
			assign,
			{ requirements: w.requirements, zones: w.zones, assets: w.assets, locks: w.locks, events: w.events },
			{ zoneId: w.zoneId, assetId },
		);
	return { ...w, existingAssetId, secondAssetId: secondAsset.entity.id, adapterFor };
}

describe('reversible-assign-asset-command', () => {
	it('execute (first) publishes RequirementCreated', async () => {
		const w = await wiredAssign();
		const adapter = w.adapterFor(w.secondAssetId);
		w.events.clear();

		expectOk(await adapter.execute());

		expect(w.events.published.map((event) => event.type)).toEqual(['RequirementCreated']);
	});

	it('execute (redo) publishes RequirementCreated', async () => {
		const w = await wiredAssign();
		const adapter = w.adapterFor(w.secondAssetId);
		await adapter.execute();
		await adapter.undo();
		w.events.clear();

		expectOk(await adapter.execute()); // the redo — the silent half this task closed

		expect(w.events.published.map((event) => event.type)).toEqual(['RequirementCreated']);
	});

	it('undo (created) publishes RequirementDeleted', async () => {
		const w = await wiredAssign();
		const adapter = w.adapterFor(w.secondAssetId);
		await adapter.execute();
		w.events.clear();

		expectOk(await adapter.undo());

		expect(w.events.published.map((event) => event.type)).toEqual(['RequirementDeleted']);
	});

	it('undo (found) publishes nothing — it wrote nothing', async () => {
		const w = await wiredAssign();
		// The pair this fixture already assigned: execute() FINDS rather than creates.
		const adapter = w.adapterFor(w.existingAssetId);
		const found = expectOk(await adapter.execute());
		expect(found.outcome).toBe('no-write');
		w.events.clear();

		expectOk(await adapter.undo());

		expect(w.events.published).toEqual([]);
	});
});

describe('reversible-override-commands', () => {
	const QUANTITY_OVERRIDE = 20;
	const COST_OVERRIDE = moneyOf('550.00', 'EUR');

	it.each(['quantity', 'cost'] as const)('(%s) undo publishes CostEstimateChanged when the figure moves', async (kind) => {
		const w = await withRequirement();
		const events = new RecordingEventBus();
		const adapter =
			kind === 'quantity'
				? new ReversibleSetRequirementQuantityOverrideCommand(
						new SetRequirementQuantityOverrideCommand(w.requirements, events, w.locks),
						w.requirements,
						events,
					)
				: new ReversibleSetRequirementCostOverrideCommand(
						new SetRequirementCostOverrideCommand(w.requirements, events, w.locks),
						w.requirements,
						events,
					);
		const input =
			kind === 'quantity'
				? { requirementId: w.requirementId, quantity: QUANTITY_OVERRIDE }
				: { requirementId: w.requirementId, cost: COST_OVERRIDE };
		expectOk(await adapter.execute(input as never));
		events.clear();

		expectOk(await adapter.undo());

		expect(events.published.map((event) => event.type)).toEqual(['CostEstimateChanged']);
	});
});

async function wiredCalibrate() {
	const projectId = createProjectId();
	const plan = makePlan({ projectId });
	const plans = new InMemoryPlanRepository();
	await plans.save(plan, 'absent');
	const events = new RecordingEventBus();
	const sidecar = new InMemoryPlanGeometrySidecar();
	sidecar.seed(plan.id, {
		calibration: null,
		objects: [{ id: 'zone-1' as never, points: [{ x: 10, y: 0 }, { x: 110, y: 0 }, { x: 110, y: 100 }] }],
	});
	return { events, command: new ReversibleCalibratePlanCommand(plans, sidecar, events), planId: plan.id };
}

describe('ReversibleCalibratePlan', () => {
	const PICKED_A = { x: 812, y: 240 };
	const PICKED_B = { x: 812, y: 1040 };
	const KNOWN_MM = 3200;

	it('execute publishes PlanCalibrated plus one ZoneGeometryChanged per rescaled object', async () => {
		const { events, command, planId } = await wiredCalibrate();

		expectOk(await command.execute({ planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));

		expect(events.published.map((event) => event.type)).toEqual(['PlanCalibrated', 'ZoneGeometryChanged']);
	});

	it('undo publishes the same cascade: PlanCalibrated plus per-object ZoneGeometryChanged', async () => {
		const { events, command, planId } = await wiredCalibrate();
		await command.execute({ planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM });
		events.clear();

		expectOk(await command.undo());

		expect(events.published.map((event) => event.type)).toEqual(['PlanCalibrated', 'ZoneGeometryChanged']);
	});
});

describe('ReversibleSetPlanBackground', () => {
	const GROUND_PNG = { path: 'Plans/ground.png', kind: 'image' as const };
	const probe: VaultFileProbe = { fileExists: (path) => path === GROUND_PNG.path };

	async function wired() {
		const plans = new InMemoryPlanRepository();
		const plan = makePlan({ projectId: createProjectId() });
		await plans.save(plan, 'absent');
		const events = new RecordingEventBus();
		const forward = new SetPlanBackgroundCommand(plans, probe, events);
		return { events, reversible: new ReversibleSetPlanBackgroundCommand(forward, plans), planId: plan.id };
	}

	// CORRECTED row: `execute()` delegates to the wrapped plain command, which has always
	// published `PlanBackgroundChanged` on success. This is pre-existing behaviour, not part
	// of this task's fix — asserted here because the plan's own table conflated it with the
	// undo carve-out below under one "nothing" row. See CENSUS_TABLE's header.
	it('execute publishes PlanBackgroundChanged (pre-existing, via the wrapped command)', async () => {
		const { events, reversible, planId } = await wired();

		expectOk(await reversible.execute({ planId, background: GROUND_PNG }));

		expect(events.published.map((event) => event.type)).toEqual(['PlanBackgroundChanged']);
	});

	it('undo publishes nothing — the carve-out', async () => {
		const { events, reversible, planId } = await wired();
		await reversible.execute({ planId, background: GROUND_PNG });
		events.clear();

		expectOk(await reversible.undo());

		expect(events.published).toEqual([]);
	});
});

describe('the asset design edits (ReversibleAssetGeometryEdit / NoteEdit / BackgroundEdit)', () => {
	it('geometry (setAnchor) execute and undo each publish AssetDesignChanged', async () => {
		const { reversible, assetId, seed, designChanges } = await seeded();
		await seed(drawn());
		const gesture = reversible.setAnchor({ assetId, anchor: { x: 40, y: 40 } });

		expectOk(await gesture.execute());
		expect(designChanges).toEqual([assetId]);

		expectOk(await gesture.undo());
		expect(designChanges).toEqual([assetId, assetId]);
	});

	it('note (setHeight) execute and undo each publish AssetDesignChanged', async () => {
		const { reversible, assetId, seed, designChanges } = await seeded();
		await seed(drawn());
		const gesture = reversible.setHeight({ assetId, height: 900 });

		expectOk(await gesture.execute());
		expect(designChanges).toEqual([assetId]);

		expectOk(await gesture.undo());
		expect(designChanges).toEqual([assetId, assetId]);
	});

	it('background (setBackground) execute and undo each publish AssetDesignChanged', async () => {
		const { reversible, assetId, designChanges } = await seeded();
		const gesture = reversible.setBackground({ assetId, path: 'Specs/a.png', kind: 'image', page: null });

		expectOk(await gesture.execute());
		expect(designChanges).toEqual([assetId]);

		expectOk(await gesture.undo());
		expect(designChanges).toEqual([assetId, assetId]);
	});
});
