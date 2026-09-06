<script setup lang="ts">
import { computed, ref } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import type { SpatialSelection } from '../selection/spatialSelection';
import { tr } from '../../i18n/strings';
import type { BatchTarget } from './renovationBatch';
import type { SpatialRecordDto } from '../../read-models/spatialRecords';

const props = defineProps<{ selection: Extract<SpatialSelection, { kind: 'multiple' }> }>();
const project = useProjectStore(), runtime = useEditorRuntime(), roomId = ref('');
const rooms = computed(() => [...project.zones.values()].filter(item => item.zoneType === 'Room'));
const targets = computed(() => props.selection.records.flatMap(record => {
	const host = project.structure.openings.find(item => item.id === record.id)?.hostId ?? record.id;
	const owner = record.kind === 'room' ? record.id : project.plan?.renovation?.subjects.find(item => item.targetId === record.id)?.roomId
		?? project.structure.boundaries.find(item => item.wallIds.includes(host))?.roomId ?? roomId.value;
	if (!owner || record.kind === 'area') return [];
	return [{ roomId: owner, targetId: record.id, name: record.name, kind: targetKind(record) } satisfies BatchTarget];
}));
function targetKind(record: SpatialRecordDto): BatchTarget['kind'] {
	if (record.kind === 'room') return 'other';
	const opening = project.structure.openings.find(item => item.id === record.id);
	return opening?.kind === 'door' ? 'door' : opening?.kind === 'window' ? 'window' : opening ? 'other' : 'wall';
}
const compatible = computed(() => targets.value.length === props.selection.ids.length && !props.selection.unavailable);
const changeCompatible = computed(() => compatible.value && props.selection.records.every(item => item.kind === 'wall' || item.kind === 'opening'));
</script>
<template>
	<section
		v-if="runtime.renovation.available"
		class="rp-batch-actions"
	>
		<h3>{{ tr('renovation.batch.heading') }}</h3>
		<label v-if="!compatible">{{ tr('renovation.target.room') }}
			<select v-model="roomId"><option value="">{{ tr('renovation.select-room') }}</option><option
				v-for="room in rooms"
				:key="room.id"
				:value="room.id"
			>{{ room.name }}</option></select>
		</label>
		<p v-if="!compatible">
			{{ tr('renovation.batch.unsupported') }}
		</p>
		<p v-else-if="!changeCompatible">
			{{ tr('renovation.batch.structure-only') }}
		</p>
		<div class="rp-renovation-actions">
			<button
				v-for="kind in (['remove', 'modify', 'work', 'evidence'] as const)"
				:key="kind"
				type="button"
				:data-rp-batch="kind"
				:disabled="runtime.renovation.blocked.value || !compatible || ((kind === 'remove' || kind === 'modify') && !changeCompatible)"
				@click="runtime.renovation.batch(kind, targets)"
			>
				{{ tr(`renovation.batch.${kind}`) }}
			</button>
		</div>
		<details>
			<summary>{{ tr('editor.structure.more') }}</summary><button
				type="button"
				data-rp-batch="delete"
				:disabled="runtime.writesBlocked.value || runtime.structureActions.active.value || !selection.records.every(item => item.kind === 'wall' || item.kind === 'opening') || selection.unavailable > 0"
				@click="runtime.structureActions.remove(selection.ids)"
			>
				{{ tr('renovation.batch.delete') }}
			</button>
		</details>
	</section>
</template>
