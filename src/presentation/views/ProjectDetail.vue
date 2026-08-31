<script setup lang="ts">
/**
 * One project (design slice 21): who it is, a way back, a way to its own note, and its plans.
 *
 * It draws only what it is given and emits intents — the row/emit division `ProjectList`
 * already states. `openNote` is a SECONDARY action rather than the row's behaviour, which is
 * what design slice 21 is for: criterion 1 replaces the project row's open-the-note behaviour
 * with navigation into this state, and `Project.md` then stays reachable from here because the
 * plugin would otherwise have no route to a project's own metadata.
 *
 * **Task 8 is what makes that true of the row, and it has not landed as this file is written.**
 * `ViewRoot` still routes a row click to `context.openProject`. The sentence above used to say
 * "the row navigates now", which was a claim about a commit that did not exist — this
 * repository's own "write the guarantee to the check, never ahead of it", broken in a docblock
 * describing the very change that would make it true. Found by this task's reviewer.
 *
 * The status reuses the shared `statusLabel`, which moved out of `ProjectList.vue` at this
 * second consumer.
 */
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import type { EmptyStateProps } from '../emptyStates/resolve';
import EmptyState from '../components/EmptyState.vue';
import PlanList from './PlanList.vue';
import { statusLabel } from './statusLabel';
import { tr } from '../i18n/strings';

/**
 * `emptyState` is the resolved `EmptyState` props for a project with no plans, or `null`.
 * It is drawn INSIDE the plans region rather than in place of this component, because the
 * Back and Open note controls live in this header and nowhere else — replacing the whole
 * detail state with an empty state takes a newly created project's only way back with it.
 * Slice 14's own rule, arriving on a third surface: an empty state that replaces a region
 * hides the thing the region exists to show.
 */
defineProps<{
	project: ProjectSummaryDto;
	plans: readonly PlanSummaryDto[];
	emptyState: EmptyStateProps | null;
}>();
defineEmits<{ back: []; openNote: []; openPlan: [planId: string]; createPlan: [] }>();
</script>

<template>
	<div class="rp-project-detail">
		<div class="rp-project-detail__header">
			<button
				type="button"
				class="rp-project-detail__back"
				@click="$emit('back')"
			>
				{{ tr('view.project.back') }}
			</button>
			<h2 class="rp-project-detail__name">
				{{ project.name }}
			</h2>
			<span class="rp-project-detail__status">{{ statusLabel(project.status) }}</span>
			<button
				type="button"
				class="rp-project-detail__open-note"
				@click="$emit('openNote')"
			>
				{{ tr('view.project.open-note') }}
			</button>
		</div>
		<!--
			`heading-level="3"` because this empty state is EMBEDDED in the plans region rather
			than replacing the view: the project's own name above is an `<h2>`, and the populated
			branch gives `Plans` an `<h3>`, so the empty branch has to sit at the same level or a
			just-created project announces "No plans yet" as a peer of the project itself.
		-->
		<EmptyState
			v-if="emptyState !== null"
			v-bind="emptyState"
			:heading-level="3"
			@action="$emit('createPlan')"
		/>
		<PlanList
			v-else
			:plans="plans"
			@open="(planId) => $emit('openPlan', planId)"
			@create="$emit('createPlan')"
		/>
	</div>
</template>
