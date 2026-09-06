<script setup lang="ts">
import type { materialRows } from './planningProjection';
import { tr } from '../../i18n/strings';
defineProps<{ row: ReturnType<typeof materialRows>[number] }>();
</script>
<template>
	<dl class="rp-planning-totals rp-material-numbers">
		<dt>{{ tr('planning.needed') }}</dt>
		<dd>
			{{ row.needed }} {{ row.entity.unit }}
			<span class="rp-material-provenance">{{ tr(row.entity.quantity.override || row.source.rule === 'manual' ? 'planning.manual' : 'renovation.calculated') }}</span>
		</dd>
		<dt>{{ tr('planning.purchased') }}</dt><dd>{{ row.procurement?.purchased || '0' }}</dd>
		<dt>{{ tr('planning.reserved') }}</dt><dd>{{ row.procurement?.reserved || '0' }}</dd>
		<dt>{{ tr('planning.outstanding') }}</dt><dd>{{ row.outstanding }} {{ row.entity.unit }}</dd>
		<dt>{{ tr('planning.planned') }}</dt><dd>{{ row.cost.amount }} {{ row.cost.currency }}</dd>
	</dl>
	<details><summary>{{ tr('planning.explain') }}</summary><p>{{ tr(`planning.rule.${row.source.rule}`) }} · {{ tr(`planning.${row.source.state}`) }} · {{ row.source.targetId }}</p><p>{{ tr('planning.waste') }}: {{ row.entity.wasteFactor.mul(100) }} · {{ tr('planning.coverage') }}: {{ row.source.coverage }} · {{ tr('planning.lot') }}: {{ row.source.lot || '—' }} · {{ tr('planning.minimum') }}: {{ row.source.minimum || '—' }}</p><p>{{ row.entity.calculatedFrom.zoneArea.value }} {{ row.entity.unit }} ÷ {{ row.source.coverage }} × (1 + {{ row.entity.wasteFactor }}) → {{ row.entity.quantity.calculated.value }} {{ row.entity.unit }} × {{ row.price.amount }} {{ row.price.currency }}/{{ row.entity.unit }}</p></details>
</template>
