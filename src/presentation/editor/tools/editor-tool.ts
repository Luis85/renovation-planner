import type { EntityId } from '../../../core/identity/EntityId';
import type { Point, ScreenPoint } from '../viewport/Viewport';
import type { EditorContext } from './editor-context';

/**
 * Every tool EITHER editing surface can have active (SDD §57, design slice 6, Interfaces &
 * Contracts) — the Plan Editor's and, since design slice B5, the asset designer's.
 *
 * **One union across two surfaces rather than one per surface**, because `ToolManager`,
 * `EditorTool` and `EditorContext` are shared and each names this type: a second union would
 * have to be widened into every one of those signatures, and the manager would then be generic
 * over a parameter it does nothing with. The last four members are the designer's — a
 * `DrawPolygonTool` registered twice under two ids for the footprint and the clearance, plus
 * its own two point-and-drag tools — and no manager ever holds tools from both surfaces, so a
 * `setActiveTool('trace-footprint')` against a Plan Editor's manager throws exactly as an
 * unregistered id always has.
 *
 * `'calibrate'` is included even though §57's own roster does not name it:
 * slice 7's `CalibrateTool` is a real `EditorTool`, and this union is what its `id` field
 * must satisfy — a tool that cannot name itself here is a compile error, not a
 * documentation nuance. `WallTool`/`OpeningTool`/`PathTool`/`BooleanTool` are explicitly
 * future (SDD §57) and are deliberately not members yet.
 *
 * `'draw-room'` is the Plan Editor's rectangular room tool (design spec §4,
 * "Add Room" increment): a primary drag writes one axis-aligned rectangle into the room
 * draft store rather than the polygon `DrawPolygonTool` accumulates vertex by vertex.
 */
export type ToolId =
	| 'select'
	| 'pan'
	| 'draw-polygon'
	| 'draw-room'
	| 'draw-area'
	| 'place-asset'
	| 'measure'
	| 'annotation'
	| 'calibrate'
	| 'trace-footprint'
	| 'trace-clearance'
	| 'set-anchor'
	| 'set-facing';

/**
 * What a tool receives for one pointer interaction (design slice 6, ADR-009).
 *
 * `worldPoint` has already been converted through `screenToWorld()` — it is what every
 * domain/geometry call a tool makes must consume. `screenPoint` is carried alongside for
 * rendering-layer use only (an on-screen tooltip's position, say); it is a distinct,
 * incompatible brand from `Point` (see `viewport/Viewport.ts`), so passing it to a Core
 * geometry function or a command input is a compile error, not a runtime bug. A tool
 * never reads Konva's native pointer event directly — this is the entire surface.
 */
export interface EditorPointerEvent {
	readonly worldPoint: Point;
	readonly screenPoint: ScreenPoint;
	readonly button: 'primary' | 'secondary' | 'auxiliary';
	readonly modifiers: {
		readonly shift: boolean;
		readonly ctrl: boolean;
		readonly alt: boolean;
	};
	/** The hit-tested render-model target under the pointer, if any. */
	readonly targetId: EntityId<string> | null;
}

/**
 * One editor tool (SDD §56, design slice 6). Exactly one `EditorTool` is active in a
 * `ToolManager` at a time; nothing here decides *which* one — that is the manager's job.
 *
 * `activate`/`deactivate` bracket the tool being the active one; `pointerDown`/
 * `pointerMove`/`pointerUp` are one gesture's three phases. `cancel()` abandons a gesture
 * already in progress — a drag, an in-progress polygon, an active resize — typically on
 * `Escape` or when the user switches tools mid-gesture, by discarding whatever transient
 * render state the tool was accumulating. **No command is ever dispatched from `cancel()`**:
 * a cancelled gesture leaves no trace in `CommandHistory` (`./command-history.ts`) at all.
 * A tool must leave no transient render state behind once `deactivate()` returns.
 *
 * `abandonGesture()` is the NARROWER of the two, and the pair exists because the two events
 * that reach them ask different questions. `cancel()` is DELIBERATE — Escape, a tool switch —
 * and a user pressing it wants the accumulation gone. `abandonGesture()` is an
 * INTERRUPTION: focus left the element with a button still down, so the release is never
 * coming, and what must go is exactly the press-to-release transient that release would have
 * completed. **A multi-click tool commits its work on `pointerdown`**, so a placed vertex or
 * a first calibration point is not transient and must survive — an interruption during one
 * click otherwise destroys every click before it, which is what the first version of the
 * blur cleanup did. A tool with no press-to-release state answers with a documented no-op;
 * the method is REQUIRED rather than optional so that a tool which grows one has to say so.
 */
export interface EditorTool {
	/** Optional explicit completion; pointer and keyboard share the same tool action. */
	finish?(): void;
	readonly id: ToolId;
	activate(context: EditorContext): void;
	deactivate(): void;
	pointerDown(event: EditorPointerEvent): void;
	pointerMove(event: EditorPointerEvent): void;
	pointerUp(event: EditorPointerEvent): void;
	cancel(): void;
	abandonGesture(): void;
	/** Does this tool hold work a user would lose to `cancel()`? Escape asks before cancelling. */
	hasDraft(): boolean;
}
