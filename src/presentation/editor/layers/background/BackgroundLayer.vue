<script setup lang="ts">
/**
 * §18's background layer: an imported document — a plan scan, or an asset's spec sheet — as
 * an image or a rendered PDF page.
 *
 * "This layer should redraw rarely" (§18), and under the per-layer viewport transform that
 * is true of every world-space layer — a pan or zoom moves the layer node and re-renders
 * no content. What still makes the background the special case is that its CONTENT changes
 * only when the subject's background reference does, which is why the load is a `watch` on
 * that reference rather than anything the render path re-runs.
 *
 * `<v-image>` is positioned and scaled in world millimetres like everything else on a
 * world-space layer: the raster's own pixels become millimetres through `drawnWorldScale`,
 * the decoded scale corrected by the subject's `pixelsPerWorldUnit`, so the picture grows with
 * the coordinates a calibration multiplies.
 *
 * **It knows nothing about a Plan, and that is a change rather than a tidy-up.** It read
 * `useProjectStore().plan` and `usePlanEditorContext().vault` directly until the asset
 * designer needed the same picture, at which point either the designer re-derived the load,
 * the stamping, the unmount rule and the `<v-image>` arithmetic — four rediscoveries of code
 * that already works — or this file learned to be told what to draw. It is told. The same
 * move Task B1 made on `PlanCanvas.vue`'s gesture doors, for the same reason and with the
 * same consequence: `PlanCanvas` now answers the two questions that name a Plan, and this
 * file answers none of them.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { NodeTransform } from '../../viewport/Viewport';
import {
	backgroundStatus,
	drawnWorldScale,
	loadBackground,
	NO_BACKGROUND,
	type BackgroundDocumentRef,
	type BackgroundRenderModel,
	type BackgroundStatus,
	type BackgroundVault,
} from './BackgroundRenderModel';

/**
 * What this layer needs of the surface it is mounted in, and nothing about whose surface it
 * is.
 *
 * `name` is REQUIRED rather than defaulted to `'background'`, for the reason
 * `EditorSurface.canvasLabel` is required: a default is a default somebody inherits silently,
 * and the designer's own layer order is asserted BY NAME (`layers.test.ts`), so a second
 * mount quietly announcing itself as the plan editor's layer would pass its own test by
 * matching the wrong string.
 *
 * `reference` is the already-resolved reference rather than a store to read one from: the two
 * subjects hold theirs in two different stores, and a layer that picked one would be a layer
 * only one surface can mount.
 */
const props = defineProps<{
	name: string;
	reference: BackgroundDocumentRef | null;
	vault: BackgroundVault;
	transform: NodeTransform;
	visible: boolean;
	/**
	 * The subject's calibration, reduced to the one number the raster's drawn size depends on;
	 * `1` for an uncalibrated subject. REQUIRED rather than defaulted, for `name`'s reason: a
	 * default is what let this layer draw every calibrated plan at the placeholder scale for
	 * eight slices with nothing failing.
	 */
	pixelsPerWorldUnit: number;
}>();

const emit = defineEmits<{ status: [status: BackgroundStatus] }>();

const model = ref<BackgroundRenderModel>(NO_BACKGROUND);

/**
 * A load is asynchronous and a background reference can change while one is in flight —
 * a calibration re-import, or simply a fast second `SetPlanBackground`. Each load
 * is stamped, and a result whose stamp is no longer the current one is DROPPED: without
 * this, the slower of two loads wins and the canvas shows the previous document.
 */
let currentLoad = 0;

/**
 * The FIELDS, never the object. A rehydrate is not a new document: every successful command
 * re-reads its subject and both mappers mint a fresh `background`, so watching identity
 * re-loaded on every unrelated edit — a footprint, an anchor, a facing, a height. For an
 * image that is a redundant decode and for a PDF it is `readBinary` plus a full page
 * rasterization, per save, of a document that did not change. `page` is normalised because
 * absent and `null` are one document and only one of the two spellings reaches here.
 */
const documentKey = computed(() =>
	props.reference === null
		? null
		: `${props.reference.kind}:${props.reference.page ?? ''}:${props.reference.path}`,
);

watch(
	documentKey,
	async () => {
		const stamp = ++currentLoad;
		const loaded = await loadBackground(props.reference, props.vault);
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
			name: props.name,
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
				width: raster.width * drawnWorldScale(raster.worldScale, props.pixelsPerWorldUnit),
				height: raster.height * drawnWorldScale(raster.worldScale, props.pixelsPerWorldUnit),
				listening: false,
			}"
		/>
	</VLayer>
</template>
