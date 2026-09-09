<script setup lang="ts">
import type { ZoneId } from '../../../domain/zone/ZoneId';
import RoomNameAction from '../naming/RoomNameAction.vue';
import OutlineEditAction from '../resize/OutlineEditAction.vue';
import { usePlanningContext } from '../planning/planningContext';
import PlanningInspector from '../planning/PlanningInspector.vue';
import { computed } from 'vue';
import { useRenovationSession } from './renovationSession';
import type { ZoneDto } from '../../read-models/PlanDto';
import { tr } from '../../i18n/strings';
import { formatArea } from '../shell/formatArea';
import { toSpatialRecordDto } from '../../read-models/spatialRecords';
import RenovationEntry from './RenovationEntry.vue';
import TransformationSummary from './TransformationSummary.vue';
import RenovationLinkedSummary from './RenovationLinkedSummary.vue';
import RoomRenovationRecords from './RoomRenovationRecords.vue';
const props = defineProps<{ room: ZoneDto }>();
const planning = usePlanningContext();
const session = useRenovationSession();
const overview = computed(() => session.mode === 'overview');
const structural = computed(() => ['existing', 'planned', 'work'].includes(session.mode));
const roomScoped = computed(() => !session.targetId || session.targetId === props.room.id);
const planningCommands = computed(() => planning.context.commands.planning);
</script>
<template>
	<p
		v-if="overview && roomScoped"
		class="rp-room-metadata"
	>
		{{ formatArea(toSpatialRecordDto(room).areaMm2) }} · {{ tr('renovation.calculated') }}
	</p>
	<TransformationSummary
		v-if="overview"
		:room-id="room.id"
		:target-id="session.targetId"
	/>
	<RenovationEntry
		:room-id="room.id"
	/>
	<template v-if="overview">
		<RenovationLinkedSummary
			v-if="planningCommands"
			:room-id="room.id"
			:target-id="session.targetId"
		/>
		<TransformationSummary
			:room-id="room.id"
			:target-id="session.targetId"
			continuation-only
		/>
	</template>
	<PlanningInspector v-else-if="!structural" />
	<RoomRenovationRecords
		v-else
		:room-id="room.id"
	/>
	<details
		v-if="roomScoped"
		class="rp-room-more-actions"
	>
		<summary>{{ tr('editor.structure.more') }}</summary>
		<p
			v-if="session.mode === 'existing'"
			class="rp-record-metadata"
		>
			{{ tr('renovation.manual') }}
		</p>
		<div class="rp-planning-actions">
			<RoomNameAction :zone-id="room.id as ZoneId" />
			<OutlineEditAction :zone-id="room.id as ZoneId" />
		</div>
	</details>
</template>
