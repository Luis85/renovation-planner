<script setup lang="ts">
import { tr } from '../../i18n/strings';
defineProps<{ rooms: readonly { id: string; name: string }[]; disabled?: boolean }>();
const roomId = defineModel<string>({ required: true });
</script>
<template>
	<label>{{ tr('renovation.target.room') }}
		<select
			v-model="roomId"
			:disabled="disabled"
		>
			<option value="">{{ tr('renovation.select-room') }}</option>
			<option
				v-for="room in rooms"
				:key="room.id"
				:value="room.id"
			>{{ room.name }}</option>
		</select>
	</label>
</template>
