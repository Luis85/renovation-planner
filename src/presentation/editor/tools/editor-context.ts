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
 * **Naming collision, read carefully**: there are now two types named `EditorContext` in
 * this codebase, in sibling directories, and neither is a typo.
 * - `src/presentation/editor/EditorContext.ts` (design slice 5) is a Vue **injection**
 *   context — `planId`, `queries`, `vault`, `onThemeChange`, `onPlanChanged` — provided
 *   once per Plan Editor leaf via `app.provide`, and consumed with `useEditorContext()`
 *   inside the Vue tree.
 * - **This** `EditorContext` (design slice 6, SDD §58) is the tool-framework facade below:
 *   what `EditorTool.activate(context)` receives. It is plain data handed to a tool by a
 *   `ToolManager`, has nothing to do with Vue's dependency injection, and is never placed
 *   on `provide`/`inject`.
 * They happen to share a name because the SDD and the design-slice-6 spec both call this
 * one `EditorContext`, and renaming it to dodge the collision would deviate from that
 * binding authority over a readability concern (see this slice's task-8 brief). Import the
 * one you mean from its own module; nothing re-exports either under the other's name.
 */
export interface EditorContext {
	/** Read-only for every tool except `PanTool`, which mutates through `setPan`/`setZoom`
	 * directly rather than a command — camera position is ephemeral UI state (SDD §15), not
	 * a domain change, so it is never undoable and never dispatched. */
	readonly viewport: {
		worldToScreen(p: Point): ScreenPoint;
		screenToWorld(p: ScreenPoint): Point;
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
 * The binding this thunk performs closes over the live `useEditorStore()` Pinia instance
 * (its current pan/zoom, its `screenToWorld`/`worldToScreen`) — see slice 5's
 * `src/presentation/stores/EditorStore.ts`. A Pinia store may not be touched before its
 * instance is active (`setActivePinia`/the app's own Pinia plugin), so if `createEditorContext`
 * took a `viewport` object directly, the composition root would have to construct that
 * object — and therefore call `useEditorStore()` — before it necessarily could. A thunk
 * defers that call to the moment `createEditorContext` actually invokes it, which is what
 * lets the composition root assemble this whole deps object first and bring the store up
 * after. `createEditorContext` calls it exactly once.
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
