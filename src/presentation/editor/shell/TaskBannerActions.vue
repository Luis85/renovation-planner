<script setup lang="ts">
import { tr } from '../../i18n/strings';

defineProps<{
	showFinish: boolean;
	finishBlocked: boolean;
	finishDescription: string;
	finishLabel: string;
	cancelBlocked: boolean;
	cancelDescription?: string;
}>();
const emit = defineEmits<{ finish: []; cancel: [] }>();
</script>

<template>
	<div class="rp-task-banner__actions">
		<button
			v-if="showFinish"
			type="button"
			class="rp-task-banner__finish"
			:aria-disabled="finishBlocked"
			:aria-describedby="finishDescription"
			@click="emit('finish')"
		>
			{{ finishLabel }}
		</button>
		<button
			type="button"
			class="rp-task-banner__cancel"
			:aria-disabled="cancelBlocked"
			:aria-describedby="cancelDescription"
			@click="emit('cancel')"
		>
			{{ tr('editor.task.cancel') }}
		</button>
	</div>
</template>
