<script setup lang="ts">
import { computed, reactive } from 'vue';
import FieldError from '../../components/FieldError.vue';
import type { EditorRuntime } from '../runtime';
import { formatMetres, parseMetres } from '../shell/formatLength';
import { tr } from '../../i18n/strings';
type Field = 'width' | 'depth';
const props = defineProps<{ task: EditorRuntime['elementTask'] }>();
const draft = props.task.draft;
const fields = computed<readonly Field[]>(() => draft.kind === 'post' ? ['width', 'depth'] : ['width']);
const text = reactive<Record<Field, string>>({ width: formatMetres(draft.kind === 'beam' ? draft.beamWidth : draft.post.width), depth: formatMetres(draft.post.depth) });
const invalid = computed(() => new Set(fields.value.filter(field => !parseMetres(text[field]).ok)));
function input(field: Field, event: Event): void {
	const control = event.target as HTMLInputElement;
	if (props.task.blocked.value) { control.value = text[field]; return; }
	text[field] = control.value;
	const parsed = parseMetres(control.value);
	if (parsed.ok && draft.kind === 'beam') draft.beamWidth = parsed.mm;
	else if (parsed.ok) draft.post = { ...draft.post, [field]: parsed.mm };
	// An unreadable section holds every placement until it reads again: `addPoint` refuses while input is pending.
	draft.pendingInput = invalid.value.size > 0;
}
</script>
<template>
	<fieldset class="rp-stair-fields">
		<legend>{{ tr(draft.kind === 'beam' ? 'editor.add.beam.label' : 'editor.add.post.label') }}</legend>
		<FieldError
			v-for="field in fields"
			:key="field"
			v-slot="{ inputId, aria }"
			:message="invalid.has(field) ? tr(`editor.structural.${field}-invalid`) : null"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>
				{{ tr(`editor.structural.${field}`) }}
				<input
					:id="inputId"
					v-bind="aria"
					:name="'structural-' + field"
					type="text"
					inputmode="decimal"
					:value="text[field]"
					:readonly="task.blocked.value"
					@input="input(field, $event)"
				>
			</label>
		</FieldError>
	</fieldset>
</template>
