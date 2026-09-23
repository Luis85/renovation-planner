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
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useAssetDesignStore } from '../stores/assetDesignStore';
import { useDesignerRuntime } from '../runtime';
import { legendRows } from './legendRows';

const { design } = storeToRefs(useAssetDesignStore());
const { showLegend } = useDesignerRuntime();

const rows = computed(() => (showLegend.value ? legendRows(design.value?.shape ?? null) : []));
</script>

<template>
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
			<span>{{ tr(row.label) }}</span>
		</div>
	</div>
</template>
