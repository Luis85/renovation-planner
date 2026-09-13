<script setup lang="ts">
import { formatMetres } from '../shell/formatLength';
import { wallLength } from '../../../domain/spatial/Structure';
import type { Wall } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';
import StructureMaterialFacts from './StructureMaterialFacts.vue';
defineProps<{ wall: Wall; rooms: readonly string[]; materials?: { existing?: string; planned?: string } | null }>();
</script>
<template>
	<dl class="rp-editor-inspector-fields">
		<dt>{{ tr('editor.structure.length') }}</dt><dd>{{ formatMetres(wallLength(wall)) }} m</dd>
		<dt>{{ tr('editor.structure.thickness') }}</dt><dd>{{ formatMetres(wall.thickness) }} m</dd>
		<dt>{{ tr('editor.structure.height') }}</dt><dd>{{ formatMetres(wall.height) }} m</dd>
		<dt>{{ tr('editor.structure.rooms') }}</dt><dd>{{ rooms.length ? rooms.join(', ') : tr('editor.structure.no-rooms') }}</dd>
		<StructureMaterialFacts
			kind="material"
			:materials="materials"
		/>
	</dl>
</template>
