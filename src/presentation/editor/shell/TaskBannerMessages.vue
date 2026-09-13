<script setup lang="ts">
import { tr } from '../../i18n/strings';

defineProps<{
	name: string;
	instruction: string;
	instructionId: string;
	state: 'busy' | 'invalid' | null;
	stateId: string;
	showSnapHint: boolean;
	openingMessage: string | null;
}>();
</script>

<template>
	<div class="rp-task-banner__text">
		<strong role="status">{{ name }}</strong>
		<span
			v-if="showSnapHint"
			role="status"
		>{{ tr('editor.room.snapped') }}</span>
		<span :id="instructionId">{{ instruction }}</span>
		<span
			v-if="state !== null"
			:id="stateId"
			:data-rp-task-state-message="state"
			role="status"
		>{{ tr(state === 'busy' ? 'save-state.saving' : 'editor.task.finish.blocked') }}</span>
		<span
			v-if="openingMessage !== null"
			role="status"
		>{{ openingMessage }}</span>
	</div>
</template>
