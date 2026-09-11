import type { EditorPointerEvent } from '../tools/editor-tool';
import type { GroupSnapshot } from './groupSnapshot';
import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import { CLICK_EPSILON_PX } from '../handleMetrics';

export interface GroupMoveDependencies {
	capture(ids: readonly string[]): GroupSnapshot | null;
	current(snapshot: GroupSnapshot): boolean;
	scale(): number;
	preview(snapshot: GroupSnapshot | null, delta?: Vector): void;
	commit(snapshot: GroupSnapshot, delta: Vector): Promise<void>;
}
function finite(event: EditorPointerEvent): boolean { return Number.isFinite(event.worldPoint.x) && Number.isFinite(event.worldPoint.y); }
export class GroupMoveGesture {
	private gesture: { snapshot: GroupSnapshot; start: Point; scale: number } | null = null;
	constructor(private readonly deps: GroupMoveDependencies) {}
	get active(): boolean { return this.gesture !== null; }
	start(ids: readonly string[], event: EditorPointerEvent): boolean {
		if (event.button !== 'primary' || event.modifiers.shift || event.modifiers.alt || event.modifiers.ctrl || !finite(event)) return false;
		const snapshot = this.deps.capture(ids); if (!snapshot) return false;
		this.gesture = { snapshot, start: { ...event.worldPoint }, scale: this.deps.scale() }; return true;
	}
	move(event: EditorPointerEvent): void {
		const gesture = this.gesture; if (!gesture) return;
		if (!finite(event) || !this.deps.current(gesture.snapshot)) { this.cancel(); return; }
		this.deps.preview(gesture.snapshot, { dx: event.worldPoint.x - gesture.start.x, dy: event.worldPoint.y - gesture.start.y });
	}
	finish(event: EditorPointerEvent): void {
		const gesture = this.gesture; if (!gesture || event.button !== 'primary') return;
		const delta = { dx: event.worldPoint.x - gesture.start.x, dy: event.worldPoint.y - gesture.start.y };
		const valid = finite(event) && this.deps.current(gesture.snapshot) && Math.hypot(delta.dx, delta.dy) > CLICK_EPSILON_PX * gesture.scale;
		if (!valid) { this.cancel(); return; }
		// The preview stays at the drop until `commit` settles: clearing it here drew the saved
		// geometry for the length of the write and its read-back, so the group flicked back.
		this.gesture = null; this.deps.preview(gesture.snapshot, delta);
		void this.deps.commit(gesture.snapshot, delta);
	}
	cancel(): void { this.gesture = null; this.deps.preview(null); }
}
