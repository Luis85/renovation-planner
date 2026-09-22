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
 * cosmetic**: `none` on a CONTAINER is what lets its children opt back in with `auto`, and these
 * strips have no children that should — a ruler is a reading and not a control, so a press
 * landing on one must reach the canvas underneath and start the pan the user meant.
 *
 * **The reason first written here was a non-sequitur and AD18-R11 corrects it.** It said that,
 * because the slot's wrapper carries `@pointerdown.stop` and its three siblings, *"a ruler
 * accepting a press would silently eat the gesture the canvas needs"*. Those modifiers are
 * BUBBLE-phase: a child's own handler runs first, in the target phase, untouched, so they are a
 * shield for the canvas against the overlay and not the reverse, and they make an accepting child
 * eat nothing. `DesignerDimensions` two files away is the proof — the same overlay slot, real
 * buttons and a real form in it.
 *
 * **It costs the canvas no LAYOUT, and AD18-R10 was AMENDED to say that is what its floor means.**
 * Two absolutely positioned strips inside the canvas region leave `.rp-designer-parts`,
 * `.rp-designer-canvas` and `.rp-designer-inspector` measuring exactly what they measured before,
 * at every width: the column is 50.0% of the shell at 580 px with the rulers and without them, to
 * the hundredth of a pixel. The ruling's sentence had a second reading — the DRAWING area after
 * the strips' own occlusion, 272.02 of 580, **46.9%** — and the amendment ("the binding is the
 * canvas COLUMN's share, and the drawing figure is disclosed beside it") takes the first, because
 * the second is unsatisfiable rather than strict: the column sits at exactly 50.0%, so any ruler
 * of any size would breach it and AD18-R10 read that way would forbid what AD18-R9 authorises.
 *
 * **So the 46.9% is a real cost to a real user at a sidebar leaf, disclosed rather than
 * dissolved** — 18 px of a 290 px canvas is 6.2% of the drawing spent on the only scale reference
 * this surface has, the grid being off by default (§2.6). It is written here so that nobody
 * re-derives it later as a discovery. No gate can see either figure, because jsdom computes no
 * layout; both are measured in a browser in
 * `docs/tasks/asset-designer-expansion/reports/W17-B-canvas-rulers.md`. If the narrow case is ever
 * reported as too tight, the cheap change the amendment names is hiding the rulers below
 * `designer-narrow.css`'s 35 rem breakpoint.
 *
 * **The step is `designerGrid`'s**, which makes the ruler the fourth reading of one function
 * rather than a second opinion about what a step is. Zero is that function's ORIGIN — the
 * committed footprint's box minimum — for the reason the grid counts from there: an offset from
 * the footprint's edge is then a whole number of steps on the ruler as well as on the grid, where
 * a ruler counted from the asset's middle would put every such offset on an odd number.
 *
 * **The FRAME is committed and the MARK is live, and the two readings are deliberate.** The step
 * and the origin come from `view.shape`, so §2.4's rule holds — dragging the footprint does not
 * slide the ruler under the drag. The extent band comes from `preview ?? view.shape`, which is
 * what `DesignerCanvas`'s own `shape` reads and therefore what `selectionMarks` and `framedBounds`
 * already follow: a band left on the committed millimetres while the selection box on the canvas
 * travels IS two answers to where the selection is during one drag, and it is the defect the first
 * version of this file shipped while its comment claimed to be avoiding it. The spec's increment 2
 * puts its dimensions "updated live from the drag preview", which is the same direction.
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
const { design, selection, preview } = storeToRefs(useAssetDesignStore());

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
	// The gesture's PREVIEW while one is live, exactly as `DesignerCanvas`'s own `shape` reads it —
	// see this component's header for why the band follows it and the tiling above does not.
	const drawn = preview.value ?? view.shape;
	const box = drawn === null ? null : selectionFrame(drawn, selection.value, perPixel);
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
