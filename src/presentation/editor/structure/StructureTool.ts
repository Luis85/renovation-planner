import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../tools/editor-tool';
import type { Point } from '../../../core/geometry/Point';
import type { Structure } from '../../../domain/spatial/Structure';
import { resolveWallJoin } from '../../../domain/spatial/wallJoin';
import { constrainDrawingPoint } from '../snapping/constrainDrawingPoint';
import { addWallPoint, endOnWall, pickHost, snapWallPoint, startFromWall, type StructureDraft, type StructureToolId } from './structureDraft';

/** Eight screen pixels in world millimetres, capped so a zoomed-out camera does not snap across a room. */
const toleranceAt = (context: EditorContext): number => Math.min(100, 8 * context.viewport.worldPerScreenPixel());

export class StructureTool implements EditorTool {
	private context: EditorContext | null = null;
	constructor(readonly id: StructureToolId, private readonly deps: { draft: StructureDraft; structure: () => Structure; start: (kind: StructureToolId) => void; stop: () => void; finish: () => void; blocked: () => boolean }) {}
	activate(context: EditorContext): void { this.context = context; this.deps.start(this.id); }
	deactivate(): void { this.context = null; this.deps.stop(); }
	pointerDown(event: EditorPointerEvent): void {
		if (event.button !== 'primary' || !this.context || this.deps.blocked()) return;
		const draft = this.deps.draft;
		if (this.id !== 'draw-wall') { this.pointerMove(event); if (draft.snapped) this.deps.finish(); return; }
		const cursor = this.trackWall(event, this.context), join = draft.pending, structure = this.deps.structure();
		if (!join) { addWallPoint(draft, cursor, structure); return; }
		if (!draft.points.length) { startFromWall(draft, structure, join.wallId, join.point, toleranceAt(this.context)); return; }
		// A click landing on a wall body is the chain's natural end: continuing past it would cross the wall.
		if (endOnWall(draft, structure, join) && draft.joins.end) this.deps.finish();
	}
	pointerMove(event: EditorPointerEvent): void {
		if (!this.context || this.deps.blocked()) return;
		if (this.id === 'draw-wall') this.trackWall(event, this.context);
		else pickHost(this.deps.draft, event.worldPoint, this.deps.structure().walls, toleranceAt(this.context));
	}
	/** Moves the draw-wall cursor — constrained, snapped, and joined to a wall body when one is under it — and answers where it landed. */
	private trackWall(event: EditorPointerEvent, context: EditorContext): Point {
		const tolerance = toleranceAt(context), draft = this.deps.draft;
		const from = draft.points.at(-1), constrained = constrainDrawingPoint(from, event.worldPoint, event.modifiers.shift, context.snapService);
		if (!context.snapService.enabled) { draft.cursor = constrained; draft.snapped = false; draft.pending = null; return constrained; }
		const walls = this.deps.structure().walls, snapped = snapWallPoint(constrained, draft.points, walls, tolerance);
		// An endpoint or previous-point snap wins outright; an axis snap yields to a wall body under the cursor.
		const join = snapped.snapped && !snapped.axis ? null : resolveWallJoin({ walls, point: constrained, tolerance, from, ...(event.modifiers.shift && from ? { ray: constrained } : {}) });
		const cursor = join ? join.point : snapped.point;
		draft.pending = join; draft.cursor = cursor; draft.snapped = join !== null || snapped.snapped;
		return cursor;
	}
	pointerUp(): void { /* Points are placed on pointer down. */ }
	finish(): void { this.deps.finish(); }
	cancel(): void {
		if (this.deps.draft.busy) return;
		const draft = this.deps.draft;
		draft.points = []; draft.cursor = null; draft.pending = null; draft.text.length = ''; draft.room = false; draft.joins.start = null; draft.joins.end = null;
	}
	abandonGesture(): void { /* A focus change preserves completed points. */ }
	hasDraft(): boolean { return this.deps.draft.points.length > 0 || this.deps.draft.text.length !== ''; }
	editCorner(index: number, point: null): boolean {
		if (this.deps.blocked() || point !== null || (index !== -1 && index !== this.deps.draft.points.length - 1)) return false;
		const draft = this.deps.draft;
		draft.points.pop(); draft.room = false; draft.joins.end = null;
		if (!draft.points.length) draft.joins.start = null;
		return true;
	}
}
