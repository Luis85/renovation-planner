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
import { expectOk, RecordingEventBus } from './domain';
import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import { DeleteZoneCommand } from '../../src/application/commands/zone/DeleteZone';
import { MoveSpatialObjectCommand } from '../../src/application/commands/zone/MoveSpatialObject';
import { GetZoneInspector } from '../../src/application/queries/GetZoneInspector';
import { FindZonesByPlan } from '../../src/application/queries/FindZonesByPlan';
import { GetPlan } from '../../src/application/queries/GetPlan';
import { createPlanEditorQueries } from '../../src/presentation/read-models/planEditorQueries';
import type { PlanDto, ZoneDto } from '../../src/presentation/read-models/PlanDto';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
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
}

export async function rig(): Promise<Rig> {
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

	const events = new RecordingEventBus();
	const queries = createPlanEditorQueries({
		getPlan: new GetPlan(plans),
		findZonesByPlan: new FindZonesByPlan(zonesRepo),
	});
	const commands = {
		createZone: new CreateZoneCommand(zonesRepo, plans, events),
		moveObject: new MoveSpatialObjectCommand(zonesRepo, events),
		deleteZone: new DeleteZoneCommand(zonesRepo, events),
		zones: zonesRepo,
		zoneInspector: new GetZoneInspector(zonesRepo),
	};

	const harness = await mountPlanEditor({
		plan: PLAN_DTO,
		zones: [ZONE_A_DTO],
		queries,
		commands,
	});
	return { harness, zonesRepo };
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

