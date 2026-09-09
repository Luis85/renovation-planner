<script setup lang="ts">
/**
 * One project's plans, one row each, and the way to add another (design slice 21).
 *
 * Deliberately the shape `ProjectList.vue` already has — a header with a title and a create
 * button, then a `<ul>` of button rows — so the two read as siblings rather than as two
 * people's ideas of a list. It DISPATCHES nothing and opens nothing: it emits an id, and the
 * view calls `context.openPlan`, which the composition root supplied because `presentation/`
 * may not reach Obsidian's workspace.
 *
 * `<h3>` and not `<h2>`: `ProjectDetail`'s own project name is the `<h2>` this sits under, and
 * heading order is one of the five things `tests/harness/accessibility.test.ts` actually
 * grades. `ProjectList`'s title is an `<h2>` because nothing draws a heading above IT.
 */
import { ref } from 'vue';
import type { PlanSummaryDto } from '../read-models/PlanDto';
import { tr } from '../i18n/strings';

defineProps<{ readOnly?: boolean; readOnlyReasonId?: string; plans: readonly PlanSummaryDto[] }>();
defineEmits<{ open: [planId: string]; create: [] }>();

const list = ref<HTMLUListElement | null>(null);

/**
 * Put the keyboard on the first plan a user could actually open, for `ProjectDetail`'s
 * "Choose a plan" entry (design slice 22): that action names a destination this component owns
 * and there is nothing for the guidance region to dispatch, so it hands the caret over instead
 * of opening a plan the user did not pick.
 *
 * `:not([disabled])` rather than the first row, because every row is disabled on a read-only
 * surface and `focus()` on a disabled button silently does nothing — which would leave focus on
 * the entry button with no way to tell that from a list that was never rendered. The answer says
 * which happened; the one caller is free to ignore it, and does.
 *
 * Queried from the `<ul>` rather than `document`, so a second plan list on the same pane (a
 * split leaf) cannot answer for this one.
 */
function focusFirst(): boolean {
	const row = list.value?.querySelector<HTMLButtonElement>('.rp-plan-list__row:not([disabled])') ?? null;

	row?.focus();

	return row !== null;
}

defineExpose({ focusFirst });
</script>

<template>
	<div class="rp-plan-list__header">
		<h3 class="rp-plan-list__title">
			{{ tr('view.project.plans-title') }}
		</h3>
		<button
			type="button"
			class="rp-plan-list__create"
			:disabled="readOnly"
			:aria-describedby="readOnly ? readOnlyReasonId : undefined"
			@click="$emit('create')"
		>
			{{ tr('view.project.create-plan') }}
		</button>
	</div>
	<ul
		ref="list"
		class="rp-plan-list"
	>
		<li
			v-for="plan in plans"
			:key="plan.id"
		>
			<button
				type="button"
				class="rp-plan-list__row"
				:disabled="readOnly"
				:aria-describedby="readOnly ? readOnlyReasonId : undefined"
				@click="$emit('open', plan.id)"
			>
				<span class="rp-plan-list__name">{{ plan.name }}</span>
			</button>
		</li>
	</ul>
</template>
