<script setup lang="ts">
import { commitTextInput } from '../forms/commitTextInput';
import { nativeSubmitKey as keydown } from "../forms/nativeSubmitKey";
import { computed, onBeforeUnmount, useId, type Ref } from 'vue';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { zoneName } from '../../../domain/zone/ZoneName';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import FormFeedback from '../forms/FormFeedback.vue';
import NameInputField from '../forms/NameInputField.vue';
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
function input(event: Event): void { commitTextInput(event, form.values.value.name, refuseInput, value => form.setField('name', value)); }
async function submit(): Promise<void> {
	if (unavailable.value) return;
	if (await form.submit()) { if (alive) emit('submit'); }
	else if (alive) await focusFirstInvalidControl();
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
		<FormFeedback
			:message="form.banner.value"
			:latest="latest.value"
		/>
		<NameInputField
			:value="form.values.value.name"
			:label="tr('editor.rename.name')"
			:message="form.fieldErrors.value.get('name') ?? null"
			:paused="paused"
			:hint-id="hintId"
			@input="input"
		/>
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
