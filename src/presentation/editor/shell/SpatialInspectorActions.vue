<script setup lang="ts">
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { SpatialRecordDto } from '../../read-models/spatialRecords';
import { watch } from 'vue';
import AreaDetailsAction from '../metadata/AreaDetailsAction.vue';
import RoomSizeAction from '../resize/RoomSizeAction.vue';
import ZoneOutlineAction from '../resize/ZoneOutlineAction.vue';
import RoomNameAction from '../naming/RoomNameAction.vue';
import { useRenovationSession } from '../renovation/renovationSession';
import { useProjectStore } from '../../stores/ProjectStore';
import { contextSource, defaultRenovationContext } from '../renovation/defaultRenovationContext';
const props = defineProps<{ zoneId: ZoneId; record?: SpatialRecordDto }>();
const session = useRenovationSession();
const project = useProjectStore();
/**
 * An Area selected directly is its own renovation context, the same as a Room's — but unlike
 * `StructureRenovationEntry`'s unconditional watcher for a wall, opening or element, a Room
 * selected here does NOT eagerly overwrite the session: Plan perspective deliberately keeps the
 * last-inspected target stale until `RenovationEntry`'s own navigation re-enters Renovate
 * (`renovationOverview.test.ts`, "uses the Room selected in Plan..."). Rooms never had that eager
 * sync before this file gave Areas the same panel, so only Areas gain it here. The context itself
 * goes through `defaultRenovationContext` (spec §4.1's one rule) rather than assuming a directly
 * selected Area's id always equals its own room context.
 */
watch(() => props.record?.kind === 'area' ? props.zoneId : null, id => {
	if (!id) return;
	const remembered = session.targetId === id ? session.roomId : '';
	session.targetId = id;
	session.roomId = defaultRenovationContext(contextSource(project), id, remembered);
}, { immediate: true });
</script>
<template>
	<template v-if="record?.kind === 'room'">
		<RoomNameAction :zone-id="zoneId" />
		<RoomSizeAction
			:zone-id="zoneId"
			:points="record.points"
		/>
	</template>
	<AreaDetailsAction
		v-if="record?.kind === 'area'"
		:zone-id="zoneId"
	/>
	<!--
		BP-04 slice B: typing a corner means the same thing for every zone type
		(`zoneOutlineAction.ts`'s `accepts: () => true`), so this is a sibling of both arms above
		rather than a member of either. The two kinds are stated rather than folded into a bare
		`v-if="record"`: `SpatialRecordDto.kind` carries seven values, and only these two are ever
		a zone.
	-->
	<ZoneOutlineAction
		v-if="record?.kind === 'room' || record?.kind === 'area'"
		:zone-id="zoneId"
	/>
</template>
