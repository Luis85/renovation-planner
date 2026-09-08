<script setup lang="ts">
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { SpatialRecordDto } from '../../read-models/spatialRecords';
import OutlineEditAction from '../resize/OutlineEditAction.vue';
import AreaDetailsAction from '../metadata/AreaDetailsAction.vue';
import RoomSizeAction from '../resize/RoomSizeAction.vue';
import RenovationEntry from '../renovation/RenovationEntry.vue';
import RoomNameAction from '../naming/RoomNameAction.vue';
defineProps<{ zoneId: ZoneId; record?: SpatialRecordDto }>();
</script>
<template>
	<template v-if="record?.kind === 'room'">
		<RenovationEntry :room-id="zoneId" />
		<RoomNameAction :zone-id="zoneId" />
		<RoomSizeAction
			:zone-id="zoneId"
			:points="record.points"
		/>
	</template>
	<OutlineEditAction :zone-id="zoneId" />
	<AreaDetailsAction
		v-if="record?.kind === 'area'"
		:zone-id="zoneId"
	/>
</template>
