<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { worldToScreen, STAGE_PIXELS } from '../viewport/Viewport';
import { formatMetres } from '../shell/formatLength';
import { tr } from '../../i18n/strings';
import type { RoomRect } from '../add/room-draft-store';
const runtime = useEditorRuntime(), editor = useEditorStore(), workspace = useWorkspaceStore();
const rect = computed(() => runtime.activeToolId.value === 'draw-room' ? runtime.roomDraft.rect : null);
const axes = ['width', 'depth'] as const;
function position(axis: 'width' | 'depth', bounds: RoomRect) {
	const point = worldToScreen({ x: bounds.x + (axis === 'width' ? bounds.width / 2 : 0), y: bounds.y + (axis === 'depth' ? bounds.depth / 2 : 0) }, editor.viewport, STAGE_PIXELS);
	return { left: `${Math.max(42, Math.min(editor.stageSize.width - 42, point.x - (axis === 'depth' ? 28 : 0)))}px`, top: `${Math.max(44, Math.min(editor.stageSize.height - 88, point.y - (axis === 'width' ? 38 : 14)))}px` };
}
function guide(axis: 'width' | 'depth', bounds: RoomRect) {
	const min = worldToScreen({ x: bounds.x, y: bounds.y }, editor.viewport, STAGE_PIXELS);
	const max = worldToScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.depth }, editor.viewport, STAGE_PIXELS);
	const label = position(axis, bounds);
	return axis === 'width' ? { left: `${min.x}px`, top: `${parseFloat(label.top) + 14}px`, width: `${max.x - min.x}px` }
		: { left: label.left, top: `${min.y}px`, height: `${max.y - min.y}px` };
}
async function focusDimension(axis: 'width' | 'depth', event: Event): Promise<void> {
	const root = (event.currentTarget as HTMLElement).closest('.renovation-plan-editor');
	if (workspace.layoutMode === 'constrained') workspace.openOverlay('inspector');
	await nextTick();
	const input = root?.querySelector<HTMLInputElement>(`.rp-new-room input[name="${axis}"]`);
	input?.focus(); input?.select();
}
</script>
<template>
	<div
		v-if="rect"
		class="rp-draft-dimensions"
	>
		<span
			class="rp-dimension-guide rp-dimension-guide--width"
			:style="guide('width', rect)"
			aria-hidden="true"
		/>
		<span
			class="rp-dimension-guide rp-dimension-guide--depth"
			:style="guide('depth', rect)"
			aria-hidden="true"
		/>
		<div
			v-for="axis in axes"
			:key="axis"
			class="rp-dimension-anchor"
			:style="position(axis, rect)"
		>
			<button
				type="button"
				class="rp-dimension-label"
				:data-rp-draft-dimension="axis"
				:aria-label="tr(axis === 'width' ? 'editor.dimension.edit-width' : 'editor.dimension.edit-depth', { value: formatMetres(rect[axis]) })"
				@click="focusDimension(axis, $event)"
			>
				{{ formatMetres(rect[axis]) }} m
			</button>
		</div>
	</div>
</template>
