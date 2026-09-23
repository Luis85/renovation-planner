<script setup lang="ts">
/**
 * The asset designer's canvas legend (AD18-R16 Task 4, board 01): a non-interactive reading of
 * what each swatch on the canvas means — Clearance, Footprint, Details, Placement point, Front
 * direction, whichever of those this design actually has (`legendRows.ts`).
 *
 * **A DOM overlay, in the SAME slot the rulers and the dimension labels already mount** —
 * `EditorSurface`'s `overlay`, via `DesignerCanvas.vue` — rather than a second slot: that spec's
 * decision table (AD18-R9/R11) already settled the mechanism for every canvas annotation, and
 * this component reopens nothing. Unlike its two neighbours it takes no press at all — every row
 * is a swatch and a label, nothing a user can act on — so `pointer-events: none` is the whole of
 * `styles/designer-legend.css`'s story rather than half of it the way it is for the dimensions.
 *
 * **One `v-if`, and it is what answers BOTH "hidden while the empty-state overlay is drawn" and
 * "no Clearance row without a clearance, no Details row without details".** `legendRows` earns no
 * row at all from a `null` shape, and a `null` shape is exactly what
 * `selectAssetDesignerEmptyState` requires before it ever draws that overlay — so there is no
 * second gate to keep in step with the first; the brief's two rules are one fact read twice.
 *
 * **The `View` menu's `Legend` checkbox is AD18-R12's kind of row**, the same shape
 * `allDimensions` already takes on `DesignerRuntime`: a plain leaf-local `ref`, default ON,
 * written nowhere. `runtime.ts`'s `showLegend` member carries the account.
 *
 * **The rows read the gesture's PREVIEW while one is live** (`preview ?? design.shape`), the
 * binding AD18-R11 carries forward and `DesignerRulers` / `DesignerDimensions` already follow: a
 * clearance dragged out of true must stop claiming one figure during the drag, not after it.
 *
 * **The root is the canvas KEY, not the legend** (AD18-R17 Task 6): one bottom-left column holding
 * the legend and, below it, `DesignerScaleBar`. One positioned box rather than two is what keeps the
 * two from overlapping without either knowing the other's height — they stack in flow. The scale bar
 * sits OUTSIDE the legend's `v-if`, because it outlives both the `Legend` toggle and the narrow
 * breakpoint that hides the legend; its own docblock says why. Over the empty state both are absent
 * and the key is an empty box that takes no press.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useAssetDesignStore } from '../stores/assetDesignStore';
import { useDesignerRuntime } from '../runtime';
import { legendRows } from './legendRows';
import DesignerScaleBar from './DesignerScaleBar.vue';

const { design, preview } = storeToRefs(useAssetDesignStore());
const { showLegend } = useDesignerRuntime();

const rows = computed(() => (showLegend.value ? legendRows(preview.value ?? design.value?.shape ?? null) : []));
</script>

<template>
	<div class="rp-designer-key">
		<div
			v-if="rows.length > 0"
			class="rp-designer-legend"
			role="group"
			:aria-label="tr('designer.legend')"
		>
			<div
				v-for="row in rows"
				:key="row.kind"
				class="rp-designer-legend__row"
			>
				<span
					class="rp-designer-legend__swatch"
					:class="`rp-designer-legend__swatch--${row.kind}`"
				/>
				<span>{{ tr(row.label, row.params) }}</span>
			</div>
		</div>
		<DesignerScaleBar />
	</div>
</template>
