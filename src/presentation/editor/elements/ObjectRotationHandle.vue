<script setup lang="ts">
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import type { ThemeTokens } from '../theme/themeTokens';
import { ROTATION_HANDLE_RADIUS_PX } from '../handleMetrics';
import RotationHandleGlyph from './RotationHandleGlyph.vue';
import { useEditorStore } from '../../stores/EditorStore';
import { rotationControlContains, type RotationControlGeometry } from './rotationControl';
defineProps<{ tokens: ThemeTokens; zoom: number }>();
const runtime = useEditorRuntime(), editor = useEditorStore();
const interaction = computed(() => runtime.renderState.rotationInteraction);
const controls = computed(() => {
	if (runtime.rotationActions.active.value) return [];
	if (interaction.value) return runtime.rotationActions.blocked.value ? [] : [interaction.value.control];
	return runtime.rotationActions.displayControls.value;
});
const angle = computed(() => runtime.renderState.rotationDegrees === null ? null : Math.round(runtime.renderState.rotationDegrees * 100) / 100);
function highlighted(control: RotationControlGeometry): boolean {
	return interaction.value !== null || (runtime.renderState.hoveredTargetKind === 'rotation' && editor.pointerWorld !== null && rotationControlContains(control.bounds, editor.pointerWorld));
}
</script>
<template>
	<VGroup
		v-if="controls.length"
		:config="{ name: 'object-rotation-handle', listening: false }"
	>
		<RotationHandleGlyph
			v-for="(geometry, index) in controls"
			:key="index"
			:geometry="geometry"
			:tokens="tokens"
			:zoom="zoom"
			:radius-px="ROTATION_HANDLE_RADIUS_PX"
			:angle="angle"
			:highlighted="highlighted(geometry)"
			:dragging="interaction?.dragging ?? false"
			:snap-degrees="interaction?.snapDegrees ?? null"
			:obstacles="runtime.rotationActions.obstacles.value"
			:visible-bounds="runtime.rotationActions.visibleBounds.value"
		/>
	</VGroup>
</template>
