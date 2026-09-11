import { computed, onBeforeUnmount, watch } from 'vue';
import type { Vector } from '../../../core/geometry/Vector';
import type { Point } from '../../../core/geometry/Point';
import type { EntityId } from '../../../core/identity/EntityId';
import { createEntityId } from '../../../core/identity/generateId';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { encloseRoom } from '../../../domain/spatial/encloseRoom';
import { groupMembers, groupRoots, regroup, selectedGroup } from '../../../domain/spatial/SpatialGroup';
import { useProjectStore } from '../../stores/ProjectStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useSelectionStore } from '../selection/selection-store';
import { provideCanvasGroupActions, type CanvasGroupAction } from '../selection/canvasGroupActions';
import type { PlanEditorContext } from '../PlanEditorContext';
import { notifyOperationFailure } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import { STAGE_PIXELS, worldPerScreenPixel } from '../viewport/Viewport';
import { captureGroup, groupRotationTarget } from './groupSnapshot';
import { createGroupOperations, type GroupOperationRuntime } from './groupOperations';
import { createGroupRotation } from './groupRotation';
import { GroupMoveGesture, type GroupMoveDependencies } from './GroupMoveGesture';
import { translatedGroup } from './groupTransforms';
import type { RotationShape } from '../elements/objectRotation';

/** Persist group membership separately from selection, with implicit hosted openings. */
export function createGroupActions(context: PlanEditorContext, runtime: GroupOperationRuntime) {
	const project = useProjectStore(), selection = useSelectionStore(), workspace = useWorkspaceStore(), editor = useEditorStore();
	const operations = createGroupOperations(context, runtime), rotation = createGroupRotation(context, runtime, operations);
	const saved = computed(() => selectedGroup(project.groups, selection.selectedIds, project.structure));
	const spatialIds = computed(() => new Set([...project.zones.keys(), ...project.structure.walls.map(item => item.id), ...project.structure.openings.map(item => item.id), ...project.structure.elements?.map(item => item.id) ?? []]));
	function expandSelection(id: string, deep = false): readonly string[] {
		if (deep) return spatialIds.value.has(id) ? [id] : [];
		if (id === 'selection-group') return selection.selectedIds.filter(member => spatialIds.value.has(member));
		const root = groupRoots([id], project.structure)[0];
		const savedGroup = project.groups.find(item => item.id === id || item.memberIds.includes(root));
		return savedGroup ? groupMembers(savedGroup, project.structure) : spatialIds.value.has(id) ? [id] : [];
	}
	function target(memberId: string) {
		const ids = selection.selectedIds.length > 1 && selection.selectedIds.some(id => id === memberId) ? selection.selectedIds : expandSelection(memberId);
		const snapshot = captureGroup(operations.document.value, ids, operations.generation.value);
		if (!snapshot) return null;
		const visible = snapshot.memberIds.some(id => project.zones.has(id) ? workspace.layerVisibility.zone : workspace.layerVisibility.architecture);
		return groupRotationTarget(snapshot, visible);
	}
	const currentTarget = computed(() => selection.selectedIds.length > 1 || saved.value ? target(selection.selectedIds[0]) : null);
	const disabled = computed(() => operations.blocked.value || operations.working.value || (currentTarget.value !== null && !operations.current(currentTarget.value.group)));
	function choose(ids: readonly string[]): void { selection.select(ids.map(id => id as EntityId<string>)); }
	function defaultName(id: string): string {
		const name = project.zones.get(id)?.name;
		return name && name.length <= 100 ? name : tr('editor.group.number', { n: String(project.groups.length + 1) });
	}
	async function group(ids: readonly string[] = selection.selectedIds): Promise<void> {
		const snapshot = operations.capture(ids); if (!snapshot) return;
		const name = defaultName(ids[0]);
		const groups = regroup(snapshot.document.groups ?? [], { id: createEntityId('group'), name, memberIds: ids }, snapshot.document.structure ?? EMPTY_STRUCTURE);
		if (await operations.commit(snapshot, { ...snapshot.document, groups })) choose(groupMembers(groups[groups.length - 1], project.structure));
	}
	async function ungroup(ids: readonly string[] = selection.selectedIds): Promise<void> {
		const snapshot = operations.capture(ids); if (!snapshot) return;
		await operations.commit(snapshot, { ...snapshot.document, groups: snapshot.document.groups?.filter(item => item.id !== snapshot.id) });
	}
	async function enclose(id: string): Promise<void> {
		const snapshot = operations.capture([id], true), zone = project.zones.get(id);
		if (!snapshot || zone?.zoneType !== 'Room') return;
		const room = snapshot.document.objects.find(object => object.id === id); if (!room) return;
		const enclosed = encloseRoom(room, snapshot.document.structure ?? EMPTY_STRUCTURE, { height: 2400, thickness: 150 }, () => createEntityId('wall'));
		if (!enclosed.ok) { notifyOperationFailure(enclosed.error); return; }
		const existing = snapshot.document.groups?.find(item => item.memberIds.includes(id));
		const groups = regroup(snapshot.document.groups ?? [], { id: existing?.id ?? createEntityId('group'), name: existing?.name ?? defaultName(id),
			memberIds: [id, ...enclosed.value.wallIds] }, enclosed.value.structure);
		if (await operations.commit(snapshot, { ...snapshot.document, structure: enclosed.value.structure, groups })) choose(groupMembers(groups[groups.length - 1], project.structure));
	}
	function actions(ids: readonly string[]): readonly CanvasGroupAction[] {
		const result: CanvasGroupAction[] = [], existing = selectedGroup(project.groups, ids, project.structure);
		const focused = selection.focusedId;
		if (ids.length > 1 && focused && ids.includes(focused)) result.push({ id: 'inspect', label: 'editor.group.select-member', icon: 'mouse-pointer-click', run: () => choose([focused]) });
		if (ids.length === 1 && !existing && expandSelection(ids[0]).length > 1) result.push({ id: 'select-group', label: 'editor.group.select-saved', icon: 'square-dashed-mouse-pointer', run: () => choose(expandSelection(ids[0])) });
		if (existing) result.push({ id: 'ungroup', label: 'editor.group.ungroup', icon: 'ungroup', disabled: disabled.value, run: () => ungroup(ids) });
		else if (groupRoots(ids, project.structure).length > 1) result.push({ id: 'group', label: 'editor.group.group', icon: 'group', disabled: disabled.value, run: () => group(ids) });
		if (ids.length === 1 && project.zones.get(ids[0])?.zoneType === 'Room') result.push({ id: 'enclose', label: 'editor.group.enclose', icon: 'brick-wall', disabled: disabled.value, run: () => enclose(ids[0]) });
		return result;
	}
	provideCanvasGroupActions({ actions, expandSelection });
	const moveDependencies: GroupMoveDependencies = { capture: operations.capture, current: operations.current,
		scale: () => worldPerScreenPixel(editor.viewport, STAGE_PIXELS),
		preview: (snapshot, delta) => { operations.preview.value = snapshot && delta ? translatedGroup(snapshot, delta) : null; },
		commit: async (snapshot, delta) => { try { await operations.commit(snapshot, translatedGroup(snapshot, delta)); } finally { operations.preview.value = null; } },
	};
	const selectionMove = new GroupMoveGesture(moveDependencies);
	watch(operations.generation, () => selectionMove.cancel(), { flush: 'sync' });
	onBeforeUnmount(() => selectionMove.cancel());
	async function moveBy(delta: Vector): Promise<void> {
		const snapshot = operations.capture(selection.selectedIds); if (snapshot) await operations.commit(snapshot, translatedGroup(snapshot, delta));
	}
	async function rotate(id: string, degrees?: number): Promise<void> {
		const shape = currentTarget.value; if (shape?.id === id) await rotation.rotate(shape.group, degrees);
	}
	return { active: operations.working, blocked: operations.blocked, disabled, preview: operations.preview, saved, target: currentTarget,
		canRotateShape: (shape: RotationShape) => Boolean(shape.group && operations.current(shape.group)),
		groupRotationTarget: target, expandSelection, selectionMove, actions, moveBy, rotate, moveRotation: rotation.move,
		previewRotation: (id: string | null, points?: readonly Point[]) => rotation.preview(id && currentTarget.value?.id === id ? currentTarget.value.group : null, points),
	};
}
