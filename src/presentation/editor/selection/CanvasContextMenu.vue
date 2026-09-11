<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { tr } from '../../i18n/strings';
import type { EntityId } from '../../../core/identity/EntityId';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useEditorRuntime } from '../runtime';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useSelectionStore } from './selection-store';
import { resolveSelectionTarget } from './resolveSelectionTarget';
import { structureCandidates } from '../structure/structureCandidates';
import { screenPoint, screenToWorld, stageCentreWorld, STAGE_PIXELS } from '../viewport/Viewport';
import { useCanvasGroupActions } from './canvasGroupActions';
import { useCanvasMenuActions, type CanvasMenuAction } from './useCanvasMenuActions';
import { canvasCandidates } from './canvasCandidates';
import { structureRecords } from '../structure/structureRecords';
import { plainPress } from '../surface/keyboard';
import HostIcon from '../../components/HostIcon.vue';
import type { Point } from '../../../core/geometry/Point';
const emit = defineEmits<{ openAdd: [] }>();
const anchor = ref<HTMLElement | null>(null), menu = ref<HTMLElement | null>(null), open = ref(false), position = ref({ left: '0px', top: '0px' });
const runtime = useEditorRuntime(), project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore(), dialogs = useDialogStore(), groups = useCanvasGroupActions();
/** Where the menu was opened, in world millimetres — where its Paste lands (design spec §4). */
let openedAt: Point = { x: 0, y: 0 };
const actions = useCanvasMenuActions(() => emit('openAdd'), () => openedAt);
const workspace = useWorkspaceStore();
/** The one object the menu acts on, named the way the rest of the editor names it; nothing for an empty or multiple selection. */
const title = computed(() => { if (selection.selectedIds.length !== 1) return null; const id = selection.selectedIds[0]; return project.zones.get(id)?.name ?? structureRecords(project.structure, project.plan?.id ?? '', project.plan?.spatialElements).find(item => item.id === id)?.name ?? null; });
let menuIds: readonly string[] = [];
let root: HTMLElement | null = null, canvas: HTMLElement | null = null, opener: HTMLElement | null = null;
function editing(target: EventTarget | null): boolean { return target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null; }
function close(restore = true): void { open.value = false; if (restore) (opener?.isConnected ? opener : canvas)?.focus(); }
function unavailable(event: MouseEvent | KeyboardEvent): boolean {
	return editing(event.target) || dialogs.current !== null || !!root?.querySelector('.rp-add-menu') || runtime.toolManager.gestureInFlight || editor.dragState !== null || !['select', 'pan'].includes(runtime.activeToolId.value ?? '');
}
function contextTarget(event: MouseEvent | KeyboardEvent, x: number, y: number): string | undefined {
	const target = event.target as HTMLElement, keyboard = event instanceof KeyboardEvent;
	const rowId = target.closest<HTMLElement>('[data-rp-id]')?.dataset.rpId;
	if (rowId && (project.zones.has(rowId) || structureCandidates(project.structure).some(item => item.id === rowId))) return rowId;
	if (keyboard) return undefined;
	const candidates = canvasCandidates(project.zones.values(), project.structure, workspace.layerVisibility);
	return resolveSelectionTarget({ candidates, selectedIds: selection.selectedIds, worldPoint: screenToWorld(screenPoint(x, y), editor.viewport, STAGE_PIXELS), handleToleranceWorld: 0, cycle: event.altKey })?.id;
}
function selectContext(hit: string | undefined, keyboard: boolean, event: MouseEvent | KeyboardEvent): void {
	// `groups.expandSelection` is optional only on the interface (`CanvasGroupActionsProvider`,
	// for a bare consumer with nothing above it — `canvasGroupActions.test.ts`'s own case): this
	// component mounts only inside a Plan Editor tree, and `runtime.ts`'s `buildRuntime` always
	// calls `createSpatialEditing` -> `createGroupActions` -> `provideCanvasGroupActions` before
	// any descendant can reach `useEditorRuntime()` at all (it throws with no provider), so the
	// method is never actually absent here. A type-only cast rather than `?? [hit]` for that
	// reason (`typescript/no-non-null-assertion` refuses `!`): the fallback was an uncovered
	// branch no test could reach honestly.
	const expandSelection = groups.expandSelection as NonNullable<typeof groups.expandSelection>;
	if (hit && (event.altKey || !selection.selectedIds.some(id => id === hit))) selection.select(expandSelection(hit, event.altKey).map(id => id as EntityId<string>));
	else if (!keyboard && !hit) selection.clear();
	if (hit) selection.focus(hit as EntityId<string>);
	menuIds = [...selection.selectedIds];
}
function allowedTarget(target: HTMLElement, keyboard: boolean, surface: HTMLElement): boolean {
	if (keyboard || target.closest('[data-rp-id]')) return true;
	return surface.contains(target) && target.closest('button, a, [role="menu"]') === null;
}
async function show(event: MouseEvent | KeyboardEvent): Promise<void> {
	if (!canvas || !root || unavailable(event)) return;
	const target = event.target as HTMLElement, keyboard = event instanceof KeyboardEvent;
	if (!allowedTarget(target, keyboard, canvas)) return;
	event.preventDefault(); event.stopPropagation();
	const bounds = canvas.getBoundingClientRect();
	const x = keyboard ? bounds.width / 2 : event.clientX - bounds.left, y = keyboard ? bounds.height / 2 : event.clientY - bounds.top;
	openedAt = keyboard ? stageCentreWorld(editor.stageSize, editor.viewport) : screenToWorld(screenPoint(x, y), editor.viewport, STAGE_PIXELS);
	const host = root.getBoundingClientRect(), menuX = x + bounds.left - host.left, menuY = y + bounds.top - host.top;
	selectContext(contextTarget(event, x, y), keyboard, event);
	opener = keyboard && target instanceof HTMLElement ? target : canvas;
	position.value = { left: `${Math.max(8, menuX)}px`, top: `${Math.max(8, menuY)}px` }; open.value = true;
	await nextTick();
	if (!menu.value) return;
	position.value = { left: `${Math.max(8, Math.min(menuX, host.width - menu.value.offsetWidth - 8))}px`, top: `${Math.max(8, Math.min(menuY, host.height - menu.value.offsetHeight - 8))}px` };
	menu.value.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
}
function context(event: MouseEvent): void { void show(event); }
function key(event: KeyboardEvent): void {
	if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) void show(event);
	else if ((event.key === 'Delete' || event.key === 'Backspace') && plainPress(event) && !event.defaultPrevented && !unavailable(event)) deleteKey(event);
}
/** Delete and Backspace run this menu's own Delete for the selection (spec §9), so the key never means anything the menu does not. */
function deleteKey(event: KeyboardEvent): void {
	const action = actions.value.find(item => item.id === 'delete' && !item.disabled);
	if (!action) return;
	event.preventDefault(); event.stopPropagation(); close(open.value); void action.run();
}
function outside(event: PointerEvent): void { if (open.value && !menu.value?.contains(event.target as Node)) close(false); }
function leave(event: FocusEvent): void { if (open.value && (!event.relatedTarget || !root?.contains(event.relatedTarget as Node))) close(false); }
function navigation(event: KeyboardEvent): void {
	if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
	if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(); return; }
	if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
	event.preventDefault(); event.stopPropagation();
	// The element the LISTENER is bound to, not the `menu` ref: `navigation` runs only as the
	// native `@keydown` handler attached to the menu's own element (below), and the DOM sets
	// `currentTarget` to that element for every dispatch — a browser guarantee rather than a
	// ref-timing assumption, so no nullable read (`menu.value?... ?? []`, an uncovered branch no
	// test could reach honestly) is needed at all.
	const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]')];
	const index = items.indexOf(document.activeElement as HTMLElement);
	const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
	items[next]?.focus();
}
function run(action: CanvasMenuAction): void { if (action.disabled) return; close(); void action.run(); }
watch(() => selection.selectedIds, ids => { if (open.value && (ids.length !== menuIds.length || ids.some((id, index) => id !== menuIds[index]))) close(false); });
watch(() => dialogs.current, dialog => { if (dialog && open.value) close(false); });
onMounted(() => {
	root = anchor.value?.closest<HTMLElement>('.renovation-plan-editor') ?? null; canvas = anchor.value?.closest<HTMLElement>('.rp-plan-canvas') ?? null;
	root?.addEventListener('contextmenu', context); root?.addEventListener('keydown', key); root?.addEventListener('pointerdown', outside, true); root?.addEventListener('focusout', leave);
});
onBeforeUnmount(() => { root?.removeEventListener('contextmenu', context); root?.removeEventListener('keydown', key); root?.removeEventListener('pointerdown', outside, true); root?.removeEventListener('focusout', leave); });
</script>
<template>
	<div
		ref="anchor"
		class="rp-context-menu-anchor"
	>
		<Teleport
			v-if="open && root"
			:to="root"
		>
			<div
				ref="menu"
				class="rp-canvas-context-menu"
				role="menu"
				:aria-label="tr('editor.input.context')"
				:style="position"
				@keydown="navigation"
			>
				<div
					v-if="title"
					class="rp-canvas-context-menu-title"
					role="presentation"
				>
					{{ title }}
				</div>
				<button
					v-for="action in actions"
					:key="action.id"
					type="button"
					role="menuitem"
					tabindex="-1"
					:aria-disabled="action.disabled || undefined"
					:title="action.disabled && action.reason ? tr(action.reason) : undefined"
					:data-rp-context-action="action.id"
					@click="run(action)"
				>
					<HostIcon :name="action.icon" />{{ tr(action.label, action.params) }}
				</button>
			</div>
		</Teleport>
	</div>
</template>
