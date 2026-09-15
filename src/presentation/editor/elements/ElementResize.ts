import type { Point } from '../../../core/geometry/Point';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { withPlacementSize } from '../../../domain/spatial/assetPlacement';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';
import { CLICK_EPSILON_PX, SNAP_TOLERANCE_PX } from '../handleMetrics';
import { acceptsElementPoints } from './elementDraft';
import { resizeTransformBox, transformHandleWorld, type ResizedGeometry, type TransformBox } from './transformBox';

export interface ElementResizeDeps {
	/** The one selected item's or placement's transform box, or `null` where none is offered. */
	transformBox?: () => TransformBox | null;
	previewResize?: (id: string | null, next?: ResizedGeometry) => void;
	commitResize?: (id: string, next: ResizedGeometry, original: SpatialElement) => void;
}

interface Gesture {
	readonly frame: TransformBox;
	readonly index: number;
	readonly start: Point;
	readonly context: EditorContext;
	dragging: boolean;
}

/**
 * A transform box handle drag (plan editor transform box design, Interaction). A press is not yet a
 * resize; travel past the click epsilon starts it. The handle's unpadded point plus the pointer's travel
 * is snapped, the opposite handle holds still, and past a limit the last valid preview stays up.
 */
export class ElementResize {
	private gesture: Gesture | null = null;
	constructor(private readonly deps: ElementResizeDeps) {}
	get active(): boolean { return this.gesture !== null; }

	start(context: EditorContext, event: EditorPointerEvent, frame: TransformBox, index: number): void {
		if (context.writesBlocked() || event.modifiers.alt || !this.deps.commitResize) return;
		this.gesture = { frame, index, start: event.worldPoint, context, dragging: false };
	}

	/**
	 * The geometry at `event`: `null` below the click epsilon, past a limit `resizeTransformBox`
	 * itself refuses, or where the result would fail `acceptsElementPoints` — `resizeTransformBox`
	 * bounds only a resized SIDE (1 to 1e6 mm), never the resulting coordinate, which is
	 * `validSpatialElement`'s bound to ask instead, exactly as `ElementMove.finish`'s vertex-drag
	 * gate does. Writes the snap guides.
	 */
	private resized(gesture: Gesture, event: EditorPointerEvent): ResizedGeometry | null {
		const { context, frame } = gesture, scale = context.viewport.worldPerScreenPixel();
		if (Math.hypot(event.worldPoint.x - gesture.start.x, event.worldPoint.y - gesture.start.y) > CLICK_EPSILON_PX * scale) gesture.dragging = true;
		if (!gesture.dragging) return null;
		const handle = transformHandleWorld(frame, gesture.index);
		const raw = { x: handle.x + event.worldPoint.x - gesture.start.x, y: handle.y + event.worldPoint.y - gesture.start.y };
		const snap = context.snapService.snapPointWithGuides(raw, context.snapCandidates([frame.element.id]), SNAP_TOLERANCE_PX * scale);
		context.renderState.snapGuides = snap.guides;
		const next = resizeTransformBox(frame, gesture.index, snap.point, event.modifiers.shift);
		if (!next) return null;
		return acceptsElementPoints(withPlacementSize(frame.element, next.size), next.points) ? next : null;
	}

	move(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture) return;
		if (context.writesBlocked()) { this.cancel(); return; }
		const next = this.resized(gesture, event);
		if (next) this.deps.previewResize?.(gesture.frame.element.id, next);
	}

	finish(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.button !== 'primary') return;
		const next = context.writesBlocked() ? null : this.resized(gesture, event);
		context.renderState.snapGuides = [];
		if (!next) { this.cancel(); return; }
		// Left previewing at the drop; the write clears it once read back, as a move's does.
		this.gesture = null;
		this.deps.previewResize?.(gesture.frame.element.id, next);
		this.deps.commitResize?.(gesture.frame.element.id, next, gesture.frame.element);
	}

	cancel(): void {
		if (this.gesture) this.gesture.context.renderState.snapGuides = [];
		this.gesture = null;
		this.deps.previewResize?.(null);
	}
}
