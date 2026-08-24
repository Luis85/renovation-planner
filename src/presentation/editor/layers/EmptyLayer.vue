<script setup lang="ts">
/**
 * A Konva layer with nothing in it yet — the four §17 layers whose content belongs to
 * slices that do not exist (`ArchitectureLayer`, `ConstructionLayer`, `AssetLayer`,
 * `AnnotationLayer`).
 *
 * One component with a `layerId` rather than four identical files: there is nothing to
 * say about any of them yet that is not said by their position in §17's order, and four
 * copies of the same four lines would be four places to forget when the transform or the
 * listening rule changes. `InteractionLayer` is deliberately NOT one of these — slice 6
 * owns it and it has its own file so that ownership is visible.
 *
 * They exist now, rather than being added when their content is, because §17's order is
 * the contract: a layer inserted later would have to land in the right place among
 * siblings, and "the right place" is exactly what an existing, empty layer already holds.
 */
import type { KonvaLayerId } from '../scene/KonvaLayers';
import type { NodeTransform } from '../viewport/Viewport';

const props = defineProps<{
	layerId: KonvaLayerId;
	transform: NodeTransform;
	visible: boolean;
}>();
</script>

<template>
	<VLayer
		:config="{
			name: props.layerId,
			listening: false,
			visible: props.visible,
			...props.transform,
		}"
	/>
</template>
