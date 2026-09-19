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
import { partKey, sameSelection, type DesignerSelection, type SelectionMode } from '../selection/designerSelection';
import { dragTarget } from '../selection/dragSnap';
import { hitDesign } from '../selection/hitTest';
import { marqueeBox, marqueeMembers } from '../selection/marquee';
import type { HandleRole } from '../selection/handles';
import { draggedShape, type DragRole, type DragStart } from '../selection/selectionDrag';

/**
 * What `DesignerSelectTool` needs beyond its `EditorContext`: the leaf's design and selection store,
 * read PER CALL (a design leaf re-reads after every write), and one reversible write.
 */
export interface DesignerSelectToolDeps {
	readonly design: () => { readonly shape: AssetShape; readonly geometryVersion: EntityVersion } | null; // null = nothing drawn yet
	readonly selection: () => DesignerSelection | null;
	/**
	 * The WHOLE selection, in selection order — `assetDesignStore.selected`, of which `selection`
	 * above is the derived primary (AD08, C05's "one list and a derived primary").
	 *
	 * Two gestures need the set rather than its primary and neither can be built without it: a plain
	 * press that must PRESERVE a set it lands inside, and a cancelled sweep that must put the whole
	 * set back rather than one member of it.
	 *
	 * **Optional, and unwired today.** The one construction site is `runtime.ts`'s `selectToolDeps`,
	 * which is outside this task's lease, so the wiring (`selected: () => store.selected`) is handed
	 * over as an integration change request. `selectionSet` below says exactly what a leaf without
	 * it gets, and the answer is deliberately LESS of each fix rather than a different one: no
	 * gesture behaves differently from the way it behaved before either was written.
	 */
	readonly selected?: () => readonly DesignerSelection[];
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
 * A marquee: a drag begun on EMPTY canvas — everywhere `hitDesign` declines, which for an asset
 * means outside the footprint and outside the clearance band.
 *
 * It holds no version and builds no command, because it writes NOTHING: C05's "a preview is not a
 * vault write", and the reason this is a separate draft from `Drag` rather than a `role` on it.
 *
 * `shape` is the design the PRESS read, so a peer's write landing mid-sweep cannot change which
 * parts the rectangle the user is drawing was drawn over. An id that write removed is pruned by
 * `AssetDesignStore.hydrate` on the refresh, which is the same guarantee every other selection here
 * rests on — never a retarget to a part the user did not sweep.
 *
 * `hidden` is carried as the OPTION OBJECT `hitDesign` was given, not as a set, so the press and the
 * release cannot disagree about what was on screen and the tool spells the "is there a hidden set at
 * all" question exactly once.
 *
 * `additive` and `initial` are both read at the PRESS and latched, exactly as the plan editor's
 * `MarqueeSelection.start` latches them: a sticky control toggled off mid-sweep must not turn the
 * gesture the user began into a different one at the release, and a snapshot taken at the release
 * would be of the selection this gesture had already cleared.
 */
interface Marquee {
	readonly context: EditorContext;
	readonly shape: AssetShape;
	readonly from: Point;
	readonly hidden: { readonly hidden?: ReadonlySet<string> };
	/** Shift, or the sticky "select multiple" control: this sweep ADDS rather than replaces. */
	readonly additive: boolean;
	/** What was selected when the press landed, for the cancellation that has to put it back. */
	readonly initial: readonly DesignerSelection[];
	/** Latched past the click epsilon, exactly as a `Drag` is: a press that never travels is a click. */
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
 * **A drag begun on EMPTY canvas is a MARQUEE** (AD08's remainder, C05): a rectangle drawn in
 * `RenderState.marquee` — the field the plan editor's own marquee uses, so the designer's gesture
 * layer draws it through the same `MarqueeOverlay` — and, at the release, one selection composed of
 * the graphics it met. The rule about WHICH graphics is `selection/marquee.ts` and not this class;
 * this class owns only the pointer lifecycle around it. It is not `MarqueeSelection` from the plan
 * editor, which works in `EntityId`s through the shared selection store and knows nothing about a
 * shape's parts. **It writes nothing at all**: no preview shape, no command, no history entry.
 *
 * That sweep reads the same two ADDITIVE routes a press on a part reads — a held Shift and the
 * sticky "select multiple" control — and an additive one UNIONS rather than toggling, which is what
 * `MarqueeSelection.finish` does with `draft.initial` on the other surface. An interrupted sweep
 * puts back what its press cleared, which is what `MarqueeSelection.cancel` does there.
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
	private marquee: Marquee | null = null;
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
		// `false`: this press has cleared the selection itself where it meant to, so the sweep it is
		// interrupting has nothing left to put back.
		this.dropMarquee(context, false);
		context.renderState.snapGuides = [];
		if (mayHold && (this.held.length > 0 || this.deps.writing())) {
			this.hold(event);
			return;
		}
		const selection = this.deps.selection();
		const hidden: { readonly hidden?: ReadonlySet<string> } = this.deps.hidden === undefined ? {} : { hidden: this.deps.hidden() };
		const hit = hitDesign(design.shape, event.worldPoint, {
			selection,
			mode: this.deps.mode(),
			worldPerPixel: context.viewport.worldPerScreenPixel(),
			...hidden,
		});
		if (hit === null) {
			// A PLAIN press on empty canvas clears the selection, as it always has; an ADDITIVE one
			// clears nothing, because the whole point of the gesture is to add to what is there — the
			// plan editor's `MarqueeSelection.start` skips its clear on the same condition. The
			// snapshot goes on the draft either way, so `dropMarquee` can put back what was cleared.
			//
			// Nothing can clear the set the release composes: `EditorSurface` binds no click listener
			// at all, so C05's "final pointer-up suppresses the synthetic click" holds structurally
			// rather than through a suppression flag somebody would have to clear again. `grep -n
			// 'this.deps.select(' ` printed FOUR sites in this file in this edit — here, the
			// non-additive release, `restoreSelection`, and `choosePart` — and every one of them runs
			// from a PRESS or from the release that composed the set, never after one.
			// The snapshot is taken BEFORE the clear, which is the whole of what makes it a snapshot.
			const additive = this.additive(event), initial = this.selectionSet();
			if (!additive) this.deps.select(null);
			this.marquee = { context, shape: design.shape, from: event.worldPoint, hidden, additive, initial, moved: false };
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
		const marquee = this.marquee;
		if (marquee !== null) {
			// Below the threshold nothing is drawn at all: the band appearing under a hand that is
			// merely clicking is the same unintended gesture the threshold exists to refuse.
			marquee.moved ||= this.travelled(marquee.context, marquee.from, event.worldPoint);
			if (marquee.moved) marquee.context.renderState.marquee = marqueeBox(marquee.from, event.worldPoint);
			return;
		}
		const drag = this.drag;
		if (drag === null || !this.passedEpsilon(drag, event.worldPoint)) return;
		this.preview(this.shapeAt(drag, event));
	}

	/**
	 * The release of a marquee: the parts the rectangle met become the selection, and nothing is
	 * written — no command, no history entry, no `SetAssetShape`. A sweep that never passed the
	 * threshold was a click, whose clearing the press already did.
	 *
	 * The set is composed member by member through `include`, which goes through the store's own
	 * `extend`, never by assigning a list: `extend` is where C05's rule about which parts may be
	 * composed lives, so a marquee cannot become a second answer to it.
	 *
	 * **A non-additive release CLEARS before it composes, rather than trusting the press to have.**
	 * `extend` is only an add against an EMPTY selection — with a special part selected every call
	 * degrades to `select`, and with a graphic already selected the matching call REMOVES it — so a
	 * part that arrived between the press and the release would leave one member selected or drop
	 * one the rectangle met. The press clearing is the usual case and this is not a second answer to
	 * it: a second pointer, or a Parts panel row activated while the sweep is open, is enough to put
	 * something back, and that precondition is cheaper to CONSTRUCT here than to reason about.
	 *
	 * A sweep that met nothing therefore leaves the selection cleared, which is the same answer the
	 * press gave and the same one a plain click on empty canvas gives.
	 */
	private finishMarquee(marquee: Marquee, event: EditorPointerEvent): void {
		this.marquee = null;
		marquee.context.renderState.marquee = null;
		if (!marquee.moved) return;
		const box = marqueeBox(marquee.from, event.worldPoint);
		const members = marqueeMembers(marquee.shape, box, {
			tolerance: marquee.context.viewport.worldPerScreenPixel(),
			...marquee.hidden,
		});
		if (!marquee.additive) this.deps.select(null);
		for (const member of members) this.include(member);
	}

	/**
	 * Put a graphic IN the selection, leaving one that is already there alone — union, which is what
	 * a sweep means and what the plan editor's `MarqueeSelection.finish` does with `draft.initial`.
	 *
	 * `extend` is a TOGGLE by design, because one control being both halves of add-and-remove is what
	 * makes a PRESS reversible without a second gesture. A sweep is not a press: sweeping across a
	 * part the user already selected and having it silently vanish is the opposite of what the
	 * gesture looks like it does. So a member the toggle removed is put straight back — two calls to
	 * a toggle are "make sure it is there", and the second is reached only when the first removed
	 * something.
	 *
	 * **Asked of the store rather than decided here**, which is why it is spelled as a repair rather
	 * than as a filter over the current members: `selection()` answers the PRIMARY, so a filter would
	 * need a membership rule of its own beside the store's, and the one question this tool can ask
	 * without inventing one is whether the call it just made left the member selected.
	 *
	 * A SPECIAL part selected when a sweep lands needs no case here: `extend`'s own rule replaces it
	 * on the first call and adds on the rest, which is C05 keeping the specials out of bulk
	 * composition, and the first call's member is left selected so nothing is repaired.
	 */
	private include(member: DesignerSelection): void {
		this.deps.extend(member);
		if (!sameSelection(this.deps.selection(), member)) this.deps.extend(member);
	}

	/** Shift, or the sticky "select multiple" control — C05's two routes, read wherever one is read. */
	private additive(event: EditorPointerEvent): boolean {
		return event.modifiers.shift || this.deps.multiSelectionMode?.() === true;
	}

	/**
	 * The whole selection, in selection order. Falls back to the PRIMARY alone where `deps.selected`
	 * is unwired (see its docblock): a one-member list, which is what every selection this tool can
	 * see through `selection()` looks like. What that costs is named at each caller, and it is
	 * always LESS of a fix and never a different behaviour — a set of one is a set no rule here
	 * treats specially.
	 */
	private selectionSet(): readonly DesignerSelection[] {
		const all = this.deps.selected?.();
		if (all !== undefined) return all;
		const primary = this.deps.selection();
		return primary === null ? [] : [primary];
	}

	/**
	 * Put a snapshot back, through the same two doors a user's own presses compose a selection with:
	 * `select` the first member, then add the rest in order, so the last one is the primary again.
	 *
	 * The MODE is not restored and cannot be — the clear this undoes had already reset it to
	 * Transform and the store has no door that sets one — so a cancelled sweep costs a point or bend
	 * mode. That is the press's own cost rather than this gesture's, and it is the same one the
	 * press pays when nothing cancels it.
	 */
	private restoreSelection(initial: readonly DesignerSelection[]): void {
		this.deps.select(initial[0] ?? null);
		for (const member of initial.slice(1)) this.include(member);
	}

	private lift(event: EditorPointerEvent): void {
		const marquee = this.marquee;
		if (marquee !== null) {
			this.finishMarquee(marquee, event);
			return;
		}
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
		return this.drag !== null || this.marquee !== null || this.bend !== null || this.held.length > 0;
	}

	/** Every gesture computes from the event's world point, so edge scrolling may carry them. */
	tracksPointer(): boolean {
		return this.bend !== null || this.drag?.moved === true || this.marquee?.moved === true;
	}

	private begin(context: EditorContext, design: PressedDesign, selection: DesignerSelection, role: DragRole, from: Point): void {
		this.drag = { context, start: { shape: design.shape, selection, role, from }, version: design.geometryVersion, moved: false };
	}

	/** Measured in SCREEN pixels through the camera as it stands now — `handleMetrics.ts`'s `CLICK_EPSILON_PX`. */
	private travelled(context: EditorContext, from: Point, to: Point): boolean {
		return distance(from, to) > CLICK_EPSILON_PX * context.viewport.worldPerScreenPixel();
	}

	private passedEpsilon(drag: Drag, point: Point): boolean {
		drag.moved ||= this.travelled(drag.context, drag.start.from, point);
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
		const context = this.context as EditorContext;
		context.renderState.snapGuides = [];
		this.dropMarquee(context, true);
		this.drag = null;
		this.bend = null;
		this.held = [];
		this.deps.setPreview(null);
	}

	/**
	 * Forget a sweep and take its rectangle off the canvas. Escape and a tool switch reach it
	 * through `cancel`; a `pointercancel` and a focus loss reach it through `abandonGesture`; and
	 * view teardown reaches it through `deactivate`. So does the start of the next press, so a
	 * sweep whose release never arrived leaves nothing drawn over the one that follows.
	 *
	 * **A release outside the leaf is deliberately NOT in that list, and this paragraph exists
	 * because the sentence above it named one.** That sentence said `EditorSurface` drove
	 * `abandonGesture` for three inputs where it drives two: `toolManager.cancelInterruptedGesture()`
	 * has exactly two call sites there, in `onPointerCancel` and in `releaseInterruptedInputs`, and
	 * `onPointerLeave` abandons only `panOverride` and the camera drag without ever reaching the
	 * tool manager. Both counts are greps over `EditorSurface.vue`, not memory.
	 *
	 * What happens instead is the OPPOSITE of an interruption: `onPointerDown` calls
	 * `setPointerCapture` on both of its arms, so a release outside the leaf is delivered back to
	 * the captured container and the gesture COMMITS. A reader who trusted the old sentence would
	 * have gone hunting for a door that cannot exist while capture is held.
	 *
	 * It was wrong from the commit that wrote it — AD08's marquee, 2026-09-17 — and found two days
	 * later by the independent reviewer of the card that finally dispatched a real `pointercancel`
	 * at this surface. Nothing between could see it: the claim is about another module's call
	 * graph, which no test of this one reads.
	 *
	 * None of them writes anything: a cancelled sweep is no command and no history entry, which is
	 * AD08's *"Escape/pointercancel is none"*.
	 *
	 * **`restore` is what separates the two kinds of caller, and it is the whole reason this takes an
	 * argument.** An INTERRUPTION puts the selection the press cleared back, which is what
	 * `MarqueeSelection.cancel` does with `draft.initial` on the other surface and what C12 asks for
	 * — the first version of this gesture argued its own non-restoring rule as though it were the
	 * only answer, in a file whose header says the marquee is the same picture in both surfaces. The
	 * next PRESS must NOT: that press has just cleared the selection itself, and restoring would
	 * undo its own gesture rather than this one's.
	 *
	 * An ADDITIVE sweep restores nothing because it cleared nothing, and calling `select` on a
	 * selection that never changed would reorder it and reset its mode for no reason.
	 *
	 * Where `deps.selected` is unwired the snapshot is the primary alone, so an interruption puts
	 * back one part rather than a set. Still strictly more than the nothing it used to put back.
	 */
	private dropMarquee(context: EditorContext, restore: boolean): void {
		const marquee = this.marquee;
		this.marquee = null;
		context.renderState.marquee = null;
		if (marquee === null || !restore || marquee.additive) return;
		this.restoreSelection(marquee.initial);
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
	 * **A plain press INSIDE a set of two or more KEEPS it** — AD08's *"Clicking inside the current
	 * multi-selection preserves it until the user intentionally changes it"*. A press on a part that
	 * is NOT a member still replaces the selection, which is what makes the preservation something
	 * the user leaves rather than something they are stuck in.
	 *
	 * **What it keeps and what it drags are two different things, deliberately.** The set and its
	 * PRIMARY are both left exactly as they were — so the inspector goes on showing the part it was
	 * showing, and nothing flickers — while the drag that begins moves the part PRESSED, which is
	 * what a press has always dragged here. Moving a whole set is a gesture of its own and is not
	 * built here: `assetDesignStore` has neither a door that re-focuses a member of a set nor one
	 * that transforms several, and inventing either beside it would be a second answer to what a
	 * selection is. The plan editor's `focusSelectedMember` does both through doors its own selection
	 * store already has, which is the shape to copy when those doors exist.
	 *
	 * A set of ONE is not a set: re-choosing the only selected part still goes through `select`,
	 * which is what keeps its point or bend mode (spec Amendment 1, through `sameSelection`).
	 *
	 * Split out of `press` for the complexity budget: adding the additive arm put that function
	 * over the CRAP threshold, and this is the arm with a rule of its own to state.
	 */
	private choosePart(context: EditorContext, design: PressedDesign, selection: DesignerSelection, event: EditorPointerEvent): void {
		if (this.additive(event)) {
			this.deps.extend(selection);
			return;
		}
		if (!this.insideSelection(selection)) this.deps.select(selection);
		// A locked graphic is CHOSEN and not dragged (AD09): no drag begins, so every later move and the
		// release have nothing to compute and nothing to write.
		if (selection.kind === 'detail' && this.deps.locked?.().has(selection.id) === true) return;
		this.begin(context, design, selection, { kind: 'body' }, event.worldPoint);
	}

	/**
	 * Is this part a member of a selection of TWO OR MORE? Both halves matter: a one-member selection
	 * must keep going through `select`, and a part nobody selected must still replace the set.
	 *
	 * Where `deps.selected` is unwired this can only ever answer `false`, so the preservation above
	 * is simply not reached and a press behaves exactly as it did before it was written.
	 */
	private insideSelection(selection: DesignerSelection): boolean {
		const members = this.selectionSet();
		return members.length > 1 && members.some((member) => sameSelection(member, selection));
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
