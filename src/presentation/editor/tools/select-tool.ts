import type { SpatialElementKind } from '../../../domain/spatial/SpatialElement';
import type { StairOptions } from '../../../domain/spatial/stairGeometry';
import type { Dimensions } from '../../../domain/asset/AssetShape';
import { MarqueeSelection } from '../selection/MarqueeSelection';
import type { SelectionInteractions } from '../selection/selectionInteractions';
import { translate } from '../../../core/geometry/operations';
import { ElementRotation, type RotationGestureDeps } from '../elements/ElementRotation';
import { rotationControlContains, type RotationControlGeometry } from '../elements/rotationControl';
import type { RotationShape } from '../elements/objectRotation';
import { ElementMove, type ElementMoveDeps } from '../elements/ElementMove';
import { ElementResize, type ElementResizeDeps } from '../elements/ElementResize';
import { OpeningResize, type OpeningResizeDeps } from '../structure/OpeningResize';
import type { OpeningGrip, OpeningHandle } from '../structure/openingHandles';
import { NUDGE_STEP_MM, NUDGE_STEP_SHIFT_MM } from '../surface/keyboard';
import { transformHandlePoints } from '../elements/transformBox';
import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import type { Point } from '../../../core/geometry/Point';
import type { AppError } from '../../../core/errors/AppError';
import type { Vector } from '../../../core/geometry/Vector';
import { selectSpatial } from '../selection/selectSpatial';
import type { EntityId } from '../../../core/identity/EntityId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { LabelMove, type LabelMoveDeps } from '../labels/LabelMove';
import { CLICK_EPSILON_PX, VERTEX_GRAB_RADIUS_PX, SELECTION_BADGE_RADIUS_PX, LABEL_GRAB_PADDING_PX, SNAP_TOLERANCE_PX } from '../handleMetrics';
import { openingHandleAt, resolveSelectionTarget, type SelectionTarget } from '../selection/resolveSelectionTarget';
import type { SnapCandidates } from '../snapping/snap-service';
import type { UndoableCommand } from './undoable-command';
import type { EditorContext } from './editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from './editor-tool';

/** The selected target's own rotate arrow under the pointer, and the shape it turns. */
interface RotationGrip {
	readonly shape: RotationShape;
	readonly control: RotationControlGeometry;
}

/**
 * What SelectTool hit-tests: a generic "spatial object on the active plan" shape so
 * slice 10 can extend the candidate set (Assets) without a parallel select mechanism.
 * Array order IS z-order — last drawn on top — matching how the ZoneLayer stacks them.
 */
export interface SpatialObjectCandidate {
	readonly kind?: 'wall' | 'opening' | SpatialElementKind;
	readonly width?: number;
	readonly loadBearing?: boolean;
	readonly offset?: number;
	readonly flipped?: boolean;
	readonly id: string;
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
	/** A derived hit/framing projection; gestures always retain the canonical points. */
	readonly hitPoints?: readonly Point[];
	/** Compound derived bodies, such as an asymmetric wall and its outer join wedges. */
	readonly hitRegions?: readonly (readonly Point[])[];
	readonly stair?: StairOptions;
	readonly assetId?: string;
	readonly size?: Dimensions;
}

/**
 * The move gesture factory. One reversible command per drag, built here rather than held:
 * like every adapter in this slice, one instance carries one transaction's forward/inverse
 * pair.
 */
export interface SelectToolDeps extends ElementMoveDeps, ElementResizeDeps, RotationGestureDeps, SelectionInteractions, LabelMoveDeps, OpeningResizeDeps {
	/** Selection remains available when false; only geometry gestures are withheld. */
	readonly canMutateGeometry?: () => boolean;
	/** The selected opening's handles, or `null` where none are offered; the same points that are drawn. */
	readonly openingHandles?: () => { readonly id: string; readonly handles: readonly OpeningHandle[] } | null;
	readonly stepOpening?: (id: string, deltaMm: number) => void;
	readonly flipOpening?: (id: string, side: 'left' | 'right') => void;
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
 * geometry is untouched mid-drag (SDD §20). Preview and release alike translate the
 * ORIGINAL polygon by the total world delta through ONE `snapTranslation`, and the result
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
	private readonly elementResize: ElementResize;
	private readonly labelMove: LabelMove;
	private readonly openingResize: OpeningResize;
	constructor(private readonly deps: SelectToolDeps) { this.elementMove = new ElementMove(deps); this.elementRotation = new ElementRotation(deps); this.elementResize = new ElementResize(deps); this.labelMove = new LabelMove(deps); this.openingResize = new OpeningResize(deps); }
	private canMutateGeometry(): boolean { return this.deps.canMutateGeometry?.() !== false; }

	activate(context: EditorContext): void {
		this.context = context;
		this.gesture = null;
		context.renderState.previewPolygon = null;
		context.renderState.hoveredObjectId = null;
		context.renderState.hoveredTargetKind = null;
		context.renderState.rotationHoverSuppressed = false;
	}

	deactivate(): void {
		const context = this.discardGesture();
		if (context !== null) {
			context.renderState.hoveredObjectId = null;
			context.renderState.hoveredTargetKind = null;
			context.renderState.rotationHoverSuppressed = false;
		}
		this.context = null;
	}

	pointerDown(input: EditorPointerEvent): void {
		const context = this.context, event = this.withMode(input);
		if (context === null || event.button !== 'primary') return;
		context.renderState.rotationHoverSuppressed = this.rotationSuppressed(event);

		const { candidates, target, grip } = this.targetAt(context, event);
		const canMutate = this.canMutateGeometry();
		// A press is exactly when the predicted hover stops meaning anything, on every path
		// out of this method — a body hit, a handle hit and a miss that clears the
		// selection: the pointer is about to act rather than
		// merely look, and the resolved target below is what that action works from. The KIND
		// goes with the id: they are one fact in two fields (see `RenderState`).
		context.renderState.hoveredObjectId = null;
		context.renderState.hoveredTargetKind = null;
		if (target === null) {
			this.marquee.start(context, event);
			return;
		}
		if (this.startDirectGesture(context, event, target, grip)) return;
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
			if (context.writesBlocked() || !canMutate) return;
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
		if (event.modifiers.shift || event.modifiers.alt || !canMutate) return;
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
		if (!context.writesBlocked() && this.canMutateGeometry()) this.deps.selectionMove?.start(context.selection.selectedIds, event);
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
		if (!event.modifiers.shift && !event.modifiers.alt && !context.writesBlocked() && this.canMutateGeometry()) this.deps.selectionMove?.start(context.selection.selectedIds, event);
		return true;
	}
	private selectStructure(context: EditorContext, event: EditorPointerEvent, hit: SpatialObjectCandidate, target: Exclude<SelectionTarget, null>): void {
		selectSpatial(context.selection, hit.id, event.modifiers.shift);
		if (!this.canMutateGeometry()) return;
		if (hit.kind !== 'wall' && hit.kind !== 'opening') this.elementMove.start(context, event, hit, target.kind === 'handle' ? target.vertexIndex : undefined);
		if (hit.kind === 'wall' && target.kind === 'handle' && target.vertexIndex === 1 && !context.writesBlocked()) this.wallGesture = { id: hit.id, start: event.worldPoint };
	}

	/**
	 * The dragged zone at `event`, through ONE snap call for either gesture kind: a body is
	 * translated by the total delta and corrected by `snapTranslation` — so the shape stays
	 * rigid — and a vertex goes through `snapPointWithGuides`; both write the guides.
	 * `pointerMove` and `pointerUp` both call this, which is what makes the preview unable to
	 * drift from the commit. `candidates` is the caller's, because `pointerMove` hands `{}`
	 * below the click epsilon: the release discards that gesture (`isClick`), so a snapped
	 * preview there would flick the zone up to a tolerance toward a neighbour and back on a
	 * jittering tap. With no candidates the service answers the raw point and no guides.
	 */
	private moved(context: EditorContext, gesture: Gesture, event: EditorPointerEvent, candidates: SnapCandidates): Point[] {
		const tolerance = SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel();
		if (gesture.kind === 'body') {
			const translated = translate(gesture.original, this.deltaOf(gesture, event)).points;
			const snap = context.snapService.snapTranslation(translated, candidates, tolerance);
			context.renderState.snapGuides = snap.guides;
			return translated.map((point) => ({ x: point.x + snap.correction.dx, y: point.y + snap.correction.dy }));
		}
		const snap = context.snapService.snapPointWithGuides(event.worldPoint, candidates, tolerance);
		context.renderState.snapGuides = snap.guides;
		const points = [...gesture.original.points];
		points[gesture.index] = snap.point;
		return points;
	}
	private deltaOf(gesture: Gesture, event: EditorPointerEvent): Vector {
		return { dx: event.worldPoint.x - gesture.startWorld.x, dy: event.worldPoint.y - gesture.startWorld.y };
	}
	/**
	 * Camera-scaled, and measured for BOTH gesture kinds: below it the pointer never travelled,
	 * so there is nothing to move whichever handle it went down on. The ONE epsilon the move's
	 * preview and the release's commit judge by.
	 */
	private isClick(context: EditorContext, gesture: Gesture, event: EditorPointerEvent): boolean {
		const by = this.deltaOf(gesture, event);
		return Math.hypot(by.dx, by.dy) <= CLICK_EPSILON_PX * context.viewport.worldPerScreenPixel();
	}

	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null) return;
		if (!this.canMutateGeometry() || context.writesBlocked()) this.cancelGeometryGesture();
		if (this.deps.selectionMove?.active) { this.deps.selectionMove.move(event); return; }
		if (this.labelMove.move(event)) return;
		if (this.marquee.active) { this.marquee.move(context, event); return; }
		if (this.elementRotation.active) { this.elementRotation.move(context, event); return; }
		if (this.elementResize.active) { this.elementResize.move(context, event); return; }
		if (this.openingResize.active) { this.openingResize.move(context, event); return; }
		if (this.elementMove.active) { this.elementMove.move(event); return; }
		if (this.wallGesture) { this.deps.previewWall?.(this.wallGesture.id, event.worldPoint); return; }
		if (this.gesture === null) {
			this.updateHover(context, event);
			return;
		}
		const candidates = this.isClick(context, this.gesture, event) ? {} : context.snapCandidates([this.gesture.zoneId]);
		context.renderState.previewPolygon = this.moved(context, this.gesture, event, candidates);
	}
	private updateHover(context: EditorContext, event: EditorPointerEvent): void {
		// Ordinary hover predicts the same body/handle as a click.
		context.renderState.rotationHoverSuppressed = this.rotationSuppressed(event);
		const { target } = this.targetAt(context, this.withMode(event));
		const canMutate = this.canMutateGeometry();
		context.renderState.hoveredObjectId = target === null ? null : target.id;
		context.renderState.hoveredTargetKind = target === null ? null : canMutate ? target.kind : 'body';
	}
	private startDirectGesture(context: EditorContext, event: EditorPointerEvent, target: Exclude<SelectionTarget, null>, grip: RotationGrip | undefined): boolean {
		if (target.kind !== 'rotation' && target.kind !== 'label' && target.kind !== 'resize' && target.kind !== 'opening-handle') return false;
		if (!this.canMutateGeometry()) { selectSpatial(context.selection, target.id, event.modifiers.shift); return true; }
		// A `rotation` target is only ever resolved from `grip`: the selected target's own arrow.
		if (target.kind === 'rotation') { const { shape, control } = grip as RotationGrip; this.elementRotation.start(context, event, shape, control); }
		else if (target.kind === 'resize') this.startResize(context, event, target.handleIndex);
		else if (target.kind === 'opening-handle') this.startOpeningGrip(context, event, target);
		else this.labelMove.start(context, event, target.id);
		return true;
	}
	private startResize(context: EditorContext, event: EditorPointerEvent, index: number): void {
		const frame = this.deps.transformBox?.();
		if (frame) this.elementResize.start(context, event, frame, index);
	}
	/**
	 * The arrows are TAPS — they write on the press and start no gesture, because there is nothing
	 * to preview between a press and a release. The circles are drags. Shift takes the larger step,
	 * the same one Shift takes on an arrow key.
	 */
	private startOpeningGrip(context: EditorContext, event: EditorPointerEvent, target: { readonly id: string; readonly grip: OpeningGrip }): void {
		if (target.grip === 'step-back' || target.grip === 'step-forward') {
			const step = event.modifiers.shift ? NUDGE_STEP_SHIFT_MM : NUDGE_STEP_MM;
			this.deps.stepOpening?.(target.id, target.grip === 'step-back' ? -step : step);
			return;
		}
		if (target.grip === 'side-left' || target.grip === 'side-right') {
			this.deps.flipOpening?.(target.id, target.grip === 'side-left' ? 'left' : 'right');
			return;
		}
		this.openingResize.start(context, event, target.id, target.grip);
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
	/** Rotation, resize and move each own a drag the same way; whichever is active finishes it and nothing else does. */
	private finishElementGesture(context: EditorContext, event: EditorPointerEvent): boolean {
		if (this.elementRotation.active) { this.elementRotation.finish(context, event); return true; }
		if (this.elementResize.active) { this.elementResize.finish(context, event); return true; }
		if (this.openingResize.active) { this.openingResize.finish(context, event); return true; }
		if (this.elementMove.active) { this.elementMove.finish(context, event); return true; }
		return false;
	}
	pointerUp(event: EditorPointerEvent): void {
		if (!this.canMutateGeometry() || this.context?.writesBlocked()) this.cancelGeometryGesture();
		if (this.finishSelectionGesture(event)) return;
		if (this.labelMove.finish(event)) return;
		if (this.context && this.finishElementGesture(this.context, event)) return;
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

		if (this.isClick(context, gesture, event)) {
			// A click, not a drag: pure selection, nothing dispatched, no history entry.
			context.renderState.previewPolygon = null;
			context.renderState.snapGuides = [];
			return;
		}

		const forwardPoints = this.moved(context, gesture, event, context.snapCandidates([gesture.zoneId]));
		context.renderState.snapGuides = [];
		void this.commit(context, gesture.zoneId, gesture.original, forwardPoints);
	}

	/** Retire only undispatched geometry. Selection marquees and pending writes keep their owner. */
	cancelGeometryGesture(): boolean {
		if (!this.gesture && !this.wallGesture && !this.elementMove.active && !this.elementRotation.active && !this.elementResize.active && !this.openingResize.active && !this.labelMove.active && !this.deps.selectionMove?.active) return false;
		this.deps.selectionMove?.cancel();
		this.elementMove.cancel(); this.elementRotation.cancel(); this.elementResize.cancel(); this.openingResize.cancel(); this.labelMove.cancel();
		this.wallGesture = null;
		this.deps.previewWall?.(null);
		const context = this.context;
		this.gesture = null;
		if (context !== null) { context.renderState.previewPolygon = null; context.renderState.snapGuides = []; }
		return true;
	}

	private discardGesture(): EditorContext | null {
		this.cancelGeometryGesture();
		const context = this.context;
		if (context !== null) { this.marquee.cancel(context); context.renderState.previewPolygon = null; context.renderState.snapGuides = []; }
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
		return this.deps.selectionMove?.active === true || this.marquee.active || this.gesture !== null || this.wallGesture !== null || this.elementMove.active || this.elementRotation.active || this.elementResize.active || this.openingResize.active || this.labelMove.active;
	}

	/**
	 * Every drag but a rotation: each measures its delta in world coordinates from where it
	 * started, so a plan scrolling under a pointer resting at the edge carries the move, the
	 * marquee or the caption further. A rotation's angle is about the shape's own centre, and
	 * scrolling would turn it rather than extend anything.
	 */
	tracksPointer(): boolean {
		return !this.elementRotation.active && this.hasDraft();
	}

	/** The selected target's arrow under the pointer, while it may be grabbed: never for an item that is not the rotation target. */
	private rotationAt(context: EditorContext, event: EditorPointerEvent): { readonly grip: RotationGrip | undefined; readonly hit: boolean } {
		const shape = this.deps.rotationTarget?.();
		const control = this.deps.rotationControls ? this.deps.rotationControls().find(candidate => rotationControlContains(candidate.bounds, event.worldPoint)) : this.deps.rotationControl?.();
		const grip = control && shape && this.deps.canRotateShape?.(shape.id) !== false && !context.writesBlocked() && !this.rotationSuppressed(event) ? { shape, control } : undefined;
		return { grip, hit: grip !== undefined && rotationControlContains(grip.control.bounds, event.worldPoint) };
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
		event: EditorPointerEvent,
	): { readonly candidates: readonly SpatialObjectCandidate[]; readonly target: SelectionTarget; readonly grip: RotationGrip | undefined } {
		const candidates = this.deps.spatialObjects();
		const rotation = this.rotationAt(context, event);
		const frame = this.deps.transformBox?.() ?? null;
		const selectedIds = context.selection.selectedIds.map(String);
		const openings = this.deps.openingHandles?.() ?? undefined;
		const handleToleranceWorld = VERTEX_GRAB_RADIUS_PX * context.viewport.worldPerScreenPixel();
		// Shift over one of the selected opening's own handles is the BIGGER STEP, the same one
		// Shift takes on an arrow key — not a multi-select press. That is the exemption
		// `rotation.hit` already takes beside it, for the identical reason: a decoration whose own
		// gesture reads Shift cannot also be the selection modifier. Without it the blanked
		// `selectedIds` make `openingHandleAt` decline every handle, so `startOpeningGrip`'s
		// `NUDGE_STEP_SHIFT_MM` arm is unreachable from the pointer.
		const openingGrip = openingHandleAt({ selectedIds, worldPoint: event.worldPoint, handleToleranceWorld, openingHandles: openings }) !== null;
		const target = resolveSelectionTarget({
			rotationHandle: rotation.grip && { id: rotation.grip.shape.id, bounds: rotation.grip.control.bounds },
			resizeHandles: frame ? { id: frame.element.id, points: transformHandlePoints(frame, context.viewport.worldPerScreenPixel()) } : undefined,
			openingHandles: openings,
			candidates,
			selectedIds: event.modifiers.shift && !rotation.hit && !openingGrip ? [] : selectedIds,
			worldPoint: event.worldPoint,
			handleToleranceWorld,
			cycle: event.modifiers.alt,
			badgeToleranceWorld: SELECTION_BADGE_RADIUS_PX * context.viewport.worldPerScreenPixel(),
			labels: this.deps.labelHits?.(),
			labelToleranceWorld: LABEL_GRAB_PADDING_PX * context.viewport.worldPerScreenPixel(),
		});
		return { candidates, target, grip: rotation.grip };
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
