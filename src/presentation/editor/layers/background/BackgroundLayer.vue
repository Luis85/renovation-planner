<script setup lang="ts">
/**
 * §18's background layer: the imported plan, as an image or a rendered PDF page.
 *
 * "This layer should redraw rarely" (§18), and under the per-layer viewport transform that
 * is true of every world-space layer — a pan or zoom moves the layer node and re-renders
 * no content. What still makes the background the special case is that its CONTENT changes
 * only when the Plan's background reference does, which is why the load is a `watch` on
 * that reference rather than anything the render path re-runs.
 *
 * `<v-image>` is positioned and scaled in world millimetres like everything else on a
 * world-space layer: the raster's own pixels become millimetres through the model's
 * `worldScale`, which is a placeholder until slice 7 calibrates and is the ONLY thing that
 * changes here when it does.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '../../../stores/ProjectStore';
import { usePlanEditorContext } from '../../PlanEditorContext';
import type { NodeTransform } from '../../viewport/Viewport';
import {
	backgroundStatus,
	loadBackground,
	NO_BACKGROUND,
	type BackgroundRenderModel,
	type BackgroundStatus,
} from './BackgroundRenderModel';

const props = defineProps<{
	transform: NodeTransform;
	visible: boolean;
}>();

const emit = defineEmits<{ status: [status: BackgroundStatus] }>();

const context = usePlanEditorContext();
const { plan } = storeToRefs(useProjectStore());
const model = ref<BackgroundRenderModel>(NO_BACKGROUND);

/**
 * A load is asynchronous and a background reference can change while one is in flight —
 * a slice-7 calibration re-import, or simply a fast second `SetPlanBackground`. Each load
 * is stamped, and a result whose stamp is no longer the current one is DROPPED: without
 * this, the slower of two loads wins and the canvas shows the previous document.
 */
let currentLoad = 0;

watch(
	() => plan.value?.background ?? null,
	async (reference) => {
		const stamp = ++currentLoad;
		const loaded = await loadBackground(reference, context.vault);
		if (stamp !== currentLoad) return;
		model.value = loaded;
		emit('status', backgroundStatus(loaded));
	},
	{ immediate: true },
);

// Nothing in flight may land after the view is gone: the component is unmounted, its
// `model` ref is detached, and writing to it would keep the decoded raster alive.
onBeforeUnmount(() => {
	currentLoad += 1;
});

const raster = computed(() => (model.value.kind === 'raster' ? model.value : null));
</script>

<template>
	<VLayer
		:config="{
			name: 'background',
			listening: false,
			visible: props.visible,
			...props.transform,
		}"
	>
		<VImage
			v-if="raster"
			:config="{
				image: raster.image,
				x: raster.worldOrigin.x,
				y: raster.worldOrigin.y,
				width: raster.width * raster.worldScale,
				height: raster.height * raster.worldScale,
				listening: false,
			}"
		/>
	</VLayer>
</template>
