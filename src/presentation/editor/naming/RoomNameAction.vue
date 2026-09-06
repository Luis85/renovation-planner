<script setup lang="ts">
import { nextTick } from 'vue';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';

defineProps<{ zoneId: ZoneId }>();
const runtime = useEditorRuntime();
async function renameRoom(id: ZoneId, event: Event): Promise<void> {
	const opener = event.currentTarget as HTMLElement;
	const root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await runtime.renameRoom(id);
	await nextTick();
	if (opener.isConnected || !root?.isConnected) return;
	const target = root.querySelector<HTMLElement>('[data-rp-action="rename-room"], [data-rp-rail="details"]')
		?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]');
	target?.focus();
}
</script>

<template>
	<button
		type="button"
		data-rp-action="rename-room"
		:aria-disabled="runtime.renameRoomBlocked.value"
		@click="renameRoom(zoneId, $event)"
	>
		{{ tr('editor.rename.action') }}
	</button>
</template>
