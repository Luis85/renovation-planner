import { useOpeningMoveAction } from '../structure/useOpeningMoveAction';
import { computed } from 'vue';
import type { StringKey } from '../../i18n/locales/en';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useEditorRuntime } from '../runtime';
import { useSelectionStore } from './selection-store';
import { usePlanFrame } from '../viewport/usePlanFrame';
import { useCanvasGroupActions } from './canvasGroupActions';
import { useRenovationSession } from '../renovation/renovationSession';
import type { Point } from '../../../core/geometry/Point';
import { useClipboardActions } from '../clipboard/clipboardActions';
import { useDetailPlanActions } from '../hierarchy/detailPlanActions';
import { deleteItems, multiDeleteBlocked } from './deleteSelection';
import { wallStartRefused } from '../structure/structureDraft';
import { STAGE_PIXELS, worldPerScreenPixel } from '../viewport/Viewport';

/** Menu order is the group order: create first, then view, mode, the object's own actions, and last what destroys it. */
export type CanvasMenuGroup = 'create' | 'view' | 'mode' | 'object' | 'destructive';
export interface CanvasMenuAction { readonly id: string; readonly label: StringKey; readonly group: CanvasMenuGroup; readonly icon: string; readonly params?: Readonly<Record<string, string>>; readonly disabled?: boolean; readonly reason?: StringKey; run(): void | Promise<void> }
const GROUP_ORDER: readonly CanvasMenuGroup[] = ['create', 'view', 'mode', 'object', 'destructive'];
export function useCanvasMenuActions(add: () => void, opened: () => Point) {
	const runtime = useEditorRuntime(), project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore();
	const moveOpening = useOpeningMoveAction(), clipboard = useClipboardActions();
	const frame = usePlanFrame(), groups = useCanvasGroupActions(), session = useRenovationSession();
	const detailPlans = useDetailPlanActions();
	function fit(all: boolean): void { const bounds = frame(all); if (bounds) editor.fitTo(bounds, editor.stageSize); }
	/** Why a greyed item is greyed: a stale floor first, since that one blocks everything, else whatever tool or edit is in flight. */
	function reason(disabled: boolean): StringKey | undefined { return !disabled ? undefined : runtime.writesBlocked.value ? 'editor.stale-write-refused' : 'editor.input.unavailable'; }
	/** A wall's create actions, at the point the menu opened on it: a new wall joined there, or an opening centred there. */
	function wallActions(id: string, blocked: boolean): CanvasMenuAction[] {
		if (!project.structure.walls.some(wall => wall.id === id)) return [];
		const task = runtime.structureTask, at = opened(), disabled = blocked || !task.available;
		// The pixel reach a wall end snaps within, the one `StructureTool` gives a pointer.
		const tolerance = Math.min(100, 8 * worldPerScreenPixel(editor.viewport, STAGE_PIXELS)), refused = wallStartRefused(project.structure, id, at, tolerance);
		return [
			{ id: 'new-wall', label: 'editor.input.new-wall-here', group: 'create', icon: 'brick-wall', disabled: disabled || refused, reason: refused ? 'editor.structure.error.opening-split' : undefined, run: () => task.drawFrom(id, at, tolerance) },
			{ id: 'add-door', label: 'editor.input.add-door', group: 'create', icon: 'door-open', disabled, run: () => task.placeAt('place-door', id, at) },
			{ id: 'add-window', label: 'editor.input.add-window', group: 'create', icon: 'panels-top-left', disabled, run: () => task.placeAt('place-window', id, at) },
			{ id: 'add-opening', label: 'editor.input.add-opening', group: 'create', icon: 'rectangle-horizontal', disabled, run: () => task.placeAt('place-opening', id, at) },
		];
	}
	function singleActions(id: string, blocked: boolean): CanvasMenuAction[] {
		const result: CanvasMenuAction[] = [], zone = project.zones.get(id);
		const structure = [...project.structure.walls, ...project.structure.openings].some(item => item.id === id);
		const element = project.structure.elements?.some(item => item.id === id);
		if (zone) {
			result.push({ id: 'edit', label: 'editor.input.edit', group: 'object', icon: 'pencil', disabled: blocked || runtime.outlineEdit.blocked.value, run: () => runtime.outlineEdit.editOutline(id as ZoneId) });
			result.push({ id: 'rename', label: 'editor.input.rename', group: 'object', icon: 'text-cursor-input', disabled: blocked, run: () => zone.zoneType === 'Room' ? runtime.renameRoom(id as ZoneId) : runtime.areaDetails.editAreaDetails(id as ZoneId) });
			result.push({ id: 'delete', label: 'editor.input.delete', group: 'destructive', icon: 'trash', disabled: blocked, run: () => runtime.deleteZone(id as ZoneId, zone.name) });
			result.push(...detailPlans(id, zone.name, blocked));
		} else if (structure || element) {
			const actions = structure ? runtime.structureActions : runtime.elementActions;
			result.push(...wallActions(id, blocked));
			result.push({ id: 'edit', label: 'editor.input.edit', group: 'object', icon: 'pencil', disabled: blocked || actions.active.value, run: () => actions.edit(id) });
			if (project.structure.openings.some(item => item.id === id)) result.push({ id: 'move-opening', label: 'editor.opening-move.action', group: 'object', icon: 'move-horizontal', disabled: !runtime.openingMove.available.value, run: () => moveOpening(id) });
			if (element) result.push({ id: 'rename', label: 'editor.input.rename', group: 'object', icon: 'text-cursor-input', disabled: blocked || actions.active.value, run: () => actions.edit(id) });
			result.push({ id: 'delete', label: 'editor.input.delete', group: 'destructive', icon: 'trash', disabled: blocked || actions.active.value, run: () => actions.remove(id) });
		}
		return result;
	}
	return computed<readonly CanvasMenuAction[]>(() => {
		const ids = selection.selectedIds, id = ids[0];
		const blocked = runtime.writesBlocked.value, review = session.perspective === 'review', panning = runtime.activeToolId.value === 'pan';
		const result: CanvasMenuAction[] = [{ id: 'fit', label: ids.length ? 'editor.view.fit-selection' : 'editor.view.fit-floor', group: 'view', icon: 'maximize', disabled: frame(ids.length === 0) === null, run: () => fit(ids.length === 0) }];
		// Hidden rather than greyed when nothing selected is copyable: every disabled reason here names an edit, and Copy is not one.
		if (clipboard?.canCopy.value) result.push({ id: 'copy', label: 'editor.input.copy', group: 'object', icon: 'copy', run: () => { clipboard.copy(); } });
		if (review) return result;
		result.push(panning ? { id: 'select', label: 'editor.primary.select', group: 'mode', icon: 'mouse-pointer-2', run: () => runtime.setTool('select') } : { id: 'pan', label: 'editor.input.pan', group: 'mode', icon: 'hand', run: () => runtime.setTool('pan') });
		if (!ids.length) result.push({ id: 'add', label: 'editor.primary.add', group: 'create', icon: 'plus', disabled: blocked, run: add });
		if (clipboard?.hasClipboard.value) result.push({ id: 'paste', label: 'editor.input.paste', group: 'create', icon: 'clipboard-paste', disabled: !clipboard.canPaste.value, run: () => clipboard.paste(opened()) });
		if (ids.length === 1) result.push(...singleActions(id, blocked));
		// Only where the composite removal has its services, as the batch panel already requires: an item that would do nothing is worse than none.
		else if (ids.length && runtime.renovation.available) result.push({ id: 'delete', label: runtime.groupActions.saved.value ? 'editor.group.delete' : 'editor.input.delete', group: 'destructive', icon: 'trash', disabled: multiDeleteBlocked(runtime), run: () => deleteItems(runtime, project.structure, ids) });
		result.push({ id: 'measure', label: 'editor.input.measure-here', group: 'create', icon: 'ruler', disabled: blocked || !runtime.elementTask.available, run: () => runtime.elementTask.measureFrom(opened()) });
		const rotation = runtime.rotationActions.target.value;
		if (rotation) result.push({ id: 'rotate', label: 'editor.input.rotate', group: 'object', icon: 'rotate-cw', disabled: blocked || runtime.rotationActions.blocked.value, run: () => runtime.rotationActions.rotate(rotation.id) });
		result.push(...groups.actions(ids).map(action => ({ ...action, group: 'object' as const })));
		return GROUP_ORDER.flatMap(group => result.filter(action => action.group === group)).map(action => ({ ...action, reason: action.reason ?? reason(action.disabled === true) }));
	});
}
