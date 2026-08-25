import { contains, distance, translate } from '../../../core/geometry/operations';
import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import type { EntityId } from '../../../core/identity/EntityId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { screenPoint } from '../viewport/Viewport';
import type { UndoableCommand } from './undoable-command';
import type { EditorContext } from './editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from './editor-tool';

/**
 * What SelectTool hit-tests: a generic "spatial object on the active plan" shape so
 * slice 10 can extend the candidate set (Assets) without a parallel select mechanism.
 * Array order IS z-order — last drawn on top — matching how the ZoneLayer stacks them.
 */
export interface SpatialObjectCandidate {
	readonly id: string;
	readonly points: readonly Point[];
}

/**
 * The move gesture factory. One reversible command per drag, built here rather than held:
 * like every adapter in this slice, one instance carries one transaction's forward/inverse
 * pair.
 */
export interface SelectToolDeps {
	readonly spatialObjects: () => readonly SpatialObjectCandidate[];
	readonly createMoveGesture: (
		zoneId: ZoneId,
		forward: Polygon,
		inverse: Polygon,
	) => UndoableCommand;
	/**
	 * Where a refused move reaches the user — validation rejection or failed write. The
	 * draw tool carries the identical seam; a silent discard here would leave the zone
	 * unmoved with the preview gone and no word of why.
	 */
	readonly reportRejected: (error: { message: string }) => void;
}

/** Vertex handles are eight screen pixels across at every zoom (SDD §19). */
const HANDLE_RADIUS_PX = 8;
/**
 * Below this SCREEN displacement, pointerUp is a click, not a drag — converted to world
 * millimetres through the CURRENT camera on every release. A world-fixed epsilon was the
 * first version's defect: 0.5 mm is half a pixel at the default zoom, so ordinary hand
 * jitter during a click dispatched a move command — exactly the history pollution the
 * spec's "a no-op move must not pollute the undo stack" exists to prevent.
 */
const CLICK_EPSILON_PX = 4;

type Gesture =
	| { readonly kind: 'body'; zoneId: ZoneId; original: Polygon; startWorld: Point }
	| { readonly kind: 'vertex'; zoneId: ZoneId; original: Polygon; index: number };

/**
 * The selection tool (design slice 8, SDD §57), scoped to `Zone` because that is the only
 * spatial object type the domain has yet.
 *
 * - **Hit-testing** is a linear scan of the candidate list with Core's point-in-polygon,
 * evaluated TOPMOST-FIRST (reverse array order) so visual stacking order matches
 * selection order on overlapping zones. Correct at any plan size; simply not the fastest
 * at very large ones (SDD §28's spatial index is an optimization this slice deliberately
 * ships without).
 * - **Dragging the body** updates only a transient preview while the pointer moves; domain
 * geometry is untouched mid-drag (SDD §20). On release the total world delta translates
 * the ORIGINAL polygon, every vertex goes back through the snap service, and the result
 * re-validates through `createPolygon` before ONE move gesture is dispatched — one drag,
 * one command, one history entry (SDD §31). A near-zero delta is a pure selection: no
 * command, no history entry.
 * - **Dragging a vertex** replaces exactly that index in the point list through the same
 * snap → validate → dispatch funnel; undo restores the prior list, so only that vertex
 * differs by construction.
 *
 * All arithmetic runs on `event.worldPoint` / `event.screenPoint`; handle proximity is
 * measured in SCREEN pixels against the world→screen projection of each vertex, so a
 * handle stays eight pixels across at every zoom.
 */
export class SelectTool implements EditorTool {
	readonly id: ToolId = 'select';

	private context: EditorContext | null = null;
	private gesture: Gesture | null = null;

	constructor(private readonly deps: SelectToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
		this.gesture = null;
		context.renderState.previewPolygon = null;
	}

	deactivate(): void {
		const context = this.context;
		this.gesture = null;
		if (context !== null) context.renderState.previewPolygon = null;
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || event.button !== 'primary') return;

		// A vertex handle of the ALREADY-SELECTED zone takes precedence over a body hit:
		// once handles are showing they sit on top of the body visually too.
		const selectedIds = context.selection.selectedIds;
		if (selectedIds.length === 1) {
			const selected = this.deps
				.spatialObjects()
				.find((object) => object.id === selectedIds[0]);
			if (selected !== undefined) {
				const vertexIndex = this.vertexAt(context, event, selected.points);
				if (vertexIndex >= 0) {
					this.gesture = {
						kind: 'vertex',
						zoneId: selected.id as ZoneId,
						original: { points: [...selected.points] },
						index: vertexIndex,
					};
					return;
				}
			}
		}

		const hit = this.hitTest(event.worldPoint);
		if (hit === null) {
			context.selection.clear();
			return;
		}
		context.selection.select([hit.id as EntityId<string>]);
		this.gesture = {
			kind: 'body',
			zoneId: hit.id as ZoneId,
			original: { points: [...hit.points] },
			startWorld: event.worldPoint,
		};
		context.renderState.previewPolygon = null;
	}

	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || this.gesture === null) return;
		if (this.gesture.kind === 'body') {
			const by: Vector = {
				dx: event.worldPoint.x - this.gesture.startWorld.x,
				dy: event.worldPoint.y - this.gesture.startWorld.y,
			};
			context.renderState.previewPolygon = translate(this.gesture.original, by).points;
			return;
		}
		const preview = [...this.gesture.original.points];
		preview[this.gesture.index] = event.worldPoint;
		context.renderState.previewPolygon = preview;
	}

	pointerUp(event: EditorPointerEvent): void {
		const context = this.context;
		const gesture = this.gesture;
		if (context === null || gesture === null) return;
		this.gesture = null;

		let forwardPoints: Point[];
		if (gesture.kind === 'body') {
			const by: Vector = {
				dx: event.worldPoint.x - gesture.startWorld.x,
				dy: event.worldPoint.y - gesture.startWorld.y,
			};
			// Camera-scaled: how many world millimetres one screen pixel is right now,
			// measured through the same transform the canvas converts events with.
			const zero = context.viewport.screenToWorld(screenPoint(0, 0));
			const one = context.viewport.screenToWorld(screenPoint(1, 0));
			if (Math.hypot(by.dx, by.dy) <= CLICK_EPSILON_PX * distance(zero, one)) {
				// A click, not a drag: pure selection, nothing dispatched, no history entry.
				context.renderState.previewPolygon = null;
				return;
			}
			forwardPoints = translate(gesture.original, by).points.map((point) =>
				context.snapService.snapPoint(point, {}),
			);
		} else {
			forwardPoints = [...gesture.original.points];
			forwardPoints[gesture.index] = context.snapService.snapPoint(event.worldPoint, {});
		}
		void this.commit(context, gesture.zoneId, gesture.original, forwardPoints);
	}

	cancel(): void {
		const context = this.context;
		this.gesture = null;
		if (context !== null) context.renderState.previewPolygon = null;
	}

	private async commit(
		context: EditorContext,
		zoneId: ZoneId,
		inverse: Polygon,
		forwardPoints: readonly Point[],
	): Promise<void> {
		// Re-validation at the point geometry becomes command input: snapping is arithmetic
		// and must not be trusted blindly (SDD §26's tool-level layer).
		const polygonResult = createPolygon(forwardPoints);
		context.renderState.previewPolygon = null;
		if (!polygonResult.ok) {
			this.deps.reportRejected(polygonResult.error);
			return;
		}
		const result = await context.commandDispatcher.run(
			this.deps.createMoveGesture(zoneId, polygonResult.value, inverse),
		);
		if (!result.ok) this.deps.reportRejected(result.error);
	}

	private hitTest(worldPoint: Point): SpatialObjectCandidate | null {
		// Topmost-first: reverse z-order, so an overlapping stack selects what is on top.
		for (const candidate of [...this.deps.spatialObjects()].toReversed()) {
			const inside = contains({ points: candidate.points }, worldPoint);
			if (inside.ok && inside.value) return candidate;
		}
		return null;
	}

	private vertexAt(
		context: EditorContext,
		event: EditorPointerEvent,
		points: readonly Point[],
	): number {
		// The handle stays HANDLE_RADIUS_PX across at every zoom, so the tolerance is
		// derived from the CURRENT camera: how many world millimetres one screen pixel is
		// right now, measured through the same transform the canvas converts events with.
		const zero = context.viewport.screenToWorld(screenPoint(0, 0));
		const one = context.viewport.screenToWorld(screenPoint(1, 0));
		const toleranceWorld = HANDLE_RADIUS_PX * distance(zero, one);
		for (const [index, point] of points.entries()) {
			if (distance(point, event.worldPoint) <= toleranceWorld) return index;
		}
		return -1;
	}
}
