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
import type { PlanSummaryDto } from '../read-models/PlanDto';
import { tr } from '../i18n/strings';

defineProps<{ readOnly?: boolean; plans: readonly PlanSummaryDto[] }>();
defineEmits<{ open: [planId: string]; create: [] }>();
</script>

<template>
	<div class="rp-plan-list__header">
		<h3 class="rp-plan-list__title">
			{{ tr('view.project.plans-title') }}
		</h3>
		<button
			v-if="!readOnly"
			type="button"
			class="rp-plan-list__create"
			@click="$emit('create')"
		>
			{{ tr('view.project.create-plan') }}
		</button>
	</div>
	<ul class="rp-plan-list">
		<li
			v-for="plan in plans"
			:key="plan.id"
		>
			<button
				type="button"
				class="rp-plan-list__row"
				:disabled="readOnly"
				@click="$emit('open', plan.id)"
			>
				<span class="rp-plan-list__name">{{ plan.name }}</span>
			</button>
		</li>
	</ul>
</template>
