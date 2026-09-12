import type { SpatialElementKind } from '../../../domain/spatial/SpatialElement';
import type { StairOptions } from '../../../domain/spatial/stairGeometry';
import { MarqueeSelection } from '../selection/MarqueeSelection';
import type { SelectionInteractions } from '../selection/selectionInteractions';
import { translate } from '../../../core/geometry/operations';
import { ElementRotation, type RotationGestureDeps } from '../elements/ElementRotation';
import { rotationControlApproachContains, rotationControlContains, type RotationControlGeometry } from '../elements/rotationControl';
import { ElementMove, type ElementMoveDeps } from '../elements/ElementMove';
import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import type { Point } from '../../../core/geometry/Point';
import type { AppError } from '../../../core/errors/AppError';
import type { Vector } from '../../../core/geometry/Vector';
import { selectSpatial } from '../selection/selectSpatial';
import type { EntityId } from '../../../core/identity/EntityId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { LabelMove, type LabelMoveDeps } from '../labels/LabelMove';
import { CLICK_EPSILON_PX, VERTEX_GRAB_RADIUS_PX, SELECTION_BADGE_RADIUS_PX, LABEL_GRAB_PADDING_PX } from '../handleMetrics';
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
	readonly kind?: 'wall' | 'opening' | SpatialElementKind;
	readonly width?: number;
	readonly id: string;
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
	/** A derived hit/framing projection; gestures always retain the canonical points. */
	readonly hitPoints?: readonly Point[];
	readonly stair?: StairOptions;
	readonly assetId?: string;
}

/**
 * The move gesture factory. One reversible command per drag, built here rather than held:
 * like every adapter in this slice, one instance carries one transaction's forward/inverse
 * pair.
 */
export interface SelectToolDeps extends ElementMoveDeps, RotationGestureDeps, SelectionInteractions, LabelMoveDeps {
	readonly previewWall?: (id: string | null, end?: Point) => void;
	readonly editWall?: (id: string, end: Point) => void;
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
	private readonly marquee = new MarqueeSelection();
	private wallGesture: { id: string; start: Point } | null = null;
	readonly id: ToolId = 'select';

	private context: EditorContext | null = null;
	private gesture: Gesture | null = null;

	private readonly elementMove: ElementMove;
	private readonly elementRotation: ElementRotation;
	private readonly labelMove: LabelMove;
	constructor(private readonly deps: SelectToolDeps) { this.elementMove = new ElementMove(deps); this.elementRotation = new ElementRotation(deps); this.labelMove = new LabelMove(deps); }

	activate(context: EditorContext): void {
		this.context = context;
		this.gesture = null;
		context.renderState.previewPolygon = null;
		context.renderState.hoveredObjectId = null;
		context.renderState.hoveredTargetKind = null;
		context.renderState.rotationHoverId = null;
		context.renderState.rotationHoverSuppressed = false;
	}

	deactivate(): void {
		const context = this.discardGesture();
		if (context !== null) {
			context.renderState.hoveredObjectId = null;
			context.renderState.hoveredTargetKind = null;
			context.renderState.rotationHoverId = null;
			context.renderState.rotationHoverSuppressed = false;
		}
		this.context = null;
	}

	pointerDown(input: EditorPointerEvent): void {
		const context = this.context, event = this.withMode(input);
		if (context === null || event.button !== 'primary') return;
		context.renderState.rotationHoverSuppressed = this.rotationSuppressed(event);

		const { candidates, target, rotationControl } = this.targetAt(context, event);
		// A press is exactly when the predicted hover stops meaning anything, on every path
		// out of this method — a body hit, a handle hit and a miss that clears the
		// selection: the pointer is about to act rather than
		// merely look, and the resolved target below is what that action works from. The KIND
		// goes with the id: they are one fact in two fields (see `RenderState`).
		context.renderState.hoveredObjectId = null;
		context.renderState.hoveredTargetKind = null;
		context.renderState.rotationHoverId = null;
		if (target === null) {
			this.marquee.start(context, event);
			return;
		}
		if (target.kind === 'rotation') { this.startRotation(context, event, target.id, rotationControl); return; }
		if (target.kind === 'label') { this.labelMove.start(context, event, target.id); return; }
		// `resolveSelectionTarget` was handed this same `candidates` array, and every non-rotation
		// id it answers comes out of it: `handleAt` and `badgeAt` find the id there first, and
		// `bodyAt` iterates it. A rotation target has already returned above.
		const hit = candidates.find((candidate) => candidate.id === target.id) as SpatialObjectCandidate;
		if (this.focusSelectedMember(context, event, hit.id)) return;
		if (target.kind === 'body' && this.selectGroup(context, event, hit.id)) return;
		if (hit.kind) { this.selectStructure(context, event, hit, target); return; }
		if (target.kind === 'handle') {
			// While the canvas is stale the gate would refuse the commit anyway; a ghost the
			// release cannot keep is a promise, so no gesture begins — the vertex handle stays
			// on an already-selected zone, but grabbing it starts no drag (design spec §2.9,
			// trust path).
			if (context.writesBlocked()) return;
			this.gesture = {
				kind: 'vertex',
				zoneId: hit.id as ZoneId,
				original: { points: [...hit.points] },
				index: target.vertexIndex,
				startWorld: event.worldPoint,
			};
			return;
		}
		selectSpatial(context.selection, hit.id, event.modifiers.shift);
		// Modified clicks choose records only; they never start an accidental edit.
		if (event.modifiers.shift || event.modifiers.alt) return;
		// While the canvas is stale the gate would refuse the commit anyway; a ghost the release
		// cannot keep is a promise, so no gesture begins. Selection still happens — inspecting
		// stays available (design spec §2.9).
		if (context.writesBlocked()) return;
		this.gesture = {
			kind: 'body',
			zoneId: hit.id as ZoneId,
			original: { points: [...hit.points] },
			startWorld: event.worldPoint,
		};
		context.renderState.previewPolygon = null;
	}

	/**
	 * The "select multiple" mode reads as a held Shift, so a click and the hover predicting it
	 * both choose rather than edit. Only the press and the hover: a move mid-gesture keeps the
	 * physical Shift, which is the rotation snap there, not a selection modifier.
	 */
	private withMode(event: EditorPointerEvent): EditorPointerEvent {
		return this.deps.multiSelectionMode?.() === true ? { ...event, modifiers: { ...event.modifiers, shift: true } } : event;
	}
	/**
	 * Alt bypasses the rotation control, and so does the "select multiple" mode: a physical Shift
	 * still rotates, but a touch user building a set has no Alt, and a tap inside the control's hit
	 * zone would otherwise rotate or open the precise form instead of choosing.
	 */
	private rotationSuppressed(event: EditorPointerEvent): boolean {
		return event.modifiers.alt || this.deps.multiSelectionMode?.() === true;
	}
	private focusSelectedMember(context: EditorContext, event: EditorPointerEvent, id: string): boolean {
		if (event.modifiers.shift || event.modifiers.alt || context.selection.selectedIds.length < 2 || !context.selection.isSelected(id as EntityId<string>)) return false;
		if (!context.writesBlocked()) this.deps.selectionMove?.start(context.selection.selectedIds, event);
		context.selection.focus(id as EntityId<string>); return true;
	}
	private selectGroup(context: EditorContext, event: EditorPointerEvent, id: string): boolean {
		const ids = this.deps.expandSelection?.(id, event.modifiers.alt);
		if (!ids || ids.length < 2) return false;
		const selected = context.selection.selectedIds;
		const result = event.modifiers.shift
			? ids.every(member => selected.some(value => value === member)) ? selected.filter(value => !ids.includes(value)) : [...selected, ...ids]
			: ids;
		context.selection.select(result.map(value => value as EntityId<string>));
		if (!event.modifiers.shift && !event.modifiers.alt && !context.writesBlocked()) this.deps.selectionMove?.start(context.selection.selectedIds, event);
		return true;
	}
	private selectStructure(context: EditorContext, event: EditorPointerEvent, hit: SpatialObjectCandidate, target: Exclude<SelectionTarget, null>): void {
		selectSpatial(context.selection, hit.id, event.modifiers.shift);
		if (hit.kind !== 'wall' && hit.kind !== 'opening') this.elementMove.start(context, event, hit, target.kind === 'handle' ? target.vertexIndex : undefined);
		if (hit.kind === 'wall' && target.kind === 'handle' && target.vertexIndex === 1 && !context.writesBlocked()) this.wallGesture = { id: hit.id, start: event.worldPoint };
	}

	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null) return;
		if (this.deps.selectionMove?.active) { this.deps.selectionMove.move(event); return; }
		if (this.labelMove.move(event)) return;
		if (this.marquee.active) { this.marquee.move(context, event); return; }
		if (this.elementRotation.active) { this.elementRotation.move(context, event); return; }
		if (this.elementMove.active) { this.elementMove.move(event); return; }
		if (this.wallGesture) { this.deps.previewWall?.(this.wallGesture.id, event.worldPoint); return; }
		if (this.gesture === null) {
			this.updateHover(context, event);
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
	private updateHover(context: EditorContext, event: EditorPointerEvent): void {
		// Ordinary hover predicts the same body/handle as a click; affordance approach stays separate.
		context.renderState.rotationHoverSuppressed = this.rotationSuppressed(event);
		const { target } = this.targetAt(context, this.withMode(event));
		context.renderState.rotationHoverId = target?.kind === 'rotation' ? target.id : this.approachingRotation(context, event) ?? target?.id ?? null;
		context.renderState.hoveredObjectId = target === null ? null : target.id;
		context.renderState.hoveredTargetKind = target === null ? null : target.kind;
	}

	private finishSelectionGesture(event: EditorPointerEvent): boolean {
		if (this.deps.selectionMove?.active) { if (event.button === 'primary') this.deps.selectionMove.finish(event); return true; }
		if (this.marquee.active && this.context) {
			this.marquee.finish(this.context, event, this.deps.spatialObjects(), this.deps.expandSelection ? (id, deep) => this.deps.expandSelection?.(id, deep) ?? [] : undefined);
			return true;
		}
		return false;
	}
	private finishWallGesture(event: EditorPointerEvent): boolean {
		if (!this.wallGesture || event.button !== 'primary') return false;
		const gesture = this.wallGesture; this.wallGesture = null;
		if (Math.hypot(event.worldPoint.x - gesture.start.x, event.worldPoint.y - gesture.start.y) <= 1) { this.deps.previewWall?.(null); return true; }
		// The dragged end stays previewed through the read and the review form; `editWall` clears it.
		this.deps.previewWall?.(gesture.id, event.worldPoint);
		this.deps.editWall?.(gesture.id, event.worldPoint);
		return true;
	}
	pointerUp(event: EditorPointerEvent): void {
		if (this.finishSelectionGesture(event)) return;
		if (this.labelMove.finish(event)) return;
		if (this.elementRotation.active && this.context) { this.elementRotation.finish(this.context, event); return; }
		if (this.elementMove.active && this.context) { this.elementMove.finish(this.context, event); return; }
		if (this.finishWallGesture(event)) return;
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

	private discardGesture(): EditorContext | null {
		this.deps.selectionMove?.cancel();
		this.elementMove.cancel(); this.elementRotation.cancel(); this.labelMove.cancel();
		this.wallGesture = null;
		this.deps.previewWall?.(null);
		const context = this.context;
		this.gesture = null;
		if (context !== null) { this.marquee.cancel(context); context.renderState.previewPolygon = null; }
		return context;
	}

	cancel(): void {
		this.discardGesture();
		// Deliberately clears neither hover field, unlike `activate`/`deactivate`/`pointerDown`
		// above: a cancelled drag leaves the pointer still resting over its target, so the
		// prediction (`hoveredObjectId`/`hoveredTargetKind`) is still true. R8's "cleared
		// together at every site" means "every site that clears one clears both" — this site
		// satisfies that by clearing neither.
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
		return this.deps.selectionMove?.active === true || this.marquee.active || this.gesture !== null || this.wallGesture !== null || this.elementMove.active || this.elementRotation.active || this.labelMove.active;
	}

	/**
	 * `resolveSelectionTarget`'s input, built ONCE — `pointerDown` and `pointerMove`'s hover
	 * arm ask the identical question of the identical state, and a second hand-built copy of
	 * this object is a second place a future field has to be added. Candidates travel back out
	 * alongside the target because `pointerDown` still needs the materialised list for its own
	 * `.find` afterwards, and re-calling `spatialObjects()` there would be the two-calls-per-
	 * gesture cost this method already exists to avoid.
	 */
	private approachingRotation(context: EditorContext, event: EditorPointerEvent): string | null {
		if (this.rotationSuppressed(event) || !this.deps.rotationControls) return null;
		const target = this.deps.rotationDisplayTarget?.();
		return target && this.deps.rotationControls().some(control => rotationControlApproachContains(control, event.worldPoint, context.viewport.worldPerScreenPixel())) ? target.id : null;
	}
	private selectRotationTarget(context: EditorContext, id: string): boolean {
		const current = this.deps.rotationTarget?.();
		const member = context.selection.selectedIds.some(selectedId => selectedId === id);
		if (member) return context.selection.selectedIds.length < 2 || current?.id === id;
		if (current?.id === id) return true;
		const ids = this.deps.expandSelection?.(id, false) ?? [id];
		if (!ids.length) return false;
		context.selection.select(ids.map(value => value as EntityId<string>));
		return true;
	}
	private startRotation(context: EditorContext, event: EditorPointerEvent, id: string, control: RotationControlGeometry | null | undefined): void {
		if (!control || context.writesBlocked() || !this.selectRotationTarget(context, id)) return;
		const shape = this.deps.rotationTarget?.();
		if (shape?.id === id) this.elementRotation.start(context, event, shape, control);
	}
	private rotationAt(context: EditorContext, event: EditorPointerEvent) {
		const selected = this.deps.rotationDisplayTarget ? this.deps.rotationDisplayTarget() : this.deps.rotationTarget?.();
		const control = this.deps.rotationControls ? this.deps.rotationControls().find(candidate => rotationControlContains(candidate.bounds, event.worldPoint)) : this.deps.rotationControl?.();
		const decoration = control && selected && this.deps.canRotateShape?.(selected.id) !== false && !context.writesBlocked() && !this.rotationSuppressed(event) ? { id: selected.id, bounds: control.bounds } : undefined;
		return { decoration, control, hit: decoration !== undefined && rotationControlContains(decoration.bounds, event.worldPoint) };
	}
	private targetAt(
		context: EditorContext,
		event: EditorPointerEvent,
	): { readonly candidates: readonly SpatialObjectCandidate[]; readonly target: SelectionTarget; readonly rotationControl: RotationControlGeometry | null | undefined } {
		const candidates = this.deps.spatialObjects();
		const rotation = this.rotationAt(context, event);
		const target = resolveSelectionTarget({
			rotationHandle: rotation.decoration,
			candidates,
			selectedIds: event.modifiers.shift && !rotation.hit ? [] : context.selection.selectedIds.map(String),
			worldPoint: event.worldPoint,
			handleToleranceWorld: VERTEX_GRAB_RADIUS_PX * context.viewport.worldPerScreenPixel(),
			cycle: event.modifiers.alt,
			badgeToleranceWorld: SELECTION_BADGE_RADIUS_PX * context.viewport.worldPerScreenPixel(),
			labels: this.deps.labelHits?.(),
			labelToleranceWorld: LABEL_GRAB_PADDING_PX * context.viewport.worldPerScreenPixel(),
		});
		return { candidates, target, rotationControl: rotation.control };
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
		if (!polygonResult.ok) {
			context.renderState.previewPolygon = null;
			// Pre-dispatch: no command exists yet, so no indicator has heard about this.
			this.deps.reportInvalidInput(polygonResult.error);
			return;
		}
		// The ghost stays at the drop until the dispatcher has written AND read back: clearing it
		// first drew the saved geometry for that whole window, so the zone flicked back.
		context.renderState.previewPolygon = polygonResult.value.points;
		const shown = context.renderState.previewPolygon;
		const result = await context.commandDispatcher.run(
			this.deps.createMoveGesture(zoneId, polygonResult.value, inverse),
		);
		// Anything that took the field while this write was pending (a new drag) owns it now.
		if (context.renderState.previewPolygon === shown) context.renderState.previewPolygon = null;
		if (!result.ok) this.deps.reportRejected(result.error);
	}
}
