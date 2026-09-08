import type { Point } from '../../../core/geometry/Point';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';
import { rotationChanged, rotationPivot, rotationPoints, type RotationShape } from './objectRotation';

export interface RotationGestureDeps {
	canRotateShape?: () => boolean;
	previewRotation?: (id: string | null, points?: readonly Point[]) => void;
	commitRotation?: (id: string, points: readonly Point[], original: RotationShape) => void;
	rotationTarget?: () => RotationShape | null;
	rotationHandle?: () => Point | null;
}
/** Bearings unwrap continuously; every preview still transforms the frozen original points. */
export class ElementRotation {
	private gesture: { shape: RotationShape; pivot: Point; bearing: number; radians: number; context: EditorContext } | null = null;
	constructor(private readonly deps: RotationGestureDeps) {}
	get active(): boolean { return this.gesture !== null; }
	start(context: EditorContext, event: EditorPointerEvent, shape: RotationShape): void {
		const pivot = rotationPivot(shape);
		if (!pivot || this.deps.canRotateShape?.() === false || context.writesBlocked() || event.modifiers.alt || !this.deps.commitRotation) return;
		context.renderState.rotationDegrees = 0;
		this.gesture = { context, shape: { ...shape, ...(shape.wall ? { wall: { ...shape.wall, start: { ...shape.wall.start }, end: { ...shape.wall.end } } } : {}), points: shape.points.map(point => ({ ...point })) }, pivot, radians: 0, bearing: Math.atan2(event.worldPoint.y - pivot.y, event.worldPoint.x - pivot.x) };
	}
	private points(context: EditorContext, event: EditorPointerEvent): readonly Point[] | null {
		const gesture = this.gesture;
		if (!gesture) return null;
		const dx = event.worldPoint.x - gesture.pivot.x, dy = event.worldPoint.y - gesture.pivot.y;
		if (dx === 0 && dy === 0) { context.renderState.rotationDegrees = null; return null; }
		const bearing = Math.atan2(dy, dx), delta = bearing - gesture.bearing;
		gesture.radians += Math.atan2(Math.sin(delta), Math.cos(delta)); gesture.bearing = bearing;
		const degrees = (event.modifiers.shift ? context.snapService.snapRotation(gesture.radians) : gesture.radians) * 180 / Math.PI;
		context.renderState.rotationDegrees = degrees;
		return rotationPoints(gesture.shape, degrees, gesture.pivot);
	}
	private canContinue(): boolean {
		const captured = this.gesture?.shape.generation;
		return this.deps.canRotateShape?.() !== false && (captured === undefined || captured === this.deps.rotationTarget?.()?.generation);
	}
	move(context: EditorContext, event: EditorPointerEvent): void {
		if (!this.canContinue()) { this.cancel(); return; }
		const points = this.points(context, event);
		if (this.gesture) this.deps.previewRotation?.(points ? this.gesture.shape.id : null, points ?? undefined);
	}
	finish(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.button !== 'primary') return;
		if (!this.canContinue()) { this.cancel(); return; }
		const points = this.points(context, event);
		this.cancel();
		if (points && rotationChanged(gesture.shape.points, points) && !context.writesBlocked()) this.deps.commitRotation?.(gesture.shape.id, points, gesture.shape);
	}
	cancel(): void { if (this.gesture) this.gesture.context.renderState.rotationDegrees = null; this.gesture = null; this.deps.previewRotation?.(null); }
}
