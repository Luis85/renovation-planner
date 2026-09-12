<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { hasDimensionTargets } from '../../../domain/spatial/structureDimensions';
import { tr } from '../../i18n/strings';
const props = defineProps<{ ids: readonly string[] }>();
const project = useProjectStore(), runtime = useEditorRuntime();
const offered = computed(() => hasDimensionTargets(project.structure, props.ids));
const paused = computed(() => runtime.writesBlocked.value || runtime.structureActions.active.value);
</script>
<template>
	<div
		v-if="offered"
		class="rp-inline-actions"
	>
		<button
			type="button"
			:aria-disabled="paused"
			data-rp-action="edit-dimensions"
			@click="runtime.structureActions.editMany(props.ids)"
		>
			{{ tr('editor.structure.bulk.edit') }}
		</button>
	</div>
</template>
