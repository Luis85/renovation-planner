<script setup lang="ts">
/**
 * M01's Property tree, sidebar polish 2026-09-10: the project, then every plan of it as a
 * sibling floor. The domain has no Building between the two, so the tree is two levels for
 * an ordinary plan; a detail plan (ADR-0028) inserts its ancestry rows between them — one row
 * per plan from the project's own floor down to this plan's immediate parent.
 *
 * Rows are buttons only when the leaf carries a `navigation` — the harness index mounts
 * this panel with none, and a button that does nothing is the live-control-that-does-nothing
 * shape slice 14 refused. `aria-current="page"` marks the plan this leaf shows.
 *
 * Deferred, and said here rather than promised: full `role="tree"` with arrow-key roving
 * (component library §4 `PropertyTree`). A nested list of buttons is Tab-reachable today;
 * the roving tabindex arrives when a third level does.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import PropertyTreeRow from './PropertyTreeRow.vue';

const { project, plan, plans } = storeToRefs(useProjectStore());
const { hierarchy } = storeToRefs(usePlanHierarchyStore());
const context = usePlanEditorContext();
/**
 * Floors are this plan's own siblings — same parent (or both root) — never every plan of the
 * project: `plans` is `ProjectStore`'s full project listing, and a detail plan's ancestors
 * already draw as ancestry rows above this list, so including them here repeated them and
 * listed every OTHER branch's plans as if they were floors of this one (findings round 2,
 * item 2). The listing may be empty on a rig that answers no siblings; the open plan is
 * always a floor.
 */
const floors = computed(() => {
	const siblings = plans.value.filter((candidate) => (candidate.parent?.planId ?? null) === (plan.value?.parent?.planId ?? null));
	return siblings.length > 0 ? siblings : plan.value ? [plan.value] : [];
});
/**
 * A row's click handler, or `undefined` to draw it as text (the current floor, or a leaf with
 * no `navigation`) — plain script rather than a ternary inline in the template, because
 * vue-tsc does not narrow the navigation function into the arrow function a template
 * expression creates (`TS2722`) the way it narrows one written in `<script setup>`.
 */
function rowOpener(planId: string, disabled = false): (() => void) | undefined {
	const openPlan = context.navigation?.plan;
	return openPlan && !disabled ? () => openPlan(planId) : undefined;
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
		<PropertyTreeRow
			v-for="ancestor in hierarchy.ancestry"
			:key="ancestor.id"
			:name="ancestor.name"
			:open-plan-id="ancestor.id"
			:on-open="rowOpener(ancestor.id)"
		/>
		<ul class="rp-property-tree__floors">
			<li
				v-for="floor in floors"
				:key="floor.id"
			>
				<PropertyTreeRow
					:name="floor.name || tr('editor.floor')"
					:current="floor.id === plan?.id"
					:on-open="rowOpener(floor.id, floor.id === plan?.id)"
				/>
			</li>
		</ul>
		<p
			v-if="hierarchy.parentZoneMissing"
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.input.parent-zone-missing') }}
		</p>
	</div>
</template>
