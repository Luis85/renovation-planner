<script setup lang="ts">
import type { Money } from '../../../core/money/Money';
import { tr } from '../../i18n/strings';
defineProps<{ totals: Record<'planned' | 'committed' | 'actual' | 'openCommitment' | 'remaining', Money> }>();
</script>
<template>
	<dl class="rp-planning-totals">
		<template
			v-for="(value, key) in totals"
			:key="key"
		>
			<dt>{{ tr(`planning.${key}`) }}</dt><dd>{{ value.amount }} {{ value.currency }}</dd>
		</template>
	</dl>
</template>
