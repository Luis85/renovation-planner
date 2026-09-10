<script setup lang="ts">
/**
 * M01's Property tree, sidebar polish 2026-09-10: the project, then every plan of it as a
 * sibling floor. The domain has no Building between the two, so the tree is two levels.
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

const { project, plan, plans } = storeToRefs(useProjectStore());
const context = usePlanEditorContext();
const openPlan = context.navigation?.plan;
/** The listing may be empty on a rig that answers no siblings; the open plan is always a floor. */
const floors = computed(() => (plans.value.length > 0 ? plans.value : plan.value ? [plan.value] : []));
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
		<ul class="rp-property-tree__floors">
			<li
				v-for="floor in floors"
				:key="floor.id"
			>
				<button
					v-if="openPlan && floor.id !== plan?.id"
					type="button"
					class="rp-property-tree__floor"
					@click="openPlan(floor.id)"
				>
					<HostIcon name="grid-2x-2" />{{ floor.name }}
				</button>
				<p
					v-else
					class="rp-property-tree__floor"
					:aria-current="floor.id === plan?.id ? 'page' : undefined"
				>
					<HostIcon name="grid-2x-2" />{{ floor.name || tr('editor.floor') }}
				</p>
			</li>
		</ul>
	</div>
</template>
