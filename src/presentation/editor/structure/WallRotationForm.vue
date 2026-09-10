<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watchEffect, type Ref } from 'vue';
import type { Structure } from '../../../domain/spatial/Structure';
import { samePoint } from '../../../domain/spatial/Structure';
import { rotateWallStructure } from '../../../domain/spatial/rotateWall';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import FieldError from '../../components/FieldError.vue';
import { parseRotationDegrees } from '../elements/objectRotation';
import { commitTextInput } from '../forms/commitTextInput';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { persistenceError } from '../../../application/errors';
import type { AppError } from '../../../core/errors/AppError';
import { spatialMessage } from './spatialMessage';
import { tr } from '../../i18n/strings';
import DraftRecovery from '../forms/DraftRecovery.vue';

const props = defineProps<{ structure: Structure; wallId: string; degrees: number; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>;
	retired: Readonly<Ref<boolean>>; retry: () => Promise<void>; openSource: () => Promise<void>;
	roomNames: Readonly<Record<string, string>>; dispatch: (structure: Structure) => Promise<DispatchResult>; preview: (structure: Structure | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
const text = ref(String(props.degrees)), reviewed = ref(props.degrees % 360 !== 0), submitting = ref(false), conflict = ref(false), error = ref<AppError | null>(null);
const refuseInput = useDialogFormBusy(submitting, props.busy);
const parsedDegrees = computed(() => parseRotationDegrees(text.value));
const proposal = computed(() => parsedDegrees.value === null ? null : rotateWallStructure(props.structure, props.wallId, parsedDegrees.value));
const changed = computed(() => proposal.value?.ok && proposal.value.value !== props.structure);
const paused = computed(() => props.blocked.value || submitting.value || conflict.value);
const affected = computed(() => proposal.value?.ok ? proposal.value.value.walls.filter((wall, index) => !samePoint(wall.start, props.structure.walls[index].start) || !samePoint(wall.end, props.structure.walls[index].end)).map(wall => wall.id) : []);
const rooms = computed(() => props.structure.boundaries.filter(boundary => boundary.wallIds.some(id => affected.value.includes(id))).map(boundary => props.roomNames[boundary.roomId] ?? boundary.roomId));
const impact = computed(() => tr('editor.structure.impact', { walls: String(affected.value.length), openings: String(props.structure.openings.filter(opening => affected.value.includes(opening.hostId)).length) }));
const invalid = computed(() => parsedDegrees.value === null ? tr('editor.rotation.invalid') : proposal.value && !proposal.value.ok ? spatialMessage(proposal.value.error) : null);
let alive = true;
onBeforeUnmount(() => { alive = false; props.preview(null); });
watchEffect(() => props.preview(reviewed.value && !paused.value && proposal.value?.ok ? proposal.value.value : null));
function input(event: Event): void {
	commitTextInput(event, text.value, refuseInput, value => { text.value = value; reviewed.value = false; error.value = null; });
}
async function submit(): Promise<void> {
	const result = proposal.value;
	if (paused.value || !changed.value || !result?.ok) return;
	if (!reviewed.value) { reviewed.value = true; return; }
	submitting.value = true;
	try {
		const outcome = await props.dispatch(result.value);
		if (!alive) return;
		if (outcome.ok) emit('submit');
		else { error.value = outcome.error; conflict.value = WRITE_BOUNDARY_CODES.some(code => outcome.error.code.endsWith(code)) || outcome.error.code === 'undo.superseded'; }
	} catch (cause) { if (alive) error.value = persistenceError('spatial.write-failed', 'The wall rotation failed.', cause); }
	finally { submitting.value = false; }
}
</script>

<template>
	<form
		class="rp-dialog-form"
		data-rp-form="wall-rotation"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<DraftRecovery
			v-if="blocked.value && !busy.value && !retired.value"
			:retry="retry"
			:open-source="openSource"
		/>
		<p>{{ tr('editor.rotation.wall-hint') }}</p>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="invalid"
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
					:value="text"
					:readonly="paused"
					@input="input"
				>
			</label>
		</FieldError>
		<p
			v-if="reviewed && changed"
			role="status"
		>
			{{ impact }}
		</p>
		<p v-if="reviewed && rooms.length">
			{{ tr('editor.structure.room-impact', { rooms: rooms.join(', ') }) }}
		</p>
		<p
			v-if="error"
			role="alert"
		>
			{{ spatialMessage(error) }}
		</p>
		<p
			v-if="conflict || retired.value"
			role="status"
		>
			{{ tr('editor.structure.conflict') }}
		</p>
		<button
			type="submit"
			class="rp-dialog-button"
			:aria-disabled="paused || !changed"
		>
			{{ tr(reviewed ? 'editor.rotation.wall-apply' : 'editor.structure.preview') }}
		</button>
	</form>
</template>
