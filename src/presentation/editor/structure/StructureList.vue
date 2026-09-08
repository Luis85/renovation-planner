<script setup lang="ts">
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useSelectionStore } from '../selection/selection-store';
import { tr } from '../../i18n/strings';
const project = useProjectStore(), runtime = useEditorRuntime(), selection = useSelectionStore();
</script>
<template>
	<section
		v-if="project.structure.walls.length"
		class="rp-structure-list"
	>
		<h3>{{ tr('editor.structure.list') }}</h3>
		<ul>
			<li
				v-for="(wall, index) in project.structure.walls"
				:key="wall.id"
			>
				<button
					type="button"
					:aria-pressed="selection.selectedIds.some(id => id === wall.id)"
					@click="runtime.selectAndFrame(wall.id, $event.shiftKey)"
				>
					{{ tr('editor.structure.wall-number', { n: String(index + 1) }) }}
				</button>
				<ul v-if="project.structure.openings.some(opening => opening.hostId === wall.id)">
					<li
						v-for="(opening, openingIndex) in project.structure.openings.filter(opening => opening.hostId === wall.id)"
						:key="opening.id"
					>
						<button
							type="button"
							:aria-pressed="selection.selectedIds.some(id => id === opening.id)"
							@click="runtime.selectAndFrame(opening.id, $event.shiftKey)"
						>
							{{ tr(`editor.add.${opening.kind}.label`) }} {{ openingIndex + 1 }}
						</button>
					</li>
				</ul>
			</li>
		</ul>
	</section>
</template>
