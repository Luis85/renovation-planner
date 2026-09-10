<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { EditorRuntime } from '../runtime';
import { DEFAULT_STAIR_RUN } from '../../../domain/spatial/stairGeometry';
import { parseStairInput, stairText, type StairText } from './stairInput';
import StairFields from './StairFields.vue';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { tr } from '../../i18n/strings';
const props = defineProps<{ task: EditorRuntime['elementTask'] }>();
const draft = props.task.draft;
const centreline = computed(() => {
	if (draft.points.length === 2) return draft.points;
	const start = draft.points[0] ?? { x: 0, y: 0 };
	return [start, { x: start.x, y: start.y - DEFAULT_STAIR_RUN }];
});
const text = ref(stairText(centreline.value, draft.stair));
watch(() => [draft.points, draft.stair], () => { if (!draft.pendingInput) text.value = stairText(centreline.value, draft.stair); }, { deep: true });
const parsed = computed(() => parseStairInput(centreline.value, text.value, draft.stair));
function update(value: StairText): void { if (!props.task.blocked.value) { text.value = value; draft.pendingInput = true; } }
function apply(): void {
	const value = parsed.value;
	if (props.task.blocked.value || !value.points) return;
	if (props.task.setPoints(value.points)) { draft.stair = value.options; draft.pendingInput = false; }
}
</script>
<template>
	<form
		data-rp-form="stair-parameters"
		@submit.prevent="apply"
		@keydown="nativeSubmitKey"
	>
		<StairFields
			:model-value="text"
			:errors="parsed.errors"
			:readonly="task.blocked.value"
			@update:model-value="update"
		/>
		<button
			type="submit"
			:aria-disabled="task.blocked.value || !parsed.points"
		>
			{{ tr('editor.stair.apply-dimensions') }}
		</button>
	</form>
</template>
