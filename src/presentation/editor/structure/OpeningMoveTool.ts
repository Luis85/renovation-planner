import type { Point } from '../../../core/geometry/Point';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../tools/editor-tool';

/** A hover preview has no accumulated draft: one Escape leaves the task. */
export class OpeningMoveTool implements EditorTool {
	readonly id = 'move-opening';
	private context: EditorContext | null = null;
	constructor(private readonly actions: { move(point: Point, tolerance: number, commit: boolean): void; stop(): void; clear(): void; saving(): boolean }) {}
	activate(context: EditorContext): void { this.context = context; }
	deactivate(): void { this.context = null; this.actions.stop(); }
	canDeactivate(): boolean { return !this.actions.saving(); }
	private point(event: EditorPointerEvent, commit: boolean): void {
		if (this.context && !this.actions.saving()) this.actions.move(event.worldPoint, 8 * this.context.viewport.worldPerScreenPixel(), commit);
	}
	pointerDown(event: EditorPointerEvent): void { if (event.button === 'primary') this.point(event, true); }
	pointerMove(event: EditorPointerEvent): void { this.point(event, false); }
	pointerUp(): void { /* Placement commits on the primary press. */ }
	cancel(): void { if (!this.actions.saving()) this.actions.clear(); }
	abandonGesture(): void { this.cancel(); }
	hasDraft(): boolean { return false; }
}
