import type { AppError, ValidationError } from '../../../core/errors/AppError';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { Result } from '../../../core/result/Result';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf, type OutlinePart } from '../../../domain/asset/shapeEdits';
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
 * **The preview is cleared only after the write settles**, so the canvas never flashes back to the
 * old shape before the refresh lands. That is what `previewGeneration` guards: an earlier gesture's
 * write settling must not clear a preview a LATER gesture has drawn since. It is bumped when a preview
 * is WRITTEN, not at a press — a later click on a handle writes none, and bumping at its press would
 * strand the earlier preview on the canvas. The refusal itself is reported whatever happened since
 * (`SetFacingTool`'s rule: a generation guards gesture-owned state, never the report of a write that
 * really was attempted).
 */
export class DesignerSelectTool implements EditorTool {
	readonly id: ToolId = 'select';

	private context: EditorContext | null = null;
	private drag: Drag | null = null;
	private previewGeneration = 0;

	constructor(private readonly deps: DesignerSelectToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
	}

	deactivate(): void {
		this.dropGesture();
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		const design = this.deps.design();
		if (context === null || design === null || event.button !== 'primary') return;
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
		// Bend edges is `CurveTool`'s gesture (Task 7); until it is wired an edge handle starts nothing.
		if (hit.role.kind === 'edge') return;
		// A handle is only ever drawn around a selection — `selectionHandles` answers `[]` for none — so
		// the selection it belongs to is never null here, and no guard is written for it.
		this.begin(context, design, selection as DesignerSelection, hit.role, event.worldPoint);
	}

	pointerMove(event: EditorPointerEvent): void {
		const drag = this.drag;
		if (drag === null || !this.passedEpsilon(drag, event.worldPoint)) return;
		this.preview(this.shapeAt(drag, event));
	}

	pointerUp(event: EditorPointerEvent): void {
		const drag = this.drag;
		if (drag === null || event.button !== 'primary') return;
		this.drag = null;
		if (!this.passedEpsilon(drag, event.worldPoint)) return;
		this.release(drag.context, this.shapeAt(drag, event), drag.version);
	}

	cancel(): void {
		this.dropGesture(); // no command dispatched
	}

	/** The whole gesture is press-to-release, so an interruption abandons exactly what `cancel()` does. */
	abandonGesture(): void {
		this.dropGesture();
	}

	/** A press with no release yet — so Escape mid-drag abandons the drag before it clears the selection. */
	hasDraft(): boolean {
		return this.drag !== null;
	}

	/** Every drag computes from the event's world point, so edge scrolling may carry it once it is a drag. */
	tracksPointer(): boolean {
		return this.drag?.moved === true;
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
		this.deps.setPreview(null);
	}
}
