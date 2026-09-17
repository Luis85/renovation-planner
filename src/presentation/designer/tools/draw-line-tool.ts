import type { AppError, ValidationError } from '../../../core/errors/AppError';
import { createCurvedPath, pathPolyline, type CurvedPath } from '../../../core/geometry/CurvedPath';
import { coincident } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import { unwrap, type Result } from '../../../core/result/Result';
import { constrainDrawingPoint } from '../../editor/snapping/constrainDrawingPoint';
import { POLYGON_CLOSE_GRAB_RADIUS_PX, SNAP_TOLERANCE_PX } from '../../editor/handleMetrics';
import type { EditorContext } from '../../editor/tools/editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from '../../editor/tools/editor-tool';
import type { DetailWrite } from './draw-detail-tool';

/** How many vertices an open graphic needs before it can be finished — `CurvedPath`'s own floor. */
export const LINE_MIN_VERTICES = 2;

export interface DrawLineToolDeps {
	readonly id: ToolId;
	/** Build the write for a completed path: a domain refusal, or the command plus the id the new graphic will have. */
	readonly commandFor: (path: CurvedPath) => Result<DetailWrite, ValidationError>;
	/** A DISPATCHED refusal. */
	readonly reportRejected: (error: AppError) => void;
	/** A refusal made before anything was dispatched — slice 17's split. */
	readonly reportInvalidInput: (error: AppError) => void;
	/** After a successful write: select the new graphic and return to Select. */
	readonly onCompleted: (detailId: string) => void;
}

/**
 * The designer's OPEN graphic tool (AD11): a click places a vertex, Enter or a click back on the
 * LAST placed vertex finishes the run, and what is written is one `OpenDetail` — a stroke with no
 * interior, never a thin polygon standing in for one.
 *
 * **Its own class rather than a `DrawPolygonTool` with a flag**, and the three reasons are the
 * three rules that tool is built out of. It closes on the FIRST vertex, which is the gesture this
 * one must not have; it validates through `createPolygon`, which demands three points where a line
 * has two; and it hands its completion a `Polygon`, which is the type the brand on `CurvedPath`
 * exists to keep an open run out of. A flag would have to defeat all three, in a tool the Plan
 * Editor's zones also depend on.
 *
 * **What it does share, deliberately**: `constrainDrawingPoint` for Shift-to-a-whole-angle, the
 * context's snap service at the same `SNAP_TOLERANCE_PX`, the screen-space grab radius that decides
 * whether a click landed on a vertex, and the generation counter that keeps a completion from
 * reaching a gesture the user has since abandoned. A second answer to any of those is a pair that
 * drifts.
 *
 * **Completion and cancellation.** `finish()` is the one door — Enter reaches it through
 * `finishShortcut`/`ToolManager.finishActiveTool`, a click on the last vertex calls it directly, so
 * pointer and keyboard are the same action. Escape reaches `cancel()` through `routeEscape`, which
 * asks `hasDraft()` first, so the first press discards a run in progress and the second returns to
 * Select. Nothing is dispatched on either, and a refusal keeps the buffer: a user's placed vertices
 * are never destroyed by a `no`.
 *
 * **The preview is drawn OPEN**, through `RenderState.previewClosed` — a closing edge back to the
 * first vertex would promise geometry the write does not contain.
 */
export class DrawLineTool implements EditorTool {
	readonly id: ToolId;

	private context: EditorContext | null = null;
	private buffer: Point[] = [];
	private finishing = false;
	private generation = 0;

	constructor(private readonly deps: DrawLineToolDeps) {
		this.id = deps.id;
	}

	activate(context: EditorContext): void {
		this.context = context;
		this.reset(context);
	}

	deactivate(): void {
		if (this.context !== null) this.reset(this.context);
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || event.button !== 'primary' || this.finishing) return;
		if (this.endsRun(context, event.worldPoint)) {
			this.finish();
			return;
		}
		const landing = this.landingPoint(context, event);
		// A repeated vertex would give the path a zero-length segment. `coincident` rather than
		// `===` for `DrawPolygonTool`'s measured reason: a constrained point has been through
		// trigonometry and lands at `-1.42e-14` where an exact comparison expects zero.
		if (this.buffer.some((other) => coincident(other, landing))) return;
		this.buffer.push(landing);
		this.publish(context, null);
	}

	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || this.buffer.length === 0 || this.finishing) return;
		this.publish(context, this.landingPoint(context, event));
	}

	pointerUp(): void {}

	/**
	 * Enter and a click on the last vertex are ONE action; a refusal keeps every vertex placed.
	 *
	 * **`createCurvedPath` cannot refuse this buffer, so it is `unwrap`ped rather than guarded**, and
	 * the first version of this method guarded it under a comment claiming the refusal was reachable
	 * when *"two clicks a snap pulled onto one another are two distinct buffer entries with no length
	 * between them"*. That is false, and measured: `pointerDown` never pushes a landing `coincident`
	 * with one already held, `coincident` is a `<= 1e-6` mm ball, and `path-degenerate` asks only for
	 * a point EXACTLY unequal to the first — a strictly weaker test that the filter has already
	 * passed. An unreachable guard costs a branch it can never pay back, which is what took it out.
	 *
	 * **The other THREE, named rather than counted** (the first version of this paragraph said "the
	 * other two" and accounted for one that is not a `validatePathPoints` arm at all, leaving one arm
	 * unaccounted for). The call passes points and no bulges, so `validatePathBulges` never runs and
	 * neither `curve-edge-count` nor the bulge-edge rules can arise: this tool draws straight runs,
	 * and a bend is the existing edge handle's, applied after the graphic exists. Of the three arms
	 * `validatePathPoints` itself has, `path-too-few-points` is excluded by the length guard on the
	 * line above, `path-degenerate` by the filter argued for above, and `path-non-finite-coordinate`
	 * by every buffered point having come through `landingPoint`: `screenToWorld` divides by
	 * `zoom * dpr` with `zoom` held positive and finite by `clampZoom`, `constrainDrawingPoint`
	 * either returns its input or `snapDirection`s it, and the snap service answers a candidate or
	 * the point it was given.
	 *
	 * **That last one is an ARGUMENT, not a filter, and it is the only refusal here that is** — said
	 * plainly because of what it would cost if it is wrong: `unwrap` throws, and it throws inside a
	 * pointer handler, where the sibling `DrawDetailTool` reaches `validateAssetShape` through
	 * `addDetail` and refuses through `reportInvalidInput` instead. AD11's reviewer could construct
	 * no reachable non-finite world point and neither could this pass. Converting the `unwrap` to a
	 * reported refusal is the fix if one is ever found; it is not taken now because it buys a branch
	 * nothing can drive, which is the same trade that removed the `path-degenerate` guard.
	 */
	finish(): void {
		const context = this.context;
		if (context === null || this.finishing || this.buffer.length < LINE_MIN_VERTICES) return;
		const write = this.deps.commandFor(unwrap(createCurvedPath({ points: this.buffer })));
		if (!write.ok) {
			this.deps.reportInvalidInput(write.error);
			return;
		}
		this.finishing = true;
		void this.dispatch(context, write.value);
	}

	cancel(): void {
		if (this.context !== null) this.reset(this.context); // no command dispatched
	}

	/**
	 * A vertex is placed on `pointerdown` and there is no matching release to complete, so an
	 * interruption has no press-to-release state to abandon — `DrawPolygonTool`'s rule, and for its
	 * reason: routing focus loss through `cancel()` would destroy every vertex placed before it.
	 * The guides are the one thing that must go, since they describe a pointer no longer there.
	 */
	abandonGesture(): void {
		if (this.context !== null) this.context.renderState.snapGuides = [];
	}

	hasDraft(): boolean {
		return this.buffer.length > 0;
	}

	tracksPointer(): boolean {
		return this.buffer.length > 0;
	}

	/**
	 * Whether a click at `worldPoint` ends the run: it is within the grab radius of the LAST placed
	 * vertex, and there are enough vertices to write.
	 *
	 * The LAST rather than the first, which is the whole difference from `closesPolygon`: a ring's
	 * completion is its closure and a path's is its far end. Judged in SCREEN pixels against the
	 * UNSNAPPED pointer for that predicate's two reasons — the target is a pointing affordance, and
	 * a snap must not drag a near-miss into a completion.
	 *
	 * The length guard is asked FIRST and is the only one: an `at(-1) === undefined` arm beside it
	 * reads as defensive and is dead, because a buffer of two or more always has a last member.
	 * `noUncheckedIndexedAccess` is off here, so the index read needs no narrowing to be a `Point`.
	 */
	private endsRun(context: EditorContext, worldPoint: Point): boolean {
		if (this.buffer.length < LINE_MIN_VERTICES) return false;
		const pointer = context.viewport.worldToScreen(worldPoint);
		const at = context.viewport.worldToScreen(this.buffer[this.buffer.length - 1]);
		return Math.hypot(pointer.x - at.x, pointer.y - at.y) <= POLYGON_CLOSE_GRAB_RADIUS_PX;
	}

	/** Where a click would put the next vertex: constrained to a whole angle under Shift, then snapped. */
	private landingPoint(context: EditorContext, event: EditorPointerEvent): Point {
		const constrained = constrainDrawingPoint(this.buffer.at(-1), event.worldPoint, event.modifiers.shift, context.snapService);
		const snap = context.snapService.snapPointWithGuides(constrained, context.snapCandidates(), SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
		context.renderState.snapGuides = snap.guides;
		return snap.point;
	}

	/**
	 * The placed run plus the rubber band's loose end, as ONE open polyline.
	 *
	 * **A FRESH array every time, including when there is no loose end.** `pathPolyline` answers
	 * `path.points` itself for a run with no curves — which every run this tool draws is — so
	 * `nextVertex === null` without the spread would put the tool's own LIVE buffer on the render
	 * state, and the next `pointerDown` would grow a list a consumer is already holding.
	 *
	 * **Stated no wider than that, deliberately.** The obvious sharper claim — that `runtime.ts`
	 * holds the render state in `reactive()`, whose setter compares the raw value, so re-assigning
	 * the same array is not a change and the preview would freeze at one vertex — was written here
	 * first and then MEASURED: reverting the spread and asserting the preview after two clicks with
	 * no pointer move between them leaves `designerDrawOpenLines.test.ts` green. Whatever else
	 * re-renders it, the freeze does not happen, so the sentence claiming it is gone and the case
	 * that could not tell the two apart went with it. The copy stays on the narrow argument above.
	 */
	private publish(context: EditorContext, nextVertex: Point | null): void {
		const points = nextVertex === null ? [...this.buffer] : [...this.buffer, nextVertex];
		context.renderState.previewClosed = false;
		context.renderState.previewPolygon = pathPolyline({ points });
	}

	private reset(context: EditorContext): void {
		this.buffer = [];
		this.finishing = false;
		this.generation += 1;
		context.renderState.previewPolygon = null;
		context.renderState.previewClosed = true;
		context.renderState.snapGuides = [];
	}

	private async dispatch(context: EditorContext, write: DetailWrite): Promise<void> {
		const generation = this.generation;
		try {
			const result = await context.commandDispatcher.run(write.command);
			// Reported BEFORE the generation check, for `DrawPolygonTool.closePolygon`'s reason: a
			// refusal is a fact about a write that really was declined, and many of the codes this
			// door can answer are pre-write, so the notice is the only channel carrying them.
			if (!result.ok) {
				this.deps.reportRejected(result.error);
				return; // buffer intact — a rejection never discards the user's work
			}
			if (generation !== this.generation) return;
			this.reset(context);
			this.deps.onCompleted(write.detailId);
		} finally {
			// Only for the gesture that opened the window: a `cancel()` mid-flight has already
			// started a new one, whose state this must not touch.
			if (generation === this.generation) this.finishing = false;
		}
	}
}
