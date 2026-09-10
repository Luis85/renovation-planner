<script setup lang="ts">
import HostIcon from '../../components/HostIcon.vue';
import { EDITOR_MODE_ICONS } from '../editorIcons';
import { tr } from '../../i18n/strings';
import type { RenovationMode } from './renovationSession';
defineProps<{ expanded: boolean; modes: readonly RenovationMode[] }>();
const emit = defineEmits<{ navigate: [mode: RenovationMode, event: Event] }>();
</script>
<template>
	<nav
		v-show="expanded"
		class="rp-related-navigation"
		:aria-label="tr('renovation.summary.linked')"
	>
		<button
			v-for="mode in modes"
			:key="mode"
			type="button"
			:data-rp-mode="mode"
			@click="emit('navigate', mode, $event)"
		>
			<HostIcon :name="EDITOR_MODE_ICONS[mode]" />{{ tr(`renovation.${mode}`) }}
		</button>
	</nav>
</template>
