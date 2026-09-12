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
		class="rp-inspector-action"
		data-rp-action="rename-room"
		:aria-disabled="runtime.renameRoomBlocked.value"
		@click="runInspectorAction($event, 'rename-room', () => runtime.renameRoom(zoneId))"
	>
		{{ tr('editor.rename.action') }}
	</button>
</template>
