import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import type { Point } from '../../../core/geometry/Point';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';
import type { SpatialObjectCandidate } from '../tools/select-tool';
import { CLICK_EPSILON_PX } from '../handleMetrics';

export interface ElementMoveDeps {
	canRotateElement?: () => boolean;
	previewElement?: (id: string | null, points?: readonly Point[]) => void;
	moveElement?: (id: string, points: readonly Point[], original: SpatialElement) => void;
}
/** A body translation previews only; the existing command facade owns the release write. */
export class ElementMove {
	private gesture: { element: SpatialElement; start: Point; points: readonly Point[] } | null = null;
	constructor(private readonly deps: ElementMoveDeps) {}
	get active(): boolean { return this.gesture !== null; }
	start(context: EditorContext, event: EditorPointerEvent, hit: SpatialObjectCandidate): void {
		if (!hit.kind || hit.kind === 'wall' || hit.kind === 'opening') return;
		if (context.writesBlocked() || event.modifiers.shift || event.modifiers.alt || !this.deps.moveElement) return;
		this.gesture = { element: { id: hit.id, kind: hit.kind, points: hit.points }, start: event.worldPoint, points: hit.points };
	}
	private points(point: Point): Point[] {
		const gesture = this.gesture;
		return gesture ? gesture.points.map(original => ({ x: original.x + point.x - gesture.start.x, y: original.y + point.y - gesture.start.y })) : [];
	}
	move(event: EditorPointerEvent): void { if (this.gesture) this.deps.previewElement?.(this.gesture.element.id, this.points(event.worldPoint)); }
	finish(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.button !== 'primary') return;
		const points = this.points(event.worldPoint), moved = Math.hypot(event.worldPoint.x - gesture.start.x, event.worldPoint.y - gesture.start.y) > CLICK_EPSILON_PX * context.viewport.worldPerScreenPixel();
		this.cancel();
		if (moved && !context.writesBlocked()) this.deps.moveElement?.(gesture.element.id, points, gesture.element);
	}
	cancel(): void { this.gesture = null; this.deps.previewElement?.(null); }
}
