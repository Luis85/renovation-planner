import type { Point } from '../../../core/geometry/Point';
import type { Wall } from '../../../domain/spatial/Structure';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../tools/editor-tool';
import { placementAt, type AssetPlacementDraft } from './assetPlacementDraft';

/** Click-to-place, repeatedly. It keeps no draft Escape could discard, so Escape leaves the tool. */
export class AssetPlacementTool implements EditorTool {
	readonly id = 'place-asset' as const;
	private context: EditorContext | null = null;
	constructor(private readonly deps: { draft: AssetPlacementDraft; walls(): readonly Wall[]; blocked(): boolean; place(points: readonly [Point, Point]): void }) {}
	activate(context: EditorContext): void { this.context = context; }
	deactivate(): void { this.context = null; this.deps.draft.preview = null; }
	pointerDown(event: EditorPointerEvent): void {
		if (event.button !== 'primary') return;
		this.pointerMove(event);
		const at = this.deps.draft.preview;
		if (at && !this.deps.blocked()) this.deps.place(at);
	}
	pointerMove(event: EditorPointerEvent): void {
		const context = this.context, shape = this.deps.draft.shape;
		if (!context || !shape) return;
		const tolerance = context.snapService.enabled ? 8 * context.viewport.worldPerScreenPixel() : null;
		this.deps.draft.preview = placementAt(event.worldPoint, shape, this.deps.walls(), tolerance);
	}
	pointerUp(): void { /* A placement belongs to pointer down. */ }
	cancel(): void { this.deps.draft.preview = null; }
	abandonGesture(): void { this.deps.draft.preview = null; }
	hasDraft(): boolean { return false; }
}
