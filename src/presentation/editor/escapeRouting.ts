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
 *
 * **Two decisions §6.3 records since 2026-09-04 (they were deviations until the spec was amended to them).**
 *
 * (a) The draft test runs BEFORE the tool test for every tool, not only a non-Select one — so
 * Escape mid-drag under SELECT cancels the drag rather than clearing the selection, where §6.3
 * nests the draft question under "an active non-select tool" and would have Select's own drag
 * fall straight through to the selection clear. This ordering is a deliberate improvement: a
 * selection cleared out from under a hand still moving the mouse is worse than the drag simply
 * being abandoned. Pinned by `escapeRouting.test.ts`'s "Select mid-drag cancels the drag before
 * it would clear the selection" case. Dated 2026-09-03 in `docs/requirements/Selection.md`'s
 * `## Amendments`.
 *
 * (b) The return-to-Select arm calls `setTool('select')` alone, never `cancelGesture()` as well
 * — §6.3 says both. Equivalent today only because `hasDraft()` has already answered `false` on
 * every path that reaches this arm, and because `setTool` runs the outgoing tool's own
 * `deactivate()`, which is where a creation tool's abandon-on-switch behaviour already lives.
 * Do not "restore" the `cancelGesture()` call without re-checking that equivalence still holds.
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
