<script setup lang="ts">
/**
 * The asset card atop the Inspector's Object tab (AD18-R16 Task 9, board 02): a decorative
 * footprint thumbnail beside the catalogue category, as a chip. **No name** — AD18-R1 already
 * put that in the header, and this task's own brief names checking that as the one thing the
 * implementing card owes.
 *
 * **Sits BEFORE `<h3>Asset</h3>`, not after it**, which is the placement decision this task's
 * brief asked the implementing card to make and record. `designerUsageScope.test.ts`'s own
 * *"sits directly under the asset heading, with no block between them (AD18-R1)"* case reads
 * `.rp-designer-usage-scope`'s `previousElementSibling` and requires it to be that `<h3>` —
 * inserting this card between the heading and the usage scope would put a block between them
 * and break that pin. Before the heading is also the more literal reading of "at the top of the
 * Asset block" and of AD18-R16's own table entry ("atop the Object tab"): with nothing selected
 * the `Asset` heading is already the tab's first `<h3>` (`designerInspector.test.ts`'s *"heads
 * the asset's own block"*), so a card drawn above it is the true top of both.
 *
 * **The thumbnail reuses `presetPreview`, never a third renderer.** `AssetMark.vue` was the
 * brief's other suggestion and takes an `AssetOutline` — a `ListAssetOutlines` read this leaf
 * does not have and would cost a new query and port to get. `presetPreview` takes the
 * `AssetShape` this leaf already reads off `design.shape`, and `AssetPresetForm.vue` already
 * draws its `footprint` path in exactly this decorative shape. Only the footprint is drawn, not
 * `.details`: the brief asks for "the asset's own footprint", and `AssetMark.vue`'s own
 * decorative mark draws no interior detail either.
 *
 * **Decorative and `aria-hidden`, like `AssetMark.vue`'s own mark** — the category text beside
 * it is the one accessible statement of what this is, so the drawing states nothing a second
 * time in a channel screen-reader users cannot compare against the visible chip.
 *
 * **The category chip carries no `v-if`.** `AssetDesignDto.category` is `AssetCategory`,
 * required and never `null`: `Asset.create`/`reconstitute` refuse an undeclared value through
 * `isAssetCategory` before this leaf ever reads one, so "if the asset has a category" (the
 * brief's own phrase, echoing board 02) is never false for a design this query can answer. The
 * code wins over the brief's conditional wording; this component draws the chip unconditionally.
 */
import { computed } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import { ASSET_CATEGORY_LABELS } from '../../views/assetLabels';
import { tr } from '../../i18n/strings';
import { presetPreview } from '../presets/presetPreview';

const props = defineProps<{ design: AssetDesignDto }>();

/** `null` for a shapeless asset (no footprint yet), which draws no thumbnail at all. */
const preview = computed(() => (props.design.shape === null ? null : presetPreview(props.design.shape)));
</script>

<template>
	<div class="rp-designer-asset-card">
		<svg
			v-if="preview !== null"
			class="rp-designer-asset-thumbnail"
			:viewBox="preview.viewBox"
			aria-hidden="true"
		>
			<path :d="preview.footprint" />
		</svg>
		<span class="rp-designer-asset-category">{{ tr(ASSET_CATEGORY_LABELS[design.category]) }}</span>
	</div>
</template>
