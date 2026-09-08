<script setup lang="ts">
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { nextTick } from 'vue';
const props = defineProps<{ id: string }>();
const runtime = useEditorRuntime();
async function open(event: Event): Promise<void> {
	const root = (event.currentTarget as HTMLElement).closest('.renovation-plan-editor');
	await runtime.curveTask.open(props.id); await nextTick();
	root?.querySelector<HTMLElement>('[data-rp-form="edit-curves"] select')?.focus();
}
</script>
<template>
	<button
		v-if="runtime.curveTask.available.value"
		type="button"
		data-rp-action="edit-curves"
		:aria-disabled="runtime.curveTask.blocked.value"
		@click="open"
	>
		{{ tr('editor.curves.action') }}
	</button>
</template>
