import type { EditorRuntime } from '../runtime';
import type { ClipboardActions } from '../clipboard/clipboardActions';

const EDITING = 'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable]:not([contenteditable="false"])';

/** A dialog, an event something nearer already handled, or a focused field owns its own editing keys. */
function ownedElsewhere(event: KeyboardEvent, modal: boolean): boolean {
	return modal || event.defaultPrevented || (event.target instanceof HTMLElement && event.target.closest(EDITING) !== null);
}
function historyAction(event: KeyboardEvent): 'undo' | 'redo' | null {
	if (event.altKey || event.isComposing || (!event.ctrlKey && !event.metaKey)) return null;
	const key = event.key.toLowerCase();
	return key === 'z' ? event.shiftKey ? 'redo' : 'undo' : key === 'y' && !event.shiftKey ? 'redo' : null;
}
function clipboardAction(event: KeyboardEvent): 'copy' | 'paste' | null {
	if (event.altKey || event.shiftKey || event.isComposing || (!event.ctrlKey && !event.metaKey)) return null;
	const key = event.key.toLowerCase();
	return key === 'c' ? 'copy' : key === 'v' ? 'paste' : null;
}
/** Native text history and modal shortcuts remain owned by their focused surface. */
export function editorHistoryShortcut(event: KeyboardEvent, runtime: Pick<EditorRuntime, 'undo' | 'redo' | 'canUndo' | 'canRedo' | 'writesBlocked'>, state: { modal: boolean; gesture: boolean }): boolean {
	if (ownedElsewhere(event, state.modal)) return false;
	const action = historyAction(event);
	if (!action) return false;
	event.preventDefault(); event.stopPropagation();
	if (!state.gesture && !event.repeat && !runtime.writesBlocked.value && (action === 'undo' ? runtime.canUndo.value : runtime.canRedo.value)) void runtime[action]();
	return true;
}
/**
 * Copy and Paste of the canvas selection. Copy claims the chord only when there was something to
 * copy and Paste only when it could write, so a chord that does nothing here stays the host's.
 * An OS autorepeat of Paste, or one pressed mid-gesture, is claimed and ignored exactly as Undo is.
 */
export function editorClipboardShortcut(event: KeyboardEvent, actions: Pick<ClipboardActions, 'copy' | 'paste' | 'canPaste'>, state: { modal: boolean; gesture: boolean }): boolean {
	if (ownedElsewhere(event, state.modal)) return false;
	const action = clipboardAction(event);
	if (action === null || (action === 'copy' ? !actions.copy() : !actions.canPaste.value)) return false;
	event.preventDefault(); event.stopPropagation();
	if (action === 'paste' && !event.repeat && !state.gesture) void actions.paste();
	return true;
}
