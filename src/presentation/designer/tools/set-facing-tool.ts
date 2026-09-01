import type { AppError } from '../../../core/errors/AppError';
import type { Point } from '../../../core/geometry/Point';
import { distance } from '../../../core/geometry/operations';
import { assetError } from '../../../domain/asset/Asset.errors';
import type { EditorContext } from '../../editor/tools/editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from '../../editor/tools/editor-tool';
import type { UndoableCommand } from '../../editor/tools/undoable-command';

/**
 * What `SetFacingTool` needs beyond its `EditorContext`. `facing` is radians anticlockwise
 * from +x, which is what `SetAssetFacingInput` declares; the tool hands the raw angle over
 * and the domain folds it into `[0, 2π)`, so one direction has one spelling and no caller has
 * to remember to fold it.
 */
export interface SetFacingToolDeps {
	/** One drag, one reversible adapter — see `SetAnchorToolDeps.createCommand`. */
	readonly createCommand: (facing: number) => UndoableCommand;
	/** Where a DISPATCHED refusal reaches the user. */
	readonly reportRejected: (error: AppError) => void;
	/**
	 * Where a refusal this tool made ITSELF reaches the user — a drag too short to name a
	 * direction, refused before any command is built, so `commandDispatcher.run` was never
	 * entered and nothing downstream has heard about it.
	 *
	 * A separate door from `reportRejected` rather than a parameter, for design slice 17's
	 * reason: only a DISPATCHED failure has been through `withSaveStateTracking`, so only that
	 * one is already carried by the save indicator. One shared door made every pre-dispatch
	 * refusal silent, once, in three tools at the same time.
	 */
	readonly reportInvalidInput: (error: AppError) => void;
}

/**
 * How far the pointer must travel, in SCREEN pixels, before a drag names a direction.
 *
 * The same number and the same reason as `SelectTool`'s `CLICK_EPSILON_PX`: ordinary hand
 * jitter during a click is a real displacement, and a world-fixed threshold is half a pixel at
 * one zoom and eighty millimetres at another. Measured through the CURRENT camera on every
 * release, so the gesture behaves the same however far the user has zoomed.
 *
 * What it buys HERE is different from what it buys there, which is why it is not merely
 * copied: a near-zero move gives `Math.atan2(0, 0)` a perfectly finite answer of `0` — due
 * east — a direction the user never indicated, dispatched as a real facing with a real
 * revision behind it. This threshold is the only thing between a stray click and that.
 */
const DIRECTION_EPSILON_PX = 4;

/**
 * The facing tool (design slice B5, PRD §88): drag from anywhere on the canvas in the
 * direction the object faces.
 *
 * **The facing comes from the DIRECTION of the drag and not from where it ended**, which is
 * the whole reason it is a drag rather than a click. A click would have to measure an angle
 * from some invented origin — the anchor, the footprint's centroid — and both are points the
 * user cannot see themselves aiming from. Two drags of different lengths in the same direction
 * therefore set the same facing, and the length is used for nothing but the epsilon above.
 *
 * **Shift constrains the drag to a whole angle** through `SnapService.snapDirection` — the
 * same service and the same 15 degree step both drawing tools take
 * (`snapping/editorSnapping.ts`), never a second mechanism — anchored at where the button went
 * DOWN, which is the only anchor a direction gesture has. The status region advertises it
 * while this tool is active, because a modifier nothing advertises is a modifier nobody finds.
 *
 * **The preview is written to `RenderState.measurement`**, the field `CalibrateTool` uses for
 * its tape measure: a facing drag is a direction indicated between two points and not a shape
 * being drawn, so `polygonSketch` would say the wrong thing about it. **Nothing draws that
 * field on this canvas yet** — the asset designer has no interaction layer (design slice B4
 * shipped four world-space layers and no transient one), so this gesture is currently
 * invisible while it is being made and its result appears only once the facing arrow is
 * redrawn from the committed design. That is a gap in the increment rather than in this tool,
 * and it is written here because this is the file whose behaviour it makes invisible.
 *
 * **No generation counter, and its absence is a decision** — the same one `SetAnchorTool`'s
 * docblock states, reached here by DELETING one. This tool carried a counter whose docblock said
 * it let "the continuation after `dispatch`'s awaited run tell whether the preview it is about
 * to clear is still its own", and that continuation clears no preview: `pointerUp` clears it
 * synchronously, before the dispatch is even started. So the counter guarded nothing it claimed
 * to, and the one statement it did guard was the REPORT — a drag whose command refused after the
 * user switched tools was reported nowhere at all, with `asset.no-footprint` being a pre-write
 * code that leaves the save indicator neutral and no second channel behind it.
 *
 * The rule the deletion leaves behind, and it is the one `DrawPolygonTool` and `CalibrateTool`
 * still need their counters for: a generation guards MUTATIONS of gesture-owned state — a vertex
 * buffer, a pending point, a selection — and never the reporting of a refusal, which is a fact
 * about a write that really was attempted.
 */
export class SetFacingTool implements EditorTool {
	readonly id: ToolId = 'set-facing';

	private context: EditorContext | null = null;
	/** Where the button went down — the anchor of both the constraint and the direction. */
	private origin: Point | null = null;

	constructor(private readonly deps: SetFacingToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
		this.origin = null;
		this.clearPreview(context);
	}

	deactivate(): void {
		const context = this.context;
		this.origin = null;
		if (context !== null) this.clearPreview(context);
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || event.button !== 'primary') return;
		this.origin = event.worldPoint;
		// A zero-length segment, which is what "pressed, not yet moved" honestly looks like.
		this.publishPreview(context, event.worldPoint, event.worldPoint);
	}

	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		const origin = this.origin;
		if (context === null || origin === null) return;
		this.publishPreview(context, origin, this.headPoint(context, origin, event));
	}

	pointerUp(event: EditorPointerEvent): void {
		const context = this.context;
		const origin = this.origin;
		if (context === null || origin === null || event.button !== 'primary') return;
		this.origin = null;
		this.clearPreview(context);
		const head = this.headPoint(context, origin, event);
		// Measured in SCREEN pixels through the camera as it stands right now — see
		// `DIRECTION_EPSILON_PX`. The comparison is made in world units because that is what
		// both points are in; the threshold is what crosses the camera, not the points.
		if (distance(origin, head) < DIRECTION_EPSILON_PX * context.viewport.worldPerScreenPixel()) {
			// Pre-dispatch: nothing was built, so no indicator is carrying this and the notice
			// door is the only place it can be said. Silence here is what a first draft did,
			// and it leaves a user clicking at a canvas that answers nothing.
			this.deps.reportInvalidInput(
				assetError('facing-without-direction', 'A facing is the direction of a drag; this gesture named none.'),
			);
			return;
		}
		void this.dispatch(context, Math.atan2(head.y - origin.y, head.x - origin.x));
	}

	cancel(): void {
		const context = this.context;
		this.origin = null;
		if (context !== null) this.clearPreview(context); // no command dispatched
	}

	/**
	 * The whole of this tool's gesture is press-to-release, so an interruption abandons exactly
	 * what `cancel()` does — unlike `DrawPolygonTool`, whose buffer survives one because a
	 * multi-click tool commits its work on `pointerdown`. `SelectTool` draws the same
	 * equivalence for the same reason and says so.
	 */
	abandonGesture(): void {
		this.cancel();
	}

	/**
	 * Where the drag's head is: the pointer, pulled onto a whole angle from the ORIGIN while
	 * Shift is held.
	 *
	 * One function for the preview and for the commit, which is the contract `SnapService`
	 * states about itself — the previewed direction can never differ from the committed one,
	 * because they are the same call. That is not a nicety here: preview and commit are the
	 * only two readings of a gesture whose result the user cannot otherwise check.
	 */
	private headPoint(context: EditorContext, origin: Point, event: EditorPointerEvent): Point {
		return event.modifiers.shift
			? context.snapService.snapDirection(origin, event.worldPoint)
			: event.worldPoint;
	}

	private publishPreview(context: EditorContext, start: Point, end: Point): void {
		// A whole new object each time rather than a mutation: the field is read through a
		// `reactive()` proxy, and one assignment is one re-render of the layer that draws it.
		context.renderState.measurement = { start, end };
	}

	private clearPreview(context: EditorContext): void {
		context.renderState.measurement = null;
	}

	/**
	 * **The continuation touches nothing but the report door, which is why there is no
	 * generation check in it** — see the class docblock for the counter this tool used to carry.
	 *
	 * Everything the gesture owned is already gone by the time this runs: `pointerUp` nulls the
	 * origin and clears the preview BEFORE it calls this, so a later `activate`, `deactivate` or
	 * `cancel` has nothing here to protect from a late resolution.
	 */
	private async dispatch(context: EditorContext, facing: number): Promise<void> {
		const result = await context.commandDispatcher.run(this.deps.createCommand(facing));
		// Reported however the gesture ended. The write really was attempted and the vault
		// really declined it, which stays true whatever the user has done since — and
		// `asset.no-footprint` is a PRE-WRITE code, so `affectsSaveState` resolves neutral and
		// no indicator is carrying it. Returning early here made that refusal silent.
		if (!result.ok) this.deps.reportRejected(result.error);
	}
}
