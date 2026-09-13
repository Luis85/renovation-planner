<script setup lang="ts">
import { computed, onBeforeUnmount, watchEffect, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { SpatialElementKind } from '../../../domain/spatial/SpatialElement';
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
import { structuralEdit, structuralText, type StructuralEdit, type StructuralText } from './structuralInput';

const props = defineProps<{ kind: SpatialElementKind; width?: number; points: readonly Point[]; name: string; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; latest: Readonly<Ref<string | null>>;
	inputBlocked: Readonly<Ref<boolean>>; logger: Logger; retry: () => Promise<void>; openSource: () => Promise<void>;
	dispatch: (value: StructuralEdit) => Promise<DispatchResult>; preview: (value: StructuralEdit | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();
const shape = computed(() => ({ kind: props.kind, points: props.points, ...(props.width === undefined ? {} : { width: props.width }) }));
let alive = true;
const form = useFormCommit({ initial: structuralText(shape.value, props.name), logger: props.logger, errorMap: {}, toUserMessage: trError,
	dispatch: (value: StructuralText) => { const { edit } = structuralEdit(shape.value, value); return edit ? props.dispatch(edit) : Promise.resolve(err(spatialError('element-invalid'))); } });
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const parsed = computed(() => structuralEdit(shape.value, form.values.value));
const paused = computed(() => props.inputBlocked.value || form.submitting.value);
const stored = computed(() => JSON.stringify({ name: props.name, points: props.points, ...(props.kind === 'beam' ? { width: props.width } : {}) }));
const disabled = computed(() => props.blocked.value || paused.value || props.latest.value !== null || !parsed.value.edit || JSON.stringify(parsed.value.edit) === stored.value);
const fields = computed<readonly ('width' | 'depth')[]>(() => props.kind === 'post' ? ['width', 'depth'] : ['width']);
function input(field: keyof StructuralText, event: Event): void {
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
		data-rp-form="structural-edit"
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
		<fieldset class="rp-stair-fields">
			<FieldError
				v-for="field in fields"
				:key="field"
				v-slot="{ inputId, aria }"
				:message="parsed.errors.has(field) ? tr(`editor.structural.${field}-invalid`) : null"
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
						:value="form.values.value[field]"
						:readonly="paused"
						@input="input(field, $event)"
					>
				</label>
			</FieldError>
		</fieldset>
		<button
			type="submit"
			class="mod-cta"
			:aria-disabled="disabled"
		>
			{{ tr('editor.structural.apply') }}
		</button>
	</form>
</template>
