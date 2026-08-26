import type { EntityId } from '../../../core/identity/EntityId';
import type { Point, ScreenPoint } from '../viewport/Viewport';
import type { EditorContext } from './editor-context';

/**
 * Every tool a Plan Editor can have active (SDD §57, design slice 6, Interfaces &
 * Contracts). `'calibrate'` is included even though §57's own roster does not name it:
 * slice 7's `CalibrateTool` is a real `EditorTool`, and this union is what its `id` field
 * must satisfy — a tool that cannot name itself here is a compile error, not a
 * documentation nuance. `WallTool`/`OpeningTool`/`PathTool`/`BooleanTool` are explicitly
 * future (SDD §57) and are deliberately not members yet.
 */
export type ToolId = 'select' | 'pan' | 'draw-polygon' | 'place-asset' | 'measure' | 'annotation' | 'calibrate';

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
 */
export interface EditorTool {
	readonly id: ToolId;
	activate(context: EditorContext): void;
	deactivate(): void;
	pointerDown(event: EditorPointerEvent): void;
	pointerMove(event: EditorPointerEvent): void;
	pointerUp(event: EditorPointerEvent): void;
	cancel(): void;
}
