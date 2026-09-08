<script setup lang="ts">
import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import { useEditorStore } from '../../stores/EditorStore';
import { STAGE_PIXELS, worldToScreen } from '../viewport/Viewport';
import { formatMetres } from '../shell/formatLength';
import { tr } from '../../i18n/strings';
import { roomEdges } from './roomEdgeMeasurements';

const props = defineProps<{ points: readonly Point[]; bulges?: readonly number[]; closed: boolean; omitAxisControls: boolean }>();
const editor = useEditorStore();
const edges = computed(() => {
	const placed: { x: number; y: number }[] = [];
	return roomEdges(props.points, props.closed, props.omitAxisControls, props.bulges).map(edge => {
		const midpoint = worldToScreen(edge.midpoint, editor.viewport, STAGE_PIXELS);
		const candidates = [28, 52, 76, 100].map(offset => ({ x: Math.max(48, Math.min(editor.stageSize.width - 48, midpoint.x + edge.normal.x * offset)), y: Math.max(16, Math.min(editor.stageSize.height - 40, midpoint.y + edge.normal.y * offset)) }));
		const position = candidates.find(point => placed.every(other => Math.abs(point.x - other.x) > 90 || Math.abs(point.y - other.y) > 28)) ?? candidates[candidates.length - 1];
		placed.push(position);
		return { ...edge, midpoint, position, text: formatMetres(edge.length) };
	});
});
</script>
<template>
	<svg
		class="rp-room-edge-guides"
		aria-hidden="true"
	>
		<line
			v-for="edge in edges"
			:key="edge.index"
			:x1="edge.midpoint.x"
			:y1="edge.midpoint.y"
			:x2="edge.position.x"
			:y2="edge.position.y"
		/>
	</svg>
	<span
		v-for="edge in edges"
		:key="edge.index"
		class="rp-dimension-anchor rp-room-edge-measurement"
		:data-rp-room-edge="edge.index"
		:style="{ left: `${edge.position.x}px`, top: `${edge.position.y}px` }"
		:title="tr('editor.room.edge-length', { edge: String(edge.index + 1), length: edge.text })"
	>
		<span aria-hidden="true">{{ edge.text }} m</span>
		<span class="rp-visually-hidden">{{ tr('editor.room.edge-length', { edge: String(edge.index + 1), length: edge.text }) }}</span>
	</span>
</template>
