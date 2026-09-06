import type { Vector } from '../../../core/geometry/Vector';

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
