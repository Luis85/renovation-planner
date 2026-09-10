<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import AreaCornerEditor from '../add/AreaCornerEditor.vue';
import FreeShapeRoomAction from '../add/FreeShapeRoomAction.vue';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
const runtime = useEditorRuntime(), workspace = useWorkspaceStore();
const isCurves = computed(() => runtime.activeToolId.value === 'edit-curves');
const isArea = computed(() => runtime.activeToolId.value === 'draw-area');
const isFreeRoom = computed(() => runtime.activeToolId.value === 'draw-polygon');
const isOutline = computed(() => isArea.value || isFreeRoom.value);
async function curvePrecision(event: Event): Promise<void> {
	const root = (event.currentTarget as HTMLElement).closest('.renovation-plan-editor');
	workspace.openOverlay('inspector'); await nextTick();
	root?.querySelector<HTMLElement>('[data-rp-form="edit-curves"] select')?.focus();
}
function freeRoomName(event: Event): void {
	const input = event.target as HTMLInputElement;
	if (runtime.areaCorners.editable.value) runtime.roomDraft.setName(input.value);
	else input.value = runtime.roomDraft.name;
}
</script>
<template>
	<FreeShapeRoomAction
		v-if="runtime.activeToolId.value === 'draw-room'"
		canvas
	/>
	<label v-if="isFreeRoom">{{ tr('editor.room.name') }}
		<input
			name="free-room-name"
			type="text"
			:value="runtime.roomDraft.name"
			:readonly="!runtime.areaCorners.editable.value"
			@input="freeRoomName"
		>
	</label>
	<AreaCornerEditor v-if="isOutline" />
	<button
		v-if="isCurves"
		type="button"
		@click="curvePrecision"
	>
		{{ tr('editor.curves.precision') }}
	</button>
	<button
		v-if="runtime.activeToolId.value === 'draw-wall'"
		type="button"
		:aria-disabled="runtime.structureTask.blocked.value"
		@click="runtime.structureTask.undoPoint()"
	>
		{{ tr('editor.structure.undo-point') }}
	</button>
	<label
		v-if="isArea"
		class="rp-task-banner__repeat"
	>
		<input
			v-model="runtime.keepAddingAreas.value"
			type="checkbox"
		>
		{{ tr('editor.area.keep-adding') }}
	</label>
</template>
