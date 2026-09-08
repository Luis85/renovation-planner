import type { Point } from '../../../core/geometry/Point';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';
import type { ElementMoveDeps } from './ElementMove';
import { rotationChanged, rotationPivot, rotationPoints } from './objectRotation';

/** A gesture owns a frozen baseline and pivot, never its previous preview. */
export class ElementRotation {
	private gesture: { element: SpatialElement; pivot: Point; bearing: number; context: EditorContext } | null = null;
	constructor(private readonly deps: ElementMoveDeps) {}
	get active(): boolean { return this.gesture !== null; }
	start(context: EditorContext, event: EditorPointerEvent, element: SpatialElement): void {
		const pivot = rotationPivot(element);
		if (!pivot || this.deps.canRotateElement?.() === false || context.writesBlocked() || event.modifiers.alt || !this.deps.moveElement) return;
		this.gesture = { context, element: { ...element, points: element.points.map(point => ({ ...point })) }, pivot, bearing: Math.atan2(event.worldPoint.y - pivot.y, event.worldPoint.x - pivot.x) };
	}
	private points(context: EditorContext, event: EditorPointerEvent): readonly Point[] | null {
		const gesture = this.gesture;
		if (!gesture) return null;
		const dx = event.worldPoint.x - gesture.pivot.x, dy = event.worldPoint.y - gesture.pivot.y;
		if (dx === 0 && dy === 0) { context.renderState.rotationDegrees = null; return null; }
		const radians = Math.atan2(dy, dx) - gesture.bearing;
		const degrees = (event.modifiers.shift ? context.snapService.snapRotation(radians) : radians) * 180 / Math.PI;
		context.renderState.rotationDegrees = degrees;
		return rotationPoints(gesture.element, degrees, gesture.pivot);
	}
	move(context: EditorContext, event: EditorPointerEvent): void {
		if (this.deps.canRotateElement?.() === false) { this.cancel(); return; }
		const points = this.points(context, event);
		if (this.gesture) this.deps.previewElement?.(points ? this.gesture.element.id : null, points ?? undefined);
	}
	finish(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.button !== 'primary') return;
		if (this.deps.canRotateElement?.() === false) { this.cancel(); return; }
		const points = this.points(context, event);
		this.cancel();
		if (points && rotationChanged(gesture.element.points, points) && !context.writesBlocked()) this.deps.moveElement?.(gesture.element.id, points, gesture.element);
	}
	cancel(): void { if (this.gesture) this.gesture.context.renderState.rotationDegrees = null; this.gesture = null; this.deps.previewElement?.(null); }
}
