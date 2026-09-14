import type { AppError, ValidationError } from '../../../core/errors/AppError';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { Result } from '../../../core/result/Result';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf, setBulge, type OutlinePart } from '../../../domain/asset/shapeEdits';
import { CurveTool } from '../../editor/curves/CurveTool';
import type { CurveTarget } from '../../editor/curves/curveDraft';
import { CLICK_EPSILON_PX, SNAP_TOLERANCE_PX } from '../../editor/handleMetrics';
import type { EditorContext } from '../../editor/tools/editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from '../../editor/tools/editor-tool';
import type { UndoableCommand } from '../../editor/tools/undoable-command';
import { partKey, type DesignerSelection, type SelectionMode } from '../selection/designerSelection';
import { hitDesign } from '../selection/hitTest';
import { draggedShape, type DragRole, type DragStart } from '../selection/selectionDrag';

/**
 * What `DesignerSelectTool` needs beyond its `EditorContext`: the leaf's design and selection store,
 * read PER CALL (a design leaf re-reads after every write), and one reversible write.
 */
export interface DesignerSelectToolDeps {
	readonly design: () => { readonly shape: AssetShape; readonly geometryVersion: EntityVersion } | null; // null = nothing drawn yet
	readonly selection: () => DesignerSelection | null;
	readonly mode: () => SelectionMode;
	readonly select: (next: DesignerSelection | null) => void;
	readonly setPreview: (shape: AssetShape | null) => void;
	/** One reversible SetAssetShape write, conditional on `expected`. */
	readonly createCommand: (shape: AssetShape, expected: EntityVersion) => UndoableCommand;
	readonly reportRejected: (error: AppError) => void; // a dispatched refusal
	readonly reportInvalidInput: (error: AppError) => void; // a domain refusal at release; nothing dispatched
	/** Whether a write this leaf queued has not settled yet, its read-back included (`createWriteChain`). */
	readonly writing: () => boolean;
	/** Resolves once every write queued so far has settled. */
	readonly settled: () => Promise<void>;
}

/** A press made while a write was still queued: held, with its latest move and its release, until that write settles. */
interface Held {
	readonly down: EditorPointerEvent;
	move: EditorPointerEvent | null;
	up: EditorPointerEvent | null;
}

/** What a press read of the design: the shape a gesture edits and the version its write is conditional on. */
type PressedDesign = NonNullable<ReturnType<DesignerSelectToolDeps['design']>>;

interface Drag {
	readonly context: EditorContext;
	readonly start: DragStart;
	readonly version: EntityVersion;
	/** Latched once the pointer has travelled past the click epsilon; a press that never does is a click. */
	moved: boolean;
}

/** `CurveToolActions` members this tool has no use for: nothing blocks a bend, `hitDesign` already chose its edge, and `dropGesture` does the rest. */
const never = (): boolean => false;
const nothing = (): void => undefined;

/** A Bend edges gesture: one edge of the selected outline, handed to `CurveTool` as a one-edge target. */
interface Bend {
	readonly context: EditorContext;
	readonly design: PressedDesign;
	readonly selection: OutlinePart;
	/** The edge's index in the OUTLINE; the curve tool only ever sees it as edge 0. */
	readonly edge: number;
	readonly target: CurveTarget;
	/** The bulge the curve tool last set; `null` while the press has not moved, which writes nothing. */
	bulge: number | null;
}

/**
 * The asset designer's Select tool (symbols spec, Decision 10): a click selects by `hitDesign`'s
 * order, a drag moves the part or works the handle it started on, and the release is ONE conditional
 * `SetAssetShape` write.
 *
 * **Not the Plan Editor's `SelectTool`**, which selects zones and elements by id through the shared
 * selection store; this surface selects a PART of one shape, held in its own `assetDesignStore`.
 *
 * **Conditional on the design the press read** (spec Amendment 1): the version is captured at the
 * press and passed as `expected`, so a peer's write during the drag refuses this one rather than
 * being overwritten by a shape computed from the older design.
 *
 * **Every write joins the leaf's ONE write chain** (`selection/editShape.ts`'s `createWriteChain`, spec
 * Amendment 2): `commit` dispatches through the context's dispatcher, which the runtime queues behind
 * every earlier write and its read-back. And a press that arrives while a write is still queued is
 * HELD (`hold`) and replayed once the chain drains, so a second drag or bend begun before the first
 * one's refresh lands reads the design that write left — the one its preview showed — and is
 * conditional on THAT version. A write queued after a press was taken still refuses its drag, which is
 * the version check doing its job: nothing is overwritten.
 *
 * **`commit` clears its preview only after its write settles**, so a release does not flash the
 * canvas back to the old shape before the refresh lands. That is what `previewGeneration` guards: an
 * earlier gesture's write settling must not clear a preview a LATER gesture has drawn since. It is
 * bumped when a preview is WRITTEN, not at a press — a later click on a handle writes none, and bumping
 * at its press would strand the earlier preview on the canvas. The guard covers `commit` alone: a
 * press abandoning a leftover bend, `cancel` and a tool switch clear the preview too, and a write still
 * in flight then shows the stored shape until its refresh. Selecting does not: the store's `select`
 * leaves a preview it did not draw.
 * The refusal itself is reported whatever happened since (`SetFacingTool`'s rule: a generation guards
 * gesture-owned state, never the report of a write that really was attempted).
 *
 * **Bend edges is the plan editor's `CurveTool`, not a copy of it**: an edge-handle press in `bend`
 * mode is forwarded to one `CurveTool` built over this tool's own `CurveToolActions`, whose `set`
 * previews `setBulge` and whose `finish` commits through the same `release` a drag does.
 */
export class DesignerSelectTool implements EditorTool {
	readonly id: ToolId = 'select';

	private context: EditorContext | null = null;
	private drag: Drag | null = null;
	private bend: Bend | null = null;
	/** Presses held behind a queued write, in arrival order; every one but the last has its release (`hold`). */
	private held: Held[] = [];
	private previewGeneration = 0;
	/**
	 * Its actions are asked only while a bend exists — `pointerDown` forwards to it only on an edge
	 * handle, and its `hasDraft` (true for any target) is never asked — so `target` and `set` read
	 * `bend` without a null arm. `blocked` and `busy` share one never-true function. `choose` has
	 * nothing to add, because `hitDesign` already chose the edge (`bend.edge`) before `CurveTool` is
	 * asked; `stop` and `cancel` have nothing to do, because `dropGesture` clears the preview beside
	 * the `deactivate` and `cancel` that reach them.
	 */
	private readonly curve: CurveTool;

	constructor(private readonly deps: DesignerSelectToolDeps) {
		this.curve = new CurveTool({
			target: () => (this.bend as Bend).target,
			blocked: never,
			busy: never,
			set: (_index, bulge) => this.bendTo(bulge),
			choose: nothing,
			stop: nothing,
			cancel: nothing,
			finish: () => this.finishBend(),
		});
	}

	activate(context: EditorContext): void {
		this.context = context;
		this.curve.activate(context);
	}

	deactivate(): void {
		this.curve.deactivate();
		this.dropGesture();
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		this.press(event, true);
	}

	/** While a press is held, its latest move and its release are recorded on it rather than acted on. */
	pointerMove(event: EditorPointerEvent): void {
		const last: Held | undefined = this.held[this.held.length - 1];
		if (last !== undefined) {
			last.move = event;
			return;
		}
		this.movePointer(event);
	}

	pointerUp(event: EditorPointerEvent): void {
		if (event.button !== 'primary') return;
		const last: Held | undefined = this.held[this.held.length - 1];
		if (last !== undefined) {
			last.up = event;
			return;
		}
		this.lift(event);
	}

	/**
	 * `mayHold` is false only for a replay (`replayWhenSettled`), which must act on the press rather than
	 * queue it again behind the presses held with it.
	 */
	private press(event: EditorPointerEvent, mayHold: boolean): void {
		const context = this.context;
		const design = this.deps.design();
		if (context === null || design === null || event.button !== 'primary') return;
		// A gesture whose release never arrived (a secondary release, say) must not be finished by THIS
		// press's release. A leftover bend is abandoned whole — its curve drag with it, or a later cancel
		// would ask a bend that is gone — while a drag is only forgotten, so a plain press clears no preview.
		if (this.bend !== null) this.abandonGesture();
		this.drag = null;
		if (mayHold && (this.held.length > 0 || this.deps.writing())) {
			this.hold(event);
			return;
		}
		const selection = this.deps.selection();
		const hit = hitDesign(design.shape, event.worldPoint, {
			selection,
			mode: this.deps.mode(),
			worldPerPixel: context.viewport.worldPerScreenPixel(),
		});
		if (hit === null) {
			this.deps.select(null);
			return;
		}
		if (hit.kind === 'part') {
			this.deps.select(hit.selection);
			this.begin(context, design, hit.selection, { kind: 'body' }, event.worldPoint);
			return;
		}
		if (hit.role.kind === 'edge') {
			// An edge handle is drawn only in Bend edges, around an outline the shape has.
			this.beginBend(context, design, selection as OutlinePart, hit.role.index);
			this.curve.pointerDown(event);
			return;
		}
		// A handle is only ever drawn around a selection — `selectionHandles` answers `[]` for none — so
		// the selection it belongs to is never null here, and no guard is written for it.
		this.begin(context, design, selection as DesignerSelection, hit.role, event.worldPoint);
	}

	private movePointer(event: EditorPointerEvent): void {
		if (this.bend !== null) {
			this.curve.pointerMove(event);
			return;
		}
		const drag = this.drag;
		if (drag === null || !this.passedEpsilon(drag, event.worldPoint)) return;
		this.preview(this.shapeAt(drag, event));
	}

	private lift(event: EditorPointerEvent): void {
		if (this.bend !== null) {
			// `CurveTool` takes the release's own bulge and drops its drag; `finish` then commits.
			this.curve.pointerUp(event);
			this.curve.finish();
			return;
		}
		const drag = this.drag;
		if (drag === null) return;
		this.drag = null;
		if (!this.passedEpsilon(drag, event.worldPoint)) return;
		// The release point is previewed before it is committed, as `CurveTool.pointerUp` does, so the
		// canvas shows the shape being written rather than the last move's.
		const next = this.shapeAt(drag, event);
		this.preview(next);
		this.release(drag.context, next, drag.version);
	}

	cancel(): void {
		this.curve.cancel();
		this.dropGesture(); // no command dispatched
	}

	/** Every gesture here is press-to-release, so an interruption abandons exactly what `cancel()` does. */
	abandonGesture(): void {
		this.curve.abandonGesture();
		this.dropGesture();
	}

	/** A press with no release yet, or one held behind a write — so Escape abandons it before it clears the selection. */
	hasDraft(): boolean {
		return this.drag !== null || this.bend !== null || this.held.length > 0;
	}

	/** Both gestures compute from the event's world point, so edge scrolling may carry them. */
	tracksPointer(): boolean {
		return this.bend !== null || this.drag?.moved === true;
	}

	private begin(context: EditorContext, design: PressedDesign, selection: DesignerSelection, role: DragRole, from: Point): void {
		this.drag = { context, start: { shape: design.shape, selection, role, from }, version: design.geometryVersion, moved: false };
	}

	/** Measured in SCREEN pixels through the camera as it stands now — `handleMetrics.ts`'s `CLICK_EPSILON_PX`. */
	private passedEpsilon(drag: Drag, point: Point): boolean {
		drag.moved ||= distance(drag.start.from, point) > CLICK_EPSILON_PX * drag.context.viewport.worldPerScreenPixel();
		return drag.moved;
	}

	/** The shape a release here would write — ONE function for the preview and the commit, so the two cannot differ. */
	private shapeAt(drag: Drag, event: EditorPointerEvent): Result<AssetShape, ValidationError> {
		const { context, start } = drag;
		return draggedShape(start, this.dragTarget(drag, event.worldPoint), {
			shift: event.modifiers.shift,
			snapRotation: (radians) => context.snapService.snapRotation(radians),
		});
	}

	/**
	 * The `to` `draggedShape` is handed. A vertex and the anchor snap to the other parts' vertices (never
	 * to themselves: `partKey` excludes the dragged part), at the screen tolerance `DrawPolygonTool` snaps
	 * with; a body move, a box handle and the facing take the raw point.
	 *
	 * **What snaps is the MOVED feature, not the pointer** — the feature where the pointer's travel since
	 * the press has carried it. A press a few millimetres off the anchor would otherwise snap the POINTER
	 * and land the anchor those millimetres off the vertex it visibly snapped to, or not snap at all.
	 * The two features are then handed over differently because `draggedShape` reads them differently:
	 * a vertex's `to` is its new POSITION, so it is the snapped vertex itself, while the anchor moves by
	 * `to − from`, so its `to` is `from` carried by the snapped anchor's travel.
	 */
	private dragTarget(drag: Drag, raw: Point): Point {
		const { context, start } = drag;
		const snapMoved = (feature: Point): Point =>
			context.snapService.snapPoint(
				{ x: feature.x + raw.x - start.from.x, y: feature.y + raw.y - start.from.y },
				context.snapCandidates([partKey(start.selection)]),
				SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel(),
			);
		if (start.role.kind === 'vertex') {
			// A vertex handle is only drawn on an outline the pressed shape has, so neither cast hides a null.
			return snapMoved((outlineOf(start.shape, start.selection as OutlinePart) as CurvedPolygon).points[start.role.index]);
		}
		if (start.role.kind !== 'body' || start.selection.kind !== 'anchor') return raw;
		const { anchor } = start.shape;
		const snapped = snapMoved(anchor);
		return { x: start.from.x + snapped.x - anchor.x, y: start.from.y + snapped.y - anchor.y };
	}

	/** A refused intermediate position keeps the last valid preview rather than drawing nothing. */
	private preview(next: Result<AssetShape, ValidationError>): void {
		if (!next.ok) return;
		this.previewGeneration += 1;
		this.deps.setPreview(next.value);
	}

	private release(context: EditorContext, next: Result<AssetShape, ValidationError>, version: EntityVersion): void {
		if (!next.ok) {
			// Pre-dispatch: nothing was built, so the notice door is the only place this can be said.
			this.deps.setPreview(null);
			this.deps.reportInvalidInput(next.error);
			return;
		}
		void this.commit(context, next.value, version);
	}

	private async commit(context: EditorContext, shape: AssetShape, version: EntityVersion): Promise<void> {
		const generation = this.previewGeneration;
		const result = await context.commandDispatcher.run(this.deps.createCommand(shape, version));
		if (generation === this.previewGeneration) this.deps.setPreview(null);
		if (!result.ok) this.deps.reportRejected(result.error);
	}

	private dropGesture(): void {
		this.drag = null;
		this.bend = null;
		this.held = [];
		this.deps.setPreview(null);
	}

	/**
	 * A press made while a write is still queued is HELD, with its latest move and its release, and
	 * replayed once every write queued so far has settled — so it reads, and a drag is conditional on,
	 * the design those writes left (spec Amendments 1 and 2).
	 *
	 * A press arriving while others are held is held behind them, so gestures replay in the order they
	 * were made. It REPLACES the last one only when that one's release never came — the rule a live press
	 * follows — and never a gesture whose release was recorded, which is a whole drag the user finished.
	 */
	private hold(down: EditorPointerEvent): void {
		const idle = this.held.length === 0;
		const last: Held | undefined = this.held[this.held.length - 1];
		if (last?.up === null) this.held.pop();
		this.held.push({ down, move: null, up: null });
		if (idle) void this.replayWhenSettled(this.held);
	}

	/**
	 * Replays the held presses in order, each through the private doors so its move and release cannot
	 * land on a press still held behind it. It stops whenever a write is queued — the one a replayed
	 * release just dispatched, or one queued while they waited — so the next press reads what that write
	 * left. A new list (`dropGesture`: Escape, an interruption, a tool switch) ends it.
	 */
	private async replayWhenSettled(queue: Held[]): Promise<void> {
		while (queue === this.held && queue.length > 0) {
			await this.deps.settled();
			while (queue === this.held && !this.deps.writing()) {
				const next = queue.shift();
				if (next === undefined) return;
				this.press(next.down, false);
				if (next.move !== null) this.movePointer(next.move);
				if (next.up !== null) this.lift(next.up);
			}
		}
	}

	/**
	 * ONE edge as a `kind: 'wall'` target, whose `curveEdges` arm yields only edge 0: `CurveTool` takes
	 * the FIRST edge whose midpoint is within 22 px, so a whole-outline target bends a neighbour of the
	 * edge `hitDesign` found on any outline small on screen. `bulgeAt` reads only the edge's start and
	 * end, so the bulge's sign is the closed ring's.
	 */
	private beginBend(context: EditorContext, design: PressedDesign, selection: OutlinePart, edge: number): void {
		// An edge handle is drawn only on an outline the shape has, so this lookup cannot miss here.
		const outline = outlineOf(design.shape, selection) as CurvedPolygon;
		const start = outline.points[edge];
		const end = outline.points[(edge + 1) % outline.points.length];
		this.bend = {
			context,
			design,
			selection,
			edge,
			bulge: null,
			target: { id: partKey(selection), kind: 'wall', name: '', geometry: { points: [start, end], bulges: [outline.bulges?.[edge] ?? 0, 0] } },
		};
	}

	private bendTo(bulge: number): void {
		const bend = this.bend as Bend;
		bend.bulge = bulge;
		this.preview(setBulge(bend.design.shape, bend.selection, bend.edge, bulge));
	}

	private finishBend(): void {
		const bend = this.bend as Bend;
		this.bend = null;
		if (bend.bulge === null) return;
		this.release(bend.context, setBulge(bend.design.shape, bend.selection, bend.edge, bend.bulge), bend.design.geometryVersion);
	}
}
