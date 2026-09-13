<script setup lang="ts">
import { computed } from 'vue';
import type { Opening } from '../../../domain/spatial/Structure';
import { useProjectStore } from '../../stores/ProjectStore';
import { tr } from '../../i18n/strings';
import { formatMetres } from '../shell/formatLength';
import StructureMaterialFacts from './StructureMaterialFacts.vue';

const props = defineProps<{ opening: Opening; label: string; materials?: { existing?: string; planned?: string } | null }>();
const project = useProjectStore();
const host = computed(() => project.structure.walls.find(candidate => candidate.id === props.opening.hostId));
const rooms = computed(() => {
	const hostId = host.value?.id;
	return hostId ? project.structure.boundaries
		.filter(boundary => boundary.wallIds.includes(hostId))
		.map(boundary => project.zones.get(boundary.roomId)?.name ?? boundary.roomId) : [];
});
const hostLabel = computed(() => host.value
	? tr('editor.structure.wall-number', { n: String(project.structure.walls.findIndex(candidate => candidate.id === host.value?.id) + 1) })
	: props.opening.hostId);
</script>

<template>
	<h3 data-rp-opening-identity>
		{{ label }}
	</h3>
	<p
		class="rp-structure-opening-context"
		data-rp-opening-context
	>
		{{ rooms.length ? rooms.join(' / ') : tr('renovation.target.none') }}
	</p>
	<p
		v-if="project.plan?.name"
		class="rp-structure-opening-floor"
		data-rp-opening-floor
	>
		<span>{{ tr('editor.inspector.floor-context') }}:</span> {{ project.plan.name }}
	</p>
	<dl class="rp-editor-inspector-fields rp-structure-opening-facts">
		<dt>{{ tr('editor.structure.host') }}</dt>
		<dd data-rp-opening-property="host">{{ hostLabel }}</dd>
		<dt>{{ tr('renovation.target.room') }}</dt>
		<dd data-rp-opening-property="room-context">
			{{ rooms.length ? rooms.join(' / ') : tr('renovation.target.none') }}
		</dd>
		<template
			v-for="field in (['width', 'height', 'offset', 'sill'] as const)"
			:key="field"
		>
			<dt>{{ tr(`editor.structure.${field}`) }}</dt>
			<dd :data-rp-opening-property="field">{{ formatMetres(opening[field]) }} m</dd>
		</template>
		<StructureMaterialFacts
			kind="product"
			:materials="materials"
		/>
	</dl>
</template>
