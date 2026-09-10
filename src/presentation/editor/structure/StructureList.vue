<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useSelectionStore } from '../selection/selection-store';
import ElementList from '../elements/ElementList.vue';
import { tr } from '../../i18n/strings';
const project = useProjectStore(), runtime = useEditorRuntime(), selection = useSelectionStore();
const selected = computed(() => new Set<string>(selection.selectedIds));
const walls = computed(() => project.structure.walls.map((wall, index) => ({
	id: wall.id, name: tr('editor.structure.wall-number', { n: String(index + 1) }), selected: selected.value.has(wall.id),
	openings: project.structure.openings.filter(opening => opening.hostId === wall.id).map((opening, n) => ({
		id: opening.id, name: `${tr(`editor.add.${opening.kind}.label`)} ${n + 1}`, selected: selected.value.has(opening.id),
	})),
})));
</script>
<template>
	<ElementList />
	<section
		v-if="walls.length"
		class="rp-structure-list"
	>
		<h3>{{ tr('editor.structure.list') }}</h3>
		<ul>
			<li
				v-for="wall in walls"
				:key="wall.id"
			>
				<button
					type="button"
					class="rp-structure-list__row"
					:aria-pressed="wall.selected"
					:data-rp-id="wall.id"
					@click="runtime.selectAndFrame(wall.id, $event.shiftKey)"
				>
					{{ wall.name }}
				</button>
				<ul v-if="wall.openings.length">
					<li
						v-for="opening in wall.openings"
						:key="opening.id"
					>
						<button
							type="button"
							class="rp-structure-list__row"
							:aria-pressed="opening.selected"
							:data-rp-id="opening.id"
							@click="runtime.selectAndFrame(opening.id, $event.shiftKey)"
						>
							{{ opening.name }}
						</button>
					</li>
				</ul>
			</li>
		</ul>
	</section>
</template>
