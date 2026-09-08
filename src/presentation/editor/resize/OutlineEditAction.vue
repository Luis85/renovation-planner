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
		data-rp-action="edit-outline"
		:aria-disabled="runtime.outlineEdit.blocked.value"
		@click="runInspectorAction($event, 'edit-outline', () => runtime.outlineEdit.editOutline(zoneId))"
	>
		{{ tr('editor.outline.action') }}
	</button>
</template>
