import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { validSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { Point } from '../../../core/geometry/Point';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';
import type { SpatialObjectCandidate } from '../tools/select-tool';
import { CLICK_EPSILON_PX } from '../handleMetrics';
import { constrainDrawingPoint } from '../snapping/constrainDrawingPoint';

export interface ElementMoveDeps {
	previewElement?: (id: string | null, points?: readonly Point[]) => void;
	moveElement?: (id: string, points: readonly Point[], original: SpatialElement) => void;
}
/** A body translation previews only; the existing command facade owns the release write. */
export class ElementMove {
	private gesture: { element: SpatialElement; start: Point; points: readonly Point[]; vertexIndex?: number; context: EditorContext } | null = null;
	constructor(private readonly deps: ElementMoveDeps) {}
	get active(): boolean { return this.gesture !== null; }
	start(context: EditorContext, event: EditorPointerEvent, hit: SpatialObjectCandidate, vertexIndex?: number): void {
		if (!hit.kind || hit.kind === 'wall' || hit.kind === 'opening') return;
		if (context.writesBlocked() || event.modifiers.shift || event.modifiers.alt || !this.deps.moveElement) return;
		if (vertexIndex !== undefined && (hit.kind !== 'arrow' || !hit.points[vertexIndex])) return;
		this.gesture = { element: { id: hit.id, kind: hit.kind, points: hit.points, ...(hit.stair ? { stair: hit.stair } : {}) }, start: event.worldPoint, points: hit.points, vertexIndex, context };
	}
	private points(event: EditorPointerEvent): Point[] {
		const gesture = this.gesture;
		if (!gesture) return [];
		if (gesture.vertexIndex !== undefined) {
			const points = [...gesture.points], anchor = points[gesture.vertexIndex === 0 ? 1 : gesture.vertexIndex - 1];
			const constrained = constrainDrawingPoint(anchor, event.worldPoint, event.modifiers.shift, gesture.context.snapService);
			points[gesture.vertexIndex] = gesture.context.snapService.snapPoint(constrained, {});
			return points;
		}
		return gesture.points.map(original => ({ x: original.x + event.worldPoint.x - gesture.start.x, y: original.y + event.worldPoint.y - gesture.start.y }));
	}
	move(event: EditorPointerEvent): void { if (this.gesture) this.deps.previewElement?.(this.gesture.element.id, this.points(event)); }
	finish(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.button !== 'primary') return;
		const points = this.points(event), moved = Math.hypot(event.worldPoint.x - gesture.start.x, event.worldPoint.y - gesture.start.y) > CLICK_EPSILON_PX * context.viewport.worldPerScreenPixel();
		if (!moved || context.writesBlocked() || (gesture.vertexIndex !== undefined && !validSpatialElement({ ...gesture.element, points }))) { this.cancel(); return; }
		// Left previewing at the drop; `moveElement` clears it once the write has been read back.
		this.gesture = null; this.deps.previewElement?.(gesture.element.id, points);
		this.deps.moveElement?.(gesture.element.id, points, gesture.element);
	}
	cancel(): void { this.gesture = null; this.deps.previewElement?.(null); }
}
