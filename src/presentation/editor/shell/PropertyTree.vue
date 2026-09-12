<script setup lang="ts">
/**
 * The Property tree (ADR-0029): the project row, then every plan of the project as one
 * `role="tree"` nested by parent link — `hierarchy.tree`, built once per hydrate from the same
 * `listPlans` read the ancestry uses. Full tree semantics with a roving tabindex: ↑/↓ walk the
 * visible rows, Home/End jump, ←/→ go to the parent / the first child (every node is expanded,
 * so → on a leaf does nothing), Enter or Space opens the focused plan through the ONE
 * `navigation.plan` door. This is the "arrives with a third level" deferral of the 2026-09-10
 * sidebar polish, and the third level is here.
 *
 * Reordering siblings has three inputs and ONE door: the row menu (right-click, Shift+F10 or the
 * ContextMenu key — `PropertyTreeMenu`, teleported into `.renovation-plan-editor` like the canvas
 * menu), native drag and drop between rows of the SAME parent, and Alt+↑/↓ on the focused row.
 * All three call `usePlanReorder`, which owns availability, the paused gate, the writes and the
 * focus restore after one. Every handler is delegated to the `<ul>` and keys on the `li`'s
 * `data-rp-plan-id`/`data-rp-parent-id`, so the template stays one list.
 *
 * Touch devices have no HTML5 drag and drop, so the row menu is the mobile path: long-press
 * raises `contextmenu` there, and the same menu is what Shift+F10 reaches from a keyboard.
 *
 * The drag state is per `PropertyTree` INSTANCE, deliberately not module-level: a drop from
 * another leaf's tree would be a cross-tree, possibly cross-project move — a re-parenting, which
 * is out of scope — and per-instance state makes that a no-op by construction rather than a
 * check somebody has to remember.
 */
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import PropertyTreeNode from './PropertyTreeNode.vue';
import PropertyTreeMenu from './PropertyTreeMenu.vue';
import { findNode, usePlanReorder, type DropTarget } from './usePlanReorder';

const { project, plan } = storeToRefs(useProjectStore());
const { hierarchy, failed } = storeToRefs(usePlanHierarchyStore());
const context = usePlanEditorContext();
const reorder = usePlanReorder();
const treeEl = ref<HTMLElement | null>(null);
const rootEl = ref<HTMLElement | null>(null);
/** A row is draggable only with both gates open; the menu opens on `available` alone and greys itself. */
const canReorder = computed(() => reorder.available.value && !reorder.paused.value);
const navigate = computed(() => {
	const openPlan = context.navigation?.plan;
	return openPlan ? (planId: string) => { void openPlan(planId); } : undefined;
});
/**
 * A leaf whose query bundle answers no `hierarchy` (the harness index, the older editor rigs)
 * draws the open plan alone rather than an empty tree.
 */
const tree = computed(() =>
	hierarchy.value.tree.length > 0
		? hierarchy.value.tree
		: plan.value
			? [{ id: plan.value.id, name: plan.value.name, kind: plan.value.kind, order: plan.value.order, parentId: null, children: [] }]
			: [],
);

const menuFor = ref<{ planId: string; x: number; y: number } | null>(null);
const menuNode = computed(() => (menuFor.value ? findNode(tree.value, menuFor.value.planId) : undefined));
const menuPosition = computed(() => {
	if (!menuFor.value || !menuNode.value) return null;
	const siblings = reorder.siblingsOf(menuNode.value.id), index = siblings.findIndex((node) => node.id === menuNode.value?.id);
	return { ...menuFor.value, first: index <= 0, last: index >= siblings.length - 1 };
});
let opener: HTMLElement | null = null;
function openMenu(item: HTMLElement, x: number, y: number): void {
	const id = item.dataset.rpPlanId;
	if (!id || !reorder.available.value) return;
	const host = rootEl.value?.closest<HTMLElement>('.renovation-plan-editor')?.getBoundingClientRect();
	opener = item;
	menuFor.value = { planId: id, x: Math.max(8, x - (host?.left ?? 0)), y: Math.max(8, y - (host?.top ?? 0)) };
}
function closeMenu(): void { menuFor.value = null; opener?.focus(); }
function itemOf(event: Event): HTMLElement | null { return (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]'); }
function onContextMenu(event: MouseEvent): void {
	const item = itemOf(event);
	if (!item) return;
	event.preventDefault(); event.stopPropagation();
	openMenu(item, event.clientX, event.clientY);
}

/** The row being dragged, and its parent — a drop is legal only on a row with the SAME parent. */
const dragging = ref<{ planId: string; parentId: string | null } | null>(null);
const dropAt = ref<DropTarget | null>(null);
function onDragStart(event: DragEvent): void {
	const item = itemOf(event);
	if (!item || !canReorder.value) { event.preventDefault(); return; }
	dragging.value = { planId: item.dataset.rpPlanId ?? '', parentId: item.dataset.rpParentId ?? null };
	event.dataTransfer?.setData('text/plain', '');
	if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
function onDragOver(event: DragEvent): void {
	const item = itemOf(event), source = dragging.value;
	if (!item || !source || (item.dataset.rpParentId ?? null) !== source.parentId || item.dataset.rpPlanId === source.planId) { dropAt.value = null; return; }
	event.preventDefault();
	const rect = item.querySelector<HTMLElement>('.rp-property-tree__row')?.getBoundingClientRect();
	dropAt.value = { planId: item.dataset.rpPlanId ?? '', edge: rect && event.clientY > rect.top + rect.height / 2 ? 'after' : 'before' };
}
function onDrop(event: DragEvent): void {
	const target = dropAt.value, source = dragging.value;
	dragging.value = null; dropAt.value = null;
	if (!target || !source) return;
	event.preventDefault();
	const siblings = reorder.siblingsOf(source.planId);
	const from = siblings.findIndex((node) => node.id === source.planId), over = siblings.findIndex((node) => node.id === target.planId);
	if (from < 0 || over < 0) return;
	const index = (target.edge === 'after' ? over + 1 : over) - (from < over ? 1 : 0);
	void reorder.moveTo(source.planId, index);
}
function onDragEnd(): void { dragging.value = null; dropAt.value = null; }

function items(): HTMLElement[] {
	return [...(treeEl.value?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];
}
/** The reorder keys — Alt+↑/↓ move the row, ContextMenu or Shift+F10 open its menu. True when the key was one of them. */
function reorderKey(event: KeyboardEvent, item: HTMLElement): boolean {
	if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
		// The paused gate is `usePlanReorder`'s own `write()`, so it is not repeated here.
		if (!reorder.available.value) return true;
		event.preventDefault();
		const id = item.dataset.rpPlanId ?? '';
		void (event.key === 'ArrowUp' ? reorder.moveUp(id) : reorder.moveDown(id));
		return true;
	}
	if (event.altKey) return true;
	if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return false;
	// Stopped here, or the canvas menu's own root listener would open on the same press.
	event.preventDefault(); event.stopPropagation();
	const rect = item.getBoundingClientRect();
	openMenu(item, rect.left + 24, rect.top + rect.height / 2);
	return true;
}
function onKeydown(event: KeyboardEvent): void {
	const item = itemOf(event);
	if (!item || event.ctrlKey || event.metaKey || reorderKey(event, item)) return;
	const all = items(), index = all.indexOf(item);
	const moves: Record<string, () => HTMLElement | undefined> = {
		ArrowDown: () => all[index + 1],
		ArrowUp: () => all[index - 1],
		Home: () => all[0],
		End: () => all[all.length - 1],
		ArrowRight: () => item.querySelector<HTMLElement>('[role="treeitem"]') ?? undefined,
		ArrowLeft: () => item.parentElement?.closest<HTMLElement>('[role="treeitem"]') ?? undefined,
	};
	const move = moves[event.key];
	if (move) { event.preventDefault(); move()?.focus(); return; }
	if ((event.key === 'Enter' || event.key === ' ') && navigate.value) {
		const id = item.dataset.rpPlanId;
		if (id && id !== context.planId) { event.preventDefault(); navigate.value(id); }
	}
}
</script>

<template>
	<div
		ref="rootEl"
		class="rp-property-tree"
	>
		<button
			v-if="project && context.navigation"
			type="button"
			class="rp-property-tree__project"
			@click="context.navigation.project(project.id)"
		>
			<HostIcon name="house" />{{ project.name }}
		</button>
		<p
			v-else-if="project"
			class="rp-property-tree__project"
		>
			<HostIcon name="house" />{{ project.name }}
		</p>
		<ul
			ref="treeEl"
			role="tree"
			class="rp-property-tree__list"
			:aria-label="tr('editor.shell.tree')"
			@keydown="onKeydown"
			@contextmenu="onContextMenu"
			@dragstart="onDragStart"
			@dragover="onDragOver"
			@drop="onDrop"
			@dragend="onDragEnd"
		>
			<PropertyTreeNode
				v-for="node in tree"
				:key="node.id"
				:node="node"
				:level="1"
				:current-id="context.planId"
				:navigate="navigate"
				:draggable="canReorder"
				:drop-at="dropAt"
			/>
		</ul>
		<Teleport
			v-if="menuPosition && menuNode"
			:to="rootEl?.closest('.renovation-plan-editor') ?? 'body'"
		>
			<PropertyTreeMenu
				:plan-id="menuNode.id"
				:name="menuNode.name || tr('editor.floor')"
				:kind="menuNode.kind"
				:x="menuPosition.x"
				:y="menuPosition.y"
				:first="menuPosition.first"
				:last="menuPosition.last"
				@close="closeMenu"
			/>
		</Teleport>
		<p
			v-if="failed"
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.input.hierarchy-unreadable') }}
		</p>
		<p
			v-else-if="hierarchy.parentZoneMissing"
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.input.parent-zone-missing') }}
		</p>
	</div>
</template>
