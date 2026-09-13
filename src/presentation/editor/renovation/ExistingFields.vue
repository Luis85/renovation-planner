<script setup lang="ts">
import { restoreInoperativeChoice } from '../forms/inoperativeControl';
import { computed } from 'vue';
import { tr } from '../../i18n/strings';
import { CONDITIONS, type Renovation } from '../../../domain/renovation/Renovation';
import type { EditableRenovationDraft } from './renovationDraft';
import type { Structure } from '../../../domain/spatial/Structure';
import { applyMaterial, materialChoices, takesMaterial, type MaterialChoice } from './materialChoices';
import MaterialSelect from './MaterialSelect.vue';
const draft = defineModel<EditableRenovationDraft>('draft', { required: true });
const props = defineProps<{ value: Renovation; targets: readonly { id: string; label: string }[]; structure: Structure; frozen: boolean; catalogue: readonly MaterialChoice[] }>();
const choices = computed(() => materialChoices(props.catalogue, draft.value.subject.kind));
const material = computed({
	get: () => draft.value.subject.existing?.assetId ?? '',
	set: (id: string) => { if (draft.value.subject.existing) applyMaterial(draft.value.subject.existing, id, props.catalogue); },
});
</script>
<template>
	<label v-if="!value.subjects.some(item => item.id === draft.subject.id)">{{ tr('renovation.target') }}
		<select
			v-model="draft.subject.targetId"
			:aria-disabled="frozen"
			@change.capture="restoreInoperativeChoice($event, draft.subject.targetId)"
		>
			<option
				v-for="target in targets"
				:key="target.id"
				:value="target.id"
			>{{ target.label }}</option>
		</select>
	</label>
	<template v-if="draft.subject.existing">
		<label>{{ tr('renovation.description') }}<textarea
			v-model="draft.subject.existing.description"
			name="description"
			:readonly="frozen"
		/></label>
		<label>{{ tr('renovation.condition') }}
			<select
				v-model="draft.subject.existing.condition"
				:aria-disabled="frozen"
				@change.capture="restoreInoperativeChoice($event, draft.subject.existing.condition)"
			>
				<option
					v-for="condition in CONDITIONS"
					:key="condition"
					:value="condition"
				>{{ tr(`renovation.condition.${condition}`) }}</option>
			</select>
		</label>
		<MaterialSelect
			v-if="takesMaterial(draft.subject, structure)"
			v-model="material"
			:kind="draft.subject.kind"
			:choices="choices"
			:frozen="frozen"
		/>
	</template>
</template>
