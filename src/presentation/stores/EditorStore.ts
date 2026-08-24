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
 * Slice 6 owns the tool vocabulary; this is the typed SLOT it fills, declared here so
 * that adding tools does not change this store's shape. Always `null` in this slice —
 * there is no `EditorTool` yet to be active.
 *
 * NOT exported, and `DragState` below is the same: an export with no consumer is dead code
 * by this project's own gate (`npm run analyze`), and "slice 6 will want it" is exactly the
 * argument that gate refuses. Slice 6 exports it in the change that gives it a caller.
 */
type ToolId = string;

/**
 * A gesture in progress. This slice has exactly one — the camera pan — and slice 6 widens
 * the union with the tool gestures it introduces. The `kind` discriminator is here from
 * the start for that reason: a single-shape "drag state" would have to be replaced rather
 * than extended.
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
 * This slice defines the shape and drives only the viewport half; the rest is inert until
 * slice 6's tools start writing into it.
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
	 * The four slots below are exposed and nothing reads them yet — §15's ephemeral
	 * vocabulary, which design slice 5 states it defines the SHAPE of and slice 6's tools
	 * are what write into. Suppressed rather than deleted, and rather than left to fail the
	 * gate: this is the same case as `Zone.area()`/`Zone.perimeter()` in slice 3, where
	 * deleting a declared capability because nothing calls it yet is how the declaration
	 * rots. Each line is its own suppression so that slice 6 removes them one at a time as
	 * it gives each slot a reader, instead of one blanket comment outliving all four.
	 */
	return {
		viewport,
		// fallow-ignore-next-line unused-store-member
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
