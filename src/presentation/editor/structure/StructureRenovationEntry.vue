<script setup lang="ts">
import RoomContextSelect from '../renovation/RoomContextSelect.vue';
import { computed, watch } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession(), runtime = useEditorRuntime();
const rooms = computed(() => [...project.zones.values()].filter(item => item.zoneType === 'Room'));
watch(() => selection.selectedIds[0], id => {
	const remembered = session.targetId === id && rooms.value.some(room => room.id === session.roomId) ? session.roomId : '';
	session.targetId = id ?? '';
	const host = project.structure.openings.find(item => item.id === id)?.hostId ?? id;
	session.roomId = project.plan?.renovation?.subjects.find(item => item.targetId === id)?.roomId
		?? project.plan?.renovation?.work.find(item => item.targetId === id)?.roomId
		?? project.structure.boundaries.find(item => item.wallIds.includes(host))?.roomId ?? remembered;
}, { immediate: true });
</script>
<template>
	<section
		v-if="runtime.renovation.available"
		class="rp-structure-renovation-entry"
	>
		<RoomContextSelect
			v-model="session.roomId"
			:rooms="rooms"
			:disabled="runtime.renovation.blocked.value"
		/>
		<p v-if="!session.roomId">
			{{ tr('renovation.target.choose') }}
		</p>
		<button
			v-if="session.roomId && session.perspective === 'plan'"
			type="button"
			@click="runtime.renovation.focus(session.roomId, 'overview')"
		>
			{{ tr('renovation.overview') }}
		</button>
	</section>
</template>
