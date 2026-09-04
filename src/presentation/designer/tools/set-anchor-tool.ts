import type { AppError } from '../../../core/errors/AppError';
import type { Point } from '../../../core/geometry/Point';
import type { EditorContext } from '../../editor/tools/editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from '../../editor/tools/editor-tool';
import type { UndoableCommand } from '../../editor/tools/undoable-command';

/**
 * What `SetAnchorTool` needs beyond its `EditorContext`. Nothing here names an Asset: which
 * asset this leaf is designing is bound into `createCommand` at the composition seam
 * (`registerDesignerTools`), exactly as `DrawPolygonTool`'s `PolygonCompletion` binds a Plan.
 */
export interface SetAnchorToolDeps {
	/**
	 * The reversible command for ONE placement — a factory, because a reversible adapter holds
	 * that one write's inverse and `CommandHistory` holds a stack of gestures rather than of
	 * commands. `CalibrateToolDeps.createCommand` is the same shape one surface over.
	 */
	readonly createCommand: (anchor: Point) => UndoableCommand;
	/**
	 * Where a DISPATCHED refusal reaches the user — the pair `SelectTool` and
	 * `DrawPolygonTool` both carry, and this tool has only this half of it: there is no
	 * pre-dispatch refusal it can make. A point is a point; `validateAssetShape` is what
	 * refuses a non-finite one, and that runs inside the command.
	 */
	readonly reportRejected: (error: AppError) => void;
}

/**
 * The anchor tool (design slice B5, PRD §88): one click puts the asset's anchor where the
 * user pointed — the point of the object that lands where a plan drops it.
 *
 * **It commits on `pointerDown`, not on `pointerUp`**, which is the grammar every point-PICK
 * in this editor uses (`CalibrateTool` places both of its points that way) and deliberately
 * not the one `SelectTool` uses. The distinction is what the gesture MEANS: a select is a
 * press-to-release gesture whose release carries a displacement worth measuring against a
 * click epsilon, while placing a point has no second coordinate — a drag from the anchor to
 * anywhere else still names exactly one place.
 *
 * `abandonGesture()` is therefore a documented no-op and `cancel()` clears nothing: neither
 * has anything to abandon, because the whole gesture is over inside `pointerDown`. That is not
 * the same as saying the tool is stateless — see `context`, which `deactivate` releases.
 *
 * **No generation counter, and its absence is a decision.** `DrawPolygonTool` and
 * `CalibrateTool` each carry one because their continuation after an awaited dispatch touches
 * state — a vertex buffer, a pending point, the selection — that a cancel may have handed to a
 * later gesture. This tool's continuation touches nothing but the report door, and reporting a
 * refusal of a write that really was attempted stays true however the tool has been switched
 * since.
 *
 * **Re-entrancy is likewise not guarded**, for the same reason: two clicks are two anchor
 * placements, both real, both undoable, and the second is a legitimate correction of the
 * first. `SetAssetAnchorCommand` answers `no-write` for a coincident re-place, so a jittery
 * double click costs a history entry that reverses nothing rather than a second revision.
 */
export class SetAnchorTool implements EditorTool {
	readonly id: ToolId = 'set-anchor';

	private context: EditorContext | null = null;

	constructor(private readonly deps: SetAnchorToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
	}

	deactivate(): void {
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || event.button !== 'primary') return;
		// Through the snap service like every other placed point, so the day it is handed
		// candidate geometry this tool snaps with the rest rather than being the one that
		// does not. With an empty candidate set it is provably the identity.
		void this.place(context, context.snapService.snapPoint(event.worldPoint, {}));
	}

	/**
	 * A hover holds nothing, and the parameters are DECLARED rather than dropped: a
	 * zero-argument method satisfies `EditorTool` structurally, and every caller that is not the
	 * manager — a test driving the tool the way the surface does — then cannot pass the event it
	 * really receives. The name is underscored because it is genuinely unused.
	 */
	pointerMove(_event: EditorPointerEvent): void {}

	pointerUp(_event: EditorPointerEvent): void {}

	/** Nothing accumulates across clicks, so there is nothing for Escape to discard. */
	cancel(): void {
		// See the class docblock: the gesture is over inside `pointerDown`.
	}

	/** A documented no-op: this tool holds no press-to-release state a missing release could complete. */
	abandonGesture(): void {
		// See `cancel`.
	}

	/** Nothing accumulates across clicks: see the class docblock. Escape has nothing to ask about. */
	hasDraft(): boolean {
		return false;
	}

	private async place(context: EditorContext, anchor: Point): Promise<void> {
		// Through the dispatcher and never by the command itself: it is the single funnel per
		// leaf, and it is what puts this gesture on the undo stack, re-reads the design
		// afterwards and drives the save-state badge.
		const result = await context.commandDispatcher.run(this.deps.createCommand(anchor));
		if (!result.ok) this.deps.reportRejected(result.error);
	}
}
