<script setup lang="ts">
/**
 * Board 01's `Source & scale` block (AD18-R17): how the footprint came to be, and whether its
 * dimensions are set — READ-ONLY, with no control, since the board's `Mark as needs verification`
 * would be a stored review state and the ruling carves it out.
 *
 * **Both rows are reads of stored facts, never a join.** `Source` is `shape.footprintOrigin`, the
 * provenance `SetAssetFootprint` records at capture: `typed` for a Width and Depth (or a preset's
 * values) entered in millimetres, `traced` for an outline drawn on the canvas. `Dimensions set` is
 * `design.dimensionsUnscaled` negated — `GetAssetDesign`'s own docblock says why that flag and
 * not "is there a calibration": a replaced sheet must not re-flag measured millimetres. The two
 * are independent, which is the point of showing both: a trace a calibration has converted is
 * still traced, and now measured.
 *
 * Draws nothing for a shapeless asset, like its placement and clearance siblings: there is no
 * footprint to have a source.
 */
import { computed } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import { tr } from '../../i18n/strings';

const props = defineProps<{ design: AssetDesignDto }>();

const origin = computed(() => props.design.shape?.footprintOrigin ?? null);
</script>

<template>
	<section
		v-if="origin !== null"
		class="rp-designer-source"
	>
		<h3 class="rp-designer-panel-title rp-designer-section-title">
			{{ tr('designer.source.title') }}
		</h3>
		<dl class="rp-designer-reference-fields">
			<dt>{{ tr('designer.source') }}</dt>
			<dd>{{ origin === 'typed' ? tr('designer.source.typed') : tr('designer.source.traced') }}</dd>
			<dt>{{ tr('designer.source.dimensions-set') }}</dt>
			<dd>{{ design.dimensionsUnscaled ? tr('designer.source.dimensions-set.no') : tr('designer.source.dimensions-set.yes') }}</dd>
		</dl>
	</section>
</template>
