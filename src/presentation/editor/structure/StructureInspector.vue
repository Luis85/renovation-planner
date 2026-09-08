<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { formatMetres } from '../shell/formatLength';
import { wallLength } from '../../../domain/spatial/Structure';
import StructureRenovationEntry from './StructureRenovationEntry.vue';
const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime();
const id = computed(() => String(selection.selectedIds[0]));
const wall = computed(() => project.structure.walls.find(candidate => candidate.id === id.value));
const opening = computed(() => project.structure.openings.find(candidate => candidate.id === id.value));
const paused = computed(() => runtime.writesBlocked.value || runtime.structureActions.active.value);
const rooms = computed(() => project.structure.boundaries.filter(boundary => boundary.wallIds.includes(id.value)).map(boundary => project.zones.get(boundary.roomId)?.name ?? boundary.roomId));
async function act(event: Event, remove: boolean): Promise<void> {
	const opener = event.currentTarget as HTMLElement;
	const root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await (remove ? runtime.structureActions.remove(id.value) : runtime.structureActions.edit(id.value));
	await nextTick();
	if (opener.isConnected || !root?.isConnected) return;
	const target = root.querySelector<HTMLElement>('[data-rp-action="edit-structure"], [data-rp-rail="details"]') ?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]');
	target?.focus();
}
</script>
<template>
	<section
		v-if="wall || opening"
		class="rp-structure-inspector"
	>
		<h3>{{ tr(wall ? 'editor.add.wall.label' : `editor.add.${opening!.kind}.label`) }}</h3>
		<dl class="rp-editor-inspector-fields">
			<template v-if="wall">
				<dt>{{ tr('editor.structure.length') }}</dt><dd>{{ formatMetres(wallLength(wall)) }} m</dd>
				<dt>{{ tr('editor.structure.thickness') }}</dt><dd>{{ formatMetres(wall.thickness) }} m</dd>
				<dt>{{ tr('editor.structure.height') }}</dt><dd>{{ formatMetres(wall.height) }} m</dd>
				<dt>{{ tr('editor.structure.rooms') }}</dt><dd>{{ rooms.length ? rooms.join(', ') : tr('editor.structure.no-rooms') }}</dd>
			</template>
			<template v-else-if="opening">
				<dt>{{ tr('editor.structure.host') }}</dt><dd>{{ tr('editor.structure.wall-number', { n: String(project.structure.walls.findIndex(wall => wall.id === opening!.hostId) + 1) }) }}</dd>
				<template
					v-for="field in (['offset', 'width', 'height', 'sill'] as const)"
					:key="field"
				>
					<dt>{{ tr(`editor.structure.${field}`) }}</dt><dd>{{ formatMetres(opening[field]) }} m</dd>
				</template>
			</template>
		</dl>
		<StructureRenovationEntry />
		<button
			type="button"
			:aria-disabled="paused"
			data-rp-action="edit-structure"
			@click="act($event, false)"
		>
			{{ tr('editor.structure.edit') }}
		</button>
		<details>
			<summary>{{ tr('editor.structure.more') }}</summary><button
				type="button"
				:aria-disabled="paused"
				@click="act($event, true)"
			>
				{{ tr('editor.structure.delete') }}
			</button>
		</details>
	</section>
</template>
