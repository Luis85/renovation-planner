<script setup lang="ts">
import { computed, ref } from 'vue';
import FieldError from '../../components/FieldError.vue';
import type { EditorRuntime } from '../runtime';
import { formatMetres, parseCoordinateMetres } from '../shell/formatLength';
import { tr } from '../../i18n/strings';
const props = defineProps<{ task: EditorRuntime['elementTask'] }>();
const draft = props.task.draft;
const text = ref(formatMetres(draft.offset));
const invalid = computed(() => !parseCoordinateMetres(text.value).ok);
function input(event: Event): void {
	const control = event.target as HTMLInputElement;
	if (props.task.blocked.value) { control.value = text.value; return; }
	text.value = control.value;
	const parsed = parseCoordinateMetres(control.value);
	// A typed offset replaces the pointer's until the pointer moves over the canvas again.
	if (parsed.ok) { draft.offset = parsed.mm; draft.cursor = null; }
	// An unreadable offset holds Finish and the placing click until it reads again.
	draft.pendingInput = !parsed.ok;
}
</script>
<template>
	<fieldset class="rp-stair-fields">
		<legend>{{ tr('editor.add.dimension.label') }}</legend>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="invalid ? tr('editor.drafting.offset-invalid') : null"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>
				{{ tr('editor.drafting.offset') }}
				<input
					:id="inputId"
					v-bind="aria"
					name="dimension-offset"
					type="text"
					inputmode="decimal"
					:value="text"
					:readonly="task.blocked.value"
					@input="input"
				>
			</label>
		</FieldError>
	</fieldset>
</template>
