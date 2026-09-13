import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../tools/editor-tool';
import type { Point } from '../../../core/geometry/Point';
import type { Structure } from '../../../domain/spatial/Structure';
import { resolveWallJoin } from '../../../domain/spatial/wallJoin';
import { constrainDrawingPoint } from '../snapping/constrainDrawingPoint';
import { addWallPoint, endOnWall, pickHost, startFromWall, type StructureDraft, type StructureToolId } from './structureDraft';

/** Eight screen pixels in world millimetres, capped so a zoomed-out camera does not snap across a room. */
const toleranceAt = (context: EditorContext): number => Math.min(100, 8 * context.viewport.worldPerScreenPixel());

export class StructureTool implements EditorTool {
	private context: EditorContext | null = null;
	constructor(readonly id: StructureToolId, private readonly deps: { draft: StructureDraft; structure: () => Structure; start: (kind: StructureToolId) => void; stop: () => void; finish: () => void; blocked: () => boolean }) {}
	activate(context: EditorContext): void { this.context = context; this.deps.start(this.id); }
	deactivate(): void { if (this.context) this.context.renderState.snapGuides = []; this.context = null; this.deps.stop(); }
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
	/**
	 * Moves the draw-wall cursor — constrained, snapped, and joined to a wall body when one is under it — and answers where it
	 * landed, drawing the smart guides that say why. The axis stage lines up with EVERY corner of the chain, not only the last, so
	 * a rectangle's fourth corner lands square with its first; and with the floor's own geometry through `snapCandidates`.
	 */
	private trackWall(event: EditorPointerEvent, context: EditorContext): Point {
		const tolerance = toleranceAt(context), draft = this.deps.draft, snap = context.snapService;
		const from = draft.points.at(-1), constrained = constrainDrawingPoint(from, event.worldPoint, event.modifiers.shift, snap);
		context.renderState.snapGuides = [];
		if (!snap.enabled) { draft.cursor = constrained; draft.snapped = false; draft.pending = null; return constrained; }
		const walls = this.deps.structure().walls;
		// An endpoint snap wins outright; an axis alignment yields to a wall body under the cursor.
		const endpoint = snap.snapToVertex(constrained, [...draft.points, ...walls.flatMap(wall => [wall.start, wall.end])], tolerance);
		const aligned = endpoint ? { point: endpoint, guides: [{ start: constrained, end: endpoint }] }
			: snap.snapPointWithGuides(constrained, { alignments: [...draft.points, ...(context.snapCandidates().alignments ?? [])] }, tolerance);
		const join = endpoint ? null : resolveWallJoin({ walls, point: constrained, tolerance, from, ...(event.modifiers.shift && from ? { ray: constrained } : {}) });
		const cursor = join ? join.point : aligned.point;
		draft.pending = join; draft.cursor = cursor; draft.snapped = join !== null || aligned.guides.length > 0;
		context.renderState.snapGuides = join ? [] : aligned.guides;
		return cursor;
	}
	pointerUp(): void { /* Points are placed on pointer down. */ }
	finish(): void { this.deps.finish(); }
	cancel(): void {
		if (this.deps.draft.busy) return;
		const draft = this.deps.draft;
		if (this.context) this.context.renderState.snapGuides = [];
		draft.points = []; draft.cursor = null; draft.pending = null; draft.text.length = ''; draft.room = false; draft.joins.start = null; draft.joins.end = null;
	}
	/** A focus change preserves completed points; only the guides, which describe a pointer no longer there, go. */
	abandonGesture(): void { if (this.context) this.context.renderState.snapGuides = []; }
	hasDraft(): boolean { return this.deps.draft.points.length > 0 || this.deps.draft.text.length !== ''; }
	editCorner(index: number, point: null): boolean {
		if (this.deps.blocked() || point !== null || (index !== -1 && index !== this.deps.draft.points.length - 1)) return false;
		const draft = this.deps.draft;
		draft.points.pop(); draft.room = false; draft.joins.end = null;
		if (!draft.points.length) draft.joins.start = null;
		return true;
	}
}
