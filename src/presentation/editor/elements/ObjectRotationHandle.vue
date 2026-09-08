<script setup lang="ts">
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import type { ThemeTokens } from '../theme/themeTokens';
import { ROTATION_HANDLE_RADIUS_PX } from '../handleMetrics';
defineProps<{ tokens: ThemeTokens; zoom: number }>();
const runtime = useEditorRuntime();
const geometry = computed(() => runtime.rotationActions.blocked.value || runtime.rotationActions.active.value ? null : runtime.rotationActions.handleGeometry.value);
const angle = computed(() => runtime.renderState.rotationDegrees === null ? null : Math.round(runtime.renderState.rotationDegrees * 100) / 100);
</script>
<template>
	<VGroup v-if="geometry" :config="{ name: 'object-rotation-handle', listening: false }">
		<VLine :config="{ points: [geometry.anchor.x, geometry.anchor.y, geometry.handle.x, geometry.handle.y], stroke: tokens.accent, strokeWidth: 1 / zoom }" />
		<VCircle :config="{ x: geometry.handle.x, y: geometry.handle.y, radius: ROTATION_HANDLE_RADIUS_PX / zoom, stroke: tokens.accent, strokeWidth: 2 / zoom, fill: tokens.canvasBackground }" />
		<VText v-if="angle !== null" :config="{ x: geometry.handle.x + 18 / zoom, y: geometry.handle.y - 7 / zoom, text: angle + '°', fontSize: 14 / zoom, fill: tokens.accent }" />
	</VGroup>
</template>
