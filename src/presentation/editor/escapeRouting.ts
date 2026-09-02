import type { ToolId } from './tools/editor-tool';

export type EscapeOutcome = 'swallowed-pan' | 'cancelled-draft' | 'returned-to-select' | 'cleared-selection' | 'nothing';

export interface EscapeDeps {
	readonly panning: boolean;
	readonly activeToolId: ToolId | null;
	readonly hasDraft: () => boolean;
	readonly cancelGesture: () => void;
	readonly setTool: (id: ToolId | null) => void;
	readonly hasSelection: boolean;
	readonly clearSelection: () => void;
}

/**
 * What Escape does on the canvas, decided ONCE (design spec §6.3). An open Add menu or overlay
 * is not here: the root owns those and handles the key before the canvas sees it.
 *
 * Order: a running pan swallows it (the camera does not rewind, and a tool's draft is the only
 * thing it could destroy); a tool holding a draft cancels the draft and stays put; a creation
 * tool with nothing drawn returns to Select; Select with a selection clears it; else nothing.
 * The draft test comes BEFORE the selection test so a drag in flight is abandoned rather than
 * a selection cleared under a hand still moving.
 */
export function routeEscape(deps: EscapeDeps): EscapeOutcome {
	if (deps.panning) return 'swallowed-pan';
	if (deps.hasDraft()) {
		deps.cancelGesture();
		return 'cancelled-draft';
	}
	if (deps.activeToolId !== null && deps.activeToolId !== 'select') {
		deps.setTool('select');
		return 'returned-to-select';
	}
	if (deps.hasSelection) {
		deps.clearSelection();
		return 'cleared-selection';
	}
	return 'nothing';
}
