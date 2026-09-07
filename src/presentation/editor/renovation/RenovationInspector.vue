<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from './renovationSession';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { tr } from '../../i18n/strings';
import RoomRenovationDetails from './RoomRenovationDetails.vue';
import ReviewInspector from './ReviewInspector.vue';
import FloorInspector from '../shell/FloorInspector.vue';
import StructureInspector from '../structure/StructureInspector.vue';
import ElementInspector from '../elements/ElementInspector.vue';

const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession();
const value = computed(() => project.plan?.renovation ?? EMPTY_RENOVATION);
watch(() => selection.selectedIds, ids => {
	const remembered = session.targetId === ids[0] ? session.roomId : '';
	session.targetId = ids[0] ?? '';
	const room = project.zones.get(ids[0]);
	if (room?.zoneType === 'Room') session.roomId = room.id;
	else {
		const target = ids[0], host = project.structure.openings.find(item => item.id === target)?.hostId ?? target;
		session.roomId = value.value.subjects.find(item => item.targetId === target)?.roomId
			?? project.structure.boundaries.find(item => item.wallIds.includes(host))?.roomId ?? remembered;
	}
}, { immediate: true });
const room = computed(() => project.zones.get(session.roomId));
const element = computed(() => project.structure.walls.some(item => item.id === session.targetId) || project.structure.openings.some(item => item.id === session.targetId));
const generic = computed(() => project.structure.elements?.some(item => item.id === session.targetId));
const root = ref<HTMLElement | null>(null);
watch(() => [session.focusedId, session.mode], () => {
	if (!session.focusedId) return;
	const row = [...root.value?.querySelectorAll<HTMLElement>('[data-rp-record]') ?? []].find(item => item.dataset.rpRecord === session.focusedId);
	row?.querySelector('button')?.focus();
}, { flush: 'post' });


</script>
<template>
	<ReviewInspector v-if="session.perspective === 'review'" />
	<FloorInspector v-else-if="selection.selectedIds.length === 0" />
	<div
		v-else
		ref="root"
		class="rp-renovation-inspector"
	>
		<ElementInspector v-if="generic" />
		<StructureInspector v-else-if="element" />
		<h3 v-else>
			{{ room?.name || tr('renovation.select-room') }}
		</h3>
		<RoomRenovationDetails
			v-if="room"
			:room="room"
		/>
	</div>
</template>
