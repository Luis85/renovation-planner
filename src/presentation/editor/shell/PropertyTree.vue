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
 * Reordering and the row menu are `usePlanReorder` / `PropertyTreeMenu` (Task 8), mounted here
 * so this file's template stays one list.
 */
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import PropertyTreeNode from './PropertyTreeNode.vue';

const { project, plan } = storeToRefs(useProjectStore());
const { hierarchy, failed } = storeToRefs(usePlanHierarchyStore());
const context = usePlanEditorContext();
const treeEl = ref<HTMLElement | null>(null);
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

function items(): HTMLElement[] {
	return [...(treeEl.value?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];
}
function onKeydown(event: KeyboardEvent): void {
	const item = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
	if (!item || event.altKey || event.ctrlKey || event.metaKey) return;
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
	<div class="rp-property-tree">
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
		>
			<PropertyTreeNode
				v-for="node in tree"
				:key="node.id"
				:node="node"
				:level="1"
				:current-id="context.planId"
				:navigate="navigate"
			/>
		</ul>
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
