<script setup lang="ts">
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { SpatialRecordDto } from '../../read-models/spatialRecords';
import { watch } from 'vue';
import AreaDetailsAction from '../metadata/AreaDetailsAction.vue';
import RoomSizeAction from '../resize/RoomSizeAction.vue';
import RenovationEntry from '../renovation/RenovationEntry.vue';
import RoomNameAction from '../naming/RoomNameAction.vue';
import CurveAction from '../curves/CurveAction.vue';
import { useRenovationSession } from '../renovation/renovationSession';
const props = defineProps<{ zoneId: ZoneId; record?: SpatialRecordDto }>();
const session = useRenovationSession();
/**
 * An Area selected directly is its own renovation context, the same as a Room's — but unlike
 * `StructureRenovationEntry`'s unconditional watcher for a wall, opening or element, a Room
 * selected here does NOT eagerly overwrite the session: Plan perspective deliberately keeps the
 * last-inspected target stale until `RenovationEntry`'s own navigation re-enters Renovate
 * (`renovationOverview.test.ts`, "uses the Room selected in Plan..."). Rooms never had that eager
 * sync before this file gave Areas the same panel, so only Areas gain it here.
 */
watch(() => props.record?.kind === 'area' ? props.zoneId : null, id => {
	if (id) { session.targetId = id; session.roomId = id; }
}, { immediate: true });
</script>
<template>
	<template v-if="record?.kind === 'room'">
		<CurveAction :id="zoneId" />
		<RoomNameAction :zone-id="zoneId" />
		<RoomSizeAction
			:zone-id="zoneId"
			:points="record.points"
		/>
	</template>
	<RenovationEntry
		v-if="record?.kind === 'room' || record?.kind === 'area'"
		:room-id="zoneId"
	/>
	<AreaDetailsAction
		v-if="record?.kind === 'area'"
		:zone-id="zoneId"
	/>
</template>
