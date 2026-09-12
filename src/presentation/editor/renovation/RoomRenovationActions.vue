<script setup lang="ts">
import type { ZoneId } from '../../../domain/zone/ZoneId';
import RoomNameAction from '../naming/RoomNameAction.vue';
import ObjectRotationControls from '../elements/ObjectRotationControls.vue';
import type { ZoneDto } from '../../read-models/PlanDto';
import { useRenovationSession } from './renovationSession';
import { tr } from '../../i18n/strings';
defineProps<{ room: ZoneDto }>();
const session = useRenovationSession();
</script>
<template>
	<details
		v-if="!session.targetId || session.targetId === room.id"
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
		</div>
		<ObjectRotationControls :id="room.id" />
	</details>
</template>
