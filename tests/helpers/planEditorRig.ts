/**
 * The wired Plan Editor, mounted for real — real Vue, real Pinia, real Konva, the real
 * toolbar/canvas/inspector wiring — against in-memory repositories, so a drawn zone is
 * genuinely written and a refresh genuinely re-reads what was written.
 *
 * Extracted from `zoneEditing.test.ts` when a second suite needed the same rig, which is
 * also what took that file back under the tests line budget. Two suites, one fixture: a
 * geometry or wiring change lands once.
 *
 * Geometry note: `DEFAULT_ZOOM` is 0.1 with a 48 px margin, so world = 10 × screen − 480
 * per axis at the default camera. The fixture zone's world rect (1500..4400)² therefore
 * has the screen footprint (198,198)-(488,388), inside the 800×600 stage.
 */
import { mountPlanEditor, type EditorHarness } from './editor';
import { expectOk } from './domain';
import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import { MoveSpatialObjectCommand } from '../../src/application/commands/zone/MoveSpatialObject';
import { dispatchingEventBus, makeDeleteZoneCommand } from './slice10';
import { RecalculateRequirementCommand } from '../../src/application/commands/requirement/RecalculateRequirement';
import { registerOnZoneGeometryChanged } from '../../src/application/event-handlers/requirement/onZoneGeometryChanged';
import { registerOnAssetUpdated } from '../../src/application/event-handlers/requirement/onAssetUpdated';
import { AssignAssetCommand } from '../../src/application/commands/requirement/AssignAsset';
import { SetRequirementQuantityOverrideCommand } from '../../src/application/commands/requirement/SetRequirementQuantityOverride';
import { SetRequirementCostOverrideCommand } from '../../src/application/commands/requirement/SetRequirementCostOverride';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import { recorder } from './logger';
import { GetRequirementsForZone } from '../../src/application/queries/GetRequirementsForZone';
import { ListAssets } from '../../src/application/queries/ListAssets';
import { ListRequirementsReferencing } from '../../src/application/queries/ListRequirementsReferencing';
import { ListReassignmentTargets } from '../../src/application/queries/ListReassignmentTargets';
import { GetZoneInspector } from '../../src/application/queries/GetZoneInspector';
import { FindZonesByPlan } from '../../src/application/queries/FindZonesByPlan';
import { GetPlan } from '../../src/application/queries/GetPlan';
import { createPlanEditorQueries } from '../../src/presentation/read-models/planEditorQueries';
import type { PlanDto, ZoneDto } from '../../src/presentation/read-models/PlanDto';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryAssetRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { makePlan, makeZone } from './entities';
import type { PlanId } from '../../src/domain/plan/PlanId';
import { createProjectId } from '../../src/domain/project/ProjectId';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import { createPolygon } from '../../src/core/geometry/Polygon';

export const PROJECT_ID = createProjectId();
export const PLAN_DTO: PlanDto = {
	id: 'plan-e2e',
	projectId: PROJECT_ID,
	name: 'Ground floor',
	background: null,
	layers: [],
};

/** World rect (1500..4400)² — screen footprint (198,198)-(488,388) at the default camera. */
export const ZONE_A_DTO: ZoneDto = {
	id: 'zone-a',
	planId: PLAN_DTO.id,
	name: 'Kitchen',
	zoneType: 'Room',
	status: 'Planned',
	points: [
		{ x: 1500, y: 1500 },
		{ x: 4400, y: 1500 },
		{ x: 4400, y: 3400 },
		{ x: 1500, y: 3400 },
	],
};

export interface Rig {
	harness: EditorHarness;
	zonesRepo: InMemoryZoneRepository;
	assetsRepo: InMemoryAssetRepository;
	requirementsRepo: InMemoryRequirementRepository;
}

export async function rig(seed?: (repos: {
	assets: InMemoryAssetRepository;
	requirements: InMemoryRequirementRepository;
	zones: InMemoryZoneRepository;
}) => Promise<void>): Promise<Rig> {
	const plans = new InMemoryPlanRepository();
	const plan = makePlan({ projectId: PROJECT_ID, id: PLAN_DTO.id as PlanId });
	await plans.save(plan, 'absent');
	const zonesRepo = new InMemoryZoneRepository();
	const geometry = expectOk(createPolygon(ZONE_A_DTO.points));
	const zoneA = makeZone({
		projectId: PROJECT_ID,
		planId: plan.id,
		id: 'zone-a' as ZoneId,
		name: ZONE_A_DTO.name,
		zoneType: 'Room',
		status: 'Planned',
		geometry,
	});
	await zonesRepo.save(zoneA, 'absent');

	// Slice 10's catalog and links, wired for real so the Requirements panel's rows and
	// its assign/override controls drive actual repositories through the ONE dispatcher.
	const assetsRepo = new InMemoryAssetRepository();
	const requirementsRepo = new InMemoryRequirementRepository();
	const locks = new ReferenceLocks();
	// A DISPATCHING bus, not a recording one. `RecordingEventBus.subscribe` discards its
	// handler, so a rig built on it has no recalculation cascade at all — every
	// geometry-driven figure on the panel would be as stale as the day it was written and
	// no assertion here could see it. The composition root registers exactly the two
	// handlers below; a rig that registered neither is a fake kinder than the real app.
	const events = dispatchingEventBus();
	const recalculate = new RecalculateRequirementCommand(requirementsRepo, zonesRepo, assetsRepo, events);
	registerOnZoneGeometryChanged(events, {
		requirements: requirementsRepo,
		events,
		logger: recorder,
		recalculate: (input) => recalculate.execute({ requirementId: input.requirementId as never }),
	});
	registerOnAssetUpdated(events, {
		requirements: requirementsRepo,
		assets: assetsRepo,
		events,
		logger: recorder,
		recalculate: (input) => recalculate.execute({ requirementId: input.requirementId as never }),
	});

	const queries = createPlanEditorQueries({
		getPlan: new GetPlan(plans),
		findZonesByPlan: new FindZonesByPlan(zonesRepo),
		getRequirementsForZone: new GetRequirementsForZone(requirementsRepo, zonesRepo, assetsRepo),
		listAssets: new ListAssets(assetsRepo),
		listRequirementsReferencing: new ListRequirementsReferencing(requirementsRepo),
		listReassignmentTargets: new ListReassignmentTargets(zonesRepo, assetsRepo),
	});
	const commands = {
		createZone: new CreateZoneCommand(zonesRepo, plans, events),
		moveObject: new MoveSpatialObjectCommand(zonesRepo, events),
		// The SAME requirement repository and lock set the panel's assign control writes
		// through: a delete command with a private one of each would never see a referent
		// this rig just created, and every reference-integrity assertion driven through the
		// real editor would pass against a zone nothing references.
		deleteZone: makeDeleteZoneCommand(zonesRepo, events, requirementsRepo, locks),
		zones: zonesRepo,
		zoneInspector: new GetZoneInspector(zonesRepo),
		requirementEdits: {
			assignAsset: new AssignAssetCommand(zonesRepo, assetsRepo, requirementsRepo, events, locks),
			setQuantityOverride: new SetRequirementQuantityOverrideCommand(requirementsRepo, events, locks),
			setCostOverride: new SetRequirementCostOverrideCommand(requirementsRepo, events, locks),
			requirements: requirementsRepo,
			assets: assetsRepo,
			locks,
		},
		logger: recorder,
	};

	if (seed) {
		await seed({ assets: assetsRepo, requirements: requirementsRepo, zones: zonesRepo });
	}

	const harness = await mountPlanEditor({
		plan: PLAN_DTO,
		zones: [ZONE_A_DTO],
		queries,
		commands,
	});
	return { harness, zonesRepo, assetsRepo, requirementsRepo };
}

export function pointer(element: HTMLElement, type: string, x: number, y: number, button = 0): void {
	element.dispatchEvent(
		new PointerEvent(type, { button, clientX: x, clientY: y, bubbles: true }),
	);
}

/**
 * A real CLICK: down AND up at the same pixel. The rig deliberately never sends a bare
 * `pointerdown` without its `pointerup` — a real mouse cannot do it, and the first
 * review pass caught Escape-cancels-drawing being certified by exactly that impossible
 * sequence. A drag is spelled `pointer(down, move…, up)`; everything else is clicks.
 */
export function click(element: HTMLElement, x: number, y: number, button = 0): void {
	pointer(element, 'pointerdown', x, y, button);
	pointer(element, 'pointerup', x, y, button);
}


export function toolbarButton(harness: EditorHarness, label: string): HTMLButtonElement {
	const buttons = harness.wrapper.findAll('button');
	const found = buttons.find((button) => button.text() === label);
	if (found === undefined) throw new Error(`no toolbar button labelled ${label}`);
	return found.element as HTMLButtonElement;
}

