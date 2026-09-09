<script setup lang="ts">
import { computed } from 'vue';
import HostIcon from '../../components/HostIcon.vue';
import type { PlanDto } from '../../read-models/PlanDto';
import { tr } from '../../i18n/strings';
const props = defineProps<{ background: NonNullable<PlanDto['background']> }>();
const unlocked = computed(() => props.background.appearance?.locked === false);
const label = computed(() => tr(unlocked.value ? 'editor.shell.unlocked' : 'editor.shell.locked'));
const opacity = computed(() => Math.round((props.background.appearance?.opacity ?? 1) * 100));
</script>
<template>
	<HostIcon
		:name="unlocked ? 'lock-open' : 'lock'"
		:title="label"
	/>
	<span class="rp-visually-hidden">{{ label }}</span>
	<span class="rp-layer-opacity">{{ opacity }}%</span>
</template>
