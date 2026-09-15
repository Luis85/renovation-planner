import type { AppError, ValidationError } from '../../../core/errors/AppError';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import { distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { Result } from '../../../core/result/Result';
import { circle, rect } from '../../../domain/asset/presets/presetGeometry';
import { SNAP_TOLERANCE_PX } from '../../editor/handleMetrics';
import { ARC_TOLERANCE_PX } from '../layers/footprintLayer';
import type { EditorContext } from '../../editor/tools/editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from '../../editor/tools/editor-tool';
import type { UndoableCommand } from '../../editor/tools/undoable-command';

/** What one completed detail write hands back: the reversible command and the id the new detail will have. */
export interface DetailWrite {
	readonly command: UndoableCommand;
	readonly detailId: string;
}

export interface DrawDetailToolDeps {
	/** `'draw-rect'` or `'draw-circle'`: one class, two registered tools, as `DrawPolygonTool` is. */
	readonly id: ToolId;
	/** The outline a drag from `from` to `to` describes; `null` when it encloses no area. */
	readonly outlineFor: (from: Point, to: Point) => CurvedPolygon | null;
	/** Build the write for a completed outline: a domain refusal, or the command plus the id the new detail will have. */
	readonly commandFor: (outline: CurvedPolygon) => Result<DetailWrite, ValidationError>;
	/** A DISPATCHED refusal. */
	readonly reportRejected: (error: AppError) => void;
	/** A refusal made before anything was dispatched — slice 17's split. */
	readonly reportInvalidInput: (error: AppError) => void;
	/** After a successful write: select the new detail and return to Select. */
	readonly onCompleted: (detailId: string) => void;
}

/** The axis-aligned box of two corners, wound from the top-left; `null` with no width or no depth. */
export const rectOutline = (from: Point, to: Point): CurvedPolygon | null =>
	from.x === to.x || from.y === to.y
		? null
		: rect(Math.abs(to.x - from.x), Math.abs(to.y - from.y), (from.x + to.x) / 2, (from.y + to.y) / 2);

/** A circle about `centre` through `rim`, as the presets draw one; `null` when the rim is the centre. */
export const circleOutline = (centre: Point, rim: Point): CurvedPolygon | null => {
	const radius = distance(centre, rim);
	return radius === 0 ? null : circle(2 * radius, centre.x, centre.y);
};

/**
 * A detail drawn by one primary drag (asset designer symbols spec, Decision 11): the press records
 * the snapped start, a move previews the outline in `RenderState.previewPolygon` (drawn by
 * `DesignerGestureLayer`), the release builds the outline and writes it as ONE command.
 *
 * **A generation counter guards `onCompleted` and nothing else.** It selects a detail and switches
 * the tool, which is gesture-owned state a user who has since switched tools must keep; the
 * refusal report stays unconditional, for the reason `SetFacingTool`'s docblock records.
 */
export class DrawDetailTool implements EditorTool {
	readonly id: ToolId;

	private context: EditorContext | null = null;
	private start: Point | null = null;
	private generation = 0;

	constructor(private readonly deps: DrawDetailToolDeps) {
		this.id = deps.id;
	}

	activate(context: EditorContext): void {
		this.context = context;
		this.drop(context);
	}

	deactivate(): void {
		if (this.context !== null) this.drop(this.context);
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || event.button !== 'primary') return;
		// A new press is a new gesture: a write still in flight from the last one must not select
		// its detail and switch to Select in the middle of this drag.
		this.generation += 1;
		this.start = this.snapped(context, event.worldPoint);
	}

	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		const start = this.start;
		if (context === null || start === null) return;
		const outline = this.deps.outlineFor(start, this.snapped(context, event.worldPoint));
		context.renderState.previewPolygon =
			outline === null ? null : polygonPolyline(outline, ARC_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
	}

	pointerUp(event: EditorPointerEvent): void {
		const context = this.context;
		const start = this.start;
		if (context === null || start === null || event.button !== 'primary') return;
		const outline = this.deps.outlineFor(start, this.snapped(context, event.worldPoint));
		this.drop(context);
		if (outline === null) return;
		const write = this.deps.commandFor(outline);
		if (!write.ok) {
			this.deps.reportInvalidInput(write.error);
			return;
		}
		void this.dispatch(context, write.value);
	}

	cancel(): void {
		if (this.context !== null) this.drop(this.context); // no command dispatched
	}

	/** The whole gesture is press-to-release, so an interruption abandons exactly what `cancel()` does. */
	abandonGesture(): void {
		this.cancel();
	}

	hasDraft(): boolean {
		return this.start !== null;
	}

	/** The outline's far corner trails the pointer from a world-fixed start for the whole drag. */
	tracksPointer(): boolean {
		return this.start !== null;
	}

	private snapped(context: EditorContext, point: Point): Point {
		return context.snapService.snapPoint(point, context.snapCandidates(), SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
	}

	/** Ends the gesture: no start, no preview, and a write still in flight no longer owns what follows it. */
	private drop(context: EditorContext): void {
		this.start = null;
		this.generation += 1;
		context.renderState.previewPolygon = null;
	}

	private async dispatch(context: EditorContext, write: DetailWrite): Promise<void> {
		const generation = this.generation;
		const result = await context.commandDispatcher.run(write.command);
		if (!result.ok) {
			this.deps.reportRejected(result.error);
			return;
		}
		if (generation === this.generation) this.deps.onCompleted(write.detailId);
	}
}
