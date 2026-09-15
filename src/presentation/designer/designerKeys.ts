import type { Vector } from '../../core/geometry/Vector';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { AssetShape } from '../../domain/asset/AssetShape';
import { DUPLICATE_OFFSET_MM, deleteDetail, duplicateDetail, nextDetailId } from '../../domain/asset/detailEdits';
import { moveAnchor, moveOutline, removeClearance } from '../../domain/asset/shapeEdits';
import { notifyIfRefused } from '../editor/report-failure';
import { plainPress } from '../editor/surface/keyboard';
import type { ToolId } from '../editor/tools/editor-tool';
import { selectionExists, type DesignerSelection } from './selection/designerSelection';
import type { EditShape, ShapeEdit } from './selection/editShape';

/**
 * The asset designer's selection keys (symbols spec, Decision 10). Delete and Ctrl+D are decided HERE
 * and bound on the canvas element itself by `AssetDesignerRoot`, because `EditorSurface` routes neither
 * and leaves both to other listeners; the arrows are `EditorSurface`'s own nudge, which `DesignerCanvas` answers with
 * `selectionKeyActions(...).nudgeSelection`. Every edit is one `editShape`, so one conditional write
 * and one undo entry, and every refusal goes through `notifyIfRefused` — except a nudge or a Delete whose
 * part is already gone when its step runs, which is skipped and says nothing (`whileItExists`).
 */

/** What `designerShortcut` reads of a key event — a real `KeyboardEvent` satisfies it structurally. */
export interface DesignerKeyPress {
	readonly key: string;
	readonly ctrlKey: boolean;
	readonly metaKey: boolean;
	readonly altKey: boolean;
	readonly shiftKey: boolean;
	readonly repeat: boolean;
	readonly isComposing: boolean;
	preventDefault(): void;
}

export interface DesignerKeyDoors {
	readonly selection: DesignerSelection | null;
	deleteSelection(): void;
	duplicateSelection(): void;
}

/**
 * A bare Delete or Backspace on a part that can go: a detail, or the clearance. The footprint cannot
 * be deleted (spec Decision 9), and the anchor and the facing are not parts one removes. An autorepeat
 * is refused too — a held key would dispatch a second, stale delete before the first refresh landed.
 */
function deletes(event: DesignerKeyPress, kind: DesignerSelection['kind'] | undefined): boolean {
	return plainPress(event) && !event.shiftKey && (event.key === 'Delete' || event.key === 'Backspace') && (kind === 'detail' || kind === 'clearance');
}

/** Ctrl+D, or Cmd+D, on a detail. The character rather than the physical key, so Caps Lock still reads as `d`. */
function duplicates(event: DesignerKeyPress, kind: DesignerSelection['kind'] | undefined): boolean {
	return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && !event.repeat && !event.isComposing && event.key.toLowerCase() === 'd' && kind === 'detail';
}

/** true when the press was one of these shortcuts (and was handled). Delete/Backspace with no modifiers on a detail or clearance → deleteSelection; Ctrl/Meta+D (no Alt, no Shift, not repeat) on a detail → duplicateSelection and preventDefault. Everything else → false. */
export function designerShortcut(event: DesignerKeyPress, doors: DesignerKeyDoors): boolean {
	const kind = doors.selection?.kind;
	if (deletes(event, kind)) {
		doors.deleteSelection();
		return true;
	}
	if (!duplicates(event, kind)) return false;
	event.preventDefault();
	doors.duplicateSelection();
	return true;
}

/**
 * Duplicate one detail and select the copy once the write lands. The copy's id is read from the shape
 * the edit is HANDED — the one the write is conditional on — never from a render. Answers the raw
 * result, so the Ctrl+D action hands it to `notifyIfRefused` and the inspector's Duplicate button shows
 * it in its own alert: the one step both doors share.
 */
export async function duplicateAndSelect(
	editShape: (edit: ShapeEdit) => Promise<DispatchResult>,
	id: string,
	select: (next: DesignerSelection) => void,
): Promise<DispatchResult> {
	let copy = '';
	const result = await editShape((shape) => {
		copy = nextDetailId(shape);
		return duplicateDetail(shape, id, { dx: DUPLICATE_OFFSET_MM, dy: DUPLICATE_OFFSET_MM });
	});
	// The refresh has landed by the time a dispatch resolves, so the copy exists to be selected.
	if (result.ok) select({ kind: 'detail', id: copy });
	return result;
}

/**
 * A key's edit, skipped when the part it captured at the press is gone by the time its step runs — a
 * Delete or an undo queued ahead of it removed it. `null` is `editShape`'s "nothing to do": the press
 * was right when made and the canvas already shows the part gone, so there is nothing to say (the plan
 * editor's `nudge.ts` rule). The inspector does not take this door; its alert sits beside a part still drawn.
 */
function whileItExists(selection: DesignerSelection, edit: ShapeEdit): (shape: AssetShape) => ReturnType<ShapeEdit> | null {
	return (shape) => (selectionExists(shape, selection) ? edit(shape) : null);
}

/**
 * The three edits a selection key dispatches, over the leaf's store, its `editShape` and its active
 * tool. Arrow-function properties, so a component may destructure one without an unbound `this`.
 *
 * Each action reads the selection at the CALL and answers for itself what it can act on — a detail or
 * the clearance to delete, a detail to duplicate — rather than trusting its caller to have asked:
 * `designerShortcut` asks at the press, while `nudgeSelection` is reached through `EditorSurface`'s arrow
 * door, which asks nothing about the part. The inspector's buttons call none of these; they share only
 * `duplicateAndSelect` above. The selection clears itself after a delete: the
 * refresh re-reads a shape without the part, and the store prunes a selection that names nothing.
 */
export function selectionKeyActions(
	store: { readonly selection: DesignerSelection | null; select(next: DesignerSelection | null): void },
	editShape: EditShape,
	activeToolId: { readonly value: ToolId | null },
): {
	readonly deleteSelection: () => Promise<void>;
	readonly duplicateSelection: () => Promise<void>;
	readonly nudgeSelection: (by: Vector) => Promise<void>;
} {
	return {
		deleteSelection: () => {
			const selection = store.selection;
			if (selection?.kind === 'detail') return notifyIfRefused(editShape(whileItExists(selection, (shape) => deleteDetail(shape, selection.id))));
			if (selection?.kind === 'clearance') return notifyIfRefused(editShape(whileItExists(selection, removeClearance)));
			return Promise.resolve();
		},
		duplicateSelection: async () => {
			const selection = store.selection;
			if (selection?.kind !== 'detail') return;
			await notifyIfRefused(duplicateAndSelect(editShape, selection.id, (next) => store.select(next)));
		},
		nudgeSelection: (by) => {
			// The plan editor's `nudge.ts` rule: an arrow moves the selection only under Select, since every
			// other tool owns the keyboard for its own gesture. Read at the press, before `editShape` chains.
			const selection = activeToolId.value === 'select' ? store.selection : null;
			// A facing is a direction: a nudge has no meaning for it, and nothing is written.
			if (selection === null || selection.kind === 'facing') return Promise.resolve();
			return notifyIfRefused(
				editShape(
					whileItExists(selection, (shape) =>
						selection.kind === 'anchor'
							? moveAnchor(shape, { x: shape.anchor.x + by.dx, y: shape.anchor.y + by.dy })
							: moveOutline(shape, selection, by),
					),
				),
			);
		},
	};
}
