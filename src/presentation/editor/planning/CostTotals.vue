<script setup lang="ts">
import { formatPlanningMoney } from '../../i18n/planningFormat';
import type { Money } from '../../../core/money/Money';
import { tr } from '../../i18n/strings';
defineProps<{ totals: Record<'planned' | 'committed' | 'actual' | 'openCommitment' | 'remaining', Money> }>();
</script>
<template>
	<dl class="rp-planning-totals rp-cost-totals">
		<div
			v-for="(value, key) in totals"
			:key="key"
			class="rp-cost-total"
			:data-rp-stage="key"
		>
			<dt>{{ tr(`planning.${key}`) }}</dt><dd>{{ formatPlanningMoney(value) }}</dd>
		</div>
	</dl>
</template>
