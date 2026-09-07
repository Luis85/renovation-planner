import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../tools/editor-tool';
import type { ElementDraft, ElementToolId } from './elementDraft';
import { discardElementGeometry } from './elementDraft';
import type { Point } from '../../../core/geometry/Point';
import type { SnapCandidates } from '../snapping/snap-service';

/** Multi-click linear drafts share the standard tool lifecycle and require explicit Finish. */
export class ElementTool implements EditorTool {
	private context: EditorContext | null = null;
	constructor(readonly id: ElementToolId, private readonly deps: {
		draft: ElementDraft; start(id: ElementToolId): void; stop(): void; blocked(): boolean;
		addPoint(point: Point): boolean; finish(): void; candidates(): SnapCandidates;
	}) {}
	activate(context: EditorContext): void { this.context = context; this.deps.start(this.id); }
	deactivate(): void { this.context = null; this.deps.stop(); }
	pointerDown(event: EditorPointerEvent): void {
		if (event.button !== 'primary' || !this.context || this.deps.blocked()) return;
		this.pointerMove(event);
		if (this.deps.draft.cursor) this.deps.addPoint(this.deps.draft.cursor);
	}
	pointerMove(event: EditorPointerEvent): void {
		if (!this.context || this.deps.blocked()) return;
		this.deps.draft.cursor = this.context.snapService.snapPoint(event.worldPoint, this.deps.candidates(), 8 * this.context.viewport.worldPerScreenPixel());
	}
	pointerUp(): void { /* Completed points belong to pointer down. */ }
	finish(): void { this.deps.finish(); }
	cancel(): void { if (!this.deps.draft.busy) discardElementGeometry(this.deps.draft); }
	abandonGesture(): void { this.deps.draft.cursor = null; }
	hasDraft(): boolean { return this.deps.draft.points.length > 0 || this.deps.draft.pendingInput || !!this.deps.draft.text.x || !!this.deps.draft.text.y; }
	editCorner(index: number, point: Point | null): boolean {
		if (this.deps.blocked()) return false;
		const points = this.deps.draft.points, resolved = index === -1 ? points.length - 1 : index;
		if (resolved < 0 || resolved >= points.length) return false;
		if (point) points.splice(resolved, 1, point); else points.splice(resolved, 1);
		return true;
	}
}
