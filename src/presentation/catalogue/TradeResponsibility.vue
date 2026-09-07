<script setup lang="ts">
import { computed } from 'vue';
import { useTradeCatalogue } from './tradeCatalogue';
import type { WorkPackage } from '../../domain/renovation/Renovation';
import { tr } from '../i18n/strings';
const props = defineProps<{ work: WorkPackage }>();
const catalogue = useTradeCatalogue();
const name = computed(() => catalogue.entries.value.find(item => item.id === props.work.tradeId)?.name);
</script>
<template>
	<span v-if="work.responsibility === 'trade'">{{ name ?? tr('trade.unresolved', { id: work.tradeId ?? '' }) }}<span v-if="catalogue.status.value !== 'ready'"> · {{ tr('trade.unavailable') }}</span></span>
	<span v-else>{{ tr(work.responsibility === 'diy' ? 'renovation.diy' : 'renovation.unassigned') }}</span>
</template>
