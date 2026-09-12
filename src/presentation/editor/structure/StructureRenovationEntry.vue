<script setup lang="ts">
import RoomContextSelect from '../renovation/RoomContextSelect.vue';
import { computed, watch } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { contextSource, defaultRenovationContext } from '../renovation/defaultRenovationContext';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession(), runtime = useEditorRuntime();
const zones = computed(() => [...project.zones.values()].map(item => ({ id: item.id, name: item.name, zoneType: item.zoneType })));
watch(() => selection.selectedIds[0], id => {
	const target = id ?? '', remembered = session.targetId === target ? session.roomId : '';
	session.targetId = target;
	session.roomId = defaultRenovationContext(contextSource(project), target, remembered);
}, { immediate: true });
</script>
<template>
	<section
		v-if="runtime.renovation.available"
		class="rp-structure-renovation-entry"
	>
		<RoomContextSelect
			v-model="session.roomId"
			:rooms="zones"
			:disabled="runtime.renovation.blocked.value"
		/>
		<button
			v-if="session.perspective === 'plan'"
			type="button"
			@click="runtime.renovation.focus(session.roomId, 'overview')"
		>
			{{ tr('renovation.overview') }}
		</button>
	</section>
</template>
