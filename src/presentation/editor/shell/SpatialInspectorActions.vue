<script setup lang="ts">
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { SpatialRecordDto } from '../../read-models/spatialRecords';
import AreaDetailsAction from '../metadata/AreaDetailsAction.vue';
import RoomSizeAction from '../resize/RoomSizeAction.vue';
import RenovationEntry from '../renovation/RenovationEntry.vue';
import RoomNameAction from '../naming/RoomNameAction.vue';
import CurveAction from '../curves/CurveAction.vue';
defineProps<{ zoneId: ZoneId; record?: SpatialRecordDto }>();
</script>
<template>
	<template v-if="record?.kind === 'room'">
		<CurveAction :id="zoneId" />
		<RenovationEntry :room-id="zoneId" />
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
</template>
