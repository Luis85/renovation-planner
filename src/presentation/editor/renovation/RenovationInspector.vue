<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from './renovationSession';
import { tr } from '../../i18n/strings';
import { contextSource, defaultRenovationContext } from './defaultRenovationContext';
import RenovationDetails from './RenovationDetails.vue';
import ReviewInspector from './ReviewInspector.vue';
import FloorInspector from '../shell/FloorInspector.vue';
import StructureInspector from '../structure/StructureInspector.vue';
import ElementInspector from '../elements/ElementInspector.vue';
import ObjectRotationControls from '../elements/ObjectRotationControls.vue';

const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession();
watch(() => selection.selectedIds, ids => {
	const target = ids[0] ?? '', remembered = session.targetId === target ? session.roomId : '';
	session.targetId = target;
	session.roomId = defaultRenovationContext(contextSource(project), target, remembered);
}, { immediate: true });
const room = computed(() => project.zones.get(session.roomId));
const selectedZone = computed(() => project.zones.get(selection.selectedIds[0]));
const element = computed(() => project.structure.walls.some(item => item.id === session.targetId) || project.structure.openings.some(item => item.id === session.targetId));
const generic = computed(() => project.structure.elements?.some(item => item.id === session.targetId));
const selectedElement = computed(() => project.structure.elements?.find(item => item.id === session.targetId));
const selectedWall = computed(() => project.structure.walls.find(item => item.id === session.targetId));
const selectedOpening = computed(() => project.structure.openings.find(item => item.id === session.targetId));
const headingVisible = computed(() => session.mode === 'overview' || !room.value);
function heading(): string {
	if (selectedElement.value) return project.plan?.spatialElements?.find(item => item.id === selectedElement.value?.id)?.name ?? selectedElement.value.id;
	if (selectedWall.value) return tr('editor.add.wall.label');
	if (selectedOpening.value) return tr(`editor.add.${selectedOpening.value.kind}.label`);
	return selectedZone.value?.name || room.value?.name || tr('renovation.select-room');
}
const standaloneZone = computed(() => selectedZone.value?.zoneType !== 'Room' ? selectedZone.value : undefined);
/**
 * The frame's group controls arrive through the `actions` slot. A wall, opening or element body
 * takes them above its own Delete, so Delete stays the foot of the Inspector region (side panels
 * spec §3); every other state draws them as this component's last node, where they trailed before.
 * `review` is excluded because `ReviewInspector` replaces both bodies there, so the trailing mount is
 * then the only one; `EntityInspector`, this component's one caller, passes no slot in Review anyway.
 */
const bodyTakesActions = computed(() => session.perspective === 'plan' && selection.selectedIds.length > 0 && (generic.value === true || element.value));
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
		:class="{ 'rp-renovation-inspector--focused': session.perspective === 'renovate' }"
	>
		<ElementInspector v-if="generic && session.perspective === 'plan'">
			<template #actions>
				<slot name="actions" />
			</template>
		</ElementInspector>
		<StructureInspector v-else-if="element && session.perspective === 'plan'">
			<template #actions>
				<slot name="actions" />
			</template>
		</StructureInspector>
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
	<slot
		v-if="!bodyTakesActions"
		name="actions"
	/>
</template>
