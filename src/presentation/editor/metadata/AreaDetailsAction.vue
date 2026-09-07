<script setup lang="ts">
import { runInspectorAction } from '../shell/restoreInspectorActionFocus';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
defineProps<{ zoneId: ZoneId }>();
const runtime = useEditorRuntime();
</script>
<template>
	<button
		type="button"
		data-rp-action="area-details"
		:aria-disabled="runtime.areaDetails.areaDetailsBlocked.value"
		@click="runInspectorAction($event, 'area-details', () => runtime.areaDetails.editAreaDetails(zoneId))"
	>
		{{ tr('editor.area.details') }}
	</button>
</template>
