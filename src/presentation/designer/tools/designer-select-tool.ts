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
import { CLICK_EPSILON_PX } from '../../editor/handleMetrics';
import type { EditorContext } from '../../editor/tools/editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from '../../editor/tools/editor-tool';
import type { UndoableCommand } from '../../editor/tools/undoable-command';
import { partKey, type DesignerSelection, type SelectionMode } from '../selection/designerSelection';
import { dragTarget } from '../selection/dragSnap';
import { hitDesign } from '../selection/hitTest';
import type { HandleRole } from '../selection/handles';
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
	/**
	 * Add a graphic to the selection, or remove it when it is already a member (AD08).
	 *
	 * Separate from `select` rather than a flag on it, because the store owns which parts may be
	 * composed at all: the footprint, the clearance, the anchor and the facing stay special
	 * selections (C05), and this tool should not have to know that list.
	 */
	readonly extend: (next: DesignerSelection) => void;
	/**
	 * The sticky "select multiple" mode, read PER CALL. The Plan Editor's own seam
	 * (`selectionInteractions.ts`), for C05's reason: adding to a selection needs a control a
	 * keyboard and a touch user can reach, not a modifier alone.
	 */
	readonly multiSelectionMode?: () => boolean;
	/**
	 * The Parts panel's leaf-local locks and hidden set, read PER PRESS (AD09).
	 *
	 * A LOCKED graphic is still chosen by a press — that is how a user finds it, reads its fields and
	 * unlocks it — and starts no drag, so the same pointer stream that would have moved it previews
	 * and writes nothing. A lock that refused the selection too would make the panel the only way
	 * back; one that merely skipped the write would preview a move that never lands.
	 *
	 * A HIDDEN graphic is handed to `hitDesign`, which owns the hit ORDER, so a press falls through to
	 * what is really drawn beneath rather than being swallowed here.
	 */
	readonly locked?: () => ReadonlySet<string>;
	readonly hidden?: () => ReadonlySet<string>;
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

/**
 * `CurveToolActions` members this tool has no use for: nothing blocks a bend, `hitDesign`
 * already chose its edge, and `dropGesture` does the rest. Its actions are asked only while a
 * bend exists — `press` forwards to it only on an edge handle — so `target` and `set` read
 * `bend` without a null arm.
 */
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

	/**
	 * While a held press has no release yet, its latest move is recorded on it rather than acted on. Once
	 * its release IS recorded, a later move is a hover with no gesture in flight — `EditorSurface` forwards
	 * every such hover here for a draw tool's rubber band — and it is dropped rather than overwriting the
	 * held press's move: replaying that move on release would turn the click into a drag past the epsilon.
	 */
	pointerMove(event: EditorPointerEvent): void {
		const last: Held | undefined = this.held[this.held.length - 1];
		if (last !== undefined) {
			if (last.up === null) last.move = event;
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
		context.renderState.snapGuides = [];
		if (mayHold && (this.held.length > 0 || this.deps.writing())) {
			this.hold(event);
			return;
		}
		const selection = this.deps.selection();
		const hit = hitDesign(design.shape, event.worldPoint, {
			selection,
			mode: this.deps.mode(),
			worldPerPixel: context.viewport.worldPerScreenPixel(),
			...(this.deps.hidden === undefined ? {} : { hidden: this.deps.hidden() }),
		});
		if (hit === null) {
			this.deps.select(null);
			return;
		}
		if (hit.kind === 'part') {
			this.choosePart(context, design, hit.selection, event);
			return;
		}
		this.grabHandle(context, design, selection, hit.role, event);
	}

	/**
	 * A press on one of the selection's own handles. Split from `press` for the complexity budget
	 * AD08's additive arm pushed it over; the two arms and both casts are unchanged.
	 */
	private grabHandle(context: EditorContext, design: PressedDesign, selection: DesignerSelection | null, role: HandleRole, event: EditorPointerEvent): void {
		if (role.kind === 'edge') {
			// An edge handle is drawn only in Bend edges, around an outline the shape has.
			this.beginBend(context, design, selection as OutlinePart, role.index);
			this.curve.pointerDown(event);
			return;
		}
		// A handle is only ever drawn around a selection — `selectionHandles` answers `[]` for none — so
		// the selection it belongs to is never null here, and no guard is written for it.
		this.begin(context, design, selection as DesignerSelection, role, event.worldPoint);
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
		// A guide says why a drag in flight is landing where it is; the release ends the drag it explained.
		drag.context.renderState.snapGuides = [];
		this.preview(next);
		this.release(drag.context, next, drag.version);
	}

	cancel(): void {
		this.abandonGesture();
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

	/**
	 * The shape a release here would write — ONE function for the preview and the commit, so the two cannot differ.
	 * It publishes the guides that decided the landing (`selection/dragSnap.ts`) on the way.
	 */
	private shapeAt(drag: Drag, event: EditorPointerEvent): Result<AssetShape, ValidationError> {
		const { context, start } = drag;
		const target = dragTarget(context, start, event);
		context.renderState.snapGuides = target.guides;
		return draggedShape(start, target.to, {
			shift: event.modifiers.shift,
			snapRotation: (radians) => context.snapService.snapRotation(radians),
		});
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

	/**
	 * Reached only from `deactivate()`, before it clears `this.context`, and from `abandonGesture()` —
	 * itself reached only from `press()` past its own `context === null` return, or as `EditorTool.cancel()`/
	 * `abandonGesture()` through `ToolManager`, which never calls either on a tool that is not its
	 * `activeTool` — and a tool becomes `activeTool` only once `activate()` has set `this.context`. No
	 * caller reaches this on a never-activated tool, so the cast hides no null.
	 */
	private dropGesture(): void {
		(this.context as EditorContext).renderState.snapGuides = [];
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
	/**
	 * A press on a part: choose it, and begin a body drag unless the press was ADDITIVE.
	 *
	 * **An additive press chooses and never drags** (AD08) — the Plan Editor's own rule, and the
	 * reason this returns early: a user building a set out of three graphics would otherwise move
	 * the third by however far the press wandered before release.
	 *
	 * Split out of `press` for the complexity budget: adding the additive arm put that function
	 * over the CRAP threshold, and this is the arm with a rule of its own to state.
	 */
	private choosePart(context: EditorContext, design: PressedDesign, selection: DesignerSelection, event: EditorPointerEvent): void {
		if (event.modifiers.shift || this.deps.multiSelectionMode?.() === true) {
			this.deps.extend(selection);
			return;
		}
		this.deps.select(selection);
		// A locked graphic is CHOSEN and not dragged (AD09): no drag begins, so every later move and the
		// release have nothing to compute and nothing to write.
		if (selection.kind === 'detail' && this.deps.locked?.().has(selection.id) === true) return;
		this.begin(context, design, selection, { kind: 'body' }, event.worldPoint);
	}

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
