import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../tools/editor-tool';
import type { Structure } from '../../../domain/spatial/Structure';
import { addWallPoint, pickHost, snapWallPoint, type StructureDraft, type StructureToolId } from './structureDraft';

export class StructureTool implements EditorTool {
	private context: EditorContext | null = null;
	constructor(readonly id: StructureToolId, private readonly deps: { draft: StructureDraft; structure: () => Structure; start: (kind: StructureToolId) => void; stop: () => void; finish: () => void; blocked: () => boolean }) {}
	activate(context: EditorContext): void { this.context = context; this.deps.start(this.id); }
	deactivate(): void { this.context = null; this.deps.stop(); }
	pointerDown(event: EditorPointerEvent): void {
		if (event.button !== 'primary' || !this.context || this.deps.blocked()) return;
		this.pointerMove(event);
		if (this.id === 'draw-wall' && this.deps.draft.cursor) addWallPoint(this.deps.draft, this.deps.draft.cursor, this.deps.structure());
	}
	pointerMove(event: EditorPointerEvent): void {
		if (!this.context || this.deps.blocked()) return;
		const tolerance = Math.min(100, 8 * this.context.viewport.worldPerScreenPixel());
		if (this.id !== 'draw-wall') { pickHost(this.deps.draft, event.worldPoint, this.deps.structure().walls, tolerance); return; }
		const snapped = snapWallPoint(event.worldPoint, this.deps.draft.points, this.deps.structure().walls, tolerance);
		this.deps.draft.cursor = snapped.point; this.deps.draft.snapped = snapped.snapped;
	}
	pointerUp(): void { /* Points are placed on pointer down. */ }
	finish(): void { this.deps.finish(); }
	cancel(): void { if (!this.deps.draft.busy) { this.deps.draft.points = []; this.deps.draft.cursor = null; this.deps.draft.text.length = ''; this.deps.draft.room = false; } }
	abandonGesture(): void { /* A focus change preserves completed points. */ }
	hasDraft(): boolean { return this.deps.draft.points.length > 0 || this.deps.draft.text.length !== ''; }
	editCorner(index: number, point: null): boolean {
		if (this.deps.blocked() || point !== null || (index !== -1 && index !== this.deps.draft.points.length - 1)) return false;
		this.deps.draft.points.pop(); this.deps.draft.room = false; return true;
	}
}
