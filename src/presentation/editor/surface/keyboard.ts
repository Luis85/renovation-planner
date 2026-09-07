import { isElementTool } from '../elements/elementDraft';
import type { Vector } from '../../../core/geometry/Vector';
import type { ToolId } from '../tools/editor-tool';

/**
 * What `onKeyDown` needs of a key event to compute an arrow nudge — never the whole
 * `KeyboardEvent`, so this stays a pure function a node test can drive with no DOM at all
 * (a real `KeyboardEvent` satisfies this structurally, so `EditorSurface.vue` passes one
 * straight through).
 */
export interface ArrowKeyPress {
	readonly key: string;
	readonly shiftKey: boolean;
}

const NUDGE_STEP_MM = 10;
const NUDGE_STEP_SHIFT_MM = 100;

/**
 * Arrow-key nudge vectors, in WORLD millimetres (§85's one operation slice 5 left
 * unreachable by keyboard, E8): ten millimetres a press, a hundred with Shift held — the
 * keyboard's answer to `SelectTool`'s drag. `null` for every other key, so `onKeyDown`'s own
 * branch is a lookup rather than four `if`s.
 */
export function arrowVector(event: ArrowKeyPress): Vector | null {
	const step = event.shiftKey ? NUDGE_STEP_SHIFT_MM : NUDGE_STEP_MM;
	switch (event.key) {
		case 'ArrowLeft':
			return { dx: -step, dy: 0 };
		case 'ArrowRight':
			return { dx: step, dy: 0 };
		case 'ArrowUp':
			return { dx: 0, dy: -step };
		case 'ArrowDown':
			return { dx: 0, dy: step };
		default:
			return null;
	}
}

/** What `plainPress` reads — a real `KeyboardEvent` satisfies it structurally. */
export interface KeyPress {
	readonly repeat: boolean;
	readonly ctrlKey: boolean;
	readonly metaKey: boolean;
	readonly altKey: boolean;
	readonly isComposing: boolean;
}

/**
 * A press that is ONE deliberate press of the bare key: not an OS autorepeat, not a chord
 * (Ctrl/Cmd/Alt+key belongs to whoever bound the chord), and not a keystroke an IME is still
 * composing. Enter finishes a draw-area draft on exactly this and nothing else; extracted so
 * `onKeyDown` pays one branch for it rather than five.
 */
export function plainPress(event: KeyPress): boolean {
	return !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing;
}

/** What `finishShortcut` reads of a key event — a real `KeyboardEvent` satisfies it structurally. */
export interface FinishKeyPress extends KeyPress {
	readonly key: string;
	preventDefault(): void;
}

/** The surface's doors `finishShortcut` may take, with the active tool they are asked for. */
export interface DraftFinishDoors {
	readonly tool: ToolId | null;
	finishArea(): void;
	finishActiveTool(): void;
	undoDraftPoint(): void;
}

/** The tools whose draft Enter finishes through the existing guarded task. */
function finishesOnEnter(tool: ToolId): boolean {
	return tool === 'draw-area' || tool === 'draw-wall' || tool.startsWith('place-') || isElementTool(tool);
}

/**
 * Enter finishes a draft, and Backspace takes the active wall/element draft's last point back. An Area finishes
 * through `finishArea` (the runtime's guarded action — see `EditorSurface`'s prop of that name);
 * a wall chain or a hosted opening through `finishActiveTool`, whose structure tool asks its
 * task's `blocked` itself. Only a PLAIN Enter finishes (`plainPress`), but `preventDefault`
 * runs for every Enter while one of those tools is active, chorded or not, so nothing beneath
 * the canvas activates on it. Answers whether the key was this shortcut's, so the caller's
 * chain can stop. Pure, and here rather than in `EditorSurface.vue`, because that file met its
 * 400-line budget the day the connected-walls merge widened the Enter branch.
 */
export function finishShortcut(event: FinishKeyPress, doors: DraftFinishDoors): boolean {
	const tool = doors.tool;
	if (event.key === 'Backspace' && (tool === 'draw-wall' || isElementTool(tool))) {
		event.preventDefault();
		if (!event.repeat) doors.undoDraftPoint();
		return true;
	}
	if (event.key !== 'Enter' || tool === null || !finishesOnEnter(tool)) return false;
	event.preventDefault();
	if (!plainPress(event)) return true;
	if (tool === 'draw-area') doors.finishArea();
	else doors.finishActiveTool();
	return true;
}
