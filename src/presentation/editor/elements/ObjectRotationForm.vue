<script setup lang="ts">
import { computed, onBeforeUnmount, watchEffect, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { commitTextInput } from '../forms/commitTextInput';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import DraftRecovery from '../forms/DraftRecovery.vue';
import FieldError from '../../components/FieldError.vue';
import FormBanner from '../../components/FormBanner.vue';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { parseRotationDegrees, rotationChanged, rotationPoints } from './objectRotation';
const props = defineProps<{ element: NamedSpatialElement; pivot: Point; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; latest: Readonly<Ref<string | null>>;
	inputBlocked: Readonly<Ref<boolean>>; retry: () => Promise<void>; openSource: () => Promise<void>; logger: Logger;
	dispatch: (points: readonly Point[]) => Promise<DispatchResult>; preview: (points: readonly Point[] | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
let alive = true;
onBeforeUnmount(() => { alive = false; props.preview(null); });
const form = useFormCommit({ initial: { angle: '0' }, logger: props.logger, errorMap: {}, toUserMessage: trError,
	dispatch: ({ angle }: { angle: string }): Promise<DispatchResult> => props.dispatch(rotationPoints(props.element, parseRotationDegrees(angle) as number, props.pivot) as readonly Point[]) });
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const degrees = computed(() => parseRotationDegrees(form.values.value.angle));
const proposal = computed(() => degrees.value === null ? null : rotationPoints(props.element, degrees.value, props.pivot));
const paused = computed(() => props.inputBlocked.value || form.submitting.value);
const disabled = computed(() => props.blocked.value || paused.value || props.latest.value !== null || !proposal.value || !rotationChanged(props.element.points, proposal.value));
watchEffect(() => props.preview(proposal.value));
function input(event: Event): void { commitTextInput(event, form.values.value.angle, refuseInput, angle => form.setField('angle', angle)); }
async function submit(): Promise<void> { if (!disabled.value && await form.submit() && alive) emit('submit'); }
</script>
<template>
	<form
		class="rp-dialog-form"
		data-rp-form="object-rotation"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<DraftRecovery
			v-if="blocked.value && !busy.value"
			:retry="retry"
			:open-source="openSource"
		/>
		<p>{{ tr('editor.rotation.hint') }}</p>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="proposal === null ? tr('editor.rotation.invalid') : null"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>{{ tr('editor.rotation.degrees') }}
				<input
					:id="inputId"
					v-bind="aria"
					name="angle"
					type="text"
					inputmode="decimal"
					:value="form.values.value.angle"
					:readonly="paused"
					@input="input"
				>
			</label>
		</FieldError>
		<FormBanner :message="form.banner.value" />
		<p
			v-if="latest.value !== null"
			role="status"
		>
			{{ latest.value }}
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
