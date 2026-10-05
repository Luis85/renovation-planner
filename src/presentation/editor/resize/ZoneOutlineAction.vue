<script setup lang="ts">
/**
 * BP-04 slice B, the Inspector half of the reach: the production door onto the numeric outline
 * editor slices A and A2 built (`zoneOutlineAction.ts`, beside this file — which is why the
 * button lives here rather than under `metadata/`, and `RoomSizeAction.vue` is already its
 * neighbour). `runtime.zoneOutline.editZoneOutline` is the ONE function both doors call; the
 * other is `useCanvasMenuActions`'s `edit-outline` entry. Neither re-decides acceptance and
 * neither builds a dialog — CLAUDE.md's "one action, every input".
 *
 * **No perspective guard here, deliberately.** `EntityInspector`'s `body` routes `renovate` and
 * `review` to `RenovationInspector`, so `RoomInspector` — and with it `SpatialInspectorActions`
 * and this button — mounts only in Plan. A guard would cost a branch it can never pay back.
 * The MENU half has no such routing and carries the guard instead, through `GEOMETRY_ACTIONS`.
 */
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
		data-rp-action="edit-outline"
		:aria-disabled="runtime.zoneOutline.zoneOutlineBlocked.value"
		@click="runInspectorAction($event, 'edit-outline', () => runtime.zoneOutline.editZoneOutline(zoneId))"
	>
		{{ tr('editor.area.outline') }}
	</button>
</template>
