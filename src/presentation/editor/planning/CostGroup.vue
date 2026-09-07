<script setup lang="ts">
import { computed } from 'vue';
import CostRow from './CostRow.vue';
import { aggregateCosts, type costRows } from './planningProjection';
import { useRenovationSession } from '../renovation/renovationSession';
import { formatPlanningMoney } from '../../i18n/planningFormat';
import { tr } from '../../i18n/strings';
const props = defineProps<{ name: string; rows: ReturnType<typeof costRows>; currency: string; first: boolean }>();
const session = useRenovationSession();
const totals = computed(() => aggregateCosts(props.rows, props.currency));
const selected = computed(() => !!session.focusedId && props.rows.some(row => [row.record.id, row.record.requirementId].includes(session.focusedId)));
</script>
<template>
	<details
		class="rp-cost-group"
		:open="first || selected"
	>
		<summary>
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
