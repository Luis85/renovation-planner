<script setup lang="ts">
import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { STAGE_PIXELS, worldToScreen } from '../viewport/Viewport';

/**
 * `stepMm` and `origin` are the asset designer's (snapping spec §5), whose `designerGrid` has already chosen a step the
 * screen can afford and counts it from the footprint's corner. Without them this is the Plan Editor's visual ruler:
 * 100 mm multiples from the world origin, decimated at distant zooms to avoid dense moiré.
 */
const props = defineProps<{ stepMm?: number; origin?: Point }>();
const editor = useEditorStore(), workspace = useWorkspaceStore();
const style = computed(() => {
	const spacing = (props.stepMm ?? 100) * editor.viewport.zoom;
	const pixels = props.stepMm === undefined ? spacing * Math.pow(10, Math.max(0, Math.ceil(Math.log10(16 / spacing)))) : spacing;
	const origin = worldToScreen(props.origin ?? { x: 0, y: 0 }, editor.viewport, STAGE_PIXELS);
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
