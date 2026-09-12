<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from './renovationSession';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { tr } from '../../i18n/strings';
import { defaultRenovationContext } from './defaultRenovationContext';
import RenovationDetails from './RenovationDetails.vue';
import ReviewInspector from './ReviewInspector.vue';
import FloorInspector from '../shell/FloorInspector.vue';
import StructureInspector from '../structure/StructureInspector.vue';
import ElementInspector from '../elements/ElementInspector.vue';
import ObjectRotationControls from '../elements/ObjectRotationControls.vue';

const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession();
const value = computed(() => project.plan?.renovation ?? EMPTY_RENOVATION);
watch(() => selection.selectedIds, ids => {
	const target = ids[0] ?? '', remembered = session.targetId === target ? session.roomId : '';
	session.targetId = target;
	session.roomId = defaultRenovationContext({ zoneIds: new Set(project.zones.keys()), structure: project.structure, renovation: value.value }, target, remembered);
}, { immediate: true });
const room = computed(() => project.zones.get(session.roomId));
const selectedZone = computed(() => project.zones.get(selection.selectedIds[0]));
const element = computed(() => project.structure.walls.some(item => item.id === session.targetId) || project.structure.openings.some(item => item.id === session.targetId));
const generic = computed(() => project.structure.elements?.some(item => item.id === session.targetId));
const headingVisible = computed(() => session.mode === 'overview' || !room.value);
function heading(): string { return selectedZone.value?.name || room.value?.name || tr('renovation.select-room'); }
const standaloneZone = computed(() => selectedZone.value?.zoneType !== 'Room' ? selectedZone.value : undefined);
const root = ref<HTMLElement | null>(null);
watch(() => [session.focusedId, session.mode], async () => {
	if (!session.focusedId) return;
	await nextTick();
	const row = [...root.value?.querySelectorAll<HTMLElement>('[data-rp-record]') ?? []].find(item => item.dataset.rpRecord === session.focusedId)
		?? root.value?.querySelector<HTMLElement>('[data-rp-record].is-selected');
	const group = row?.closest('details');
	if (group) group.open = true;
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
		<h3 v-else-if="headingVisible">
			{{ heading() }}
		</h3>
		<details
			v-if="standaloneZone"
			class="rp-room-more-actions"
		>
			<summary>{{ tr('editor.structure.more') }}</summary>
			<ObjectRotationControls :id="standaloneZone.id" />
		</details>
		<RenovationDetails
			v-if="room || element || generic"
			:room="room"
		/>
	</div>
</template>
