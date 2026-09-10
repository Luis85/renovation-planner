<script setup lang="ts">
import { runInspectorAction } from '../shell/restoreInspectorActionFocus';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { Point } from '../../../core/geometry/Point';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { roomDimensions } from './roomDimensions';
import { useProjectStore } from '../../stores/ProjectStore';

defineProps<{ zoneId: ZoneId; points: readonly Point[] }>();
const runtime = useEditorRuntime();
const project = useProjectStore();

</script>

<template>
	<button
		v-if="roomDimensions(points, project.zones.get(zoneId)?.bulges) !== null"
		type="button"
		data-rp-action="resize-room"
		:aria-disabled="runtime.resizeRoomBlocked.value"
		@click="runInspectorAction($event, 'resize-room', () => runtime.resizeRoom(zoneId))"
	>
		{{ tr('editor.resize.action') }}
	</button>
	<p v-else>
		{{ tr('editor.resize.unsupported') }}
	</p>
</template>
