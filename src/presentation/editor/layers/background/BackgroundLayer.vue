<script setup lang="ts">
/**
 * §18's background layer: an imported document — a plan scan, or an asset's spec sheet — as
 * an image or a rendered PDF page.
 *
 * "This layer should redraw rarely" (§18), and under the per-layer viewport transform that
 * is true of every world-space layer — a pan or zoom moves the layer node and re-renders
 * no content. What makes the background the special case is that its content changes for TWO
 * reasons rather than one, which is why the load is a `watch` on a KEY rather than on anything
 * the render path re-runs: the subject's reference can be pointed somewhere else, and the FILE
 * that reference names can be replaced, renamed or deleted under it.
 *
 * This paragraph named only the first for as long as the layer knew only the first, and the
 * second is not a refinement of it — a frontmatter reference does not move when the file it
 * names does, and no write pipeline in this plugin hears about a PNG at all. `fileChanges` is
 * the door; PR 43 is where the gap was reported, against the very document key that had
 * disclosed it.
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
import { TFile } from 'obsidian';
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
	/**
	 * "Tell me when a vault file changed", by path — the door that makes the key below answer a
	 * question about NOW rather than about the last time the subject was re-read.
	 *
	 * A subscription as a PROP, which is the shape this component already takes for everything
	 * else: it is told what to draw and told where to read, and a context injection here would
	 * make it a layer only one surface can mount. Both surfaces pass their context's own member,
	 * bound by the composition root to the one `createVaultFileChangeSource`.
	 *
	 * REQUIRED, for `name`'s and `pixelsPerWorldUnit`'s reason: a default is a default somebody
	 * inherits silently, and this one would be silence about a file the user just replaced.
	 */
	fileChanges: (listener: (path: string) => void) => () => void;
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
 * How many times a vault event has named the file this layer is drawing.
 *
 * Part of the key rather than a bare dependency of it, and the difference is measurable: the
 * stat below moves for a replace and for a delete, but two writes inside one clock tick that
 * leave the size alone are indistinguishable to it. Counting the EVENT makes the reload
 * unconditional for the file the event named, which is the safe direction — the cost is one
 * redundant decode for a touch that changed nothing, and the alternative is a raster the user
 * can see is stale.
 *
 * Filtered on the path, which is what stops this being "reload on every vault event": every
 * note this plugin writes fires `modify`, so an unfiltered bump would re-decode the sheet — or
 * re-rasterize a PDF page — on every zone the user draws.
 */
const fileGeneration = ref(0);

/**
 * The FIELDS, never the object. A rehydrate is not a new document: every successful command
 * re-reads its subject and both mappers mint a fresh `background`, so watching identity
 * re-loaded on every unrelated edit — a footprint, an anchor, a facing, a height. For an
 * image that is a redundant decode and for a PDF it is `readBinary` plus a full page
 * rasterization, per save, of a document that did not change. `page` is normalised because
 * absent and `null` are one document and only one of the two spellings reaches here.
 */
const documentKey = computed(() => {
	const reference = props.reference;
	if (reference === null) return null;
	// The FILE's own state as well as the reference's, because a reference whose three fields
	// have not moved is not the same thing as a file that has not moved: replace the PNG at that
	// path, or delete it, and identity-free watching would keep the decoded raster on screen and
	// never emit `missing`. `mtime:size` is the whole of what a file states about itself
	// synchronously here, which is the same reading `EchoWindow` compares for the same reason.
	//
	// TWO things re-evaluate this, and it needed both: a new `reference` (a rehydrate), and
	// `fileGeneration` (a vault event naming this file). The key shipped with only the first,
	// which made a CHANGED file different without making anybody look — so a sheet replaced or
	// deleted under an idle surface was noticed only when something unrelated re-read the
	// subject, and identity-watching had been repairing that by accident until the key removed
	// the accident. Reported on PR 43 against the key that had disclosed it.
	const file = props.vault.getAbstractFileByPath(reference.path);
	// `instanceof TFile` and not a null check, the same narrowing `loadBackground` states its
	// own reason for: a folder at that path is not a background, and only a `TFile` has a stat.
	const stat = file instanceof TFile ? `${file.stat.mtime}:${file.stat.size}` : 'absent';
	return `${reference.kind}:${reference.page ?? ''}:${stat}:${fileGeneration.value}:${reference.path}`;
});

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

/**
 * Subscribed at setup and RELEASED on unmount, and the release is not tidiness: a vault
 * listener outlives the element that registered it, so one left behind re-decodes a raster into
 * a detached `model` ref on every file the user ever touches — one more per surface they have
 * opened this session. `runtime.ts` disposes `onDesignChanged` the same way and for the same
 * reason.
 *
 * `props.reference?.path` is read INSIDE the callback, so a surface whose reference has moved
 * since filters on the one it is drawing now rather than on the one it was drawing at setup.
 */
onBeforeUnmount(
	props.fileChanges((path) => {
		if (path === props.reference?.path) fileGeneration.value += 1;
	}),
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
