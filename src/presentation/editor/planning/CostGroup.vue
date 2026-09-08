<script setup lang="ts">
import { computed } from 'vue';
import CostRow from './CostRow.vue';
import { aggregateCosts, type costRows } from './planningProjection';
import { useRenovationSession } from '../renovation/renovationSession';
import { formatPlanningMoney } from '../../i18n/planningFormat';
import { tr } from '../../i18n/strings';
import { usePlanningContext } from './planningContext';
const props = defineProps<{ workId: string; name: string; rows: ReturnType<typeof costRows>; currency: string; first: boolean }>();
const session = useRenovationSession();
const planning = usePlanningContext();
const totals = computed(() => aggregateCosts(props.rows, props.currency));
const selected = computed(() => !!session.focusedId && props.rows.some(row => [row.record.id, row.record.requirementId].includes(session.focusedId)));
const workSelected = computed(() => !!props.workId && session.focusedId === props.workId);
function focusWork(event: MouseEvent): void {
	const summary = event.currentTarget as HTMLElement;
	if (props.workId && !(summary.parentElement as HTMLDetailsElement).open) planning.runtime.renovation.focus(session.roomId, 'costs', props.workId);
}
</script>
<template>
	<details
		class="rp-cost-group"
		:class="{ 'is-selected': workSelected }"
		:open="first || selected"
	>
		<summary
			:data-rp-cost-work="workId"
			:aria-current="workSelected ? 'true' : undefined"
			@click="focusWork"
		>
			<span>{{ name }}</span>
			<span
				v-if="totals"
				class="rp-cost-group-amount"
			>{{ tr('planning.planned') }} {{ formatPlanningMoney(totals.planned) }}</span>
			<span v-else>{{ tr('planning.totals-refused') }}</span>
		</summary>
		<ol class="rp-renovation-list">
			<CostRow
				v-for="row in rows"
				:key="row.record.id"
				:row="row"
			/>
		</ol>
	</details>
</template>
