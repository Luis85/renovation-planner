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
 * focus restore after one. Every handler is delegated to the `<ul>` and resolves the `li` it
 * landed in through `rowOf`, so the template stays one list. While a reorder is unavailable (no
 * command, review perspective) no input is CLAIMED: a right-click or Shift+F10 is left to the
 * host, rather than swallowed with nothing opened.
 *
 * HTML5 drag and drop needs a pointer; the row menu and Alt+↑/↓ are the paths that do not. The
 * Plan editor is desktop-only (`Platform.isMobile`, `src/plugin/planEditorCommands.ts`), so no
 * touch path is promised here.
 *
 * The drag state is per `PropertyTree` INSTANCE, deliberately not module-level: a drop from
 * another leaf's tree would be a cross-tree, possibly cross-project move — a re-parenting, which
 * is out of scope — and per-instance state makes that a no-op by construction rather than a
 * check somebody has to remember.
 */
import { computed, ref, shallowRef } from 'vue';
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

/** The `li` a delegated event landed in, with the two facts `PropertyTreeNode` declares on it. */
interface Row { readonly el: HTMLElement; readonly planId: string; readonly parentId: string | null }
function rowOf(event: Event): Row | null {
	const el = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"][data-rp-plan-id]');
	// The selector asked for the attribute, so the id is never absent — a type-only cast, since `!` is refused here.
	return el ? { el, planId: el.dataset.rpPlanId as string, parentId: el.dataset.rpParentId ?? null } : null;
}

const menuFor = ref<{ planId: string; x: number; y: number } | null>(null);
/**
 * The open menu: its node, the editor pane it is teleported into and positioned against (the
 * canvas menu's own host), and whether the row is first or last among its siblings. `null` while
 * closed — and once a re-read has dropped the row, so the menu closes with it rather than
 * offering moves for a plan that is gone.
 */
const menu = computed(() => {
	const open = menuFor.value;
	if (!open) return null;
	const node = findNode(tree.value, open.planId), host = rootEl.value?.closest<HTMLElement>('.renovation-plan-editor');
	if (!node || !host) return null;
	const siblings = reorder.siblingsOf(node.id), index = siblings.findIndex((sibling) => sibling.id === node.id);
	const rect = host.getBoundingClientRect();
	return { node, host, x: Math.max(8, open.x - rect.left), y: Math.max(8, open.y - rect.top), first: index <= 0, last: index >= siblings.length - 1 };
});
let opener: HTMLElement | null = null;
function openMenu(row: Row, x: number, y: number): void { opener = row.el; menuFor.value = { planId: row.planId, x, y }; }
function closeMenu(): void { menuFor.value = null; opener?.focus(); }
function onContextMenu(event: MouseEvent): void {
	const row = rowOf(event);
	if (!row || !reorder.available.value) return;
	event.preventDefault(); event.stopPropagation();
	openMenu(row, event.clientX, event.clientY);
}

/** The row being dragged — a drop is legal only on a row with the SAME parent. */
const dragging = shallowRef<Row | null>(null);
const dropAt = ref<DropTarget | null>(null);
/** `draggable` is bound to `canReorder`, so the browser raises this on a row only while a reorder is offered. */
function onDragStart(event: DragEvent): void {
	dragging.value = rowOf(event);
	// A real `dragstart` always carries a transfer (type-only cast); `move` keeps the cursor honest about what a drop does.
	(event.dataTransfer as DataTransfer).effectAllowed = 'move';
}
function onDragOver(event: DragEvent): void {
	const row = rowOf(event), source = dragging.value;
	if (!row || !source || row.parentId !== source.parentId || row.planId === source.planId) { dropAt.value = null; return; }
	event.preventDefault();
	// The row itself is the `li`'s first child (`PropertyTreeNode`); the `li` spans the nested group below it.
	const rect = row.el.children[0].getBoundingClientRect();
	dropAt.value = { planId: row.planId, edge: event.clientY > rect.top + rect.height / 2 ? 'after' : 'before' };
}
/**
 * Leaving the tree clears the indicator. Chromium reports no `relatedTarget` on `dragleave`, so
 * moving between two rows clears it for one event and the next `dragover` draws it again.
 */
function onDragLeave(event: DragEvent): void {
	if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) dropAt.value = null;
}
function onDrop(event: DragEvent): void {
	const target = dropAt.value, source = dragging.value;
	onDragEnd();
	if (!target || !source) return;
	event.preventDefault();
	const siblings = reorder.siblingsOf(source.planId);
	const from = siblings.findIndex((node) => node.id === source.planId), over = siblings.findIndex((node) => node.id === target.planId);
	// A re-read between the last `dragover` and the drop can have taken the target row; a source
	// gone the same way writes nothing on its own (`plannedWrites` skips an unknown id).
	if (over < 0) return;
	const index = (target.edge === 'after' ? over + 1 : over) - (from < over ? 1 : 0);
	void reorder.moveTo(source.planId, index);
}
function onDragEnd(): void { dragging.value = null; dropAt.value = null; }

function items(event: KeyboardEvent): HTMLElement[] {
	return [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="treeitem"]')];
}
/**
 * The reorder keys — Alt+↑/↓ move the row, ContextMenu or Shift+F10 open its menu. True when the
 * key was claimed. The paused gate is `usePlanReorder`'s own `write()`, so it is not repeated
 * here; while UNAVAILABLE nothing is claimed at all, so Alt+↑ roves like a bare ↑ and Shift+F10
 * reaches the host as it would from any other shell control.
 */
function reorderKey(event: KeyboardEvent, row: Row): boolean {
	const move = event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown');
	if (!move && event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return false;
	if (!reorder.available.value) return false;
	event.preventDefault();
	if (move) { void (event.key === 'ArrowUp' ? reorder.moveUp(row.planId) : reorder.moveDown(row.planId)); return true; }
	// Stopped here, or the canvas menu's own root listener would open on the same press.
	event.stopPropagation();
	const rect = row.el.getBoundingClientRect();
	openMenu(row, rect.left + 24, rect.top + rect.height / 2);
	return true;
}
function onKeydown(event: KeyboardEvent): void {
	const row = rowOf(event);
	if (!row || event.ctrlKey || event.metaKey || reorderKey(event, row)) return;
	const all = items(event), index = all.indexOf(row.el);
	const moves: Record<string, () => HTMLElement | null | undefined> = {
		ArrowDown: () => all[index + 1],
		ArrowUp: () => all[index - 1],
		Home: () => all[0],
		End: () => all[all.length - 1],
		ArrowRight: () => row.el.querySelector<HTMLElement>('[role="treeitem"]'),
		ArrowLeft: () => row.el.parentElement?.closest<HTMLElement>('[role="treeitem"]'),
	};
	const move = moves[event.key];
	if (move) { event.preventDefault(); move()?.focus(); return; }
	if ((event.key === 'Enter' || event.key === ' ') && navigate.value && row.planId !== context.planId) { event.preventDefault(); navigate.value(row.planId); }
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
			role="tree"
			class="rp-property-tree__list"
			:aria-label="tr('editor.shell.tree')"
			@keydown="onKeydown"
			@contextmenu="onContextMenu"
			@dragstart="onDragStart"
			@dragover="onDragOver"
			@dragleave="onDragLeave"
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
			v-if="menu"
			:to="menu.host"
		>
			<PropertyTreeMenu
				:plan-id="menu.node.id"
				:name="menu.node.name || tr('editor.floor')"
				:kind="menu.node.kind"
				:host="menu.host"
				:x="menu.x"
				:y="menu.y"
				:first="menu.first"
				:last="menu.last"
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
