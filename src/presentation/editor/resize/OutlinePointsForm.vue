<script setup lang="ts">
import { computed, onBeforeUnmount, watchEffect, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { Logger } from '../../../application/ports/Logger';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import FieldError from '../../components/FieldError.vue';
import FormBanner from '../../components/FormBanner.vue';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { formatMetres } from '../shell/formatLength';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { outlineProposal, type CoordinateEdits } from './outlineProposal';
const props = defineProps<{ points: readonly Point[]; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; latest: Readonly<Ref<string | null>>;
	logger: Logger; dispatch: (polygon: Polygon) => Promise<DispatchResult>; preview: (polygon: Polygon | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
let alive = true; onBeforeUnmount(() => { alive = false; props.preview(null); });
const form = useFormCommit({ initial: { edits: props.points.map(() => ({})) as CoordinateEdits }, logger: props.logger, errorMap: {}, toUserMessage: trError,
	dispatch: ({ edits }: { edits: CoordinateEdits }) => props.dispatch(outlineProposal(props.points, edits).polygon as Polygon) });
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();
const proposal = computed(() => outlineProposal(props.points, form.values.value.edits));
watchEffect(() => props.preview(proposal.value.polygon));
const paused = computed(() => props.blocked.value || form.submitting.value);
const changed = computed(() => JSON.stringify(proposal.value.polygon?.points) !== JSON.stringify(props.points));
const disabled = computed(() => paused.value || props.latest.value !== null || !changed.value);
const axes = ['x', 'y'] as const;
function value(index: number, axis: 'x' | 'y'): string { return form.values.value.edits[index]?.[axis] ?? formatMetres(props.points[index][axis]); }
function input(index: number, axis: 'x' | 'y', event: Event): void {
	const control = event.target as HTMLInputElement;
	if (refuseInput(control, value(index, axis))) return;
	form.setField('edits', form.values.value.edits.map((entry, n) => n === index ? { ...entry, [axis]: control.value } : entry));
}
async function submit(): Promise<void> {
	if (disabled.value) return;
	if (proposal.value.polygon === null) { await focusFirstInvalidControl(); return; }
	if (await form.submit() && alive) emit('submit');
}
</script>
<template>
	<form
		ref="formEl"
		class="rp-dialog-form"
		data-rp-form="outline-points"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<p>{{ tr('editor.outline.hint') }}</p>
		<FormBanner :message="form.banner.value" />
		<p
			v-if="latest.value !== null"
			role="status"
		>
			{{ latest.value }}
		</p>
		<fieldset
			v-for="(point, index) in points"
			:key="index"
			class="rp-dialog-fields"
		>
			<legend>{{ tr('editor.area.corner', { n: String(index + 1) }) }}</legend>
			<FieldError
				v-for="axis in axes"
				:key="axis"
				v-slot="{ inputId, aria }"
				:message="proposal.errors.has(index + '.' + axis) ? tr('editor.area.coordinate-invalid') : null"
			>
				<label
					:for="inputId"
					class="rp-dialog-field"
				>{{ tr(axis === 'x' ? 'editor.area.x' : 'editor.area.y') }}
					<input
						:id="inputId"
						v-bind="aria"
						:name="index + '.' + axis"
						type="text"
						inputmode="decimal"
						:value="value(index, axis)"
						:readonly="paused"
						@input="input(index, axis, $event)"
					>
				</label>
			</FieldError>
		</fieldset>
		<p
			v-if="proposal.polygon === null"
			role="alert"
		>
			{{ tr('editor.resize.invalid') }}
		</p>
		<div class="rp-dialog-actions">
			<button
				type="submit"
				class="rp-dialog-button"
				:aria-disabled="disabled"
			>
				{{ tr('editor.rename.apply') }}
			</button>
		</div>
	</form>
</template>
