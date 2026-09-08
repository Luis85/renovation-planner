<script setup lang="ts">
import { computed } from 'vue';
import type { ThemeTokens } from '../theme/themeTokens';
import { useReviewPresentation } from './useReviewPresentation';
import { useSelectionStore } from '../selection/selection-store';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useEditorRuntime } from '../runtime';

const props = defineProps<{ tokens: ThemeTokens; zoom: number }>();
const { rows } = useReviewPresentation();
const selection = useSelectionStore(), workspace = useWorkspaceStore(), runtime = useEditorRuntime();
const markers = computed(() => rows.value.filter(room => room.markerNumber !== null && room.points.length > 0).map(room => {
	const left = Math.min(...room.points.map(point => point.x)), right = Math.max(...room.points.map(point => point.x));
	const top = Math.min(...room.points.map(point => point.y)), bottom = Math.max(...room.points.map(point => point.y));
	return { roomId: room.id, number: room.markerNumber, selected: selection.focusedId === room.id,
		x: left + Math.min(32 / props.zoom, (right - left) / 2), y: top + Math.min(32 / props.zoom, (bottom - top) / 2) };
}));
function select(roomId: string): void {
	runtime.selectAndFrame(roomId);
	if (workspace.layoutMode === 'constrained') workspace.openOverlay('inspector');
}
</script>

<template>
	<VGroup
		v-for="marker in markers"
		:key="marker.roomId"
		:config="{ name: 'review-room-marker', roomId: marker.roomId, number: marker.number, x: marker.x, y: marker.y,
			onClick: () => select(marker.roomId), onTap: () => select(marker.roomId) }"
	>
		<VCircle :config="{ radius: 18 / zoom, fill: tokens.canvasBackground, stroke: marker.selected ? tokens.accent : tokens.zoneStroke, strokeWidth: (marker.selected ? 3 : 1.5) / zoom }" />
		<VText :config="{ x: -14 / zoom, y: -8 / zoom, width: 28 / zoom, align: 'center', text: String(marker.number), fontSize: 16 / zoom, fontStyle: 'bold', fill: tokens.zoneLabel, listening: false }" />
	</VGroup>
</template>
