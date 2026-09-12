import { useOpeningMoveAction } from '../structure/useOpeningMoveAction';
import { computed, inject } from 'vue';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { insertPathPoint, insertRingPoint } from '../../../core/geometry/insertPoint';
import { splitWall } from '../../../domain/spatial/splitWall';
import { projectOntoWall, wallLength } from '../../../domain/spatial/Structure';
import type { ZoneDto } from '../../read-models/PlanDto';
import { PLAN_EDITOR_CONTEXT, type PlanEditorContext } from '../PlanEditorContext';
import { moveGesture } from '../tools/registerEditorTools';
import { mapDispatchFaults, reportDispatchFailure } from '../report-failure';
import type { StringKey } from '../../i18n/locales/en';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { DISPATCH_FAULT_EVENT, useEditorRuntime } from '../runtime';
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

/**
 * Menu order is the group order, and `CanvasContextMenu` draws a separator between groups: the plans a
 * zone links to first, then the object's own edits, what can be created at that point, the clipboard,
 * selection and grouping, the view, and last what destroys the object.
 */
export type CanvasMenuGroup = 'plans' | 'edit' | 'create' | 'clipboard' | 'arrange' | 'view' | 'destructive';
export interface CanvasMenuAction { readonly id: string; readonly label: StringKey; readonly group: CanvasMenuGroup; readonly icon: string; readonly params?: Readonly<Record<string, string>>; readonly disabled?: boolean; readonly reason?: StringKey; run(): void | Promise<void> }
const GROUP_ORDER: readonly CanvasMenuGroup[] = ['plans', 'edit', 'create', 'clipboard', 'arrange', 'view', 'destructive'];
export function useCanvasMenuActions(add: () => void, opened: () => Point) {
	const runtime = useEditorRuntime(), project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore();
	const moveOpening = useOpeningMoveAction(), clipboard = useClipboardActions();
	const frame = usePlanFrame(), groups = useCanvasGroupActions(), session = useRenovationSession();
	const detailPlans = useDetailPlanActions();
	function fit(all: boolean): void { const bounds = frame(all); if (bounds) editor.fitTo(bounds, editor.stageSize); }
	/** Why a greyed item is greyed: a stale floor first, since that one blocks everything, else whatever tool or edit is in flight. */
	function reason(disabled: boolean): StringKey | undefined { return !disabled ? undefined : runtime.writesBlocked.value ? 'editor.stale-write-refused' : 'editor.input.unavailable'; }
	function ordered(result: readonly CanvasMenuAction[]): CanvasMenuAction[] {
		return GROUP_ORDER.flatMap(group => result.filter(action => action.group === group)).map(action => ({ ...action, reason: action.reason ?? reason(action.disabled === true) }));
	}
	/** Fit floor or Fit selection; a greyed Fit floor says there is nothing to frame rather than blaming another tool. */
	function fitAction(ids: readonly string[]): CanvasMenuAction {
		const nothingToFit = frame(ids.length === 0) === null;
		return { id: 'fit', label: ids.length ? 'editor.view.fit-selection' : 'editor.view.fit-floor', group: 'view', icon: 'maximize', disabled: nothingToFit, ...(nothingToFit && ids.length === 0 ? { reason: 'editor.view.fit-nothing' as const } : {}), run: () => fit(ids.length === 0) };
	}
	/** The pixel reach a wall end snaps within, the one `StructureTool` gives a pointer, in world millimetres. */
	const reach = (): number => Math.min(100, 8 * worldPerScreenPixel(editor.viewport, STAGE_PIXELS));
	/**
	 * `inject` rather than `usePlanEditorContext()`, and read only when a zone's point is added: every real menu mounts
	 * inside `PlanEditorRoot`, while `canvasContextMenuStandalone.test.ts` mounts one outside it that never opens.
	 */
	const context = inject(PLAN_EDITOR_CONTEXT);
	/** The drag's own reversible command, so undo removes the point exactly as it restores a dragged corner. */
	async function reshapeZone(zone: ZoneDto, next: CurvedPolygon): Promise<void> {
		const editorContext = context as PlanEditorContext, dispatcher = mapDispatchFaults(runtime.dispatcher, editorContext.commands.logger, DISPATCH_FAULT_EVENT);
		const result = await dispatcher.run(moveGesture(editorContext, runtime.structureTask.ledger)(zone.id as ZoneId, next, { points: zone.points, bulges: zone.bulges }));
		if (!result.ok) reportDispatchFailure(result.error);
	}
	/** A point where the menu opened, on the nearest edge of a zone, wall, path or fence, for its handle to drag; none where it would land on a point already there. */
	function addPointActions(id: string, blocked: boolean): CanvasMenuAction[] {
		const at = opened(), tolerance = reach(), zone = project.zones.get(id), wall = project.structure.walls.find(item => item.id === id);
		const element = project.structure.elements?.find(item => item.id === id && (item.kind === 'path' || item.kind === 'fence'));
		const base = { id: 'add-point', label: 'editor.input.add-point', group: 'edit', icon: 'plus' } as const;
		if (zone) {
			const next = insertRingPoint(zone, at, tolerance);
			return next ? [{ ...base, disabled: blocked, run: () => reshapeZone(zone, next) }] : [];
		}
		if (wall) {
			const offset = Math.round(projectOntoWall(wall, at).offset);
			if (Math.min(offset, wallLength(wall) - offset) <= tolerance) return [];
			const refused = !splitWall(project.structure, id, offset, 'wall-probe').ok;
			return [{ ...base, disabled: blocked || refused || runtime.structureActions.active.value, reason: refused ? 'editor.structure.error.opening-split' : undefined, run: () => runtime.structureActions.addPoint(id, offset) }];
		}
		const points = element ? insertPathPoint(element.points, at, tolerance) : null;
		return element && points ? [{ ...base, disabled: blocked || runtime.elementActions.active.value, run: () => runtime.elementActions.move(id, points, element) }] : [];
	}
	/** A wall's create actions, at the point the menu opened on it: a new wall joined there, or an opening centred there. */
	function wallActions(id: string, blocked: boolean): CanvasMenuAction[] {
		if (!project.structure.walls.some(wall => wall.id === id)) return [];
		const task = runtime.structureTask, at = opened(), disabled = blocked || !task.available;
		const tolerance = reach(), refused = wallStartRefused(project.structure, id, at, tolerance);
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
			// An Area's form edits its type as well as its name, so it is named for the form it opens.
			result.push(zone.zoneType === 'Room'
				? { id: 'rename', label: 'editor.input.rename', group: 'edit', icon: 'text-cursor-input', disabled: blocked, run: () => runtime.renameRoom(id as ZoneId) }
				: { id: 'rename', label: 'editor.area.details', group: 'edit', icon: 'pencil', disabled: blocked, run: () => runtime.areaDetails.editAreaDetails(id as ZoneId) });
			result.push({ id: 'delete', label: 'editor.input.delete', group: 'destructive', icon: 'trash', disabled: blocked, run: () => runtime.deleteZone(id as ZoneId, zone.name) });
			result.push(...detailPlans(id, zone.name, blocked));
		} else if (structure || element) {
			const actions = structure ? runtime.structureActions : runtime.elementActions;
			result.push(...wallActions(id, blocked));
			result.push({ id: 'edit', label: 'editor.input.edit', group: 'edit', icon: 'pencil', disabled: blocked || actions.active.value, run: () => actions.edit(id) });
			if (project.structure.openings.some(item => item.id === id)) result.push({ id: 'move-opening', label: 'editor.opening-move.action', group: 'edit', icon: 'move-horizontal', disabled: !runtime.openingMove.available.value, run: () => moveOpening(id) });
			if (element) result.push({ id: 'rename', label: 'editor.input.rename', group: 'edit', icon: 'text-cursor-input', disabled: blocked || actions.active.value, run: () => actions.edit(id) });
			result.push({ id: 'delete', label: 'editor.input.delete', group: 'destructive', icon: 'trash', disabled: blocked || actions.active.value, run: () => actions.remove(id) });
		}
		result.push(...addPointActions(id, blocked));
		return result;
	}
	return computed<readonly CanvasMenuAction[]>(() => {
		const ids = selection.selectedIds, id = ids[0];
		const blocked = runtime.writesBlocked.value, review = session.perspective === 'review', panning = runtime.activeToolId.value === 'pan';
		const result: CanvasMenuAction[] = [fitAction(ids)];
		// Hidden rather than greyed when nothing selected is copyable: every disabled reason here names an edit, and Copy is not one.
		if (clipboard?.canCopy.value) result.push({ id: 'copy', label: 'editor.input.copy', group: 'clipboard', icon: 'copy', run: () => { clipboard.copy(); } });
		if (review) return ordered(result);
		result.push(panning ? { id: 'select', label: 'editor.input.switch-to-select', group: 'view', icon: 'mouse-pointer-2', run: () => runtime.setTool('select') } : { id: 'pan', label: 'editor.input.switch-to-pan', group: 'view', icon: 'hand', run: () => runtime.setTool('pan') });
		if (!ids.length) result.push({ id: 'add', label: 'editor.primary.add', group: 'create', icon: 'plus', disabled: blocked, run: add });
		if (clipboard?.hasClipboard.value) result.push({ id: 'paste', label: 'editor.input.paste', group: 'clipboard', icon: 'clipboard-paste', disabled: !clipboard.canPaste.value, run: () => clipboard.paste(opened()) });
		if (ids.length === 1) result.push(...singleActions(id, blocked));
		// Only where the composite removal has its services, as the batch panel already requires: an item that would do nothing is worse than none.
		else if (ids.length && runtime.renovation.available) result.push({ id: 'delete', label: runtime.groupActions.saved.value ? 'editor.group.delete' : 'editor.input.delete', group: 'destructive', icon: 'trash', disabled: multiDeleteBlocked(runtime), run: () => deleteItems(runtime, project.structure, ids) });
		result.push({ id: 'measure', label: 'editor.input.measure-here', group: 'create', icon: 'ruler', disabled: blocked || !runtime.elementTask.available, run: () => runtime.elementTask.measureFrom(opened()) });
		const rotation = runtime.rotationActions.target.value;
		if (rotation) result.push({ id: 'rotate', label: 'editor.input.rotate', group: 'edit', icon: 'rotate-cw', disabled: blocked || runtime.rotationActions.blocked.value, run: () => runtime.rotationActions.rotate(rotation.id) });
		result.push(...groups.actions(ids).map(action => ({ ...action, group: 'arrange' as const })));
		return ordered(result);
	});
}
