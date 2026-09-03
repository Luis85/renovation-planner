import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Point } from '../../core/geometry/Point';
import {
	DEFAULT_VIEWPORT,
	fitViewport,
	panBy,
	screenToWorld,
	STAGE_PIXELS,
	zoomAbout,
	type ScreenPoint,
	type StageSize,
	type Viewport,
} from '../editor/viewport/Viewport';
import type { BoundingBox } from '../../core/geometry/BoundingBox';
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
	/**
	 * WHICH pointer is doing the dragging.
	 *
	 * Invisible on a mouse — one `pointerId` is shared across every button — and load-bearing
	 * on touch, where the manifest promises support (`isDesktopOnly: false`) and camera mode
	 * is the DEFAULT state. A second finger's moves were read as continuations of the first
	 * one's drag, so the camera jumped by the distance BETWEEN two fingers rather than by how
	 * far either had travelled.
	 *
	 * It lives on the drag rather than beside it because it is a fact ABOUT this gesture, and
	 * a second field elsewhere would be a second thing to forget to clear.
	 */
	readonly pointerId: number;
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
/**
 * Clear space left around a fitted extent, in stage pixels, so a zone's caption and its
 * selection handles are not flush against the pane edge — the same reason
 * `DEFAULT_VIEWPORT` carries a margin rather than starting at the world origin.
 */
const FIT_PADDING_PX = 48;

export const useEditorStore = defineStore('editor', () => {
	const viewport = ref<Viewport>(DEFAULT_VIEWPORT);
	const activeToolId = ref<ToolId | null>(null);
	const hoveredObjectId = ref<string | null>(null);
	const dragState = ref<DragState | null>(null);
	const temporaryPolygon = ref<readonly Point[] | null>(null);

	/**
	 * The gesture surface's own measured size, in stage pixels — `{ width: 0, height: 0 }`
	 * until `EditorSurface`'s resize observer has run at least once, which is the window
	 * `fitTo` already treats as an ordinary early call rather than an error (see its own
	 * docblock).
	 *
	 * Held here, rather than threaded as a second parameter, because `selectAndFrame` (design
	 * slice 12's list-framing seam) is the first caller with no prop path of its own to carry
	 * one: it is reached from the Inspector's room list, nowhere near `EditorSurface`'s
	 * `size` ref or the `framedBounds` prop that already threads it to the fit shortcuts. A
	 * fact the surface measures and a tool-framework caller needs is a store field, the same
	 * bargain `viewport` itself already makes.
	 */
	const stageSize = ref<StageSize>({ width: 0, height: 0 });

	/**
	 * The last pointer position, in the STAGE's own screen pixels. The SCREEN half is what is
	 * stored, because it is the half a camera change leaves alone.
	 */
	const pointerScreen = ref<ScreenPoint | null>(null);

	/**
	 * The last pointer position, in world millimetres — what the status bar's measurements
	 * readout shows. Read-only telemetry: it demonstrates the viewport transform working
	 * without any editable state behind it.
	 *
	 * DERIVED, never stored, and that is the whole of this file's share of a lesson this
	 * repository has now paid for three times: a value computed from two inputs goes stale
	 * when EITHER of them moves. It was assigned in `setPointer` alone, so it answered for a
	 * pointer that had moved and not for a camera that had — and both camera paths move it
	 * under a stationary pointer. The keyboard's `+`/`-` anchor at the stage centre, so the
	 * world position under the pointer genuinely changes and the readout simply lied until
	 * the next mouse move; a pan is DEFINED by holding one world point under the cursor,
	 * and there the stored value was recomputed from the pre-pan camera every move, so the
	 * one number that should not have moved at all was the one that drifted furthest.
	 *
	 * Refreshing it at the camera call sites was the alternative and is the shape that
	 * decays: it is a list of the paths someone thought of, and the wrong half of it is
	 * unreachable anyway — `EditorSurface.reissuePointerMove` returns early when no tool is
	 * active, which is camera mode, where the keyboard zoom is still live.
	 */
	const pointerWorld = computed<Point | null>(() =>
		pointerScreen.value === null ? null : screenToWorld(pointerScreen.value, viewport.value, STAGE_PIXELS),
	);

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

	/**
	 * A drag already running is KEPT, not replaced. A second pointer pressing in camera mode
	 * would otherwise hand the gesture to the newcomer — the first finger's moves then ignored
	 * as a foreign pointer's, so the pan dies under the hand still making it. One gesture at a
	 * time, decided here rather than at each call site.
	 */
	function beginPan(at: ScreenPoint, pointerId: number): void {
		if (dragState.value !== null) return;
		dragState.value = { kind: 'pan', originScreen: at, originViewport: viewport.value, pointerId };
	}

	/**
	 * Answers whether the move was consumed, so the caller does not have to re-inspect
	 * `dragState` to find out — the store is the one place that knows whether a gesture is
	 * running, and now also which pointer is running it.
	 *
	 * A move from any OTHER pointer is refused rather than applied: see `DragState.pointerId`.
	 */
	function continuePan(at: ScreenPoint, pointerId: number): boolean {
		const drag = dragState.value;
		if (drag === null || drag.pointerId !== pointerId) return false;
		viewport.value = panBy(drag.originViewport, at.x - drag.originScreen.x, at.y - drag.originScreen.y);
		return true;
	}

	/**
	 * The drag's own pointer letting go. Answers whether it consumed the release, and refuses
	 * one from any other pointer — the second half of `DragState.pointerId`'s rule, and the
	 * half a first pass misses: a second finger LIFTING ended the first finger's drag, so the
	 * pan stopped dead while the hand making it was still moving.
	 */
	function endPan(pointerId: number): boolean {
		if (dragState.value?.pointerId !== pointerId) return false;
		dragState.value = null;
		return true;
	}

	/**
	 * The drag is over whoever owned it — `pointercancel` and focus loss, neither of which
	 * names a pointer worth trusting.
	 *
	 * **`pointerleave` is deliberately NOT a caller**, and this used to list it. That handler
	 * calls `endPan(event.pointerId)` instead: a leave DOES carry an identity, so it can
	 * refuse one from a pointer that owns nothing rather than abandoning a drag the owner's
	 * finger is still making. The comment there says so, and the two contradicted each other
	 * about the same path until this one was corrected.
	 *
	 * Separate from `endPan` rather than reached by omitting its argument, so that no caller
	 * can get "end whatever is running" by ACCIDENT, which is precisely what `endPan` was just
	 * narrowed to refuse. `PanOverride` splits the same pair for the same reason.
	 */
	function abandonPan(): void {
		dragState.value = null;
	}

	/**
	 * A one-shot camera nudge in SCREEN pixels, with no gesture behind it — what a wheel
	 * notch is. Shift+wheel pans horizontally in Obsidian's own Canvas, and this is where
	 * that reaches the camera.
	 *
	 * Distinct from `continuePan` rather than a spelling of it: that one is relative to the
	 * viewport a gesture STARTED from, which is what keeps a long drag free of accumulated
	 * drift. A wheel notch has no start to be relative to, so it composes on the current
	 * camera — and its drift is bounded by the fact that each notch is a fresh, exact
	 * quantity rather than a running total of pointer positions.
	 */
	function panByScreen(dx: number, dy: number): void {
		viewport.value = panBy(viewport.value, dx, dy);
	}

	/**
	 * Zoom-to-fit: the camera that shows all of `bounds` at once, centred.
	 *
	 * A pane with no area answers `null` and is IGNORED rather than adopted. The stage is
	 * measured from a container that is `0 x 0` until layout runs, so a fit asked in that
	 * window is an ordinary early call and not an error — keeping the camera the editor
	 * already has is the honest outcome, where writing `null` through would blank the view.
	 */
	function fitTo(bounds: BoundingBox, stage: StageSize, paddingPx = FIT_PADDING_PX): void {
		// The current zoom goes IN because a doubly-degenerate extent — a zone reduced to a
		// point — has nothing to fit and keeps the camera the user has, centring on it. The
		// store is what knows that zoom; a fit computed without it can only invent one.
		const fitted = fitViewport(bounds, stage, paddingPx, viewport.value.zoom);
		if (fitted !== null) viewport.value = fitted;
	}

	/** `null` when the pointer leaves the stage, so the readout blanks rather than lying. */
	function setPointer(at: ScreenPoint | null): void {
		pointerScreen.value = at;
	}

	/** Written by `EditorSurface`'s resize observer, at the same place it sets its own local ref. */
	function setStageSize(size: StageSize): void {
		stageSize.value = size;
	}

	/**
	 * The camera and every in-flight gesture back to the state a Plan Editor opens in.
	 *
	 * For a store holding nothing persisted (see the header), that is the whole definition:
	 * there is no canonical value to re-read and nothing to discard, so "reset" is exactly
	 * "assign the same defaults the module top declared" — which is why `DEFAULT_VIEWPORT` is
	 * imported rather than restated, leaving one source of truth for what a fresh viewport is.
	 * A store whose state DID outlive its component would need a reload here instead, and the
	 * distinction is the reason this method can be four assignments and be complete.
	 *
	 * What that buys, and the thing that would notice it missing: any surface reusing one Pinia
	 * across successive mounts — the harness index is the one that exists (`tests/harness/fixture.ts`
	 * calls this before every entry it opens, so a pan left by one entry does not draw the next),
	 * a later in-plugin surface would be another.
	 */
	function reset(): void {
		viewport.value = DEFAULT_VIEWPORT;
		activeToolId.value = null;
		hoveredObjectId.value = null;
		dragState.value = null;
		temporaryPolygon.value = null;
		pointerScreen.value = null;
	}

	/**
	 * `activeToolId` is the ONE reactive mirror of `ToolManager`'s non-reactive pointer,
	 * written by `runtime.ts`'s `setTool` and read by `EditorRuntime.activeToolId`, which
	 * is this ref — so the shell's own active-tool indicator (`FloatingPrimaryActions`'
	 * `aria-pressed` on Select in the Plan Editor, the asset designer's own toolbar) and
	 * `EditorSurface`'s tool-versus-camera routing both come from here. It briefly had a
	 * second writer and a private copy beside
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
		stageSize,
		pointerWorld,
		zoomAt,
		zoomByFactor,
		beginPan,
		continuePan,
		endPan,
		abandonPan,
		panByScreen,
		fitTo,
		setPointer,
		setStageSize,
		reset,
	};
});
