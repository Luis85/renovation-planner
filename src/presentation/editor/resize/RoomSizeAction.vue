<script setup lang="ts">
import { nextTick } from 'vue';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { Point } from '../../../core/geometry/Point';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { roomDimensions } from './roomDimensions';

defineProps<{ zoneId: ZoneId; points: readonly Point[] }>();
const runtime = useEditorRuntime();
/** Reflow can remove the opener while the root-owned form survives. Recover inside this leaf. */
async function resizeRoom(id: ZoneId, event: Event): Promise<void> {
	const opener = event.currentTarget as HTMLElement;
	const root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await runtime.resizeRoom(id);
	await nextTick();
	if (opener.isConnected || !root?.isConnected) return;
	const target = root.querySelector<HTMLElement>('[data-rp-action="resize-room"], [data-rp-rail="details"]')
		?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]');
	target?.focus();
}

</script>

<template>
	<button
		v-if="roomDimensions(points) !== null"
		type="button"
		data-rp-action="resize-room"
		:aria-disabled="runtime.resizeRoomBlocked.value"
		@click="resizeRoom(zoneId, $event)"
	>
		{{ tr('editor.resize.action') }}
	</button>
	<p v-else>
		{{ tr('editor.resize.unsupported') }}
	</p>
</template>
