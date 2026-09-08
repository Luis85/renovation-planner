<script setup lang="ts">
import { computed, onBeforeUnmount, watchEffect, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { StairOptions } from '../../../domain/spatial/stairGeometry';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { err } from '../../../core/result/Result';
import { spatialError } from '../../../domain/spatial/structureGeometry';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import FieldError from '../../components/FieldError.vue';
import FormBanner from '../../components/FormBanner.vue';
import DraftRecovery from '../forms/DraftRecovery.vue';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { commitTextInput } from '../forms/commitTextInput';
import StairFields from './StairFields.vue';
import { parseStairInput, stairText, type StairText, type StairEdit } from './stairInput';

const props = defineProps<{ points: readonly Point[]; options: StairOptions; name: string; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; latest: Readonly<Ref<string | null>>;
	inputBlocked: Readonly<Ref<boolean>>; logger: Logger; retry: () => Promise<void>; openSource: () => Promise<void>;
	dispatch: (value: StairEdit) => Promise<DispatchResult>; preview: (value: StairEdit | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();
let alive = true;
function proposalFor(value: StairText & { name: string }): StairEdit | null {
	const parsed = parseStairInput(props.points, value, props.options);
	return parsed.points && value.name.trim() ? { name: value.name.trim(), points: parsed.points, stair: parsed.options } : null;
}
const form = useFormCommit({ initial: { name: props.name, ...stairText(props.points, props.options) }, logger: props.logger, errorMap: {}, toUserMessage: trError,
	dispatch: (value: StairText & { name: string }) => { const proposal = proposalFor(value); return proposal ? props.dispatch(proposal) : Promise.resolve(err(spatialError('element-invalid'))); } });
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const parsed = computed(() => parseStairInput(props.points, form.values.value, props.options));
const paused = computed(() => props.inputBlocked.value || form.submitting.value);
const proposal = computed(() => proposalFor(form.values.value));
const unchanged = computed(() => proposal.value !== null && JSON.stringify(proposal.value) === JSON.stringify({ name: props.name, points: props.points, stair: props.options }));
const disabled = computed(() => props.blocked.value || paused.value || props.latest.value !== null || !proposal.value || unchanged.value);
function update(value: StairText): void { if (paused.value) return; for (const field of ['width', 'run', 'treads', 'direction'] as const) form.setField(field, value[field]); }
function nameInput(event: Event): void { commitTextInput(event, form.values.value.name, refuseInput, value => form.setField('name', value)); }
watchEffect(() => props.preview(proposal.value));
onBeforeUnmount(() => { alive = false; props.preview(null); });
async function submit(): Promise<void> {
	if (disabled.value) { await focusFirstInvalidControl(); return; }
	if (await form.submit() && alive) emit('submit');
}
</script>
<template>
	<form
		ref="formEl"
		class="rp-dialog-form"
		data-rp-form="stair-edit"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<DraftRecovery
			v-if="blocked.value && !busy.value"
			:retry="retry"
			:open-source="openSource"
		/>
		<FormBanner :message="form.banner.value" />
		<p
			v-if="latest.value"
			role="status"
		>
			{{ latest.value }}
		</p>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.values.value.name.trim() ? null : tr('editor.element.name-required')"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>{{ tr('editor.room.name') }}<input
				:id="inputId"
				v-bind="aria"
				name="name"
				type="text"
				:value="form.values.value.name"
				:readonly="paused"
				@input="nameInput"
			></label>
		</FieldError>
		<StairFields
			:model-value="form.values.value"
			:errors="parsed.errors"
			:readonly="paused"
			@update:model-value="update"
		/>
		<button
			type="submit"
			class="mod-cta"
			:aria-disabled="disabled"
		>
			{{ tr('editor.stair.apply') }}
		</button>
	</form>
</template>
