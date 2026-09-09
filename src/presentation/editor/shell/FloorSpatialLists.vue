<script setup lang="ts">
import type { FloorSummaryDto } from '../../read-models/spatialRecords';
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import RoomSummaryList from './RoomSummaryList.vue';
defineProps<{ summary: FloorSummaryDto; starting: boolean; roomAnnotations: ReadonlyMap<string, string> }>();
const runtime = useEditorRuntime();
</script>
<template>
	<p
		v-if="summary.rooms.length > 0 && runtime.activeToolId.value === 'select'"
		class="rp-floor-inspector__guidance"
	>
		<HostIcon name="info" /><span>{{ tr('editor.inspector.floor.guidance') }}</span>
	</p>

	<RoomSummaryList
		v-if="summary.rooms.length > 0"
		:records="summary.rooms"
		:heading="tr('editor.inspector.floor.rooms')"
		:annotations="roomAnnotations"
	/>
	<p
		v-else-if="!starting"
		class="rp-editor-inspector-empty"
	>
		{{ tr('editor.inspector.floor.no-rooms') }}
	</p>

	<RoomSummaryList
		v-if="summary.areas.length > 0"
		:records="summary.areas"
		:heading="tr('editor.inspector.floor.areas')"
	/>
</template>
