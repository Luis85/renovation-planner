<script setup lang="ts">
import { computed, onBeforeUnmount, useId, type Ref } from 'vue';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { zoneName } from '../../../domain/zone/ZoneName';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import FieldError from '../../components/FieldError.vue';
import FormBanner from '../../components/FormBanner.vue';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';

const props = defineProps<{
	name: string; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; latest: Readonly<Ref<string | null>>;
	dispatch: (name: string) => Promise<DispatchResult>; logger: Logger;
}>();
const emit = defineEmits<{ submit: [] }>();
const hintId = useId();
let alive = true;
onBeforeUnmount(() => { alive = false; });
const form = useFormCommit({ initial: { name: props.name }, logger: props.logger,
	errorMap: { 'zone.empty-name': ['name'] }, toUserMessage: trError,
	dispatch: ({ name }: { name: string }) => props.dispatch(name),
});
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();
const changed = computed(() => {
	const parsed = zoneName(form.values.value.name);
	return !parsed.ok || parsed.value !== props.name;
});
const paused = computed(() => props.blocked.value || form.submitting.value);
const unavailable = computed(() => paused.value || props.latest.value !== null || !changed.value);
function input(event: Event): void {
	const control = event.target as HTMLInputElement;
	if (!refuseInput(control, form.values.value.name)) form.setField('name', control.value);
}
async function submit(): Promise<void> {
	if (unavailable.value) return;
	if (await form.submit()) { if (alive) emit('submit'); }
	else if (alive) await focusFirstInvalidControl();
}
function keydown(event: KeyboardEvent): void {
	if (event.key === 'Enter' && (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)) event.preventDefault();
}
</script>

<template>
	<form
		ref="formEl"
		class="rp-dialog-form"
		data-rp-form="room-name"
		@submit.prevent="submit"
		@keydown="keydown"
	>
		<p>{{ tr('editor.rename.current', { name }) }}</p>
		<p :id="hintId">
			{{ tr('editor.rename.hint') }}
		</p>
		<FormBanner :message="form.banner.value" />
		<p
			v-if="latest.value !== null"
			role="status"
		>
			{{ latest.value }}
		</p>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('name') ?? null"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>
				{{ tr('editor.rename.name') }}
				<input
					:id="inputId"
					v-bind="aria"
					name="name"
					data-field="name"
					type="text"
					:value="form.values.value.name"
					:readonly="paused"
					:aria-describedby="[hintId, aria['aria-describedby']].filter(Boolean).join(' ')"
					@input="input"
				>
			</label>
		</FieldError>
		<p
			v-if="paused"
			role="status"
		>
			{{ tr('editor.rename.paused') }}
		</p>
		<div class="rp-dialog-actions">
			<button
				type="submit"
				class="rp-dialog-button"
				:aria-disabled="unavailable"
			>
				{{ tr('editor.rename.apply') }}
			</button>
		</div>
	</form>
</template>
