<script setup lang="ts">
import { nextTick } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { tr } from '../../i18n/strings';
const runtime = useEditorRuntime(), project = useProjectStore();
async function open(event: Event): Promise<void> {
	const opener = event.currentTarget as HTMLElement, root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await runtime.openReference(); await nextTick();
	if (!opener.isConnected && root?.isConnected) root.querySelector<HTMLElement>('[data-rp-action="reference"], [data-rp-rail="layers"]')?.focus();
}
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
