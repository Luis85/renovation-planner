<script setup lang="ts">
import { formatPlanningNumber, formatPlanningMoney } from '../../i18n/planningFormat';
import type { materialRows } from './planningProjection';
import { tr } from '../../i18n/strings';
defineProps<{ row: ReturnType<typeof materialRows>[number] }>();
</script>
<template>
	<dl class="rp-planning-totals rp-material-numbers">
		<dt>{{ tr('planning.needed') }}</dt>
		<dd>
			{{ formatPlanningNumber(row.needed) }} {{ row.entity.unit }}
			<span class="rp-material-provenance">{{ tr(row.entity.quantity.override || row.source.rule === 'manual' ? 'planning.manual' : 'renovation.calculated') }}</span>
		</dd>
		<dt>{{ tr('planning.purchased') }}</dt><dd>{{ formatPlanningNumber(row.procurement?.purchased || '0') }}</dd>
		<dt>{{ tr('planning.reserved') }}</dt><dd>{{ formatPlanningNumber(row.procurement?.reserved || '0') }}</dd>
		<dt>{{ tr('planning.outstanding') }}</dt><dd>{{ formatPlanningNumber(row.outstanding) }} {{ row.entity.unit }}</dd>
		<dt>{{ tr('planning.planned') }}</dt><dd>{{ formatPlanningMoney(row.cost) }}</dd>
	</dl>
	<details><summary>{{ tr('planning.explain') }}</summary><p>{{ tr(`planning.rule.${row.source.rule}`) }} · {{ tr(`planning.${row.source.state}`) }} · {{ row.source.targetId }}</p><p>{{ tr('planning.waste') }}: {{ formatPlanningNumber(row.entity.wasteFactor.mul(100)) }} · {{ tr('planning.coverage') }}: {{ formatPlanningNumber(row.source.coverage) }} · {{ tr('planning.lot') }}: {{ row.source.lot ? formatPlanningNumber(row.source.lot) : '—' }} · {{ tr('planning.minimum') }}: {{ row.source.minimum ? formatPlanningNumber(row.source.minimum) : '—' }}</p><p>{{ formatPlanningNumber(row.entity.calculatedFrom.zoneArea.value) }} {{ row.entity.calculatedFrom.zoneArea.unit }} ÷ {{ formatPlanningNumber(row.source.coverage) }} × (1 + {{ formatPlanningNumber(row.entity.wasteFactor) }}) → {{ formatPlanningNumber(row.entity.quantity.calculated.value) }} {{ row.entity.unit }} × {{ formatPlanningNumber(row.price.amount) }} {{ row.price.currency }}/{{ row.entity.unit }}</p></details>
</template>
