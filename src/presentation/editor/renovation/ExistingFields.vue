<script setup lang="ts">
import { tr } from '../../i18n/strings';
import { CONDITIONS, type Renovation } from '../../../domain/renovation/Renovation';
import type { EditableRenovationDraft } from './renovationDraft';
const draft = defineModel<EditableRenovationDraft>('draft', { required: true });
defineProps<{ value: Renovation; targets: readonly { id: string; label: string }[]; frozen: boolean }>();
</script>
<template>
	<label v-if="!value.subjects.some(item => item.id === draft.subject.id)">{{ tr('renovation.target') }}
		<select
			v-model="draft.subject.targetId"
			:disabled="frozen"
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
				:disabled="frozen"
			>
				<option
					v-for="condition in CONDITIONS"
					:key="condition"
					:value="condition"
				>{{ tr(`renovation.condition.${condition}`) }}</option>
			</select>
		</label>
	</template>
</template>
