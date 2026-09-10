import type { EditorRuntime } from '../runtime';

function historyAction(event: KeyboardEvent): 'undo' | 'redo' | null {
	if (event.altKey || event.isComposing || (!event.ctrlKey && !event.metaKey)) return null;
	const key = event.key.toLowerCase();
	return key === 'z' ? event.shiftKey ? 'redo' : 'undo' : key === 'y' && !event.shiftKey ? 'redo' : null;
}
/** Native text history and modal shortcuts remain owned by their focused surface. */
export function editorHistoryShortcut(event: KeyboardEvent, runtime: Pick<EditorRuntime, 'undo' | 'redo' | 'canUndo' | 'canRedo' | 'writesBlocked'>, state: { modal: boolean; gesture: boolean }): boolean {
	if (state.modal || event.defaultPrevented) return false;
	const target = event.target;
	if (target instanceof HTMLElement && target.closest('input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable]:not([contenteditable="false"])')) return false;
	const action = historyAction(event);
	if (!action) return false;
	event.preventDefault(); event.stopPropagation();
	if (!state.gesture && !event.repeat && !runtime.writesBlocked.value && (action === 'undo' ? runtime.canUndo.value : runtime.canRedo.value)) void runtime[action]();
	return true;
}
