<script setup lang="ts">
import { computed } from 'vue';
import HostIcon from '../../components/HostIcon.vue';
import { EDITOR_MODE_ICONS } from '../editorIcons';
import { tr } from '../../i18n/strings';
import type { RenovationMode } from './renovationSession';
const props = defineProps<{ mode: Exclude<RenovationMode, 'overview'>; current: RenovationMode }>();
const emit = defineEmits<{ navigate: [mode: RenovationMode, event: Event] }>();
const overview = computed(() => props.current === 'overview');
const semantic = computed(() => ['existing', 'planned', 'work'].includes(props.mode));
function label(): string { return !overview.value && semantic.value ? tr(`renovation.summary.${props.mode as 'existing' | 'planned' | 'work'}`) : tr(`renovation.${props.mode}`); }
</script>
<template>
	<button
		class="rp-room-navigation__button"
		:data-rp-mode="mode"
		:aria-pressed="current === mode"
		type="button"
		@click="emit('navigate', mode, $event)"
	>
		<HostIcon
			v-if="overview"
			:name="EDITOR_MODE_ICONS[mode]"
		/>
		<span class="rp-room-navigation__text">
			<span>{{ label() }}</span>
			<small v-if="overview && semantic">{{ tr(`renovation.summary.${mode as 'existing' | 'planned' | 'work'}`) }}</small>
		</span>
		<HostIcon
			v-if="overview"
			name="chevron-right"
			class="rp-room-navigation__arrow"
		/>
	</button>
</template>
