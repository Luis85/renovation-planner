<script setup lang="ts">
import { computed } from 'vue';
import { tr } from '../../i18n/strings';
const props = defineProps<{ rooms: readonly { id: string; name: string; zoneType: string }[]; disabled?: boolean; required?: boolean }>();
const roomId = defineModel<string>({ required: true });
const groups = computed(() => [
	{ key: 'rooms', label: tr('renovation.target.rooms'), items: props.rooms.filter(item => item.zoneType === 'Room') },
	{ key: 'areas', label: tr('renovation.target.areas'), items: props.rooms.filter(item => item.zoneType !== 'Room') },
].filter(group => group.items.length));
</script>
<template>
	<label>{{ tr('renovation.target.room') }}
		<select
			v-model="roomId"
			:disabled="disabled"
		>
			<option value="">{{ tr(required ? 'renovation.select-room' : 'renovation.target.none') }}</option>
			<optgroup
				v-for="group in groups"
				:key="group.key"
				:label="group.label"
			>
				<option
					v-for="room in group.items"
					:key="room.id"
					:value="room.id"
				>{{ room.name }}</option>
			</optgroup>
		</select>
	</label>
</template>
