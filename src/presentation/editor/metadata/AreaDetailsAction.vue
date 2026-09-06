<script setup lang="ts">
import { nextTick } from 'vue';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
defineProps<{ zoneId: ZoneId }>();
const runtime = useEditorRuntime();
async function edit(id: ZoneId, event: Event): Promise<void> {
	const opener = event.currentTarget as HTMLElement, root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await runtime.areaDetails.editAreaDetails(id); await nextTick();
	if (opener.isConnected || !root?.isConnected) return;
	(root.querySelector<HTMLElement>('[data-rp-action="area-details"], [data-rp-rail="details"]') ?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]'))?.focus();
}
</script>
<template>
	<button
		type="button"
		data-rp-action="area-details"
		:aria-disabled="runtime.areaDetails.areaDetailsBlocked.value"
		@click="edit(zoneId, $event)"
	>
		{{ tr('editor.area.details') }}
	</button>
</template>
