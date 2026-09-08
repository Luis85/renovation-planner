<script setup lang="ts">
import HostIcon from '../../components/HostIcon.vue';
import { EDITOR_MODE_ICONS } from '../editorIcons';
import { tr } from '../../i18n/strings';
import type { RenovationMode } from '../renovation/renovationSession';
type DetailMode = Exclude<RenovationMode, 'overview'>;
defineProps<{ modes: readonly DetailMode[]; blocked: boolean }>();
defineEmits<{ select: [mode: DetailMode] }>();
</script>

<template>
	<button
		v-for="mode in modes"
		:key="mode"
		type="button"
		:data-rp-canvas-detail-mode="mode"
		:aria-disabled="blocked"
		@click="$emit('select', mode)"
	>
		<HostIcon :name="EDITOR_MODE_ICONS[mode]" />{{ tr(`renovation.${mode}`) }}
	</button>
</template>
