<script setup lang="ts">
import { usePlanEditorContext } from '../PlanEditorContext';
const context = usePlanEditorContext();
import { useEditorRuntime } from '../runtime';
import { useRenovationSession, type RenovationMode } from './renovationSession';
import { tr } from '../../i18n/strings';
import { computed, nextTick, ref } from 'vue';
const props = defineProps<{ roomId: string }>();
const runtime = useEditorRuntime(), session = useRenovationSession();
const expanded = ref(false), opener = ref<HTMLButtonElement | null>(null);
const modes = computed(() => session.mode === 'overview' && session.perspective === 'renovate' ? ['existing', 'planned', 'work'] as const
	: context.commands.planning ? ['overview', 'existing', 'planned', 'work', 'materials', 'costs', 'documents', 'photos', 'notes'] as const : ['overview', 'existing', 'planned', 'work'] as const);
async function navigate(mode: RenovationMode, event: Event): Promise<void> {
	const button = event.currentTarget as HTMLElement;
	const inspector = button.closest<HTMLElement>('[data-rp-region="inspector"]');
	runtime.renovation.focus(props.roomId, mode);
	expanded.value = false;
	await nextTick();
	if (inspector?.isConnected) (opener.value ?? inspector).focus();
}
</script>
<template>
	<button
		v-if="runtime.renovation.available && session.mode !== 'overview'"
		ref="opener"
		type="button"
		class="rp-room-navigation-opener"
		data-rp-room-navigation
		:aria-expanded="expanded"
		@click="expanded = !expanded"
	>
		{{ tr(`renovation.${session.mode}`) }} <span aria-hidden="true">{{ expanded ? '⌃' : '⌄' }}</span>
	</button>
	<nav
		v-if="runtime.renovation.available"
		v-show="session.mode === 'overview' || expanded"
		class="rp-renovation-switch rp-room-navigation"
		:aria-label="tr('renovation.renovate')"
	>
		<button
			v-for="mode in modes"
			:key="mode"
			class="rp-room-navigation__button"
			:data-rp-mode="mode"
			:aria-pressed="session.mode === mode"
			type="button"
			@click="navigate(mode, $event)"
		>
			{{ tr(`renovation.${mode}`) }}
		</button>
	</nav>
</template>
