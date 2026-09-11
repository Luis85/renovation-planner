<script setup lang="ts">
import RoomContextSelect from './RoomContextSelect.vue';
import { computed, ref } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import type { SpatialSelection } from '../selection/spatialSelection';
import { deleteItems, multiDeleteBlocked } from '../selection/deleteSelection';
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
/** Walls and openings are named; every other kind — rooms and each element kind, present or future — is not a wall. */
function targetKind(record: SpatialRecordDto): BatchTarget['kind'] {
	if (record.kind === 'wall') return 'wall';
	if (record.kind !== 'opening') return ['object', 'asset'].includes(record.kind) ? 'fixture' : 'other';
	const opening = project.structure.openings.find(item => item.id === record.id);
	return opening?.kind === 'door' ? 'door' : opening?.kind === 'window' ? 'window' : 'other';
}
const compatible = computed(() => targets.value.length === props.selection.ids.length && !props.selection.unavailable);
const changeCompatible = computed(() => compatible.value && props.selection.records.every(item => item.kind !== 'room' && item.kind !== 'area'));
const kinds = ['remove', 'modify', 'work', 'evidence'] as const;
const actions = computed(() => kinds.map(kind => ({ kind, disabled: runtime.renovation.blocked.value || !compatible.value || ((kind === 'remove' || kind === 'modify') && !changeCompatible.value) })));
const deleteBlocked = computed(() => multiDeleteBlocked(runtime) || props.selection.unavailable > 0);
function deleteSelection(): Promise<void> { return deleteItems(runtime, project.structure, props.selection.ids); }
</script>
<template>
	<section
		v-if="runtime.renovation.available"
		class="rp-batch-actions"
	>
		<h3>{{ tr('renovation.batch.heading') }}</h3>
		<RoomContextSelect
			v-if="!compatible"
			v-model="roomId"
			:rooms="rooms"
		/>
		<p v-if="!compatible">
			{{ tr('renovation.batch.unsupported') }}
		</p>
		<p v-else-if="!changeCompatible">
			{{ tr('renovation.batch.structure-only') }}
		</p>
		<div class="rp-renovation-actions">
			<button
				v-for="action in actions"
				:key="action.kind"
				type="button"
				class="rp-batch-action"
				:data-rp-batch="action.kind"
				:disabled="action.disabled"
				@click="runtime.renovation.batch(action.kind, targets)"
			>
				{{ tr(`renovation.batch.${action.kind}`) }}
			</button>
		</div>
		<details>
			<summary>{{ tr('editor.structure.more') }}</summary><button
				type="button"
				data-rp-batch="delete"
				:disabled="deleteBlocked"
				@click="deleteSelection"
			>
				{{ tr('renovation.batch.delete') }}
			</button>
		</details>
	</section>
</template>
