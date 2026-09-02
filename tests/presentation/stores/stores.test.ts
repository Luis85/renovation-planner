/**
 * The three Pinia stores this slice owns (SDD §14–15).
 *
 * Node, not jsdom: a store is plain reactive state, and needing a DOM to test one would
 * mean the persistent/ephemeral split had leaked into a component.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { KONVA_LAYER_IDS } from '../../../src/presentation/editor/scene/KonvaLayers';
import {
	DEFAULT_VIEWPORT,
	MAX_ZOOM,
	screenPoint,
	screenToWorld,
	STAGE_PIXELS,
	worldToScreen,
} from '../../../src/presentation/editor/viewport/Viewport';
import type { PlanEditorQueryServices } from '../../../src/presentation/read-models/planEditorQueries';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_PROJECT, FIXTURE_ZONES } from '../../helpers/planFixtures';

const READ_FAILED = { category: 'Persistence', code: 'plan.read-failed', message: 'boom' } as const;

/**
 * The one pointer every camera gesture below is made with.
 *
 * `beginPan`/`continuePan`/`endPan` each take a `pointerId` — a gesture belongs to a POINTER
 * and not only to a button, which is what stops a second finger's moves reading as a
 * continuation of the first one's drag. These cases called them with the screen point alone,
 * an arity the store has not had since that fix; what they describe is one pointer throughout,
 * so they say so. Two-pointer ownership is `canvasGestureOwnership.test.ts`'s subject.
 */
const POINTER = 1;

function queries(overrides: Partial<PlanEditorQueryServices> = {}): PlanEditorQueryServices {
	return {
		getPlan: () => Promise.resolve(ok(FIXTURE_PLAN)),
		getProject: () => Promise.resolve(ok(FIXTURE_PROJECT)),
		findZonesByPlan: () => Promise.resolve(ok({ zones: FIXTURE_ZONES, unreadable: 0 })),
		getRequirementsForZone: () => Promise.resolve(ok([])),
		listAssets: () => Promise.resolve(ok([])),
		listRequirementsReferencing: () => Promise.resolve(ok([])),
		listReassignmentTargets: () => Promise.resolve(ok([])),
		...overrides,
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('ProjectStore hydration', () => {
	it('starts idle, holding nothing', () => {
		const store = useProjectStore();

		expect(store.status).toBe('idle');
		expect(store.plan).toBeNull();
		expect(store.zones.size).toBe(0);
	});

	it('loads the plan and keys its zones by domain id', async () => {
		const store = useProjectStore();

		await store.hydrate(queries(), FIXTURE_PLAN.id);

		expect(store.status).toBe('ready');
		expect(store.plan).toEqual(FIXTURE_PLAN);
		expect([...store.zones.keys()]).toEqual(FIXTURE_ZONES.map((zone) => zone.id));
	});

	/**
	 * The distinction the query services exist to preserve. `missing` and `failed` are
	 * different states because slice 14 branches on the first and slice 17 on the second,
	 * and a store that collapsed them would make that impossible downstream.
	 */
	it('reports a plan that does not exist as missing', async () => {
		const store = useProjectStore();

		await store.hydrate(queries({ getPlan: () => Promise.resolve(ok(null)) }), 'nope');

		expect(store.status).toBe('missing');
		expect(store.error).toBeNull();
	});

	it('reports a failed plan read as failed, carrying the error', async () => {
		const store = useProjectStore();

		await store.hydrate(queries({ getPlan: () => Promise.resolve(err(READ_FAILED)) }), FIXTURE_PLAN.id);

		expect(store.status).toBe('failed');
		expect(store.error).toEqual(READ_FAILED);
	});

	it('reports a failed ZONE read as failed too, and keeps no half-loaded plan', async () => {
		const store = useProjectStore();

		await store.hydrate(
			queries({ findZonesByPlan: () => Promise.resolve(err(READ_FAILED)) }),
			FIXTURE_PLAN.id,
		);

		expect(store.status).toBe('failed');
		// The plan read SUCCEEDED here. Keeping it would draw a canvas that looks current
		// beside an error saying it is not — the worse of the two wrong answers.
		expect(store.plan).toBeNull();
		expect(store.zones.size).toBe(0);
	});

	/** Listing the zones of a plan that does not exist is a vault read with one answer. */
	it('does not ask for zones when the plan is absent', async () => {
		const findZonesByPlan = vi.fn<PlanEditorQueryServices['findZonesByPlan']>();
		const store = useProjectStore();

		await store.hydrate(queries({ getPlan: () => Promise.resolve(ok(null)), findZonesByPlan }), 'nope');

		expect(findZonesByPlan).not.toHaveBeenCalled();
	});

	/**
	 * A re-hydration must not blank a working editor: the root mounts its canvas on `ready`,
	 * so a drop to `loading` tears the Konva stage down and rebuilds it — the whole canvas
	 * flashing because one field changed. Asserted by watching the status THROUGH the call
	 * rather than after it, since after it the value is `ready` either way.
	 */
	it('stays ready while re-reading a plan it is already showing', async () => {
		const store = useProjectStore();
		await store.hydrate(queries(), FIXTURE_PLAN.id);

		const seen: string[] = [];
		const watched = queries({
			getPlan: () => {
				seen.push(store.status);
				return Promise.resolve(ok(FIXTURE_PLAN));
			},
		});
		await store.hydrate(watched, FIXTURE_PLAN.id);

		expect(seen).toEqual(['ready']);
	});

	it('does go through loading on a first load, and after a failure', async () => {
		const store = useProjectStore();
		const seen: string[] = [];
		const watched = queries({
			getPlan: () => {
				seen.push(store.status);
				return Promise.resolve(err(READ_FAILED));
			},
		});

		await store.hydrate(watched, FIXTURE_PLAN.id);
		await store.hydrate(watched, FIXTURE_PLAN.id);

		expect(seen).toEqual(['loading', 'loading']);
	});

	/**
	 * Slice 8 gave `hydrate` a SECOND concurrent caller — the post-command refresh funnel,
	 * alongside the plan-change listener, which `ProjectIndexRebuilt` fires on every leaf
	 * regardless of which plan it touched. Two overlapping hydrations resolve in whatever
	 * order the vault answers, and without a ticket the LAST assignment wins whether or not
	 * it is the freshest: a just-drawn zone disappears from the canvas with no error.
	 */
	it('a SLOW earlier hydration does not overwrite a faster later one', async () => {
		const store = useProjectStore();
		await store.hydrate(queries(), FIXTURE_PLAN.id);

		let releaseSlow!: () => void;
		const slowGate = new Promise<void>((resolve) => {
			releaseSlow = resolve;
		});
		const stalePlan = { ...FIXTURE_PLAN, name: 'the stale answer' };
		const slow = store.hydrate(
			queries({
				getPlan: () => slowGate.then(() => ok(stalePlan)),
				findZonesByPlan: () => Promise.resolve(ok({ zones: [], unreadable: 0 })),
			}),
			FIXTURE_PLAN.id,
		);

		// A second hydration starts and finishes entirely inside the first one's await.
		const fresh = { ...FIXTURE_PLAN, name: 'the fresh answer' };
		await store.hydrate(queries({ getPlan: () => Promise.resolve(ok(fresh)) }), FIXTURE_PLAN.id);
		expect(store.plan?.name).toBe('the fresh answer');

		releaseSlow();
		await slow;

		expect(store.plan?.name).toBe('the fresh answer');
		expect(store.zones.size).toBe(FIXTURE_ZONES.length);
	});

	/**
	 * The same race, gated on the PROJECT read rather than the plan read — its own
	 * `if (superseded()) return;`, right after `queries.getProject`, needs its own proof.
	 *
	 * Answering the STALE read `ok(null)` rather than a stale-but-real project is deliberate:
	 * a stale SUCCESS is still caught by the `superseded()` check after the later
	 * `findZonesByPlan` await, so mutating only this guard would not redden a case built on
	 * that path. `foundProject.value === null` calls `markMissing` and returns immediately,
	 * with no later guard behind it — so this is the one place a missing project-read guard
	 * is observable on its own: a project that vanishes on a stale read must not blank a
	 * plan a fresher hydration has already put on screen.
	 */
	it('a SLOW earlier hydration does not blank a fresher one when its project read supersedes', async () => {
		const store = useProjectStore();
		await store.hydrate(queries(), FIXTURE_PLAN.id);
		expect(store.status).toBe('ready');

		let releaseSlow!: () => void;
		const slowGate = new Promise<void>((resolve) => {
			releaseSlow = resolve;
		});
		// The slow hydration's OWN `getPlan` is the fast default, which resolves after a single
		// microtask — the same tick a synchronously-started fresh hydration bumps
		// `latestHydration` in. Without waiting for the slow hydration to actually REACH its
		// `getProject` call, starting the fresh one right away races the PLAN guard instead of
		// the PROJECT guard this case exists to exercise, and the slow read never gets far
		// enough to reach the branch under test.
		let projectReadStarted!: () => void;
		const projectReadStartedPromise = new Promise<void>((resolve) => {
			projectReadStarted = resolve;
		});
		const slow = store.hydrate(
			queries({
				getProject: () => {
					projectReadStarted();
					return slowGate.then(() => ok(null));
				},
			}),
			FIXTURE_PLAN.id,
		);
		await projectReadStartedPromise;

		// A second hydration starts and finishes entirely inside the first one's getProject await.
		await store.hydrate(queries(), FIXTURE_PLAN.id);
		expect(store.status).toBe('ready');

		releaseSlow();
		await slow;

		// The slow hydration's project vanished, but it started before the fresh one and must
		// not retroactively blank what the fresh hydration already established.
		expect(store.status).toBe('ready');
		expect(store.plan).toEqual(FIXTURE_PLAN);
	});

	it('a reset invalidates a hydration still in flight', async () => {
		// A leaf closing must not have the plan it was reading painted back a tick later.
		const store = useProjectStore();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const pending = store.hydrate(
			queries({ getPlan: () => gate.then(() => ok(FIXTURE_PLAN)) }),
			FIXTURE_PLAN.id,
		);

		store.reset();
		release();
		await pending;

		expect(store.plan).toBeNull();
		expect(store.status).toBe('idle');
	});

	it('is fully rebuildable — a reset returns it to its opening state', async () => {
		const store = useProjectStore();
		await store.hydrate(queries(), FIXTURE_PLAN.id);

		store.reset();

		expect({ status: store.status, plan: store.plan, zones: store.zones.size, error: store.error }).toEqual({
			status: 'idle',
			plan: null,
			zones: 0,
			error: null,
		});
	});

	it('hydrates the project beside the plan, so the context bar can name it', async () => {
		const store = useProjectStore();
		await store.hydrate(fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), FIXTURE_PLAN.id);
		expect(store.status).toBe('ready');
		expect(store.project?.id).toBe(FIXTURE_PLAN.projectId);
		expect(store.project?.name).toBe('Willow House');
	});

	it('fails the hydration when the project read fails, like a failed plan read', async () => {
		const store = useProjectStore();
		const failingProject = {
			...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
			getProject: () => Promise.resolve(err({ category: 'Persistence', code: 'project.read-failed', message: 'boom' } as const)),
		};
		await store.hydrate(failingProject, FIXTURE_PLAN.id);
		expect(store.status).toBe('failed');
		expect(store.error?.code).toBe('project.read-failed');
	});

	it('treats a project that no longer resolves as a missing plan', async () => {
		const store = useProjectStore();
		const danglingProject = {
			...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
			getProject: () => Promise.resolve(ok(null)),
		};
		await store.hydrate(danglingProject, FIXTURE_PLAN.id);
		expect(store.status).toBe('missing');
	});

	/**
	 * The `keepOnFailure` arm of the project read — a failed re-read after a committed
	 * write must not blank a canvas that a moment ago showed real content, mirroring the
	 * same arm the plan and zone reads already have above.
	 */
	it('a failed project re-read keeps the previous contents too, with keepPreviousOnFailure', async () => {
		const store = useProjectStore();
		await store.hydrate(fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), FIXTURE_PLAN.id);
		expect(store.status).toBe('ready');

		const failingProject = {
			...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
			getProject: () => Promise.resolve(err(READ_FAILED)),
		};
		await store.hydrate(failingProject, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });

		expect(store.status).toBe('ready');
		expect(store.plan).toEqual(FIXTURE_PLAN);
		expect(store.error).toEqual(READ_FAILED);
		expect(store.stale).toBe(true);
	});
});

describe('EditorStore, the ephemeral half', () => {
	it('opens at the default viewport with no tool, hover, drag or draft polygon', () => {
		const store = useEditorStore();

		expect(store.viewport).toEqual(DEFAULT_VIEWPORT);
		expect({
			tool: store.activeToolId,
			hover: store.hoveredObjectId,
			drag: store.dragState,
			draft: store.temporaryPolygon,
		}).toEqual({ tool: null, hover: null, drag: null, draft: null });
	});

	it('zooms about an anchor through the shared transform, not arithmetic of its own', () => {
		const store = useEditorStore();
		const anchor = screenPoint(120, 90);
		const worldBefore = screenToWorld(anchor, store.viewport, STAGE_PIXELS);

		store.zoomAt(anchor, 2);

		expect(store.viewport.zoom).toBe(2);
		expect(screenToWorld(anchor, store.viewport, STAGE_PIXELS)).toEqual(worldBefore);
	});

	it('clamps a keyboard zoom at the ceiling', () => {
		const store = useEditorStore();
		for (let press = 0; press < 100; press += 1) store.zoomByFactor(screenPoint(0, 0), 1.2);

		expect(store.viewport.zoom).toBe(MAX_ZOOM);
	});

	/**
	 * A pan is computed from the viewport the GESTURE started at plus the total pointer
	 * displacement — never accumulated per move. Driven by comparing a drag delivered in two
	 * steps against the same drag delivered in one: they land in the same place only if each
	 * move is measured against the gesture's origin. An accumulating implementation passes
	 * every single-move test and drifts on a real drag, which is a slow, unattributable bug.
	 */
	it('pans from where the gesture started, so a long drag does not drift', () => {
		const store = useEditorStore();

		store.beginPan(screenPoint(100, 100), POINTER);
		store.continuePan(screenPoint(150, 100), POINTER);
		store.continuePan(screenPoint(200, 100), POINTER);
		const inTwoSteps = store.viewport.pan;

		// A FRESH pinia, so the second gesture starts from the same camera as the first. There
		// is deliberately no `setViewport` action to reset with: an exported setter nothing in
		// src/ calls is dead code by this project own gate.
		setActivePinia(createPinia());
		const second = useEditorStore();
		second.beginPan(screenPoint(100, 100), POINTER);
		second.continuePan(screenPoint(200, 100), POINTER);

		expect(second.viewport.pan).toEqual(inTwoSteps);
		expect(second.dragState).not.toBeNull();
	});

	it('forgets the gesture when it ends', () => {
		const store = useEditorStore();
		store.beginPan(screenPoint(0, 0), POINTER);

		store.endPan(POINTER);

		expect(store.dragState).toBeNull();
	});

	it('ignores a move with no gesture running, and says so', () => {
		const store = useEditorStore();
		const before = store.viewport;

		expect(store.continuePan(screenPoint(10, 10), POINTER)).toBe(false);
		expect(store.viewport).toBe(before);
	});

	it('reports a move as consumed while a gesture is running', () => {
		const store = useEditorStore();
		store.beginPan(screenPoint(0, 0), POINTER);

		expect(store.continuePan(screenPoint(10, 10), POINTER)).toBe(true);
	});

	it('translates the pointer into world millimetres, and blanks it on leave', () => {
		const store = useEditorStore();
		// Zoomed about the stage origin, which leaves the pan alone — so the viewport below is
		// the default pan at zoom 2, and the expected world position is arithmetic a reader can
		// do rather than a second call to the function under test.
		store.zoomAt(screenPoint(0, 0), 2);

		store.setPointer(screenPoint(40, 60));
		expect(store.pointerWorld).toEqual({
			x: 40 / 2 + DEFAULT_VIEWPORT.pan.x,
			y: 60 / 2 + DEFAULT_VIEWPORT.pan.y,
		});

		store.setPointer(null);
		expect(store.pointerWorld).toBeNull();
	});

	/*
	 * The readout is a function of the pointer AND the camera, so it goes stale when EITHER
	 * moves. These two cases are the camera half, and they are what a stored world point
	 * cannot satisfy: the keyboard zoom anchors at the stage centre, so the world position
	 * under a stationary pointer really does change, and a pan is defined by holding one
	 * world point under the cursor.
	 */
	it('follows a camera change under a stationary pointer', () => {
		const store = useEditorStore();
		const at = screenPoint(40, 60);
		store.setPointer(at);

		// Anchored away from the pointer, which is what the `+`/`-` keys do — they zoom about
		// the middle of the stage, since a keypress carries no pointer position of its own.
		store.zoomByFactor(screenPoint(0, 0), 2);

		expect(store.pointerWorld).toEqual(screenToWorld(at, store.viewport, STAGE_PIXELS));
	});

	it('holds one world point under the cursor for the whole of a pan', () => {
		const store = useEditorStore();
		const grab = screenPoint(40, 60);
		store.setPointer(grab);
		const grabbed = store.pointerWorld;
		store.beginPan(grab, POINTER);

		const to = screenPoint(140, 10);
		store.setPointer(to);
		store.continuePan(to, POINTER);

		// Panning MEANS the world sticks to the cursor, so the readout must not move at all.
		expect(store.pointerWorld).toEqual(grabbed);
	});
});

describe('WorkspaceStore, the editor chrome', () => {
	it('opens with both panels open and every layer visible', () => {
		const store = useWorkspaceStore();

		expect([store.layersPanelOpen, store.inspectorPanelOpen]).toEqual([true, true]);
		expect(Object.keys(store.layerVisibility)).toEqual([...KONVA_LAYER_IDS]);
		expect(Object.values(store.layerVisibility).every(Boolean)).toBe(true);
	});

	it('toggles a layer without touching its siblings', () => {
		const store = useWorkspaceStore();

		store.toggleLayer('zone');

		expect(store.layerVisibility.zone).toBe(false);
		expect(store.layerVisibility.background).toBe(true);
	});

	/**
	 * The record is REPLACED rather than written into, so anything watching the whole map
	 * sees one reactive event per change. Checked by identity, which is the only way to tell
	 * a replacement from a mutation.
	 */
	it('replaces the visibility record rather than mutating it', () => {
		const store = useWorkspaceStore();
		const before = store.layerVisibility;

		store.toggleLayer('asset');

		expect(store.layerVisibility).not.toBe(before);
	});

	it('toggles each panel independently', () => {
		const store = useWorkspaceStore();

		store.toggleLayersPanel();

		expect([store.layersPanelOpen, store.inspectorPanelOpen]).toEqual([false, true]);

		store.toggleInspectorPanel();

		expect([store.layersPanelOpen, store.inspectorPanelOpen]).toEqual([false, false]);
	});
});

describe('EditorStore camera actions added for canvas navigation', () => {
	it('nudges the camera by a screen delta, for the wheel gestures that are not a zoom', () => {
		// Shift+wheel is a horizontal PAN in Obsidian's own Canvas, and a wheel notch is a
		// screen-pixel quantity like a drag is. Converting it here rather than at the call
		// site keeps the camera's arithmetic in the one place that owns it.
		const store = useEditorStore();
		const before = store.viewport;

		store.panByScreen(60, 0);

		expect(store.viewport.zoom).toBe(before.zoom);
		expect(store.viewport.pan.x).toBeCloseTo(before.pan.x - 60 / before.zoom, 9);
		expect(store.viewport.pan.y).toBe(before.pan.y);
	});

	it('fits an extent into the pane', () => {
		const store = useEditorStore();

		store.fitTo({ min: { x: 0, y: 0 }, max: { x: 4000, y: 2000 } }, { width: 800, height: 600 });

		// The whole extent lands on screen, centred — the property `fitViewport` is tested for
		// directly; what this asserts is that the STORE actually adopted its answer.
		const centre = worldToScreen({ x: 2000, y: 1000 }, store.viewport, STAGE_PIXELS);
		expect(centre.x).toBeCloseTo(400, 6);
		expect(centre.y).toBeCloseTo(300, 6);
		expect(store.viewport).not.toEqual(DEFAULT_VIEWPORT);
	});

	it('keeps the camera it has when the pane has no area yet', () => {
		// The stage measures 0 x 0 until layout runs, so a fit asked in that window has
		// nowhere to put the plan. Leaving the camera alone is the honest outcome; adopting
		// `fitViewport`'s `null` would blank the view on an ordinary early call.
		const store = useEditorStore();

		store.fitTo({ min: { x: 0, y: 0 }, max: { x: 4000, y: 2000 } }, { width: 0, height: 0 });

		expect(store.viewport).toEqual(DEFAULT_VIEWPORT);
	});
});

describe('EditorStore pan ownership', () => {
	/**
	 * A drag belongs to the pointer that began it. On a mouse this is invisible — one
	 * `pointerId` is shared across every button — but the manifest promises mobile
	 * (`isDesktopOnly: false`) and camera mode is the DEFAULT state, so a second finger on a
	 * tablet lands here rather than in the pan override.
	 */
	it('ignores a move from a pointer that did not begin the drag', () => {
		const store = useEditorStore();
		store.beginPan(screenPoint(100, 100), 11);
		store.continuePan(screenPoint(140, 100), 11);
		const afterOwner = store.viewport.pan.x;

		expect(store.continuePan(screenPoint(600, 100), 12)).toBe(false);
		expect(store.viewport.pan.x).toBe(afterOwner);
	});

	it('still follows the pointer that did', () => {
		const store = useEditorStore();
		store.beginPan(screenPoint(100, 100), 11);

		expect(store.continuePan(screenPoint(140, 100), 11)).toBe(true);
		expect(store.viewport.pan.x).toBeCloseTo(DEFAULT_VIEWPORT.pan.x - 40 / DEFAULT_VIEWPORT.zoom, 6);
	});

	it('consumes nothing when no drag is running', () => {
		expect(useEditorStore().continuePan(screenPoint(1, 1), 11)).toBe(false);
	});

	it('ignores a RELEASE from a pointer that did not begin the drag', () => {
		// The other half, and the one a first pass misses: a second finger lifting ended the
		// first finger's drag, so the pan stopped dead while the hand making it was still
		// moving. Found by a canvas-level case rather than by reasoning about this store.
		const store = useEditorStore();
		store.beginPan(screenPoint(100, 100), 11);

		expect(store.endPan(12)).toBe(false);
		expect(store.continuePan(screenPoint(140, 100), 11)).toBe(true);
	});

	it('ends on the release from the pointer that did', () => {
		const store = useEditorStore();
		store.beginPan(screenPoint(100, 100), 11);

		expect(store.endPan(11)).toBe(true);
		expect(store.continuePan(screenPoint(140, 100), 11)).toBe(false);
	});

	it('abandons a drag whatever pointer owns it', () => {
		// `pointercancel`, `pointerleave` and focus loss name no owner — the gesture is simply
		// over. Separate from `endPan` rather than reached by omitting its argument, so that
		// no caller gets "end whatever is running" by accident.
		const store = useEditorStore();
		store.beginPan(screenPoint(100, 100), 11);

		store.abandonPan();

		expect(store.continuePan(screenPoint(140, 100), 11)).toBe(false);
	});
});
