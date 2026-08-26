import type { Point, ScreenPoint } from '../viewport/Viewport';
import type { Vector } from '../../../core/geometry/Vector';
import type { Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Calibration } from '../../../domain/plan/Calibration';
import type { SelectionStore } from '../selection/selection-store';
import type { SnapService } from '../snapping/snap-service';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { UndoableCommand } from './undoable-command';
import type { RenderState } from './render-state';

/**
 * The entire API an `EditorTool` gets (SDD §58, design slice 6). Deliberately excludes
 * repositories, the event bus, and raw Konva node access — a tool that needed one of
 * those would be reaching around the architecture, and `tests/presentation/editor/tools/
 * editorContext.test.ts` checks that exclusion directly (Definition of Done 11) rather than
 * merely asserting it here.
 *
 * **There used to be a second `EditorContext` here**, in the sibling directory: slice 5's
 * Vue injection context, provided per Plan Editor leaf. It is `PlanEditorContext` now.
 * This one keeps the bare name because the SDD and design slice 6 both call the tool
 * facade `EditorContext` and renaming it would deviate from the binding authority
 * (`docs/tasks/06-editor-tool-framework-undo-redo-and-inspector.md`); the Vue one was this
 * project's own invention and had no such claim on the word. Two paragraphs in two files
 * explaining which was which, plus an alias import in `runtime.ts`, was the cost of
 * keeping them both — and `npm run analyze` reported the pair as a duplicate export, which
 * it genuinely was.
 */
export interface EditorContext {
	/** Read-only for every tool except `PanTool`, which mutates through `setPan`/`setZoom`
	 * directly rather than a command — camera position is ephemeral UI state (SDD §15), not
	 * a domain change, so it is never undoable and never dispatched. */
	readonly viewport: {
		worldToScreen(p: Point): ScreenPoint;
		screenToWorld(p: ScreenPoint): Point;
		/**
		 * World millimetres per screen pixel at the CURRENT camera — how a tool converts a
		 * screen-sized tolerance (a grab radius, a click epsilon, a closing target) into the
		 * world units it must compare against. A member rather than something each tool
		 * derives: three tools projected `(0,0)` and `(1,0)` back through `screenToWorld`
		 * and measured the gap, which is a third copy of the transform in the two files
		 * least equipped to own one. `viewport/Viewport.ts`'s `worldPerScreenPixel` is the
		 * single definition this binds to.
		 */
		worldPerScreenPixel(): number;
		setPan(delta: Vector): void;
		setZoom(factor: number, origin: ScreenPoint): void;
	};
	readonly selection: SelectionStore;
	readonly snapService: SnapService;
	readonly commandDispatcher: { run(command: UndoableCommand): Promise<Result<void, AppError>> };
	/**
	 * What this editor's own history has written, per entity — see
	 * `application/editor/WriteLedger.ts` and design slice 6's "The expectation is the
	 * history's, not the adapter's". A tool never reads this directly; a reversible
	 * command adapter it constructs does.
	 */
	readonly writeLedger: WriteLedger;
	readonly renderState: RenderState;
	/**
	 * `calibration` is nullable: a Plan renders and is editable before it is calibrated
	 * (slice 5's placeholder scale), so a tool that assumed a value here would break on
	 * every freshly imported plan.
	 */
	readonly activePlan: { id: PlanId; calibration: Calibration | null };
}

/**
 * What the composition root hands `createEditorContext`. Every field is a direct
 * pass-through except `bindViewport`, which is a THUNK rather than a `viewport` object
 * passed straight in — the one piece of indirection here that looks pointless until it
 * is not.
 *
 * The binding this thunk performs closes over the live `useEditorStore()` Pinia instance's
 * `viewport` ref (current pan/zoom — see slice 5's `src/presentation/stores/EditorStore.ts`)
 * and applies `worldToScreen`/`screenToWorld`, the module functions declared in
 * `src/presentation/editor/viewport/Viewport.ts` (each taking `(point, viewport, dpr)`),
 * to it. Named rather than cited by line: those two numbers had already moved twice by the
 * time slice 6 ended, and each name is unique in that module.
 *
 * `EditorStore` itself has no `screenToWorld`/`worldToScreen` or
 * `setPan(delta)` method of its own — it exposes `viewport`, `zoomAt`, `zoomByFactor`,
 * `beginPan`/`continuePan`/`endPan`, `setPointer`; the binding is what turns those
 * primitives into this interface's shape, and building it is not this task's job. A Pinia
 * store may not be touched before its instance is active (`setActivePinia`/the app's own
 * Pinia plugin), so if `createEditorContext` took a `viewport` object directly, the
 * composition root would have to construct that object — and therefore call
 * `useEditorStore()` — before it necessarily could. A thunk defers that call to the moment
 * `createEditorContext` actually invokes it, which is what lets the composition root
 * assemble this whole deps object first and bring the store up after. `createEditorContext`
 * calls it exactly once.
 */
export interface EditorContextDeps {
	bindViewport(): EditorContext['viewport'];
	selection: SelectionStore;
	snapService: SnapService;
	commandDispatcher: EditorContext['commandDispatcher'];
	writeLedger: WriteLedger;
	renderState: RenderState;
	activePlan: { id: PlanId; calibration: Calibration | null };
}

/**
 * Assembles the facade a tool receives from already-built dependencies. Deliberately a
 * straight-through pass of each dep onto its named field, and nothing else: no
 * tool-specific branch belongs here (Definition of Done 12) — adding a future tool must
 * require only a new `EditorTool` implementation, never a change to this function.
 */
export function createEditorContext(deps: EditorContextDeps): EditorContext {
	return {
		viewport: deps.bindViewport(),
		selection: deps.selection,
		snapService: deps.snapService,
		commandDispatcher: deps.commandDispatcher,
		writeLedger: deps.writeLedger,
		renderState: deps.renderState,
		activePlan: deps.activePlan,
	};
}
