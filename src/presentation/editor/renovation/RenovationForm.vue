<script setup lang="ts">
import { restoreInoperativeChoice } from '../forms/inoperativeControl';
import { computed, onBeforeUnmount, ref, toRaw, type Ref } from 'vue';
import type { RenovationBaseline, RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import { validateRenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { AppError } from '../../../core/errors/AppError';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { DETAIL_KINDS, EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import { persistenceError } from '../../../application/errors';
import { tr } from '../../i18n/strings';
import { renovationMessage } from './renovationMessage';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { applyRenovationDraft, type RenovationDraft, type EditableRenovationDraft } from './renovationDraft';
import { plannedGeometryDraft, applyPlannedGeometry } from './plannedGeometry';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import DraftRecovery from '../forms/DraftRecovery.vue';
import ExistingFields from './ExistingFields.vue';
import WorkFields from './WorkFields.vue';
import DecisionFields from './DecisionFields.vue';
import PlannedFields from './PlannedFields.vue';

const props = defineProps<{ draft: RenovationDraft; baseline: RenovationBaseline; busy: Ref<boolean>; paused: Readonly<Ref<boolean>>; retry?: () => Promise<void>; openSource?: () => Promise<void>; dispatch: (input: RenovationInput) => Promise<DispatchResult> }>();
const emit = defineEmits<{ submit: [] }>();
const draft = ref<EditableRenovationDraft>(structuredClone(toRaw(props.draft)) as EditableRenovationDraft);
const geometry = ref(plannedGeometryDraft(props.baseline, props.draft.subject));
const value = props.baseline.plan.entity.renovation ?? EMPTY_RENOVATION;
const current = props.baseline.geometry.document.structure ?? EMPTY_STRUCTURE;
const structure = props.baseline.geometry.document.intended ?? current;
const submitting = ref(false);
useDialogFormBusy(submitting, props.busy);
const error = ref<AppError | null>(null), conflict = ref(false), reviewed = ref(false);
const frozen = computed(() => props.busy.value || conflict.value);
const submitBlocked = computed(() => frozen.value || props.paused.value);
let alive = true;
onBeforeUnmount(() => { alive = false; });
const targets = computed(() => [{ id: draft.value.subject.roomId, label: tr('renovation.room-target') },
	...(current.elements ?? []).map(item => ({ id: item.id, label: props.baseline.plan.entity.spatialElements?.find(metadata => metadata.id === item.id)?.name ?? item.id })),
	...current.walls.map((item, index) => ({ id: item.id, label: `${tr('renovation.geometry.wall')} ${index + 1}` })),
	...current.openings.map((item, index) => ({ id: item.id, label: `${tr('renovation.geometry.opening')} ${index + 1}` }))]);
function proposal() {
	const editing = draft.value;
	const planned = editing.subject.planned;
	if (planned?.change === 'remove') editing.subject = { ...editing.subject, planned: { change: 'remove', description: '' } };
	if (planned?.change === 'unchanged') editing.subject = { ...editing.subject, planned: { change: 'unchanged', description: editing.subject.existing?.description ?? '' } };
	const input = applyRenovationDraft(props.baseline, editing);
	return editing.kind === 'planned' ? applyPlannedGeometry(props.baseline, input, editing.subject, geometry.value) : { ok: true as const, value: input };
}
function accept(result: DispatchResult): void {
	if (result.ok) { emit('submit'); return; }
	error.value = result.error;
	conflict.value = WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code)) || result.error.code === 'undo.superseded';
}
async function submit(): Promise<void> {
	if (submitBlocked.value) return;
	const input = proposal();
	if (!input.ok) { error.value = input.error; return; }
	const valid = validateRenovationInput(input.value.renovation, { ...props.baseline.geometry.document, intended: input.value.intended });
	if (!valid.ok) { error.value = valid.error; return; }
	if (!reviewed.value) { reviewed.value = true; error.value = null; return; }
	submitting.value = true;
	try {
		const result = await props.dispatch(input.value);
		if (!alive) return;
		accept(result);
	} catch (cause) { if (alive) error.value = persistenceError('renovation.write-failed', 'The record could not be saved.', cause); }
	finally { submitting.value = false; }
}
function changed(): void { if (!frozen.value) reviewed.value = false; }
</script>
<template>
	<form
		class="rp-dialog-form rp-renovation-fields"
		data-rp-form="renovation"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
		@input="changed"
		@change="changed"
	>
		<DraftRecovery
			v-if="paused.value && retry && openSource"
			:retry="retry"
			:open-source="openSource"
		/>
		<p>{{ tr('renovation.manual') }}</p>
		<p
			v-if="error"
			role="alert"
		>
			{{ renovationMessage(error) }}
		</p>
		<template v-if="draft.kind === 'existing' || draft.kind === 'planned'">
			<label>{{ tr('renovation.kind') }}
				<select
					v-model="draft.subject.kind"
					:aria-disabled="frozen"
					@change.capture="restoreInoperativeChoice($event, draft.subject.kind)"
				>
					<option
						v-for="kind in DETAIL_KINDS"
						:key="kind"
						:value="kind"
					>{{ tr(`renovation.kind.${kind}`) }}</option>
				</select>
			</label>
			<ExistingFields
				v-if="draft.kind === 'existing'"
				:draft="draft"
				:value="value"
				:targets="targets"
				:frozen="frozen"
			/>
			<PlannedFields
				v-if="draft.kind === 'planned'"
				:draft="draft"
				:geometry="geometry"
				:structure="structure"
				:frozen="frozen"
			/>
		</template>
		<WorkFields
			v-if="draft.kind === 'work'"
			:draft="draft"
			:value="value"
			:frozen="frozen"
		/>
		<DecisionFields
			v-if="draft.kind === 'decision'"
			:draft="draft"
			:value="value"
			:frozen="frozen"
		/>
		<p
			v-if="reviewed"
			role="status"
		>
			{{ tr('renovation.impact') }}
		</p>
		<button
			type="submit"
			:aria-disabled="submitBlocked"
		>
			{{ tr(reviewed ? 'renovation.apply' : 'renovation.preview') }}
		</button>
	</form>
</template>
