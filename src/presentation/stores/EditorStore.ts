import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Point } from '../../core/geometry/Point';
import {
	DEFAULT_VIEWPORT,
	panBy,
	screenToWorld,
	STAGE_PIXELS,
	zoomAbout,
	type ScreenPoint,
	type Viewport,
} from '../editor/viewport/Viewport';
/**
 * The vocabulary for `activeToolId` below — the typed SLOT for whichever `EditorTool` is
 * active, so that adding tools does not change this store's shape. Always `null` today:
 * nothing constructs a `ToolManager`, so nothing writes to that slot.
 *
 * Design slice 6's real union, IMPORTED rather than restated. This file used to declare a
 * local `type ToolId = string` with a note saying slice 6 would export the union "in the
 * change that gives it a caller" — slice 6 did export it (`editor-tool.ts`) and left the
 * local alias standing, so `presentation/` briefly held two different types of that name
 * for one concept. One import is the whole fix: a tool id this store can hold is now
 * exactly one the framework can register.
 */
import type { ToolId } from '../editor/tools/editor-tool';

/**
 * A gesture in progress. There is exactly one today — the camera pan — and whichever slice
 * ships a concrete tool that drags (slice 7's calibration, slice 8's zone editing) widens
 * the union with its own. Slice 6 built the tool framework but no tool, so it added none.
 * The `kind` discriminator is here from the start for that reason: a single-shape "drag
 * state" would have to be replaced rather than extended.
 *
 * NOT exported: an export with no consumer is dead code by this project's own gate
 * (`npm run analyze`), and "a later slice will want it" is exactly the argument that gate
 * refuses.
 *
 * It holds the viewport the gesture STARTED from, not a running total, so a pan is
 * computed from the original camera and the total pointer displacement. Accumulating
 * per-move deltas instead would drift, and drift in a camera is the kind of defect that
 * only shows up after a long drag.
 */
type DragState = {
	readonly kind: 'pan';
	readonly originScreen: ScreenPoint;
	readonly originViewport: Viewport;
};

/**
 * Editor-scoped EPHEMERAL state (SDD §15). Nothing here is persisted and nothing here is
 * canonical: a Plan Editor closed and reopened resets all of it, which is why the SDD
 * gives no requirement to remember a per-plan camera across sessions.
 *
 * This store defines the shape and drives only the viewport half; the rest is inert until
 * a concrete tool starts writing into it. Slice 6 added the framework a tool plugs into
 * (`EditorTool`, `ToolManager`, `CommandHistory`, `EditorContext`) and no tool, and wired
 * none of it into the composition root, so nothing here gained a writer.
 */
export const useEditorStore = defineStore('editor', () => {
	const viewport = ref<Viewport>(DEFAULT_VIEWPORT);
	const activeToolId = ref<ToolId | null>(null);
	const hoveredObjectId = ref<string | null>(null);
	const dragState = ref<DragState | null>(null);
	const temporaryPolygon = ref<readonly Point[] | null>(null);

	/**
	 * The last pointer position, in world millimetres — what the status bar's measurements
	 * readout shows. Read-only telemetry: it demonstrates the viewport transform working
	 * without any editable state behind it.
	 */
	const pointerWorld = ref<Point | null>(null);

	/** Wheel zoom, centred on the pointer so what is under it stays under it. */
	function zoomAt(anchor: ScreenPoint, nextZoom: number): void {
		viewport.value = zoomAbout(viewport.value, anchor, nextZoom);
	}

	/**
	 * Keyboard zoom (`+`/`-`), centred on a caller-supplied anchor — normally the middle of
	 * the stage, since there is no pointer involved. §85 asks for keyboard-accessible
	 * controls, and the wheel is the only interaction this slice adds.
	 */
	function zoomByFactor(anchor: ScreenPoint, factor: number): void {
		viewport.value = zoomAbout(viewport.value, anchor, viewport.value.zoom * factor);
	}

	function beginPan(at: ScreenPoint): void {
		dragState.value = { kind: 'pan', originScreen: at, originViewport: viewport.value };
	}

	/**
	 * Answers whether the move was consumed, so the caller does not have to re-inspect
	 * `dragState` to find out — the store is the one place that knows whether a gesture is
	 * running.
	 */
	function continuePan(at: ScreenPoint): boolean {
		const drag = dragState.value;
		if (drag === null) return false;
		viewport.value = panBy(drag.originViewport, at.x - drag.originScreen.x, at.y - drag.originScreen.y);
		return true;
	}

	function endPan(): void {
		dragState.value = null;
	}

	/** `null` when the pointer leaves the stage, so the readout blanks rather than lying. */
	function setPointer(at: ScreenPoint | null): void {
		pointerWorld.value = at === null ? null : screenToWorld(at, viewport.value, STAGE_PIXELS);
	}

	/**
	 * `activeToolId` is the ONE reactive mirror of `ToolManager`'s non-reactive pointer,
	 * written by `runtime.ts`'s `setTool` and read by `EditorRuntime.activeToolId`, which
	 * is this ref — so the toolbar's active state and `PlanCanvas`'s tool-versus-camera
	 * routing both come from here. It briefly had a second writer and a private copy beside
	 * it: three places holding the active tool, the one this comment named as the consumer
	 * being the dead one. `hoveredObjectId` and `temporaryPolygon` are still inert — slice 8's tools
	 * broadcast transients through `RenderState` (a reactive proxy over
	 * `../editor/tools/render-state.ts`) instead, which is the reconciliation this file's
	 * older notes anticipated: these two slots remain declared vocabulary awaiting a
	 * reader, each with its own suppression so one can gain a consumer without the group
	 * rotting as a block.
	 */
	return {
		viewport,
		activeToolId,
		// fallow-ignore-next-line unused-store-member
		hoveredObjectId,
		// Read by a test that asserts a gesture is running, so it needs no suppression — which
		// is why these are one per line rather than one comment over the group.
		dragState,
		// fallow-ignore-next-line unused-store-member
		temporaryPolygon,
		pointerWorld,
		zoomAt,
		zoomByFactor,
		beginPan,
		continuePan,
		endPan,
		setPointer,
	};
});
