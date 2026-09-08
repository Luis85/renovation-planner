<script setup lang="ts">
import { usePlanEditorContext } from '../PlanEditorContext';
const context = usePlanEditorContext();
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from './renovationSession';
import { tr } from '../../i18n/strings';
defineProps<{ roomId: string }>();
const runtime = useEditorRuntime(), session = useRenovationSession();
</script>
<template>
	<nav
		v-if="runtime.renovation.available"
		class="rp-renovation-switch"
		:aria-label="tr('renovation.renovate')"
	>
		<button
			v-for="mode in (context.commands.planning ? ['existing', 'planned', 'work', 'materials', 'costs', 'documents', 'photos', 'notes'] as const : ['existing', 'planned', 'work'] as const)"
			:key="mode"
			:data-rp-mode="mode"
			:aria-pressed="session.mode === mode"
			type="button"
			@click="runtime.renovation.focus(roomId, mode)"
		>
			{{ tr(`renovation.${mode}`) }}
		</button>
	</nav>
</template>
