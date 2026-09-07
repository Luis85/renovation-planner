<script setup lang="ts">
import { tr } from '../../i18n/strings';
const filter = defineModel<string>({ required: true });
defineProps<{ floors: readonly (readonly [string, string])[]; blocked: boolean; canUndo: boolean; canRedo: boolean }>();
defineEmits<{ step: [direction: 'undo' | 'redo']; createTrade: [] }>();
</script>
<template>
	<div class="rp-project-work__controls">
		<label>{{ tr('schedule.floor') }}<select v-model="filter"><option value="all">{{ tr('schedule.all-floors') }}</option><option
			v-for="[id, name] in floors"
			:key="id"
			:value="id"
		>{{ name }}</option></select></label>
		<button
			type="button"
			:aria-disabled="blocked || !canUndo"
			@click="$emit('step', 'undo')"
		>
			{{ tr('editor.context.undo') }}
		</button>
		<button
			type="button"
			:aria-disabled="blocked || !canRedo"
			@click="$emit('step', 'redo')"
		>
			{{ tr('editor.context.redo') }}
		</button>
		<button
			type="button"
			:aria-disabled="blocked"
			@click="$emit('createTrade')"
		>
			{{ tr('trade.add') }}
		</button>
	</div>
</template>
