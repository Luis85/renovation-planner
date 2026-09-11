<script setup lang="ts">
import { refuseInoperativeEvent } from '../forms/inoperativeControl';
import { computed, onBeforeUnmount, ref, toRaw, type Ref } from 'vue';
import type { EvidenceFiles } from '../../../application/ports/EvidenceFiles';
import { prepareMaterial, type PlanningBaseline, type MaterialInput } from '../../../application/commands/renovation/PlanningServices';
import { validateDepthLinks } from '../../../application/commands/renovation/planningLinks';
import { validateRenovationInput, type RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { tr } from '../../i18n/strings';
import { planningInput, materialInput, type PlanningDraft } from './planningDraft';
import { renovationMessage } from '../renovation/renovationMessage';
import { formatPlanningNumber, formatPlanningMoney } from '../../i18n/planningFormat';
import { of } from '../../../core/money/Money';
import DraftRecovery from '../forms/DraftRecovery.vue';
import MaterialFields from './MaterialFields.vue';
import CostFields from './CostFields.vue';
import EvidenceFields from './EvidenceFields.vue';
import PlanningContextFields from './PlanningContextFields.vue';
const props = defineProps<{ draft: PlanningDraft; baseline: PlanningBaseline; busy: Ref<boolean>; paused: Readonly<Ref<boolean>>; files?: EvidenceFiles; retry?: () => Promise<void>; openSource?: () => Promise<void>; dispatch: (input: MaterialInput | RenovationInput) => Promise<DispatchResult> }>();
const emit = defineEmits<{ submit: [] }>();
const draft = ref(structuredClone(toRaw(props.draft))), submitting = ref(false), error = ref(''), preview = ref('');
useDialogFormBusy(submitting, props.busy);
const filesWorking = ref(false);
const photo = computed(() => draft.value.kind === 'evidence' && draft.value.type === 'photo');
const newPhoto = computed(() => photo.value && !props.baseline.plan.entity.renovation?.depth?.evidence.some(item => item.id === draft.value.id));
const frozen = computed(() => props.busy.value);
const applyBlocked = computed(() => frozen.value || props.paused.value || filesWorking.value);
let alive = true;
onBeforeUnmount(() => { alive = false; });

function input(): MaterialInput | RenovationInput | null {
	if (draft.value.kind === 'material') {
		const next = materialInput(draft.value), result = prepareMaterial(props.baseline, next);
		if (!result.ok) return null;
		preview.value = `${formatPlanningNumber(result.value.quantity.calculated.value)} ${result.value.unit} · ${formatPlanningMoney(of(result.value.estimatedCost.calculated.amount, props.baseline.currency))}`;
		return next;
	}
	if (draft.value.kind === 'evidence') {
		const file = props.files?.resolve(draft.value.path + draft.value.subpath, props.baseline.plan.entity.id);
		if (!file?.ok) return null;
		if (draft.value.type === 'photo' && file.value.image === null) { error.value = tr('planning.photo.image-required'); return null; }
		draft.value.path = file.value.path; draft.value.subpath = file.value.subpath;
	}
	const next = planningInput(draft.value, props.baseline);
	// `planningInput` always sets a real renovation (it edits Materials/Cost/Evidence, spread from
	// the floor's own record), so the fallback here only keeps `validateDepthLinks`'s required
	// `Renovation` parameter honest against `RenovationInput.renovation`'s wider type.
	if (!validateRenovationInput(next.renovation, props.baseline.geometry.document).ok || !validateDepthLinks(next.renovation ?? EMPTY_RENOVATION, props.baseline).ok) return null;
	return next;
}
async function submit(): Promise<void> {
	if (applyBlocked.value) return;
	error.value = '';
	try {
		const next = input();
		if (!next) { error.value ||= tr('planning.invalid'); return; }
		submitting.value = true;
		const result = await props.dispatch(next);
		if (!alive) return;
		if (result.ok) emit('submit'); else error.value = renovationMessage(result.error);
	} catch { if (alive) error.value = tr(submitting.value ? 'planning.write-failed' : 'planning.invalid'); }
	finally { submitting.value = false; }
}
function explain(): void { try { if (!input()) error.value = tr('planning.invalid'); } catch { error.value = tr('planning.invalid'); } }
</script>
<template>
	<form
		class="rp-dialog-form rp-renovation-fields"
		data-rp-form="planning"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<DraftRecovery
			v-if="paused.value && retry && openSource"
			:retry="retry"
			:open-source="openSource"
		/>
		<p v-if="draft.kind !== 'evidence'">
			{{ tr('planning.decimal-input') }}
		</p>
		<p
			v-if="error"
			role="alert"
		>
			{{ error }}
		</p>
		<label v-if="draft.kind === 'cost' || (draft.kind === 'evidence' && !photo)">{{ tr('planning.description') }}<input
			v-model="draft.title"
			:readonly="frozen"
			name="title"
		></label>
		<PlanningContextFields
			v-if="!photo"
			:draft="draft"
			:baseline="baseline"
			:frozen="frozen"
		/>
		<MaterialFields
			v-if="draft.kind === 'material'"
			:draft="draft"
			:baseline="baseline"
			:paused="frozen"
		/>
		<template v-else-if="draft.kind === 'procurement'">
			<label>{{ tr('planning.purchased') }}<input
				v-model="draft.purchased"
				:readonly="frozen"
				name="purchased"
				inputmode="decimal"
			></label>
			<label>{{ tr('planning.reserved') }}<input
				v-model="draft.reserved"
				:readonly="frozen"
				name="reserved"
				inputmode="decimal"
			></label>
			<p>{{ tr('planning.procurement-policy') }}</p>
		</template>
		<CostFields
			v-else-if="draft.kind === 'cost'"
			:draft="draft"
			:baseline="baseline"
			:paused="frozen"
		/>
		<EvidenceFields
			v-else
			:draft="draft"
			:baseline="baseline"
			:paused="frozen"
			:files="files"
			:write-blocked="applyBlocked"
			@busy="filesWorking = $event"
		>
			<template #context>
				<PlanningContextFields
					:draft="draft"
					:baseline="baseline"
					:frozen="frozen || filesWorking"
				/>
			</template>
		</EvidenceFields>
		<template v-if="draft.kind === 'material'">
			<button
				type="button"
				:aria-disabled="frozen"
				@click.capture="refuseInoperativeEvent"
				@click="explain"
			>
				{{ tr('planning.explain') }}
			</button><p role="status">
				{{ preview }}
			</p>
		</template>
		<button
			type="submit"
			:aria-disabled="applyBlocked"
			data-rp-planning-apply
			:class="{ 'mod-cta': newPhoto }"
			@click.capture="refuseInoperativeEvent"
		>
			{{ tr(newPhoto ? 'planning.add.photo' : 'planning.apply') }}
		</button>
	</form>
</template>
