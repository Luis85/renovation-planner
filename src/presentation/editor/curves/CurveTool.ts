import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../tools/editor-tool';
import { distance } from '../../../core/geometry/operations';
import { bulgeAt, curveEdges, type CurveTarget } from './curveDraft';
import { CLICK_EPSILON_PX } from '../handleMetrics';

export interface CurveToolActions {
	target(): CurveTarget | null;
	blocked(): boolean;
	busy(): boolean;
	set(index: number, bulge: number): void;
	choose(index: number): void;
	stop(): void;
	cancel(): void;
	finish(): void;
}
/** Explicit bend task: corners and ordinary selection never share this pointer admission. */
export class CurveTool implements EditorTool {
	readonly id = 'edit-curves' as const;
	private context: EditorContext | null = null;
	private drag: { edge: ReturnType<typeof curveEdges>[number]; original: number; start: EditorPointerEvent['screenPoint']; moved: boolean } | null = null;
	constructor(private readonly actions: CurveToolActions) {}
	activate(context: EditorContext): void { this.context = context; }
	deactivate(): void { this.abandonGesture(); this.context = null; this.actions.stop(); }
	canDeactivate(): boolean { return !this.actions.busy(); }
	pointerDown(event: EditorPointerEvent): void {
		const target = this.actions.target();
		if (!this.context || !target || this.actions.blocked() || event.button !== 'primary') return;
		const tolerance = 22 * this.context.viewport.worldPerScreenPixel();
		const edge = curveEdges(target).find(item => distance(item.midpoint, event.worldPoint) <= tolerance);
		if (edge) { this.drag = { edge, original: edge.bulge, start: event.screenPoint, moved: false }; this.actions.choose(edge.index); }
	}
	pointerMove(event: EditorPointerEvent): void {
		if (!this.drag || this.actions.blocked() || !Number.isFinite(event.worldPoint.x) || !Number.isFinite(event.worldPoint.y)) return;
		if (Math.hypot(this.drag.start.x - event.screenPoint.x, this.drag.start.y - event.screenPoint.y) > CLICK_EPSILON_PX) this.drag.moved = true;
		if (!this.drag.moved) return;
		this.actions.set(this.drag.edge.index, bulgeAt(this.drag.edge, event.worldPoint));
	}
	pointerUp(event: EditorPointerEvent): void {
		if (event.button !== 'primary') return;
		this.pointerMove(event); this.drag = null;
	}
	abandonGesture(): void { if (this.drag?.moved) this.actions.set(this.drag.edge.index, this.drag.original); this.drag = null; }
	cancel(): void { this.abandonGesture(); this.actions.cancel(); }
	finish(): void { if (!this.drag) this.actions.finish(); }
	hasDraft(): boolean { return this.actions.target() !== null; }
}
