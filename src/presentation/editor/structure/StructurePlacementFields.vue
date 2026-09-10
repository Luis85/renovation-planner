<script setup lang="ts">
import { computed } from 'vue';
import OpeningSwingFields from './OpeningSwingFields.vue';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { tr } from '../../i18n/strings';
defineProps<{ describedBy?: string }>();
const task = useEditorRuntime().structureTask, draft = task.draft, project = useProjectStore();
const wall = computed(() => draft.kind === 'draw-wall');
const fields = computed(() => wall.value ? (draft.points.length ? ['length', 'angle'] as const : ['x', 'y'] as const) : ['offset', 'width', 'openingHeight', 'sill'] as const);
</script>
<template>
	<label
		v-if="!wall"
		class="rp-dialog-field"
	>{{ tr('editor.structure.host') }}
		<select
			v-model="draft.text.hostId"
			:aria-disabled="task.blocked.value"
			:disabled="task.blocked.value"
			@change="draft.error = null"
		>
			<option value="">{{ tr('editor.structure.choose-wall') }}</option>
			<option
				v-for="(host, index) in project.structure.walls"
				:key="host.id"
				:value="host.id"
			>{{ tr('editor.structure.wall-number', { n: String(index + 1) }) }}</option>
		</select>
	</label>
	<label
		v-for="field in fields"
		:key="field"
		class="rp-dialog-field"
	>{{ tr(`editor.structure.${field}`) }}
		<input
			v-model="draft.text[field]"
			:name="field"
			type="text"
			inputmode="decimal"
			:readonly="task.blocked.value"
			:aria-invalid="draft.error !== null"
			:aria-describedby="describedBy"
		>
	</label>
	<OpeningSwingFields
		v-if="!wall && draft.kind !== 'place-opening'"
		v-model="draft.swing"
		:disabled="task.blocked.value"
	/>
</template>
