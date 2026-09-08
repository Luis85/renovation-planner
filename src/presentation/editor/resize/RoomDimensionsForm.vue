<script setup lang="ts">
import { nativeSubmitKey as keydown } from "../forms/nativeSubmitKey";
import { computed, onBeforeUnmount, ref, useId, watchEffect, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import FieldError from '../../components/FieldError.vue';
import FormBanner from '../../components/FormBanner.vue';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { formatMetres } from '../shell/formatLength';
import { formatArea } from '../shell/formatArea';
import { dimensionTexts, dimensionProposal, type DimensionsText } from './roomDimensions';

const props = defineProps<{
	points: readonly Point[]; box: BoundingBox; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; latest: Readonly<Ref<string | null>>;
	dispatch: (polygon: Polygon) => Promise<DispatchResult>; logger: Logger; preview: (polygon: Polygon | null) => void;
}>();
const emit = defineEmits<{ submit: [] }>();
const hintId = useId();
const attempted = ref(false);
let alive = true;
onBeforeUnmount(() => { alive = false; props.preview(null); });
const form = useFormCommit({
	initial: dimensionTexts(props.box), logger: props.logger, errorMap: {}, toUserMessage: trError,
	// submit validates synchronously before this single form dispatch.
	dispatch: (text: DimensionsText): Promise<DispatchResult> => props.dispatch(dimensionProposal(props.points, props.box, text).polygon as Polygon),
});
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();
const proposal = computed(() => dimensionProposal(props.points, props.box, form.values.value));
watchEffect(() => props.preview(proposal.value.polygon));
const changed = computed(() => JSON.stringify(proposal.value.polygon?.points) !== JSON.stringify(props.points));
const blocked = computed(() => props.blocked.value || form.submitting.value);
const initial = dimensionTexts(props.box);
const previewText = computed(() => {
	const polygon = proposal.value.polygon;
	if (polygon === null) return '';
	const xs = polygon.points.map(p => p.x), ys = polygon.points.map(p => p.y);
	return tr('editor.resize.preview', { width: formatMetres(Math.max(...xs) - props.box.min.x), depth: formatMetres(Math.max(...ys) - props.box.min.y), area: formatArea(proposal.value.areaMm2 as number) });
});
const axes = ['width', 'depth'] as const;
function input(axis: keyof DimensionsText, event: Event): void {
	const control = event.target as HTMLInputElement;
	if (!refuseInput(control, form.values.value[axis])) form.setField(axis, control.value);
}
function error(axis: keyof DimensionsText): string | null {
	const reason = proposal.value.errors[axis];
	if (!attempted.value || reason === null) return null;
	if (reason === 'not-positive') return tr('editor.room.error.not-positive');
	return tr(reason === 'too-large' ? 'editor.room.error.too-large' : 'editor.room.error.not-a-number');
}
async function submit(): Promise<void> {
	if (blocked.value || props.latest.value !== null || !changed.value) return;
	attempted.value = true;
	if (proposal.value.polygon === null) { await focusFirstInvalidControl(); return; }
	if (await form.submit() && alive) emit('submit');
}
/** Preserve native editing; held/composed/chorded Enter must not submit repeatedly. */

</script>

<template>
	<form
		ref="formEl"
		class="rp-dialog-form rp-room-dimensions"
		@submit.prevent="submit"
		@keydown="keydown"
	>
		<p>{{ tr('editor.resize.current', initial) }}</p>
		<p :id="hintId">
			{{ tr('editor.resize.anchor') }}
		</p>
		<FormBanner :message="form.banner.value" />
		<p
			v-if="latest.value !== null"
			role="status"
		>
			{{ latest.value }}
		</p>
		<FieldError
			v-for="axis in axes"
			:key="axis"
			v-slot="{ inputId, aria }"
			:message="error(axis)"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>
				{{ tr(axis === 'width' ? 'editor.room.width' : 'editor.room.depth') }}
				<input
					:id="inputId"
					v-bind="aria"
					:name="axis"
					:data-field="axis"
					type="text"
					inputmode="decimal"
					:value="form.values.value[axis]"
					:readonly="blocked"
					:aria-describedby="[hintId, aria['aria-describedby']].filter(Boolean).join(' ')"
					@input="input(axis, $event)"
				>
			</label>
		</FieldError>
		<p
			v-if="proposal.polygon !== null"
			role="status"
			class="rp-resize-preview"
		>
			{{ previewText }}
		</p>
		<p
			v-else-if="attempted"
			role="alert"
		>
			{{ tr('editor.resize.invalid') }}
		</p>
		<p
			v-if="blocked"
			role="status"
		>
			{{ tr('editor.resize.paused') }}
		</p>
		<div class="rp-dialog-actions">
			<button
				type="submit"
				class="rp-dialog-button"
				:aria-disabled="blocked || latest.value !== null || !changed"
			>
				{{ tr('editor.resize.apply') }}
			</button>
		</div>
	</form>
</template>
