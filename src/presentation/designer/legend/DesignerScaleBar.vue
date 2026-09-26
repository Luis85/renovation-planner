<script setup lang="ts">
/**
 * The designer's canvas scale bar (AD18-R17 Task 6, board 02's `0 250 500 mm`): a length the eye
 * can hold against the drawing, at the canvas's bottom-left under the legend.
 *
 * **Stepped by `designerGrid`, the ONE step function**, so every mark it names lands on a tick of
 * the rulers and of the grid: the bar spans ten, four or two of that step — the largest that stays
 * inside `MAX_BAR_PX` — and marks its start, its middle and its end. Ten steps is two of the
 * rulers' labelled spacings (`rulerMarks.ts` numbers every fifth step), which is where board 02's
 * `0 250 500` comes from at a 50 mm step; four and two are what a camera whose step is wide on
 * screen falls back to, and their marks are still whole steps.
 *
 * **Its length follows the LIVE camera and its place does not.** The bar is pinned to the corner
 * by `styles/designer-legend.css`; only its width is the camera's, written into its own `style`
 * as the rulers write their tiles.
 *
 * **A reading, not a control, and not announced**: `aria-hidden`, with the key it sits in taking no
 * press, for the rulers' reason — a screen reader is given the step by the rulers' own `role="img"`
 * name, and the Inspector owns this asset's measurements.
 *
 * **Nothing is drawn over the empty state or over an UNSCALED design.** A shapeless asset is what
 * the empty-state overlay is drawn over, and an unscaled one's coordinates are placeholder pixels,
 * which a millimetre bar would present as a measurement — `DesignerRulers`' own rule, for the same
 * reason (C07).
 *
 * **The legend's `View` toggle does not reach it**, and the narrow breakpoint that hides the legend
 * does not either: AD18-R17 asks for the bar whenever a design exists, so it is rendered BESIDE the
 * legend's `v-if` rather than inside it.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useEditorStore } from '../../stores/EditorStore';
import { STAGE_PIXELS, worldPerScreenPixel } from '../../editor/viewport/Viewport';
import { designerGrid } from '../grid/designerGrid';
import { useAssetDesignStore } from '../stores/assetDesignStore';

/**
 * The widest the bar is drawn, in stage pixels. `designerGrid`'s step is under 60 px on screen at
 * every camera the viewport allows, so two steps always fit and the bar is 64 to 160 px wide.
 */
const MAX_BAR_PX = 160;

const editor = useEditorStore();
const { design } = storeToRefs(useAssetDesignStore());

const bar = computed(() => {
	const view = design.value;
	if (view === null || view.shape === null || view.dimensionsUnscaled) return null;
	const perPixel = worldPerScreenPixel(editor.viewport, STAGE_PIXELS);
	const { step } = designerGrid(view.shape, perPixel);
	const steps = [10, 4].find((count) => (count * step) / perPixel <= MAX_BAR_PX) ?? 2;
	return { middle: (steps / 2) * step, end: steps * step, width: `${String((steps * step) / perPixel)}px` };
});
</script>

<template>
	<div
		v-if="bar !== null"
		class="rp-designer-scale-bar"
		aria-hidden="true"
	>
		<div
			class="rp-designer-scale-bar__ruler"
			:style="{ width: bar.width }"
		>
			<span class="rp-designer-scale-bar__mark">0</span>
			<span class="rp-designer-scale-bar__mark rp-designer-scale-bar__mark--middle">{{ bar.middle }}</span>
		</div>
		<span class="rp-designer-scale-bar__end">{{ tr('designer.legend.scale-bar.end', { length: String(bar.end) }) }}</span>
	</div>
</template>
