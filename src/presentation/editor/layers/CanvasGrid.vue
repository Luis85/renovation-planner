<script setup lang="ts">
import { computed } from 'vue';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { STAGE_PIXELS, worldToScreen } from '../viewport/Viewport';

const editor = useEditorStore(), workspace = useWorkspaceStore();
/** Visual ruler only: 100 mm multiples, decimated at distant zooms to avoid dense moiré. */
const style = computed(() => {
	const spacing = 100 * editor.viewport.zoom;
	const pixels = spacing * Math.pow(10, Math.max(0, Math.ceil(Math.log10(16 / spacing))));
	const origin = worldToScreen({ x: 0, y: 0 }, editor.viewport, STAGE_PIXELS);
	return { backgroundSize: `${pixels}px ${pixels}px`, backgroundPosition: `${origin.x}px ${origin.y}px` };
});
</script>

<template>
	<div
		v-if="workspace.gridVisible"
		class="rp-canvas-grid"
		:style="style"
		aria-hidden="true"
	/>
</template>
