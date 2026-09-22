<script setup lang="ts">
/**
 * The designer's millimetre rulers: a strip across the top and one down the left, following the
 * camera, with the selection's extent marked on each — the asset designer snapping spec
 * (2026-09-15) §0's increment 3, authorised in full by AD18-R9.
 *
 * **A DOM overlay and not a Konva layer.** That spec's decision table settles the mechanism for
 * every canvas annotation, so this component does not reopen it: a clickable Konva node fights a
 * hit test where every designer layer is `listening: false` and tools hit-test world points, and
 * a hybrid of Konva lines with DOM labels runs two render cadences that visibly lag each other
 * during a drag. It mounts in `EditorSurface`'s `overlay` slot, beside the empty state, which is
 * what resolves its `position: absolute` against `.rp-plan-canvas` rather than against the shell.
 *
 * **`pointer-events: none` in `styles/designer-rulers.css` is load-bearing rather than
 * cosmetic**: that slot's wrapper carries `@pointerdown.stop`, `@pointerup.stop`,
 * `@pointercancel.stop` and `@wheel.stop`, so a ruler accepting a press would silently eat the
 * gesture the canvas needs rather than merely sitting on top of it.
 *
 * **It costs the canvas no LAYOUT, which is what satisfies AD18-R10.** That ruling binds this
 * card to not taking the canvas below 50% of the shell at 580 px; two absolutely positioned
 * strips inside the canvas region leave `.rp-designer-parts`, `.rp-designer-canvas` and
 * `.rp-designer-inspector` measuring exactly what they measured before, at every width. What
 * they DO cost is OCCLUSION — a band along two edges of the drawing — and no gate here can see
 * either figure, because jsdom computes no layout. Both are measured in a browser and recorded in
 * `docs/tasks/asset-designer-expansion/reports/W17-B-canvas-rulers.md`.
 *
 * **The step is `designerGrid`'s**, which makes the ruler the fourth reading of one function
 * rather than a second opinion about what a step is. Zero is that function's ORIGIN — the
 * committed footprint's box minimum — for the reason the grid counts from there: an offset from
 * the footprint's edge is then a whole number of steps on the ruler as well as on the grid, where
 * a ruler counted from the asset's middle would put every such offset on an odd number.
 *
 * **Nothing is drawn over an UNSCALED design.** `dimensionsUnscaled` is a footprint captured
 * before the asset had a scale, whose coordinates are placeholder pixels; a millimetre ruler over
 * it would put a unit on a number that is not a measurement, which is the rule the status row's
 * own grid step already follows ("Read and correct an object's dimensions", acceptance
 * criterion 6).
 *
 * **What a screen reader is given is the SCALE and not the numbers.** The pair is one
 * `role="img"` naming the step, so the labelled ticks inside it are not read out as a list of
 * loose integers. The selection's extent is drawn and not announced: the Inspector owns this
 * asset's measurements, and the spec's increment 2 — dimensions on canvas, which remains owed —
 * owns the selected part's.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useEditorStore } from '../../stores/EditorStore';
import {
	STAGE_PIXELS,
	screenPoint,
	screenToWorld,
	worldPerScreenPixel,
	worldToScreen,
} from '../../editor/viewport/Viewport';
import { designerGrid } from '../grid/designerGrid';
import { selectionFrame } from '../layers/selectionLayer';
import { useAssetDesignStore } from '../stores/assetDesignStore';
import { rulerLabels } from './rulerMarks';

const editor = useEditorStore();
const { design, selection } = storeToRefs(useAssetDesignStore());

/**
 * ONE computed rather than a chain of them, and that is a coverage decision as much as a
 * structural one: every field below needs the same design, the same camera and the same step, and
 * splitting them would ask `design.value === null` again in each — arms nothing in a mounted
 * designer can reach a second time, since the root mounts the canvas only over a design it has.
 *
 * Both axes are read through `worldToScreen` rather than through `viewport.zoom`, which is the
 * same statement of the camera said twice: `CanvasGrid` multiplies its step by the zoom and is
 * the precedent for the tiling, not for the arithmetic.
 */
const model = computed(() => {
	const view = design.value;
	if (view === null || view.dimensionsUnscaled) return null;
	const viewport = editor.viewport;
	const perPixel = worldPerScreenPixel(viewport, STAGE_PIXELS);
	const { step, origin } = designerGrid(view.shape, perPixel);
	const x = (mm: number): number => worldToScreen({ x: origin.x + mm, y: origin.y }, viewport, STAGE_PIXELS).x;
	const y = (mm: number): number => worldToScreen({ x: origin.x, y: origin.y + mm }, viewport, STAGE_PIXELS).y;
	const near = screenToWorld(screenPoint(0, 0), viewport, STAGE_PIXELS);
	const far = screenToWorld(screenPoint(editor.stageSize.width, editor.stageSize.height), viewport, STAGE_PIXELS);
	// The COMMITTED shape's, like the grid's own origin: a gesture's preview moves the part, and an
	// extent mark sliding with it would be two answers to where the selection is during one drag.
	const box = view.shape === null ? null : selectionFrame(view.shape, selection.value, perPixel);
	return {
		step,
		tick: x(step) - x(0),
		zero: { x: x(0), y: y(0) },
		top: rulerLabels(step, near.x - origin.x, far.x - origin.x).map((mm) => ({ mm, at: `${String(x(mm))}px` })),
		left: rulerLabels(step, near.y - origin.y, far.y - origin.y).map((mm) => ({ mm, at: `${String(y(mm))}px` })),
		extent: box === null
			? null
			: {
				top: { left: `${String(x(box.min.x - origin.x))}px`, width: `${String(x(box.max.x - origin.x) - x(box.min.x - origin.x))}px` },
				left: { top: `${String(y(box.min.y - origin.y))}px`, height: `${String(y(box.max.y - origin.y) - y(box.min.y - origin.y))}px` },
			},
	};
});
</script>

<template>
	<div
		v-if="model !== null"
		class="rp-designer-rulers"
		role="img"
		:aria-label="tr('designer.rulers', { step: String(model.step) })"
	>
		<!--
			The LEFT strip first, so the top one paints over the corner the two share: both start at
			the canvas's own origin, which is what lets a label's `top` or `left` be the stage pixel
			its mark sits at with nothing subtracted for the other strip's width.
		-->
		<div
			class="rp-designer-ruler rp-designer-ruler--left"
			:style="{ backgroundSize: `100% ${String(model.tick)}px`, backgroundPosition: `0 ${String(model.zero.y)}px` }"
		>
			<span
				v-if="model.extent !== null"
				class="rp-designer-ruler__extent"
				:style="model.extent.left"
			/>
			<span
				v-for="label in model.left"
				:key="label.mm"
				class="rp-designer-ruler__label"
				:style="{ top: label.at }"
			>{{ label.mm }}</span>
		</div>
		<div
			class="rp-designer-ruler rp-designer-ruler--top"
			:style="{ backgroundSize: `${String(model.tick)}px 100%`, backgroundPosition: `${String(model.zero.x)}px 0` }"
		>
			<span
				v-if="model.extent !== null"
				class="rp-designer-ruler__extent"
				:style="model.extent.top"
			/>
			<span
				v-for="label in model.top"
				:key="label.mm"
				class="rp-designer-ruler__label"
				:style="{ left: label.at }"
			>{{ label.mm }}</span>
		</div>
	</div>
</template>
