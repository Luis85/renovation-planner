<script setup lang="ts">
import { commitTextInput } from '../forms/commitTextInput';
import DraftRecovery from '../forms/DraftRecovery.vue';
import { computed, onBeforeUnmount, ref, watchEffect, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { Logger } from '../../../application/ports/Logger';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import FieldError from '../../components/FieldError.vue';
import GeometryNameField from '../forms/GeometryNameField.vue';
import FormBanner from '../../components/FormBanner.vue';
import CornerChooser from './CornerChooser.vue';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { formatMetres } from '../shell/formatLength';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { outlineProposal, type CoordinateEdits } from './outlineProposal';
import type { StringKey } from '../../i18n/locales/en';
const props = defineProps<{ points: readonly Point[]; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; latest: Readonly<Ref<string | null>>;
	name?: string; nameLabel?: StringKey; hint: StringKey; inputBlocked?: Readonly<Ref<boolean>>; retry?: () => Promise<void>; openSource?: () => Promise<void>; accepts?: (points: readonly Point[]) => boolean;
	logger: Logger; dispatch: (polygon: Polygon, name?: string) => Promise<DispatchResult>; preview: (polygon: Polygon | null) => void;
	/**
	 * BP-04's "choose a numbered corner", and its action 3's highlight, as ONE optional prop
	 * whose PRESENCE draws the list (controller ruling R-S11-1, default taken).
	 *
	 * One prop rather than a mode flag beside a callback, because the coupling is real: chosen-
	 * corner mode is exactly the mode that HAS a corner to highlight, and a caller that could
	 * enable the list and forget the highlight is precisely BP-04 action 3's failure mode.
	 *
	 * **Opt-in because this form is SHARED.** `elements/elementEditPresentation.ts` mounts it as
	 * the fallback editor for every `NamedSpatialElement` that is not a stair, post, beam or
	 * dimension, and BP-04 is about Room and Area corners; an element family with its own
	 * point-count `accepts` rules is unrequested scope. That caller passes nothing and draws no
	 * list, which `elementLifecycleCompletion.test.ts` asserts.
	 *
	 * Called with `null` on unmount beside `preview`, so a cancelled dialog leaves no mark on the
	 * canvas. The corner number is a transient UI identifier and is never persisted.
	 */
	highlight?: (index: number | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
let alive = true; onBeforeUnmount(() => { alive = false; props.preview(null); props.highlight?.(null); });
const chosen = ref<number | null>(null);
const form = useFormCommit({ initial: { edits: props.points.map(() => ({})) as CoordinateEdits, name: props.name ?? '' }, logger: props.logger, errorMap: {}, toUserMessage: trError,
	dispatch: ({ edits, name }: { edits: CoordinateEdits; name: string }) => props.dispatch(outlineProposal(props.points, edits, props.accepts).polygon as Polygon, name.trim()) });
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();
/**
 * Choosing a corner moves focus into that corner's X field, so the keyboard path is choose-then-
 * type rather than choose-then-hunt. No `nextTick` and no focus rescue: every fieldset is
 * rendered at all times, so the target exists before the click and no control here can remove
 * itself — which is the difference from `add/AreaCornerEditor.vue`, whose rows CAN vanish under
 * their own button and which carries a measured docblock about the focus loss that caused.
 */
function choose(index: number): void {
	chosen.value = index;
	props.highlight?.(index);
	formEl.value?.querySelector<HTMLInputElement>(`[name="${index}.x"]`)?.focus();
}
const proposal = computed(() => outlineProposal(props.points, form.values.value.edits, props.accepts));
const invalidName = computed(() => props.name !== undefined && !form.values.value.name.trim());
watchEffect(() => props.preview(proposal.value.polygon));
const paused = computed(() => (props.inputBlocked?.value ?? props.blocked.value) || form.submitting.value);
const changed = computed(() => JSON.stringify(proposal.value.polygon?.points) !== JSON.stringify(props.points) || (props.name !== undefined && form.values.value.name.trim() !== props.name));
const disabled = computed(() => props.blocked.value || paused.value || props.latest.value !== null || !changed.value);
const axes = ['x', 'y'] as const;
function value(index: number, axis: 'x' | 'y'): string { return form.values.value.edits[index]?.[axis] ?? formatMetres(props.points[index][axis]); }
function input(index: number, axis: 'x' | 'y', event: Event): void {
	const control = event.target as HTMLInputElement;
	if (refuseInput(control, value(index, axis))) return;
	form.setField('edits', form.values.value.edits.map((entry, n) => n === index ? { ...entry, [axis]: control.value } : entry));
}
function nameInput(event: Event): void { commitTextInput(event, form.values.value.name, refuseInput, name => form.setField('name', name)); }
async function submit(): Promise<void> {
	if (disabled.value) return;
	if (proposal.value.polygon === null || invalidName.value) { await focusFirstInvalidControl(); return; }
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
		<DraftRecovery
			v-if="blocked.value && !busy.value && retry && openSource"
			:retry="retry"
			:open-source="openSource"
		/>
		<p>{{ tr(hint) }}</p>
		<GeometryNameField
			v-if="name !== undefined"
			:value="form.values.value.name"
			:label="nameLabel"
			:readonly="paused"
			:invalid="invalidName"
			@input="nameInput"
		/>
		<FormBanner :message="form.banner.value" />
		<p
			v-if="latest.value !== null"
			role="status"
		>
			{{ latest.value }}
		</p>
		<CornerChooser
			v-if="highlight"
			:points="points"
			:chosen="chosen"
			@choose="choose"
		/>
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
