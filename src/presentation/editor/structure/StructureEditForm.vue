<script setup lang="ts">
import OpeningSwingFields from './OpeningSwingFields.vue';
import { parseSwingDraft, swingDraft, type OpeningSwingDraft } from './openingSwingDraft';
import { openingOffsetAt } from '../../../domain/spatial/openingGeometry';
import { nativeSubmitKey as keydown } from "../forms/nativeSubmitKey";
import { computed, nextTick, onBeforeUnmount, ref, useId, type Ref } from 'vue';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import type { Opening, Structure, Wall } from '../../../domain/spatial/Structure';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import { alongWall, wallLength } from '../../../domain/spatial/Structure';
import { editWall, validateStructure } from '../../../domain/spatial/structureGeometry';
import type { Point } from '../../../core/geometry/Point';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { AppError } from '../../../core/errors/AppError';
import { tr } from '../../i18n/strings';
import { formatMetres, parseCoordinateMetres, parseMetres } from '../shell/formatLength';
import { spatialMessage } from './spatialMessage';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { persistenceError } from '../../../application/errors';
const props = defineProps<{ structure: Structure; id: string; end?: Point; openingPoint?: Point; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; roomNames: readonly string[]; dispatch: (structure: Structure) => Promise<DispatchResult>; preview: (structure: Structure | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus(), errorId = useId(), numericId = useId();
const wall = props.structure.walls.find(candidate => candidate.id === props.id), opening = props.structure.openings.find(candidate => candidate.id === props.id) as Opening;
const initialWall: Wall | undefined = wall && props.end ? { ...wall, end: props.end } : wall;
const openingHost = opening && props.structure.walls.find(host => host.id === opening.hostId);
const initialOffset = openingHost && props.openingPoint ? openingOffsetAt(openingHost, props.openingPoint, opening.width) : opening?.offset;
const swing = ref<OpeningSwingDraft | null>(opening && opening.kind !== 'opening' ? swingDraft(opening) : null), swingEdited = ref(false);
const initial = initialWall ? { length: wallLength(initialWall), height: initialWall.height, thickness: initialWall.thickness } : { offset: initialOffset ?? opening.offset, width: opening.width, height: opening.height, sill: opening.sill };
const fields = Object.keys(initial) as (keyof typeof initial)[];
const text = ref(Object.fromEntries(fields.map(field => [field, formatMetres(initial[field] as number)])));
const error = ref<AppError | null>(null), invalid = ref(false), reviewed = ref(false), conflict = ref(false);
const submitting = ref(false);
useDialogFormBusy(submitting, props.busy);
let alive = true;
onBeforeUnmount(() => { alive = false; props.preview(null); });
const proposal = computed(() => {
	const values: Record<string, number> = {};
	for (const field of fields) {
		const parsed = field === 'offset' || field === 'sill' ? parseCoordinateMetres(text.value[field]) : parseMetres(text.value[field]);
		if (!parsed.ok) return null;
		values[field] = text.value[field] === formatMetres(initial[field] as number) ? initial[field] as number : parsed.mm;
	}
	const parsedSwing = swing.value ? parseSwingDraft(swing.value) : undefined;
	if (parsedSwing === null) return null;
	if (initialWall) return editWall(props.structure, { ...initialWall, height: values.height, thickness: values.thickness, end: alongWall(initialWall, values.length) });
	return { ...props.structure, openings: props.structure.openings.map(item => item.id === props.id ? { ...item, ...values, ...(swingEdited.value && parsedSwing ? { swing: parsedSwing } : {}) } : item) };
});
const changed = computed(() => JSON.stringify(proposal.value) !== JSON.stringify(props.structure));
const paused = computed(() => props.busy.value || props.blocked.value);
const unavailable = computed(() => paused.value || conflict.value || !changed.value);
const describedBy = computed(() => invalid.value ? numericId : error.value ? errorId : undefined);
const impact = computed(() => {
	if (!wall) return tr('editor.structure.opening-impact');
	const walls = proposal.value?.walls.filter((item, index) => JSON.stringify(item) !== JSON.stringify(props.structure.walls[index])).length ?? 0;
	return tr('editor.structure.impact', { walls: String(walls), openings: String(props.structure.openings.filter(item => item.hostId === props.id).length) });
});
function changeSwing(value: OpeningSwingDraft): void {
	if (paused.value || conflict.value) return;
	swing.value = value; swingEdited.value = true; reviewed.value = false; props.preview(null);
}
function showPreview(): void { reviewed.value = true; props.preview(proposal.value); }
async function focusInvalidInput(): Promise<void> {
	if (swing.value && !parseSwingDraft(swing.value)) {
		await nextTick(); formEl.value?.querySelector<HTMLInputElement>('[name="opening-angle"]')?.focus();
	} else await focusFirstInvalidControl();
}
async function submit(): Promise<void> {
	if (props.busy.value || props.blocked.value || conflict.value || !changed.value) return;
	invalid.value = proposal.value === null;
	if (!proposal.value) {
		await focusInvalidInput();
		return;
	}
	const valid = validateStructure(proposal.value, props.structure.boundaries.map(boundary => boundary.roomId));
	if (!valid.ok) { error.value = valid.error; await focusFirstInvalidControl(); return; }
	if (!reviewed.value) { showPreview(); return; }
	submitting.value = true;
	try {
		const result = await props.dispatch(proposal.value);
		if (!alive) return;
		if (result.ok) emit('submit');
		else { error.value = result.error; conflict.value = WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code)) || result.error.code === 'undo.superseded'; }
	} catch (cause) { if (alive) error.value = persistenceError('spatial.write-failed', 'The spatial edit failed.', cause); }
	finally { submitting.value = false; }
}

</script>
<template>
	<form
		ref="formEl"
		class="rp-dialog-form"
		@submit.prevent="submit"
		@keydown="keydown"
	>
		<p v-if="wall">
			{{ tr('editor.structure.anchor') }}
		</p>
		<p v-if="roomNames.length">
			{{ tr('editor.structure.room-impact', { rooms: roomNames.join(', ') }) }}
		</p>
		<p
			v-if="error"
			:id="errorId"
			role="alert"
		>
			{{ spatialMessage(error) }}
		</p>
		<p
			v-if="invalid"
			:id="numericId"
			role="alert"
		>
			{{ tr('editor.structure.error.numeric') }}
		</p>
		<p
			v-if="conflict"
			role="status"
		>
			{{ tr('editor.structure.conflict') }}
		</p>
		<label
			v-for="field in fields"
			:key="field"
			class="rp-dialog-field"
		>{{ tr(`editor.structure.${field}`) }}
			<input
				v-model="text[field]"
				:name="field"
				type="text"
				inputmode="decimal"
				:readonly="paused"
				:aria-invalid="invalid || error !== null"
				:aria-describedby="describedBy"
				@input="reviewed = false; props.preview(null)"
			>
		</label>
		<OpeningSwingFields
			v-if="swing"
			:model-value="swing"
			:disabled="paused || conflict"
			@update:model-value="changeSwing"
		/>
		<p
			v-if="reviewed"
			role="status"
		>
			{{ impact }}
		</p>
		<button
			type="submit"
			:aria-disabled="unavailable"
		>
			{{ tr(reviewed ? 'editor.structure.apply' : 'editor.structure.preview') }}
		</button>
	</form>
</template>
