<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useSelectionStore } from '../selection/selection-store';
import { tr } from '../../i18n/strings';
const project = useProjectStore(), runtime = useEditorRuntime(), selection = useSelectionStore();
const names = computed(() => new Map(project.plan?.spatialElements?.map(item => [item.id, item.name])));
const selected = computed(() => new Set<string>(selection.selectedIds));
const items = computed(() => (project.structure.elements ?? []).map(({ id }) => ({ id, name: names.value.get(id) ?? id })));
</script>
<template>
	<section
		v-if="items.length"
		class="rp-structure-list"
	>
		<h3>{{ tr('editor.element.list') }}</h3>
		<ul>
			<li
				v-for="item in items"
				:key="item.id"
			>
				<button
					type="button"
					class="rp-structure-list__row"
					:data-rp-id="item.id"
					:aria-pressed="selected.has(item.id)"
					@click="runtime.selectAndFrame(item.id, $event.shiftKey)"
				>
					{{ item.name }}
				</button>
			</li>
		</ul>
	</section>
</template>
