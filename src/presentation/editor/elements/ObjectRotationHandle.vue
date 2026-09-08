<script setup lang="ts">
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import type { ThemeTokens } from '../theme/themeTokens';
import { ROTATION_HANDLE_RADIUS_PX } from '../handleMetrics';
import RotationHandleGlyph from './RotationHandleGlyph.vue';
defineProps<{ tokens: ThemeTokens; zoom: number }>();
const runtime = useEditorRuntime();
const interaction = computed(() => runtime.renderState.rotationInteraction);
const geometry = computed(() => runtime.rotationActions.blocked.value || runtime.rotationActions.active.value ? null : interaction.value?.control ?? runtime.rotationActions.handleGeometry.value);
const angle = computed(() => runtime.renderState.rotationDegrees === null ? null : Math.round(runtime.renderState.rotationDegrees * 100) / 100);
const highlighted = computed(() => interaction.value !== null || runtime.renderState.hoveredTargetKind === 'rotation');
</script>
<template>
	<VGroup
		v-if="geometry"
		:config="{ name: 'object-rotation-handle', listening: false }"
	>
		<RotationHandleGlyph
			:geometry="geometry"
			:tokens="tokens"
			:zoom="zoom"
			:radius-px="ROTATION_HANDLE_RADIUS_PX"
			:angle="angle"
			:highlighted="highlighted"
			:dragging="interaction?.dragging ?? false"
			:snap-degrees="interaction?.snapDegrees ?? null"
			:obstacles="runtime.rotationActions.obstacles.value"
			:visible-bounds="runtime.rotationActions.visibleBounds.value"
		/>
	</VGroup>
</template>
