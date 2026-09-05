/**
 * `EditorStore` (the ephemeral camera/tool half) and `WorkspaceStore` (the editor chrome) —
 * SDD §14–15. `ProjectStore` — hydration, `refreshing`/`retriesFailed`, `reset()` — moved to
 * `projectStore.test.ts` once this file crossed its 450-line cap.
 *
 * Node, not jsdom: a store is plain reactive state, and needing a DOM to test one would
 * mean the persistent/ephemeral split had leaked into a component.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
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

beforeEach(() => {
	setActivePinia(createPinia());
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
		expect(store.stageSize).toEqual({ width: 0, height: 0 });
	});

	/**
	 * `stageSize` (design slice 12) is `EditorSurface`'s own measured size, written from its
	 * resize observer at the same place it sets its local `size` ref — a store field rather
	 * than a second prop path, because `selectAndFrame` reaches it from the Inspector's room
	 * list, nowhere near the surface's own prop chain.
	 */
	it('holds the stage size the surface last measured', () => {
		const store = useEditorStore();

		store.setStageSize({ width: 800, height: 600 });

		expect(store.stageSize).toEqual({ width: 800, height: 600 });
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
	it('opens in full layout, with no overlay and every layer visible', () => {
		const store = useWorkspaceStore();

		expect([store.layoutMode, store.overlay]).toEqual(['full', 'none']);
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

	/**
	 * 'toggles each panel independently' stood here, and it was the ONLY caller of
	 * `toggleLayersPanel`/`toggleInspectorPanel` outside their own definitions — direct store
	 * calls standing in for a control §5.6 never built. Both actions and both booleans are
	 * deleted (2026-09-04, R11); the shell renders both full-mode panels unconditionally, and
	 * `shell.test.ts`'s five-regions case is what proves they still compose.
	 */
	it('opens one overlay at a time and closes it when the layout leaves constrained', () => {
		const workspace = useWorkspaceStore();
		workspace.setLayoutMode('constrained');
		workspace.openOverlay('layers');
		expect(workspace.overlay).toBe('layers');
		workspace.openOverlay('inspector');
		expect(workspace.overlay).toBe('inspector');
		workspace.setLayoutMode('full');
		expect(workspace.overlay).toBe('none');
	});

	it('resets layout mode and overlay with everything else', () => {
		const workspace = useWorkspaceStore();
		workspace.setLayoutMode('constrained');
		workspace.openOverlay('layers');
		workspace.reset();
		expect(workspace.layoutMode).toBe('full');
		expect(workspace.overlay).toBe('none');
	});

	it('keeps the overlay open when staying in constrained mode, and closes it with closeOverlay()', () => {
		const workspace = useWorkspaceStore();
		workspace.setLayoutMode('constrained');
		workspace.openOverlay('layers');
		expect(workspace.overlay).toBe('layers');

		// Staying in constrained mode keeps the overlay open
		workspace.setLayoutMode('constrained');
		expect(workspace.overlay).toBe('layers');

		// closeOverlay() closes it
		workspace.closeOverlay();
		expect(workspace.overlay).toBe('none');
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
