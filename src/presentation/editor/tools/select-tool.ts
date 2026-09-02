import { translate } from '../../../core/geometry/operations';
import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import type { Point } from '../../../core/geometry/Point';
import type { AppError } from '../../../core/errors/AppError';
import type { Vector } from '../../../core/geometry/Vector';
import type { EntityId } from '../../../core/identity/EntityId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { VERTEX_GRAB_RADIUS_PX } from '../handleMetrics';
import { resolveSelectionTarget, type SelectionTarget } from '../selection/resolveSelectionTarget';
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
	 * Where a refusal the DISPATCHER produced reaches the user — a command that ran and was
	 * refused.
	 *
	 * Paired with `reportInvalidInput` below, and the split is design slice 17's: only a
	 * DISPATCHED failure has passed through `withSaveStateTracking`, so only that one is
	 * already carried by the save indicator. Reporting it again as a toast is one failure
	 * through two widgets that can drift apart. Everything this tool refuses BEFORE building a
	 * command has no indicator behind it and takes the other door.
	 */
	readonly reportRejected: (error: AppError) => void;
	/**
	 * Where a refusal this tool made ITSELF reaches the user — geometry that cannot become a
	 * command, so `commandDispatcher.run` is never entered and nothing downstream has heard
	 * about it.
	 *
	 * A separate door rather than a parameter, because which of the two a call site is holding
	 * is a fact about that line and is what a reader has to be able to see. One shared door
	 * carried both for two slices under a docblock that said so — "validation rejection or
	 * failed write" — and slice 17 bound the pair to one origin on the strength of that
	 * sentence, sending every pre-dispatch refusal to a save-state sink that is deliberately a
	 * no-op. An invalid polygon close went silent. Reported by a review bot.
	 */
	readonly reportInvalidInput: (error: AppError) => void;
}

/**
 * Below this SCREEN displacement, pointerUp is a click, not a drag — converted to world
 * millimetres through the CURRENT camera on every release. A world-fixed epsilon was the
 * first version's defect: 0.5 mm is half a pixel at the default zoom, so ordinary hand
 * jitter during a click dispatched a move command — exactly the history pollution the
 * spec's "a no-op move must not pollute the undo stack" exists to prevent.
 *
 * It is measured on EVERY gesture, body and vertex alike. The second version's defect was
 * applying it only to body drags: a plain click on a vertex handle then teleported that
 * vertex to the click point — up to `VERTEX_GRAB_RADIUS_PX` away, which is 80 mm at the
 * default zoom — and pushed a real move onto the undo stack. Both gestures therefore
 * record where they STARTED, which is the whole reason the vertex arm carries a
 * `startWorld` it otherwise has no use for.
 */
const CLICK_EPSILON_PX = 4;

type Gesture =
	| { readonly kind: 'body'; zoneId: ZoneId; original: Polygon; startWorld: Point }
	| {
			readonly kind: 'vertex';
			zoneId: ZoneId;
			original: Polygon;
			index: number;
			startWorld: Point;
	  };

/**
 * The selection tool (design slice 8, SDD §57), scoped to `Zone` because that is the only
 * spatial object type the domain has yet.
 *
 * - **Hit-testing** is `resolveSelectionTarget` (design spec §6.1, task 11) — the ONE answer
 * to "what would a click here select", asked by `pointerDown` to act and by `pointerMove` to
 * predict, so a hover can never promise a target a click would disagree with. It scans the
 * candidate list TOPMOST-FIRST (reverse array order) with Core's point-in-polygon, so visual
 * stacking order matches selection order on overlapping zones. Correct at any plan size;
 * simply not the fastest at very large ones (SDD §28's spatial index is an optimization this
 * slice deliberately ships without).
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
 * All arithmetic runs on `event.worldPoint`; handle proximity is measured in SCREEN
 * pixels converted through the current camera, so the grab region stays
 * `VERTEX_GRAB_RADIUS_PX` at every zoom. That constant and the radius the
 * `InteractionLayer` DRAWS live together in `../handleMetrics.ts`, which is what keeps
 * "what you see" and "what you can grab" in a stated relationship.
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
		context.renderState.hoveredObjectId = null;
	}

	deactivate(): void {
		const context = this.context;
		this.gesture = null;
		if (context !== null) {
			context.renderState.previewPolygon = null;
			context.renderState.hoveredObjectId = null;
		}
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || event.button !== 'primary') return;

		const { candidates, target } = this.targetAt(context, event.worldPoint);
		// A press is exactly when the predicted hover stops meaning anything, on every path
		// out of this method — a body hit, a handle hit, a miss that clears the selection, and
		// a target the candidate list no longer has: the pointer is about to act rather than
		// merely look, and the resolved target below is what that action works from.
		context.renderState.hoveredObjectId = null;
		if (target === null) {
			context.selection.clear();
			return;
		}
		const hit = candidates.find((candidate) => candidate.id === target.id);
		if (hit === undefined) return;
		if (target.kind === 'handle') {
			this.gesture = {
				kind: 'vertex',
				zoneId: hit.id as ZoneId,
				original: { points: [...hit.points] },
				index: target.vertexIndex,
				startWorld: event.worldPoint,
			};
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
		if (context === null) return;
		if (this.gesture === null) {
			// No drag in flight: this move is a HOVER, so it predicts rather than acts —
			// `resolveSelectionTarget` is the same question `pointerDown` asks, which is what
			// keeps the cursor's promise and the click's outcome unable to disagree.
			const { target } = this.targetAt(context, event.worldPoint);
			context.renderState.hoveredObjectId = target === null ? null : target.id;
			return;
		}
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
		// A mouse shares one `pointerId` across its buttons, and `pointerdown` on a
		// non-primary button never started this gesture — so a secondary or middle release
		// mid-drag must not end it. Without this guard a reflexive right-click during a
		// drag committed the move at the half-finished position and left the real release
		// a silent no-op.
		if (event.button !== 'primary') return;
		this.gesture = null;

		const by: Vector = {
			dx: event.worldPoint.x - gesture.startWorld.x,
			dy: event.worldPoint.y - gesture.startWorld.y,
		};
		// Camera-scaled, and measured for BOTH gesture kinds: below it the pointer never
		// travelled, so there is nothing to move whichever handle it went down on.
		const worldPerPixel = context.viewport.worldPerScreenPixel();
		if (Math.hypot(by.dx, by.dy) <= CLICK_EPSILON_PX * worldPerPixel) {
			// A click, not a drag: pure selection, nothing dispatched, no history entry.
			context.renderState.previewPolygon = null;
			return;
		}

		let forwardPoints: Point[];
		if (gesture.kind === 'body') {
			// ONE snap, of the translated first vertex, and the correction it produces is
			// applied to every point. Snapping each vertex independently was the previous
			// spelling and is not a translation at all: with a live candidate set, one
			// corner would land on a guide while the opposite corner stayed where it was,
			// so a "move" would silently deform the zone and change its area.
			const translated = translate(gesture.original, by).points;
			const anchor = translated[0];
			const snappedAnchor = context.snapService.snapPoint(anchor, {});
			const correction: Vector = {
				dx: snappedAnchor.x - anchor.x,
				dy: snappedAnchor.y - anchor.y,
			};
			forwardPoints = translated.map((point) => ({
				x: point.x + correction.dx,
				y: point.y + correction.dy,
			}));
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

	/**
	 * Identical to `cancel()`, and that is a fact about THIS tool rather than about the pair:
	 * everything it holds between clicks is the drag, so the deliberate abandonment and the
	 * interrupted one have the same work to do. A multi-click tool is where the two diverge.
	 */
	abandonGesture(): void {
		this.cancel();
	}

	/** A drag in flight is the whole of what this tool would lose to `cancel()`. */
	hasDraft(): boolean {
		return this.gesture !== null;
	}

	/**
	 * `resolveSelectionTarget`'s input, built ONCE — `pointerDown` and `pointerMove`'s hover
	 * arm ask the identical question of the identical state, and a second hand-built copy of
	 * this object is a second place a future field has to be added. Candidates travel back out
	 * alongside the target because `pointerDown` still needs the materialised list for its own
	 * `.find` afterwards, and re-calling `spatialObjects()` there would be the two-calls-per-
	 * gesture cost this method already exists to avoid.
	 */
	private targetAt(
		context: EditorContext,
		worldPoint: Point,
	): { readonly candidates: readonly SpatialObjectCandidate[]; readonly target: SelectionTarget } {
		const candidates = this.deps.spatialObjects();
		const target = resolveSelectionTarget({
			candidates,
			selectedIds: context.selection.selectedIds.map(String),
			worldPoint,
			handleToleranceWorld: VERTEX_GRAB_RADIUS_PX * context.viewport.worldPerScreenPixel(),
		});
		return { candidates, target };
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
			// Pre-dispatch: no command exists yet, so no indicator has heard about this.
			this.deps.reportInvalidInput(polygonResult.error);
			return;
		}
		const result = await context.commandDispatcher.run(
			this.deps.createMoveGesture(zoneId, polygonResult.value, inverse),
		);
		if (!result.ok) this.deps.reportRejected(result.error);
	}
}
