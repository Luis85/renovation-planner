<script setup lang="ts">
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import CostGroup from './CostGroup.vue';
import CostTotals from './CostTotals.vue';
import { computed } from 'vue';
import { usePlanningContext } from './planningContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { renovationCostSummary } from '../renovation/renovationCostSummary';
import { aggregateCosts } from './planningProjection';
import { tr } from '../../i18n/strings';
const props = defineProps<{ baseline: PlanningBaseline }>();
const planning = usePlanningContext(), session = useRenovationSession();
const rows = computed(() => renovationCostSummary(props.baseline, session.roomId, session.targetId).rows);
const totals = computed(() => aggregateCosts(rows.value, props.baseline.currency));
const groups = computed(() => [...new Set(rows.value.map(row => row.record.workId))].map(id => ({
	id,
	name: props.baseline.plan.entity.renovation?.work.find(work => work.id === id)?.title ?? tr('planning.unassigned'),
	rows: rows.value.filter(row => row.record.workId === id),
})));
</script>
<template>
	<CostTotals
		v-if="totals"
		:totals="totals"
	/>
	<p
		v-else
		role="status"
	>
		{{ tr('planning.totals-refused') }}
	</p>
	<details>
		<summary>{{ tr('planning.explain') }}</summary>
		<p>{{ tr('planning.reconciliation-policy') }}</p>
	</details>
	<section class="rp-cost-groups">
		<h4>{{ tr('planning.by-work') }}</h4>
		<CostGroup
			v-for="(group, index) in groups"
			:key="group.id"
			:work-id="group.id"
			:name="group.name"
			:rows="group.rows"
			:currency="baseline.currency"
			:first="index === 0"
		/>
	</section>
	<button
		type="button"
		class="mod-cta"
		:disabled="planning.blocked.value"
		data-rp-new-cost
		@click="planning.edit('cost')"
	>
		{{ tr('planning.add-cost') }}
	</button>
</template>
