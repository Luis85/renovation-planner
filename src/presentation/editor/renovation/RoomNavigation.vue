<script setup lang="ts">
import { computed } from 'vue';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useRenovationSession, type RenovationMode } from './renovationSession';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import { EDITOR_MODE_ICONS } from '../editorIcons';
const context = usePlanEditorContext(), session = useRenovationSession();
defineEmits<{ navigate: [mode: RenovationMode, event: Event] }>();
const overview = computed(() => session.mode === 'overview');
const semantic = computed(() => ['existing', 'work', 'planned'].includes(session.mode));
const related = computed(() => ['documents', 'photos', 'notes'].includes(session.mode));
const navigable = computed(() => overview.value || semantic.value || related.value);
const modes = computed(() => overview.value && session.perspective === 'plan'
	? context.commands.planning ? ['existing', 'planned', 'work', 'materials', 'costs', 'documents', 'photos', 'notes'] as const : ['existing', 'planned', 'work'] as const
	: overview.value ? ['existing', 'planned', 'work'] as const
	: semantic.value ? ['existing', 'work', 'planned'] as const : related.value ? ['documents', 'photos', 'notes'] as const : [] as const);
/** Each button's two labels, resolved here so the template asks one question per node. */
const entries = computed(() => modes.value.map(mode => {
	if (mode === 'existing' || mode === 'planned' || mode === 'work') {
		return { mode, label: overview.value ? tr(`renovation.${mode}`) : tr(`renovation.summary.${mode}`), sub: overview.value ? tr(`renovation.summary.${mode}`) : undefined };
	}
	return { mode, label: tr(`renovation.${mode}`), sub: undefined };
}));
</script>
<template>
	<nav
		v-show="navigable"
		class="rp-renovation-switch rp-room-navigation"
		:class="{ 'rp-room-navigation--semantic': !overview }"
		:aria-label="tr('renovation.renovate')"
	>
		<button
			v-for="entry in entries"
			:key="entry.mode"
			class="rp-room-navigation__button"
			:data-rp-mode="entry.mode"
			:aria-pressed="session.mode === entry.mode"
			type="button"
			@click="$emit('navigate', entry.mode, $event)"
		>
			<HostIcon
				v-if="overview"
				:name="EDITOR_MODE_ICONS[entry.mode]"
			/>
			<span class="rp-room-navigation__text">
				<span>{{ entry.label }}</span>
				<small v-if="entry.sub">{{ entry.sub }}</small>
			</span>
			<HostIcon
				v-if="overview"
				name="chevron-right"
				class="rp-room-navigation__arrow"
			/>
		</button>
	</nav>
</template>
