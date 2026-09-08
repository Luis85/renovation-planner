<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { tr } from '../../i18n/strings';
import type { EntityId } from '../../../core/identity/EntityId';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useEditorRuntime } from '../runtime';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useSelectionStore } from './selection-store';
import { resolveSelectionTarget } from './resolveSelectionTarget';
import { structureCandidates } from '../structure/structureCandidates';
import { screenPoint, screenToWorld, STAGE_PIXELS } from '../viewport/Viewport';
import { useCanvasGroupActions } from './canvasGroupActions';
import { useCanvasMenuActions, type CanvasMenuAction } from './useCanvasMenuActions';
const emit = defineEmits<{ openAdd: [] }>();
const anchor = ref<HTMLElement | null>(null), menu = ref<HTMLElement | null>(null), open = ref(false), position = ref({ left: '0px', top: '0px' });
const runtime = useEditorRuntime(), project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore(), dialogs = useDialogStore(), groups = useCanvasGroupActions();
const actions = useCanvasMenuActions(() => emit('openAdd'));
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
	const candidates = [...project.zones.values(), ...structureCandidates(project.structure)];
	if (rowId && candidates.some(item => item.id === rowId)) return rowId;
	if (keyboard) return undefined;
	return resolveSelectionTarget({ candidates, selectedIds: selection.selectedIds, worldPoint: screenToWorld(screenPoint(x, y), editor.viewport, STAGE_PIXELS), handleToleranceWorld: 0, cycle: event.altKey })?.id;
}
function selectContext(hit: string | undefined, keyboard: boolean, event: MouseEvent | KeyboardEvent): void {
	if (hit && (event.altKey || !selection.selectedIds.some(id => id === hit))) selection.select((groups.expandSelection?.(hit, event.altKey) ?? [hit]).map(id => id as EntityId<string>));
	else if (!keyboard && !hit) selection.clear();
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
function key(event: KeyboardEvent): void { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) void show(event); }
function outside(event: PointerEvent): void { if (open.value && !menu.value?.contains(event.target as Node)) close(false); }
function leave(event: FocusEvent): void { if (open.value && (!event.relatedTarget || !root?.contains(event.relatedTarget as Node))) close(false); }
function navigation(event: KeyboardEvent): void {
	if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
	if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(); return; }
	if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
	event.preventDefault(); event.stopPropagation();
	const items = [...menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []];
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
				<button
					v-for="action in actions"
					:key="action.id"
					type="button"
					role="menuitem"
					tabindex="-1"
					:aria-disabled="action.disabled || undefined"
					:data-rp-context-action="action.id"
					@click="run(action)"
				>
					{{ tr(action.label) }}
				</button>
			</div>
		</Teleport>
	</div>
</template>
