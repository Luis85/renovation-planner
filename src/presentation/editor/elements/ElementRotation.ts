import type { Point } from '../../../core/geometry/Point';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';
import type { SnapService } from '../snapping/snap-service';
import { CLICK_EPSILON_PX, ROTATION_PIVOT_DEADZONE_PX } from '../handleMetrics';
import { rotationChanged, rotationPivot, rotationPoints, type RotationShape } from './objectRotation';
import { rotationControlContains, type RotationControlGeometry } from './rotationControl';

export interface RotationGestureDeps {
	canRotateShape?: (id?: string) => boolean;
	previewRotation?: (id: string | null, points?: readonly Point[]) => void;
	commitRotation?: (id: string, points: readonly Point[], original: RotationShape) => void;
	requestRotation?: (id: string) => void;
	rotationTarget?: () => RotationShape | null;
	rotationControl?: () => RotationControlGeometry | null;
	rotationDisplayTarget?: () => RotationShape | null;
	rotationControls?: () => readonly RotationControlGeometry[];
}
interface Gesture {
	shape: RotationShape;
	control: RotationControlGeometry;
	start: { x: number; y: number };
	bearing: number;
	initialBearing: number;
	radians: number;
	dragging: boolean;
	context: EditorContext;
}
function finitePointer(event: EditorPointerEvent): boolean {
	return [event.worldPoint.x, event.worldPoint.y, event.screenPoint.x, event.screenPoint.y].every(value => Number.isFinite(value));
}
/** A press is not yet a rotation: release opens precision; deliberate travel starts a drag. */
export class ElementRotation {
	private gesture: Gesture | null = null;
	constructor(private readonly deps: RotationGestureDeps) {}
	get active(): boolean { return this.gesture !== null; }
	start(context: EditorContext, event: EditorPointerEvent, shape: RotationShape, control: RotationControlGeometry): void {
		const pivot = rotationPivot(shape);
		if (!pivot || !finitePointer(event) || this.deps.canRotateShape?.() === false || context.writesBlocked() || event.modifiers.alt || !this.deps.commitRotation) return;
		const bearing = Math.atan2(event.worldPoint.y - pivot.y, event.worldPoint.x - pivot.x);
		const frozen = { ...control, handle: { ...control.handle }, anchor: { ...control.anchor }, pivot, bounds: { min: { ...control.bounds.min }, max: { ...control.bounds.max } } };
		this.gesture = { context, control: frozen, shape: { ...shape, ...(shape.bulges ? { bulges: [...shape.bulges] } : {}), ...(shape.wall ? { wall: { ...shape.wall, start: { ...shape.wall.start }, end: { ...shape.wall.end } } } : {}), points: shape.points.map(point => ({ ...point })) },
			start: { x: event.screenPoint.x, y: event.screenPoint.y }, radians: 0, bearing, initialBearing: bearing, dragging: false };
		context.renderState.rotationDegrees = 0;
		context.renderState.rotationInteraction = { control: frozen, dragging: false, snapDegrees: null };
	}
	private canContinue(gesture: Gesture): boolean {
		if (gesture.context.writesBlocked() || this.deps.canRotateShape?.() === false) return false;
		const original = gesture.shape;
		if (!this.deps.rotationTarget) return original.generation === undefined;
		const current = this.deps.rotationTarget();
		return current !== null && current.id === original.id && current.kind === original.kind && (original.generation === undefined || current.generation === original.generation)
			&& JSON.stringify(current.bulges) === JSON.stringify(original.bulges) && current.wall?.bulge === original.wall?.bulge
			&& current.points.length === original.points.length && current.points.every((point, index) => point.x === original.points[index].x && point.y === original.points[index].y);
	}
	private update(gesture: Gesture, event: EditorPointerEvent): readonly Point[] | null {
		const context = gesture.context;
		const snapping: SnapService = context.snapService;
		if (Math.hypot(event.screenPoint.x - gesture.start.x, event.screenPoint.y - gesture.start.y) > CLICK_EPSILON_PX) gesture.dragging = true;
		if (!gesture.dragging) return gesture.shape.points;
		const dx = event.worldPoint.x - gesture.control.pivot.x, dy = event.worldPoint.y - gesture.control.pivot.y;
		// A bearing is unstable near its centre; retain the last valid angle until it is meaningful.
		if (Math.hypot(dx, dy) > ROTATION_PIVOT_DEADZONE_PX * context.viewport.worldPerScreenPixel()) {
			const bearing = Math.atan2(dy, dx), delta = bearing - gesture.bearing;
			gesture.radians += Math.atan2(Math.sin(delta), Math.cos(delta)); gesture.bearing = bearing;
			if (bearing === gesture.initialBearing) gesture.radians = Math.round(gesture.radians / (2 * Math.PI)) * 2 * Math.PI;
		}
		const degrees = (event.modifiers.shift ? snapping.snapRotation(gesture.radians) : gesture.radians) * 180 / Math.PI;
		context.renderState.rotationDegrees = degrees;
		context.renderState.rotationInteraction = { control: gesture.control, dragging: true, snapDegrees: event.modifiers.shift ? snapping.rotationStepDegrees() : null };
		return rotationPoints(gesture.shape, degrees, gesture.control.pivot);
	}
	move(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture) return;
		if (context.writesBlocked() || !finitePointer(event) || !this.canContinue(gesture)) { this.cancel(); return; }
		const points = this.update(gesture, event);
		if (!points) { this.cancel(); return; }
		if (gesture.dragging) this.deps.previewRotation?.(gesture.shape.id, points);
	}
	finish(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.button !== 'primary') return;
		if (context.writesBlocked() || !finitePointer(event) || !this.canContinue(gesture)) { this.cancel(); return; }
		const points = this.update(gesture, event);
		const clicked = !gesture.dragging && rotationControlContains(gesture.control.bounds, event.worldPoint);
		this.cancel();
		if (clicked) { this.deps.requestRotation?.(gesture.shape.id); return; }
		if (points && gesture.dragging && rotationChanged(gesture.shape.points, points) && !context.writesBlocked()) this.deps.commitRotation?.(gesture.shape.id, points, gesture.shape);
	}
	cancel(): void {
		if (this.gesture) {
			this.gesture.context.renderState.rotationDegrees = null;
			this.gesture.context.renderState.rotationInteraction = null;
			this.gesture.context.renderState.hoveredTargetKind = null;
			this.gesture.context.renderState.hoveredObjectId = null;
			this.gesture.context.renderState.rotationHoverId = null;
		}
		this.gesture = null; this.deps.previewRotation?.(null);
	}
}
