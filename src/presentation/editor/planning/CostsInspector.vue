<script setup lang="ts">
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import CostRow from './CostRow.vue';
import CostTotals from './CostTotals.vue';
import { computed } from 'vue';
import { usePlanningContext } from './planningContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { costRows, aggregateCosts } from './planningProjection';
import { tr } from '../../i18n/strings';
const props = defineProps<{ baseline: PlanningBaseline }>();
const planning = usePlanningContext(), session = useRenovationSession();
const rows = computed(() => costRows(props.baseline, session.roomId));
const totals = computed(() => aggregateCosts(rows.value, props.baseline.currency));
</script>
<template>
	<button
		type="button"
		:disabled="planning.blocked.value"
		data-rp-new-cost
		@click="planning.edit('cost')"
	>
		{{ tr('planning.edit.cost') }}
	</button>
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
	<p>{{ tr('planning.reconciliation-policy') }}</p>
	<ol class="rp-renovation-list">
		<CostRow
			v-for="row in rows"
			:key="row.record.id"
			:row="row"
		/>
	</ol>
</template>
