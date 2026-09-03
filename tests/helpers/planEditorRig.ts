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
import type Konva from 'konva';
import { mountPlanEditor, runtimeOf, type EditorHarness } from './editor';
import type { ToolId } from '../../src/presentation/editor/tools/editor-tool';
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
import { GetProject } from '../../src/application/queries/GetProject';
import { createPlanEditorQueries } from '../../src/presentation/read-models/planEditorQueries';
import type { PlanDto, ZoneDto } from '../../src/presentation/read-models/PlanDto';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryAssetRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryProjectRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { projectFolderOf } from '../../src/infrastructure/obsidian/repositories/paths';
import { makePlan, makeProject, makeZone } from './entities';
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
	// Uncalibrated, like `planFixtures.ts`'s — absent until `tests/**` was type-checked, on a
	// literal annotated `PlanDto` with the field required.
	calibration: null,
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

/**
 * An `InMemoryProjectRepository` holding just the fixture project at `PROJECT_ID` — for a
 * spot that needs a real `GetProject` behind `createPlanEditorQueries` but not the whole
 * `rig()`, so it does not duplicate this same three-line seed at each call site.
 */
export async function projectRepoWithFixture(): Promise<InMemoryProjectRepository> {
	const projects = new InMemoryProjectRepository();
	await projects.save(makeProject({ id: PROJECT_ID }), 'absent');
	return projects;
}

/**
 * The three-repository `createPlanEditorQueries` call two rigs outside this file build by
 * hand — extracted so a caller wiring its own `plans`/`projects`/`zonesRepo` (rather than
 * going through `rig()`) states that in one line instead of five.
 */
export function planEditorQueriesFor(
	plans: InMemoryPlanRepository,
	projects: InMemoryProjectRepository,
	zonesRepo: InMemoryZoneRepository,
) {
	return createPlanEditorQueries({
		getPlan: new GetPlan(plans),
		getProject: new GetProject(projects),
		findZonesByPlan: new FindZonesByPlan(zonesRepo),
	});
}

export async function rig(seed?: (repos: {
	assets: InMemoryAssetRepository;
	requirements: InMemoryRequirementRepository;
	zones: InMemoryZoneRepository;
}) => Promise<void>): Promise<Rig> {
	const plans = new InMemoryPlanRepository();
	// The project this rig's plan belongs to, seeded and INDEXED the way the composition root
	// has both: since slice 19 `ListRequirementsReferencing` names each referent group after
	// its project and resolves that project's folder, so a rig with neither would be a fake
	// thinner than the app it stands for.
	const projects = new InMemoryProjectRepository();
	const project = makeProject({ id: PROJECT_ID, name: 'Kitchen refit' });
	await projects.save(project, 'absent');
	const index = new InMemoryProjectIndex();
	index.upsert({
		id: PROJECT_ID,
		type: 'renovation-project',
		path: 'Renovation/Kitchen refit/Project.md',
		projectId: PROJECT_ID,
	});
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
	const recalculate = new RecalculateRequirementCommand(requirementsRepo, zonesRepo, assetsRepo, events, projects);
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
		getProject: new GetProject(projects),
		findZonesByPlan: new FindZonesByPlan(zonesRepo),
		getRequirementsForZone: new GetRequirementsForZone(requirementsRepo, zonesRepo, assetsRepo, projects),
		listAssets: new ListAssets(assetsRepo),
		listRequirementsReferencing: new ListRequirementsReferencing(
			requirementsRepo,
			projects,
			(projectId) => projectFolderOf(index, projectId),
		),
		listReassignmentTargets: new ListReassignmentTargets(zonesRepo, assetsRepo),
	});
	const commands = {
		createZone: new CreateZoneCommand(zonesRepo, plans, events),
		moveObject: new MoveSpatialObjectCommand(zonesRepo, events),
		// The SAME requirement repository and lock set the panel's assign control writes
		// through: a delete command with a private one of each would never see a referent
		// this rig just created, and every reference-integrity assertion driven through the
		// real editor would pass against a zone nothing references.
		deleteZone: makeDeleteZoneCommand(zonesRepo, events, requirementsRepo, locks, projects),
		zones: zonesRepo,
		zoneInspector: new GetZoneInspector(zonesRepo),
		// A FACTORY, as the interface requires, and one that REFUSES TO BE USED — deliberately,
		// loudly, and after two rounds of trying to make it work.
		//
		// This rig cannot represent a calibration, and the reason is structural rather than a
		// missing line. In production the geometry sidecar IS the source of truth for a plan's
		// calibration and its zone coordinates, joined back by `ObsidianPlanRepository.getById`
		// and `ObsidianZoneRepository`. This rig runs on the IN-MEMORY repositories, which hold
		// no sidecar and perform no such join — so a calibration written to a sidecar here is
		// invisible to the `GetPlan`/`FindZonesByPlan` reads the post-command refresh makes, and
		// invisible to the geometry cascade that recalculates requirements from a zone's area.
		//
		// The two attempts before this one are why the remedy is a throw rather than a wiring:
		//   - the real command over an EMPTY sidecar refused every gesture with
		//     `test.injected-failure`, because `read` answers that for an unknown plan;
		//   - the real command over a SEEDED one succeeded — measured, `{ ok: true, value:
		//     'wrote' }` — and left every reader in the editor showing the pre-calibration plan.
		// The second is the worse failure: a test could assert the command succeeded and believe
		// this rig calibrates. Both were found by review rather than by any gate, because no test
		// completes a calibration through this rig — `calibrateWiring.test.ts` builds its own
		// recording factory for that, and `interactionLayer.test.ts` places only the first point.
		//
		// So the honest stand-in is one that cannot be mistaken for either a refusal or a
		// success. Whoever first completes a calibration here gets this sentence instead of a
		// misleading green, and their next move is to give the rig the sidecar join — which is a
		// change to the repositories the rig composes, not to this line.
		calibratePlan: (): never => {
			throw new Error(
				'planEditorRig does not model the geometry sidecar join, so it cannot calibrate. ' +
					'Wire the in-memory repositories to a shared PlanGeometryDocument first, or build ' +
					'a recording factory in your own suite the way calibrateWiring.test.ts does.',
			);
		},
		requirementEdits: {
			assignAsset: new AssignAssetCommand({
				zones: zonesRepo,
				assets: assetsRepo,
				requirements: requirementsRepo,
				events,
				locks,
				projects,
			}),
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

/**
 * The `PointerEvent.buttons` bit each `button` number stands for, per the DOM's own table —
 * including the three beyond the familiar ones, because a mouse's Back and Forward buttons
 * and a pen's eraser are real inputs a canvas has to decline rather than mishandle.
 */
const BUTTONS_BIT: Record<number, number> = { 0: 1, 1: 4, 2: 2, 3: 8, 4: 16, 5: 32 };

/**
 * One pointer event, with `buttons` DERIVED rather than left at jsdom's zero.
 *
 * A real device never sends a move with no bit set while a button is held, and the canvas
 * now reads exactly that bitmask to notice a button released inside a chord — so a rig that
 * left `buttons` at its default would be a fake kinder than the real thing at the one field
 * the routing depends on. The default is what the named button implies: the bit for a press
 * or a move, nothing for a release, which is what the spec says a `pointerup` reports.
 *
 * `buttons` is a parameter as well, because a CHORD is exactly the case the default cannot
 * express: pressing a second button while the first is held arrives as a `pointermove`
 * naming the button that CHANGED and carrying every bit still down.
 */
export function pointer(
	element: HTMLElement,
	type: string,
	x: number,
	y: number,
	button = 0,
	pointerId = 1,
	buttons = type === 'pointerup' || type === 'pointercancel' ? 0 : (BUTTONS_BIT[button] ?? 0),
): void {
	element.dispatchEvent(
		new PointerEvent(type, { button, buttons, pointerId, clientX: x, clientY: y, bubbles: true }),
	);
}

/**
 * A CHORDED button change, which on a mouse is the only shape one can have.
 *
 * W3C Pointer Events, "chorded button interactions": `pointerdown` fires only on the
 * transition from no buttons to some, and `pointerup` only when the LAST button comes up.
 * Every button change in between is a `pointermove` whose `button` names what changed and
 * whose `buttons` carries what is still held. Several cases in this suite used to synthesize
 * a second `pointerdown` and an early `pointerup` instead — an event stream no mouse can
 * produce, and one that hid the defect this helper exists to reach.
 */
export function chord(
	element: HTMLElement,
	x: number,
	y: number,
	changed: number,
	held: number,
	pointerId = 1,
): void {
	pointer(element, 'pointermove', x, y, changed, pointerId, held);
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


/**
 * A button anywhere in the mounted tree, found by its exact text — Task 13 retired the
 * toolbar this was named for, and the shell now spreads its actions across the context bar,
 * the floating Select/Add group and the Inspector's own Delete button, so this searches the
 * whole wrapper rather than one region.
 */
export function actionButton(harness: EditorHarness, label: string): HTMLButtonElement {
	const buttons = harness.wrapper.findAll('button');
	const found = buttons.find((button) => button.text() === label);
	if (found === undefined) throw new Error(`no button labelled ${label}`);
	return found.element as HTMLButtonElement;
}

/**
 * Activates a tool through the runtime directly, for Pan/Draw zone/Calibrate — the three
 * gestures Task 13's shell offers no button for any more (`null` is camera mode/Pan;
 * `draw-polygon` is Draw zone; `calibrate` reaches the tool Task 14 gives its own door).
 * Select, Undo, Redo and Delete zone still have real buttons and go through `actionButton`.
 */
export function activateTool(harness: EditorHarness, id: ToolId | null): void {
	runtimeOf(harness).setTool(id);
}


/**
 * Everything the interaction layer is drawing, as one comparable snapshot.
 *
 * Deliberately not "find the preview line": during a body drag that layer holds the
 * translated ghost AND the selection outline, and picking one out by template order is a
 * dependency on the order of a `<template>` rather than on behaviour. Comparing the whole
 * set is both simpler and a stronger claim — an interruption changes NOTHING that is drawn,
 * not merely nothing about the one node a case thought to name.
 *
 * Shared rather than copied: it was written for `canvasGestureOwnership.test.ts` and wanted
 * verbatim by `canvasKeyboardGestures.test.ts` the moment a second door replayed a stale
 * move, which is a second derivation of one question about one layer.
 */
export function drawnLines(stage: Konva.Stage | null): readonly (readonly number[])[] {
	const layer = stage?.findOne<Konva.Layer>('.interaction');
	if (layer === undefined) throw new Error('expected an interaction layer');
	return layer.find('Line').map((line) => (line as Konva.Line).points());
}
