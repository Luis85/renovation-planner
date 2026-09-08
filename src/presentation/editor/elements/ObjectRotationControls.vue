<script setup lang="ts">
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { runInspectorAction } from '../shell/restoreInspectorActionFocus';
const props = defineProps<{ id: string }>();
const runtime = useEditorRuntime();
const blocked = computed(() => runtime.rotationActions.blocked.value || runtime.rotationActions.active.value);
function rotate(event: Event, degrees?: number): Promise<void> { return runInspectorAction(event, 'rotate-object', () => runtime.rotationActions.rotate(props.id, degrees)); }
</script>
<template>
	<div class="rp-object-rotation-actions">
		<button
			type="button"
			data-rp-action="rotate-object"
			:aria-disabled="blocked"
			@click="rotate($event)"
		>
			{{ tr('editor.rotation.by') }}
		</button>
		<button
			type="button"
			data-rp-action="rotate-object-left"
			:aria-label="tr('editor.rotation.counterclockwise')"
			:aria-disabled="blocked"
			@click="rotate($event, -90)"
		>
			−90°
		</button>
		<button
			type="button"
			data-rp-action="rotate-object-right"
			:aria-label="tr('editor.rotation.clockwise')"
			:aria-disabled="blocked"
			@click="rotate($event, 90)"
		>
			+90°
		</button>
	</div>
</template>
