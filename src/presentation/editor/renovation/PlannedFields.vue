<script setup lang="ts">
import { restoreInoperativeChoice } from '../forms/inoperativeControl';
import { computed } from 'vue';
import { tr } from '../../i18n/strings';
import { CHANGES } from '../../../domain/renovation/Renovation';
import { constructionRule } from '../../../domain/requirement/constructionRule';
import type { Structure } from '../../../domain/spatial/Structure';
import type { EditableRenovationDraft } from './renovationDraft';
import type { PlannedGeometryDraft } from './plannedGeometry';
import PlannedGeometryFields from './PlannedGeometryFields.vue';
import { applyMaterial, materialChoices, type MaterialChoice } from './materialChoices';
const draft = defineModel<EditableRenovationDraft>('draft', { required: true });
const geometry = defineModel<PlannedGeometryDraft>('geometry', { required: true });
const props = defineProps<{ structure: Structure; frozen: boolean; catalogue: readonly MaterialChoice[] }>();
const planned = computed(() => draft.value.subject.planned);
const choices = computed(() => materialChoices(props.catalogue, draft.value.subject.kind));
const material = computed({
	get: () => planned.value?.assetId ?? '',
	set: (id: string) => { if (planned.value) applyMaterial(planned.value, id, props.catalogue); },
});
const unmeasured = computed(() => {
	const unit = props.catalogue.find(item => item.id === planned.value?.assetId)?.unit;
	const target = draft.value.subject.kind === 'wall' ? 'wall' : 'opening';
	return unit && !constructionRule(target, unit) ? unit : '';
});
</script>
<template>
	<template v-if="planned">
		<p v-if="draft.subject.existing">
			{{ tr('renovation.source') }}: {{ draft.subject.existing.description }}
		</p>
		<label>{{ tr('renovation.classification') }}
			<select
				v-model="planned.change"
				name="classification"
				:aria-disabled="frozen"
				@change.capture="restoreInoperativeChoice($event, planned.change)"
			>
				<option
					v-for="change in CHANGES.filter(item => (item === 'add') === !draft.subject.existing)"
					:key="change"
					:value="change"
				>{{ tr(`renovation.change.${change}`) }}</option>
			</select>
		</label>
		<label v-if="planned.change === 'modify' || planned.change === 'add'">{{ tr('renovation.description') }}<textarea
			v-model="planned.description"
			name="description"
			:readonly="frozen"
		/></label>
		<label v-if="(planned.change === 'modify' || planned.change === 'add') && ['wall', 'door', 'window'].includes(draft.subject.kind)">{{ tr(draft.subject.kind === 'wall' ? 'renovation.material' : 'renovation.product') }}
			<select
				v-model="material"
				name="material"
				:aria-disabled="frozen"
				@change.capture="restoreInoperativeChoice($event, material)"
			>
				<option value="">{{ tr('renovation.material.none') }}</option>
				<option
					v-for="item in choices"
					:key="item.id"
					:value="item.id"
				>{{ item.name }}</option>
			</select>
		</label>
		<p v-if="unmeasured">
			{{ tr('renovation.material.no-quantity', { unit: unmeasured }) }}
		</p>
		<PlannedGeometryFields
			:draft="geometry"
			:addition="planned.change === 'add'"
			:structure="structure"
			:paused="frozen"
		/>
	</template>
</template>
