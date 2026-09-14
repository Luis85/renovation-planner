<script setup lang="ts">
import { computed, onBeforeUnmount, watchEffect, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { err } from '../../../core/result/Result';
import { spatialError } from '../../../domain/spatial/structureGeometry';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import GeometryFormHead from '../forms/GeometryFormHead.vue';
import FieldError from '../../components/FieldError.vue';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { commitTextInput } from '../forms/commitTextInput';
import { dimensionEdit, dimensionText, type DimensionEdit, type DimensionText } from './dimensionInput';

const props = defineProps<{ offset: number; points: readonly Point[]; name: string; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; latest: Readonly<Ref<string | null>>;
	inputBlocked: Readonly<Ref<boolean>>; logger: Logger; retry: () => Promise<void>; openSource: () => Promise<void>;
	dispatch: (value: DimensionEdit) => Promise<DispatchResult>; preview: (value: DimensionEdit | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();
let alive = true;
const form = useFormCommit({ initial: dimensionText(props.offset, props.name), logger: props.logger, errorMap: {}, toUserMessage: trError,
	dispatch: (value: DimensionText) => { const { edit } = dimensionEdit(props.points, props.offset, value); return edit ? props.dispatch(edit) : Promise.resolve(err(spatialError('element-invalid'))); } });
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const parsed = computed(() => dimensionEdit(props.points, props.offset, form.values.value));
const paused = computed(() => props.inputBlocked.value || form.submitting.value);
const unchanged = computed(() => parsed.value.edit !== null && parsed.value.edit.name === props.name && parsed.value.edit.offset === props.offset);
const disabled = computed(() => props.blocked.value || paused.value || props.latest.value !== null || !parsed.value.edit || unchanged.value);
function input(field: keyof DimensionText, event: Event): void {
	commitTextInput(event, form.values.value[field], refuseInput, value => form.setField(field, value));
}
watchEffect(() => props.preview(parsed.value.edit));
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
		data-rp-form="dimension-edit"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<GeometryFormHead
			:blocked="blocked.value"
			:busy="busy.value"
			:retry="retry"
			:open-source="openSource"
			:banner="form.banner.value"
			:latest="latest.value"
			:name="form.values.value.name"
			:readonly="paused"
			@name-input="input('name', $event)"
		/>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="parsed.invalid ? tr('editor.drafting.offset-invalid') : null"
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
					:value="form.values.value.offset"
					:readonly="paused"
					@input="input('offset', $event)"
				>
			</label>
		</FieldError>
		<button
			type="submit"
			class="mod-cta"
			:aria-disabled="disabled"
		>
			{{ tr('editor.drafting.apply') }}
		</button>
	</form>
</template>
