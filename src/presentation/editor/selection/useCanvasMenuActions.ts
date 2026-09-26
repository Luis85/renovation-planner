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
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
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
import { structureCandidates } from '../structure/structureCandidates';
import { useRecordMenuActions } from './recordMenuActions';
import { useDraftingMenuActions } from './draftingMenuActions';

/**
 * Menu order is the group order, and `CanvasContextMenu` draws a separator between groups: what the
 * object links to first (a zone's plans, a placement's asset), then the object's own edits, what can be created at that point, the clipboard,
 * selection and grouping, the view, and last what destroys the object.
 */
export type CanvasMenuGroup = 'plans' | 'edit' | 'create' | 'records' | 'clipboard' | 'arrange' | 'view' | 'destructive';
/** `shortcut` is the key hint drawn at the row's end, already resolved for this platform (the asset designer's menu, AD18-R16 Task 11). */
export interface CanvasMenuAction { readonly id: string; readonly label: StringKey; readonly group: CanvasMenuGroup; readonly icon: string; readonly params?: Readonly<Record<string, string>>; readonly disabled?: boolean; readonly reason?: StringKey; readonly shortcut?: string; run(): void | Promise<void> }
export interface CanvasMenuSubmenu { readonly id: string; readonly label: StringKey; readonly group: CanvasMenuGroup; readonly icon: string; readonly children: readonly CanvasMenuAction[]; readonly disabled?: boolean; readonly reason?: StringKey }
export type CanvasMenuItem = CanvasMenuAction | CanvasMenuSubmenu;
export function isSubmenu(item: CanvasMenuItem): item is CanvasMenuSubmenu { return 'children' in item; }
const GROUP_ORDER: readonly CanvasMenuGroup[] = ['plans', 'edit', 'create', 'records', 'clipboard', 'arrange', 'view', 'destructive'];
const GEOMETRY_ACTIONS = new Set(['wall-thickness', 'adjust-thickness', 'add-point', 'edit', 'move-opening', 'rotate', 'add', 'measure', 'add-door', 'add-window', 'add-opening', 'new-wall', 'enclose']);
/** A captured menu action must obey the current perspective when invoked later. */
function guardGeometryActions(actions: readonly CanvasMenuAction[], canEdit: () => boolean, elementSelected: boolean, planOnly: boolean): CanvasMenuAction[] {
	return actions.map(action => {
		if (!GEOMETRY_ACTIONS.has(action.id) && !action.id.startsWith('draft-') && !(elementSelected && ['rename', 'delete'].includes(action.id))) return action;
		return { ...action, disabled: action.disabled === true || !canEdit(), reason: planOnly ? 'editor.element.plan-geometry' : action.reason, run: () => { if (canEdit()) return action.run(); } };
	});
}
/**
 * A plain item's promotion into the asset library (2026-09-13 item modes spec §B); nothing where this leaf cannot create an asset.
 * Outside `useCanvasMenuActions` only for that function's 100-line budget. Greyed by `promote`'s own refusal predicate;
 * its Review arm never greys here, since the menu returns before single-selection actions there and the entry is hidden.
 */
function promoteActions(runtime: ReturnType<typeof useEditorRuntime>, project: ReturnType<typeof useProjectStore>, id: string): CanvasMenuAction[] {
	const promotion = runtime.elementTask.promotion;
	if (!promotion.available() || !project.structure.elements?.some(item => item.id === id && item.kind === 'object')) return [];
	return [{ id: 'add-to-library', label: 'editor.input.add-to-library', group: 'records', icon: 'square-dashed-mouse-pointer', disabled: promotion.refused(), run: () => promotion.promote(id) }];
}
/** A placement's asset in its designer, as the placement Inspector's own button; a navigation rather than an edit, so offered in Review too, and hidden for a missing asset as there. */
function designerActions(context: PlanEditorContext | undefined, project: ReturnType<typeof useProjectStore>, shapes: ReturnType<typeof useAssetShapeStore>, ids: readonly string[]): CanvasMenuAction[] {
	const assetId = ids.length === 1 ? project.structure.elements?.find(item => item.id === ids[0])?.assetId : undefined;
	const navigation = context?.navigation, open = navigation?.asset?.bind(navigation);
	if (!assetId || !open || shapes.answerFor(assetId)?.kind === 'missing') return [];
	return [{ id: 'open-asset-designer', label: 'editor.asset.open-designer', group: 'plans', icon: 'square-dashed-mouse-pointer', run: () => open(assetId) }];
}
function thicknessActions(runtime: ReturnType<typeof useEditorRuntime>, id: string, wall: boolean, blocked: boolean): CanvasMenuAction[] {
	if (!wall) return [];
	const thickness = runtime.structureActions.thickness, disabled = blocked || runtime.structureActions.active.value || !runtime.structureTask.available;
	return [
		{ id: 'wall-thickness', label: 'editor.wall-thickness.edit', group: 'edit', icon: 'text-cursor-input', disabled, run: () => thickness.begin(id) },
		{ id: 'adjust-thickness', label: 'editor.wall-thickness.adjust', group: 'edit', icon: 'move-horizontal', disabled, run: () => thickness.begin(id, 'adjust') },
	];
}
export function useCanvasMenuActions(add: () => void, opened: () => Point) {
	const runtime = useEditorRuntime(), project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore(), shapes = useAssetShapeStore();
	const moveOpening = useOpeningMoveAction(), clipboard = useClipboardActions();
	const frame = usePlanFrame(), groups = useCanvasGroupActions(), session = useRenovationSession();
	const detailPlans = useDetailPlanActions(), records = useRecordMenuActions(), drafting = useDraftingMenuActions(opened);
	function fit(all: boolean): void { const bounds = frame(all); if (bounds) editor.fitTo(bounds, editor.stageSize); }
	/** Why a greyed item is greyed: a stale floor first, since that one blocks everything, else whatever tool or edit is in flight. */
	function reason(disabled: boolean): StringKey | undefined { return !disabled ? undefined : runtime.writesBlocked.value ? 'editor.stale-write-refused' : 'editor.input.unavailable'; }
	function orderActions(result: readonly CanvasMenuAction[]): CanvasMenuAction[] {
		const guarded = guardGeometryActions(result, () => session.perspective === 'plan' && !runtime.writesBlocked.value, project.structure.elements?.some(item => item.id === selection.selectedIds[0]) === true, session.perspective !== 'plan');
		return GROUP_ORDER.flatMap(group => guarded.filter(action => action.group === group)).map(action => ({ ...action, reason: action.reason ?? reason(action.disabled === true) }));
	}
	function ordered(result: readonly CanvasMenuItem[]): CanvasMenuItem[] {
		return GROUP_ORDER.flatMap(group => result.filter(item => item.group === group)).map(item => {
			if (!isSubmenu(item)) return orderActions([item])[0];
			const children = orderActions(item.children), disabled = children.every(child => child.disabled);
			return { ...item, children, disabled, reason: disabled ? children[0]?.reason : undefined };
		});
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
			{ id: 'add-door', label: 'editor.input.add.door', group: 'create', icon: 'door-open', disabled, run: () => task.placeAt('place-door', id, at) },
			{ id: 'add-window', label: 'editor.input.add.window', group: 'create', icon: 'panels-top-left', disabled, run: () => task.placeAt('place-window', id, at) },
			{ id: 'add-opening', label: 'editor.input.add.opening', group: 'create', icon: 'rectangle-horizontal', disabled, run: () => task.placeAt('place-opening', id, at) },
			{ id: 'new-wall', label: 'editor.input.add.wall-here', group: 'create', icon: 'brick-wall', disabled: disabled || refused, reason: refused ? 'editor.structure.error.opening-split' : undefined, run: () => task.drawFrom(id, at, tolerance) },
		];
	}

	/** The Add submenu for a single selection outside Review: a wall's geometry creations plus every target's record creations but a drafting mark's, joined and grouped. Nothing for several items, and nothing where neither applies. */
	function addSubmenu(id: string, blocked: boolean): CanvasMenuSubmenu[] {
		if (!project.zones.has(id) && !structureCandidates(project.structure).some(item => item.id === id)) return [];
		const children = [...wallActions(id, blocked), ...(drafting.isMark(id) ? [] : records(id, blocked))];
		return children.length ? [{ id: 'add-menu', label: 'editor.input.add', group: 'create', icon: 'plus', children }] : [];
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
			result.push({ id: 'edit', label: 'editor.input.edit', group: 'edit', icon: 'pencil', disabled: blocked || actions.active.value, run: () => actions.edit(id) });
			if (project.structure.openings.some(item => item.id === id)) result.push({ id: 'move-opening', label: 'editor.opening-move.action', group: 'edit', icon: 'move-horizontal', disabled: !runtime.openingMove.available.value, run: () => moveOpening(id) });
			if (element) result.push({ id: 'rename', label: 'editor.input.rename', group: 'edit', icon: 'text-cursor-input', disabled: blocked || actions.active.value, run: () => actions.edit(id) });
			result.push({ id: 'delete', label: 'editor.input.delete', group: 'destructive', icon: 'trash', disabled: blocked || actions.active.value, run: () => actions.remove(id) });
		}
		result.push(...addPointActions(id, blocked), ...thicknessActions(runtime, id, project.structure.walls.some(wall => wall.id === id), blocked));
		return result;
	}
	return computed<readonly CanvasMenuItem[]>(() => {
		const ids = selection.selectedIds, id = ids[0];
		const blocked = runtime.writesBlocked.value, review = session.perspective === 'review', panning = runtime.activeToolId.value === 'pan';
		const result: CanvasMenuItem[] = [fitAction(ids), ...designerActions(context, project, shapes, ids)];
		// Hidden rather than greyed when nothing selected is copyable: every disabled reason here names an edit, and Copy is not one.
		if (clipboard?.canCopy.value) result.push({ id: 'copy', label: 'editor.input.copy', group: 'clipboard', icon: 'copy', run: () => { clipboard.copy(); } });
		if (review) return ordered(result);
		result.push(panning ? { id: 'select', label: 'editor.input.switch-to-select', group: 'view', icon: 'mouse-pointer-2', run: () => runtime.setTool('select') } : { id: 'pan', label: 'editor.input.switch-to-pan', group: 'view', icon: 'hand', run: () => runtime.setTool('pan') });
		if (!ids.length) result.push({ id: 'add', label: 'editor.primary.add', group: 'create', icon: 'plus', disabled: blocked, run: add });
		if (clipboard?.hasClipboard.value) result.push({ id: 'paste', label: 'editor.input.paste', group: 'clipboard', icon: 'clipboard-paste', disabled: !clipboard.canPaste.value, run: () => clipboard.paste(opened()) });
		if (ids.length === 1) result.push(...singleActions(id, blocked), ...drafting.flip(id, blocked), ...promoteActions(runtime, project, id), ...addSubmenu(id, blocked));
		// Only where the composite removal has its services, as the batch panel already requires: an item that would do nothing is worse than none.
		else if (ids.length && runtime.renovation.available) result.push({ id: 'delete', label: runtime.groupActions.saved.value ? 'editor.group.delete' : 'editor.input.delete', group: 'destructive', icon: 'trash', disabled: multiDeleteBlocked(runtime), run: () => deleteItems(runtime, project.structure, ids) });
		result.push({ id: 'measure', label: 'editor.input.measure-here', group: 'create', icon: 'ruler', disabled: blocked || !runtime.elementTask.available, run: () => runtime.elementTask.startAt('measure', opened()) }, drafting.submenu(blocked));
		const rotation = runtime.rotationActions.target.value;
		if (rotation) result.push({ id: 'rotate', label: 'editor.input.rotate', group: 'edit', icon: 'rotate-cw', disabled: blocked || runtime.rotationActions.blocked.value, run: () => runtime.rotationActions.rotate(rotation.id) });
		result.push(...groups.actions(ids).map(action => ({ ...action, group: 'arrange' as const })));
		return ordered(result);
	});
}
