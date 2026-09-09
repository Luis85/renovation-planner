<script setup lang="ts">
import { formatMetres } from '../shell/formatLength';
import { wallLength } from '../../../domain/spatial/Structure';
import type { Wall, Opening } from '../../../domain/spatial/Structure';
import { useProjectStore } from '../../stores/ProjectStore';
import { tr } from '../../i18n/strings';
defineProps<{ wall?: Wall; opening?: Opening; rooms: readonly string[] }>();
const project = useProjectStore();
</script>
<template>
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
</template>
