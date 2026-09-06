<script setup lang="ts">
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
			v-for="mode in ['existing', 'planned', 'work'] as const"
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
