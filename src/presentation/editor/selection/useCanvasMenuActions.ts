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

export interface CanvasMenuAction { readonly id: string; readonly label: StringKey; readonly disabled?: boolean; run(): void | Promise<void> }
export function useCanvasMenuActions(add: () => void) {
	const runtime = useEditorRuntime(), project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore();
	const moveOpening = useOpeningMoveAction();
	const frame = usePlanFrame(), groups = useCanvasGroupActions(), session = useRenovationSession();
	function fit(all: boolean): void { const bounds = frame(all); if (bounds) editor.fitTo(bounds, editor.stageSize); }
	function singleActions(id: string, blocked: boolean): CanvasMenuAction[] {
		const result: CanvasMenuAction[] = [], zone = project.zones.get(id);
			const structure = [...project.structure.walls, ...project.structure.openings].some(item => item.id === id);
			const element = project.structure.elements?.some(item => item.id === id);
			if (zone) {
				result.push({ id: 'edit', label: 'editor.input.edit', disabled: blocked || runtime.outlineEdit.blocked.value, run: () => runtime.outlineEdit.editOutline(id as ZoneId) });
				result.push({ id: 'rename', label: 'editor.input.rename', disabled: blocked, run: () => zone.zoneType === 'Room' ? runtime.renameRoom(id as ZoneId) : runtime.areaDetails.editAreaDetails(id as ZoneId) });
				result.push({ id: 'delete', label: 'editor.input.delete', disabled: blocked, run: () => runtime.deleteZone(id as ZoneId, zone.name) });
			} else if (structure || element) {
				const actions = structure ? runtime.structureActions : runtime.elementActions;
				result.push({ id: 'edit', label: 'editor.input.edit', disabled: blocked || actions.active.value, run: () => actions.edit(id) });
				if (project.structure.openings.some(item => item.id === id)) result.push({ id: 'move-opening', label: 'editor.opening-move.action', disabled: !runtime.openingMove.available.value, run: () => moveOpening(id) });
				if (element) result.push({ id: 'rename', label: 'editor.input.rename', disabled: blocked || actions.active.value, run: () => actions.edit(id) });
				result.push({ id: 'delete', label: 'editor.input.delete', disabled: blocked || actions.active.value, run: () => actions.remove(id) });
			}
		return result;
	}
	return computed<readonly CanvasMenuAction[]>(() => {
		const ids = selection.selectedIds, id = ids[0];
		const blocked = runtime.writesBlocked.value, review = session.perspective === 'review';
		const result: CanvasMenuAction[] = [{ id: 'fit', label: ids.length ? 'editor.view.fit-selection' : 'editor.view.fit-floor', disabled: frame(ids.length === 0) === null, run: () => fit(ids.length === 0) }];
		if (!ids.length) {
			if (!review) result.unshift({ id: 'add', label: 'editor.primary.add', disabled: blocked, run: add }, { id: 'pan', label: 'editor.input.pan', run: () => runtime.setTool('pan') });
			return result;
		}
		if (review) return result;
		if (ids.length === 1) result.push(...singleActions(id, blocked));
		const rotation = runtime.rotationActions.target.value;
		if (rotation) result.push({ id: 'rotate', label: 'editor.input.rotate', disabled: blocked || runtime.rotationActions.blocked.value, run: () => runtime.rotationActions.rotate(rotation.id) });
		return [...result, ...groups.actions(ids)];
	});
}
