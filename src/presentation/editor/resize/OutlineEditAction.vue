<script setup lang="ts">
import { nextTick } from 'vue';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
defineProps<{ zoneId: ZoneId }>();
const runtime = useEditorRuntime();
async function edit(id: ZoneId, event: Event): Promise<void> {
	const opener = event.currentTarget as HTMLElement, root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await runtime.outlineEdit.editOutline(id); await nextTick();
	if (opener.isConnected || !root?.isConnected) return;
	(root.querySelector<HTMLElement>('[data-rp-action="edit-outline"], [data-rp-rail="details"]') ?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]'))?.focus();
}
</script>
<template>
	<button
		type="button"
		data-rp-action="edit-outline"
		:aria-disabled="runtime.outlineEdit.blocked.value"
		@click="edit(zoneId, $event)"
	>
		{{ tr('editor.outline.action') }}
	</button>
</template>
