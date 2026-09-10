<script setup lang="ts">
import { nextTick } from 'vue';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
const props = defineProps<{ canvas?: boolean }>();
const runtime = useEditorRuntime();
async function freeShape(event: Event): Promise<void> {
	const draft = runtime.roomDraft;
	if (runtime.writesBlocked.value || draft.submitting || !runtime.toolManager.canDeactivateActiveTool()) return;
	const leaf = (event.currentTarget as HTMLElement).closest<HTMLElement>('.renovation-plan-editor');
	const name = draft.name, points = draft.geometry?.points ?? [];
	runtime.setTool('draw-polygon');
	draft.setName(name);
	points.forEach((point, index) => { runtime.toolManager.editActiveCorner(index, point); });
	await nextTick(); await nextTick();
	leaf?.querySelector<HTMLElement>(props.canvas ? '.rp-plan-canvas' : '.rp-area-corners summary')?.focus();
}
</script>
<template>
	<button
		type="button"
		:data-rp-action="canvas ? 'draw-free-room' : 'free-shape-room'"
		:aria-disabled="runtime.writesBlocked.value || runtime.roomDraft.submitting"
		:title="tr('editor.room.free-shape-hint')"
		@click="freeShape"
	>
		{{ tr('editor.room.free-shape') }}
	</button>
</template>
