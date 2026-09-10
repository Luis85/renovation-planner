<script setup lang="ts">
/**
 * One project's plans, one row each, and the way to add another (design slice 21; redrawn
 * against P01/P02/P07).
 *
 * **A native `<details>`/`<summary>`, not a hand-built disclosure.** P02 lists "Collapse plans"
 * as an optional interaction and `components/component-library.md` names the mechanism outright
 * — "existing native details/summary is valid" — which is `aria-expanded`, keyboard operation
 * and the open state for free. `open` by default, because P02's own acceptance criterion is
 * "Plans initially visible".
 *
 * `New plan` sits ON the summary's line and OUTSIDE the `<summary>`: a button inside one is a
 * nested interactive element, which P02 forbids by name. The section is a one-row grid and both
 * children share that row — see `styles/project-detail.css`.
 *
 * It DISPATCHES nothing and opens nothing: it emits an id, and the view calls
 * `context.openPlan`, which the composition root supplied because `presentation/` may not reach
 * Obsidian's workspace.
 *
 * `<h3>` and not `<h2>`: `ProjectDetail`'s own project name is the `<h2>` this sits under, and
 * heading order is one of the five things `tests/harness/accessibility.test.ts` actually
 * grades. `ProjectList`'s title is an `<h2>` because nothing draws a heading above IT.
 */
import { ref } from 'vue';
import type { PlanSummaryDto } from '../read-models/PlanDto';
import HostIcon from '../components/HostIcon.vue';
import { tr } from '../i18n/strings';

/**
 * `emptyMessage` is P01's "compact empty plan row" — one muted line where a centred
 * `EmptyState` card used to be. §6 refuses the card outright ("no duplicate large empty card
 * below the same creation action"), because the guidance region above already offers
 * `Create first plan`; this region states the fact and stops.
 */
defineProps<{ readOnly?: boolean; readOnlyReasonId?: string; plans: readonly PlanSummaryDto[]; emptyMessage?: string | null }>();
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
	<div class="rp-plan-list__section">
		<details
			class="rp-plan-list__disclosure"
			open
		>
			<summary class="rp-plan-list__summary">
				<HostIcon
					name="chevron-right"
					class="rp-plan-list__twisty"
				/>
				<!--
					The COUNTED form once there is something to count, the bare noun otherwise —
					P02 draws `Plans (3)` and P01 draws `Plans`. "Plans (0)" is a count of nothing
					stated twice, since the line under it already says the region is empty.
				-->
				<h3 class="rp-plan-list__title">
					{{ plans.length === 0 ? tr('view.project.plans-title') : tr('view.project.plans-count', { count: String(plans.length) }) }}
				</h3>
			</summary>
			<p
				v-if="plans.length === 0 && emptyMessage"
				class="rp-plan-list__empty"
			>
				{{ emptyMessage }}
			</p>
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
						<HostIcon name="panels-top-left" />
						<span class="rp-plan-list__name">{{ plan.name }}</span>
						<HostIcon
							name="chevron-right"
							class="rp-plan-list__chevron"
						/>
					</button>
				</li>
			</ul>
		</details>
		<button
			type="button"
			class="rp-plan-list__create"
			:disabled="readOnly"
			:aria-describedby="readOnly ? readOnlyReasonId : undefined"
			@click="$emit('create')"
		>
			<HostIcon name="plus" />
			{{ tr('view.project.create-plan') }}
		</button>
	</div>
</template>
