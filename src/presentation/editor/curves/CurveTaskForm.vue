<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { formatMetres } from '../shell/formatLength';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
const task = useEditorRuntime().curveTask, description = useId(), errorId = useId();
const root = ref<HTMLFormElement | null>(null);
const error = computed(() => task.state.conflict ? tr('editor.curves.conflict') : task.state.invalidField ? tr('editor.curves.limit') : task.validation.value ? tr('editor.curves.invalid') : task.state.error ? trError(task.state.error) : null);
function input(field: 'depth' | 'radius', event: Event): void { task.input(field, (event.target as HTMLInputElement).value); }
async function submit(): Promise<void> {
	if (task.state.invalidField) { root.value?.querySelector<HTMLInputElement>(`[name="${task.state.invalidField}"]`)?.focus(); return; }
	await task.finish();
}
onBeforeUnmount(() => {
	const form = root.value;
	if (!form?.contains(form.ownerDocument.activeElement)) return;
	const editor = form.closest('.renovation-plan-editor');
	void nextTick(() => { if (editor?.isConnected) editor.querySelector<HTMLElement>('[data-rp-action="edit-curves"], .rp-plan-canvas')?.focus(); });
});
</script>
<template>
	<form
		ref="root"
		class="rp-structure-task"
		data-rp-form="edit-curves"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<h3>
			{{ tr('editor.curves.action') }}<template v-if="task.target.value?.name">
				· {{ task.target.value.name }}
			</template>
		</h3>
		<p
			v-if="task.state.loading"
			role="status"
		>
			{{ tr('editor.loading') }}
		</p>
		<p :id="description">
			{{ tr('editor.curves.direction') }}
		</p>
		<p v-if="task.target.value?.kind === 'wall'">
			{{ tr('editor.curves.wall-note') }}
		</p>
		<label class="rp-dialog-field">{{ tr('editor.curves.action') }}
			<select
				name="curve-edge"
				:value="task.state.edge"
				:disabled="task.blocked.value"
				@change="task.choose(Number(($event.target as HTMLSelectElement).value))"
			>
				<option
					v-for="edge in task.edges.value"
					:key="edge.index"
					:value="edge.index"
				>{{ tr('editor.curves.edge', { n: String(edge.index + 1), length: formatMetres(edge.length) }) }}</option>
			</select>
		</label>
		<label
			v-for="field in (['depth', 'radius'] as const)"
			:key="field"
			class="rp-dialog-field"
		>{{ tr(`editor.curves.${field}`) }}
			<input
				:name="field"
				inputmode="decimal"
				:value="task.state.text[field]"
				:readonly="task.blocked.value"
				:aria-invalid="task.state.invalidField === field"
				:aria-describedby="`${description} ${error ? errorId : ''}`.trim()"
				@input="input(field, $event)"
			>
		</label>
		<p
			v-if="error"
			:id="errorId"
			role="alert"
		>
			{{ error }}
		</p>
		<button
			type="button"
			:aria-disabled="task.blocked.value"
			@click="task.set(task.state.edge, 0)"
		>
			{{ tr('editor.curves.straighten') }}
		</button>
		<button
			type="submit"
			:aria-disabled="task.blocked.value || task.target.value === null || task.state.invalidField !== null || task.validation.value !== null"
		>
			{{ tr('editor.curves.save') }}
		</button>
		<button
			type="button"
			:aria-disabled="task.state.busy"
			@click="task.cancel()"
		>
			{{ tr('editor.task.cancel') }}
		</button>
	</form>
</template>
