<script setup lang="ts">
import { computed } from 'vue';
import { tr } from '../../i18n/strings';
import { CHANGES } from '../../../domain/renovation/Renovation';
import type { Structure } from '../../../domain/spatial/Structure';
import type { EditableRenovationDraft } from './renovationDraft';
import type { PlannedGeometryDraft } from './plannedGeometry';
import PlannedGeometryFields from './PlannedGeometryFields.vue';
const draft = defineModel<EditableRenovationDraft>('draft', { required: true });
const geometry = defineModel<PlannedGeometryDraft>('geometry', { required: true });
defineProps<{ structure: Structure; frozen: boolean }>();
const planned = computed(() => draft.value.subject.planned);
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
				:disabled="frozen"
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
		<PlannedGeometryFields
			v-model:draft="geometry"
			:addition="planned.change === 'add'"
			:structure="structure"
			:paused="frozen"
		/>
	</template>
</template>
