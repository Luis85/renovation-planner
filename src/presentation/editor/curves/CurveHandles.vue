<script setup lang="ts">
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import type { ThemeTokens } from '../theme/themeTokens';
import { arcPoint, arcTangent } from '../../../core/geometry/circularArc';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
const props = defineProps<{ tokens: ThemeTokens; zoom: number }>();
const task = useEditorRuntime().curveTask;
const workspace = useWorkspaceStore();
const edges = computed(() => task.target.value && !task.blocked.value && workspace.layerVisibility[task.target.value.kind === 'room' ? 'zone' : 'architecture'] ? task.edges.value.map(edge => {
	const tip = arcPoint(edge, 0.6), tangent = arcTangent(edge, 0.6), size = 7 / props.zoom;
	return { ...edge, guide: [edge.start.x, edge.start.y, edge.end.x, edge.end.y], arrow: [tip.x - size * (tangent.x + tangent.y), tip.y - size * (tangent.y - tangent.x), tip.x, tip.y, tip.x - size * (tangent.x - tangent.y), tip.y - size * (tangent.y + tangent.x)] };
}) : []);
</script>
<template>
	<VGroup :config="{ name: 'curve-bend-handles', listening: false }">
		<VGroup
			v-for="edge in edges"
			:key="edge.index"
		>
			<VLine :config="{ points: edge.guide, stroke: tokens.zoneCaption, strokeWidth: 1 / zoom, dash: [4 / zoom, 4 / zoom] }" />
			<VLine :config="{ points: edge.arrow, stroke: tokens.accent, strokeWidth: 2 / zoom }" />
			<VCircle :config="{ name: `curve-bend-${edge.index}`, x: edge.midpoint.x, y: edge.midpoint.y, radius: 8 / zoom, fill: tokens.canvasBackground, stroke: tokens.accent, strokeWidth: (edge.index === task.state.edge ? 3 : 1.5) / zoom }" />
			<VText :config="{ x: edge.midpoint.x - 6 / zoom, y: edge.midpoint.y - 6 / zoom, width: 12 / zoom, align: 'center', text: String(edge.index + 1), fontSize: 12 / zoom, fill: tokens.accent }" />
		</VGroup>
	</VGroup>
</template>
