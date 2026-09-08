<script setup lang="ts">
import { computed } from 'vue';
import { extentOf } from '../../../core/geometry/operations';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useEditorRuntime } from '../runtime';
import type { ThemeTokens } from '../theme/themeTokens';
import { rotationHandle } from './objectRotation';
const props = defineProps<{ tokens: ThemeTokens; zoom: number }>();
const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession(), runtime = useEditorRuntime();
const element = computed(() => session.perspective === 'plan' && runtime.activeToolId.value === 'select' && !runtime.elementActions.blocked.value && !runtime.elementActions.active.value && selection.selectedIds.length === 1 ? project.structure.elements?.find(item => item.id === selection.selectedIds[0] && item.kind === 'object') : undefined);
const handle = computed(() => element.value ? rotationHandle(element.value, 1 / props.zoom) : null);
const angle = computed(() => runtime.renderState.rotationDegrees === null ? null : Math.round(runtime.renderState.rotationDegrees * 100) / 100);
</script>
<template>
	<VGroup
		v-if="handle && element"
		:config="{ name: 'object-rotation-handle', listening: false }"
	>
		<VLine :config="{ points: [handle.x, extentOf(element.points).minY, handle.x, handle.y], stroke: tokens.accent, strokeWidth: 1 / zoom }" />
		<VCircle :config="{ x: handle.x, y: handle.y, radius: 6 / zoom, stroke: tokens.accent, strokeWidth: 2 / zoom, fill: tokens.canvasBackground }" />
		<VText
			v-if="angle !== null"
			:config="{ x: handle.x + 12 / zoom, y: handle.y - 7 / zoom, text: angle + '°', fontSize: 14 / zoom, fill: tokens.accent }"
		/>
	</VGroup>
</template>
