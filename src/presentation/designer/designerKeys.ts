import type { Vector } from '../../core/geometry/Vector';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { AssetShape } from '../../domain/asset/AssetShape';
import { DUPLICATE_OFFSET_MM, deleteDetail, duplicateDetail, nextDetailId } from '../../domain/asset/detailEdits';
import { groupDetails, groupOfDetail, ungroupDetails } from '../../domain/asset/groupEdits';
import { moveAnchor, moveOutline, removeClearance } from '../../domain/asset/shapeEdits';
import { notifyIfRefused } from '../editor/report-failure';
import { plainPress } from '../editor/surface/keyboard';
import type { ToolId } from '../editor/tools/editor-tool';
import { selectionExists, type DesignerSelection } from './selection/designerSelection';
import type { EditShape, ShapeEdit } from './selection/editShape';

/**
 * The asset designer's selection keys (symbols spec, Decision 10). Delete, Ctrl+D, and Ctrl+G and
 * Ctrl+Shift+G (group and ungroup, AD18-R16 Task 11) are decided HERE
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
	stopPropagation(): void;
}

export interface DesignerKeyDoors {
	readonly selection: DesignerSelection | null;
	deleteSelection(): void;
	duplicateSelection(): void;
	groupSelection(): void;
	ungroupSelection(): void;
}

/**
 * A bare Delete or Backspace on a part that can go: a detail, or the clearance. The footprint cannot
 * be deleted (spec Decision 9), and the anchor and the facing are not parts one removes. An autorepeat
 * is refused too — a held key would dispatch a second, stale delete before the first refresh landed.
 */
function deletes(event: DesignerKeyPress, kind: DesignerSelection['kind'] | undefined): boolean {
	return plainPress(event) && !event.shiftKey && (event.key === 'Delete' || event.key === 'Backspace') && (kind === 'detail' || kind === 'clearance');
}

/**
 * The Ctrl, or Cmd, chords on a detail: D duplicates, G groups and Shift+G ungroups. The CHARACTER
 * rather than the physical key, so Caps Lock still reads as `d` — and Shift turns `g` into `G`, which
 * `toLowerCase` folds back. Never with Alt, never an autorepeat, never mid-composition.
 */
function chord(event: DesignerKeyPress, kind: DesignerSelection['kind'] | undefined): 'duplicateSelection' | 'groupSelection' | 'ungroupSelection' | null {
	if (!(event.ctrlKey || event.metaKey) || event.altKey || event.repeat || event.isComposing || kind !== 'detail') return null;
	const key = event.key.toLowerCase();
	if (key === 'g') return event.shiftKey ? 'ungroupSelection' : 'groupSelection';
	return key === 'd' && !event.shiftKey ? 'duplicateSelection' : null;
}

/**
 * true when the press was one of these shortcuts (and was handled). Delete/Backspace with no modifiers
 * on a detail or clearance → deleteSelection; a `chord` on a detail → its door, with the default AND the
 * propagation taken away: Obsidian binds Ctrl+G to its graph view, and a chord this canvas answered must
 * not also reach the host's hotkeys (`historyShortcut.ts` stops Ctrl+Z for the same reason). Everything
 * else → false.
 */
export function designerShortcut(event: DesignerKeyPress, doors: DesignerKeyDoors): boolean {
	const kind = doors.selection?.kind;
	if (deletes(event, kind)) {
		doors.deleteSelection();
		return true;
	}
	const door = chord(event, kind);
	if (door === null) return false;
	event.preventDefault();
	event.stopPropagation();
	doors[door]();
	return true;
}

/** The selected GRAPHICS on `shape`, in selection order — a member whose part is gone is left out. */
export function selectedGraphics(shape: AssetShape | null, selected: readonly DesignerSelection[]): string[] {
	return selected.flatMap((part) => (part.kind === 'detail' && shape?.details.some((detail) => detail.id === part.id) === true ? [part.id] : []));
}

/** Two or more graphics, none of them already grouped — the whole of what `groupDetails` can accept. */
export function canGroup(shape: AssetShape, ids: readonly string[]): boolean {
	return ids.length > 1 && ids.every((id) => groupOfDetail(shape, id) === null);
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
 * The five edits a selection key dispatches, over the leaf's store, its `editShape` and its active
 * tool. Arrow-function properties, so a component may destructure one without an unbound `this`.
 *
 * Each action reads the selection at the CALL and answers for itself what it can act on — a detail or
 * the clearance to delete, a detail to duplicate — rather than trusting its caller to have asked:
 * `designerShortcut` asks at the press, while `nudgeSelection` is reached through `EditorSurface`'s arrow
 * door, which asks nothing about the part. `DesignerContextMenu`'s items call the same four that are not the nudge. The
 * inspector's buttons call none of them; they share `duplicateAndSelect`, `selectedGraphics` and
 * `canGroup` above, and show a refusal in their own alert rather than a notice. The selection clears itself after a delete: the
 * refresh re-reads a shape without the part, and the store prunes a selection that names nothing.
 */
export function selectionKeyActions(
	store: { readonly selection: DesignerSelection | null; readonly selected: readonly DesignerSelection[]; select(next: DesignerSelection | null): void },
	editShape: EditShape,
	activeToolId: { readonly value: ToolId | null },
): {
	readonly deleteSelection: () => Promise<void>;
	readonly duplicateSelection: () => Promise<void>;
	readonly groupSelection: () => Promise<void>;
	readonly ungroupSelection: () => Promise<void>;
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
		// Both read the SET at the call and ask the shape they are handed whether it can still be acted
		// on, answering `null` — nothing to do, nothing said — when it cannot, as `whileItExists` does.
		groupSelection: () => {
			const selected = store.selected;
			return notifyIfRefused(
				editShape((shape) => {
					const ids = selectedGraphics(shape, selected);
					return canGroup(shape, ids) ? groupDetails(shape, ids) : null;
				}),
			);
		},
		ungroupSelection: () => {
			const selection = store.selection;
			if (selection?.kind !== 'detail') return Promise.resolve();
			return notifyIfRefused(
				editShape((shape) => {
					const group = groupOfDetail(shape, selection.id);
					return group === null ? null : ungroupDetails(shape, group.id);
				}),
			);
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
