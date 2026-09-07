<script setup lang="ts">
import { runInspectorAction } from '../shell/restoreInspectorActionFocus';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { tr } from '../../i18n/strings';
const runtime = useEditorRuntime(), project = useProjectStore();
const open = (event: Event) => runInspectorAction(event, 'reference', () => runtime.openReference(), 'layers');
</script>
<template>
	<button
		type="button"
		data-rp-action="reference"
		:aria-disabled="runtime.referenceBlocked.value"
		@click="open"
	>
		{{ tr(project.plan?.background ? 'editor.reference.action' : 'editor.reference.upload') }}
	</button>
</template>
