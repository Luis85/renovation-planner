<script setup lang="ts">
/**
 * Where this object's SCALE comes from (AD12 item 1, contract C07): which sheet it is drawn
 * over, whether that sheet has been calibrated, and which coordinate groups are still in the
 * sheet's own pixels.
 *
 * **It is a STATUS and offers no action, which is a lease fact rather than a design one.** The
 * three gestures it describes already have doors — the picker (`assetBackgroundPicker.ts`), the
 * toolbar's Calibrate tool and the drawing tools — and every one of them is bound in
 * `AssetDesignerRoot.vue`, which AD12 does not own. Adding a fourth activation beside them would
 * break CLAUDE.md's "one action, every input" rule anyway; what was missing was never a second
 * button but a place that says where the sequence has got to.
 *
 * **The pending lines are the guarantee behind AD12's third acceptance criterion.** Replacing a
 * background clears the CALIBRATION and leaves every per-group flag exactly as it was
 * (`SetAssetBackground`, Decision 5), so a measured outline is not re-flagged and a pending one
 * does not lose its warning. That behaviour was already correct and invisible: the inspector
 * warned about the footprint alone, through `designer.dimensions.unscaled`, and said nothing
 * about a pending clearance, anchor or graphic. This draws all four.
 *
 * **One `<p>` per pending group rather than one sentence listing them**, because a list joined
 * in a template is a translated fragment concatenated with another — what `strings.ts` refuses.
 *
 * It draws nothing for an asset that has no sheet, no calibration and nothing pending: typing a
 * width and a depth is a whole path through this designer that never touches a reference, and a
 * block of "none" rows would be noise on every asset that took it.
 */
import { computed } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';

const props = defineProps<{ design: AssetDesignDto }>();

/**
 * The sheet's own name, and its page where it has one. The basename rather than the vault
 * path: the inspector is a narrow column, and the leading folders are the part of a path that
 * is never the answer to "which sheet is this".
 */
const sheet = computed(() => {
	const background = props.design.background;
	if (background === null) return tr('designer.reference.sheet.none');
	const name = background.path.slice(background.path.lastIndexOf('/') + 1);
	if (background.page === null) return name;
	return tr('designer.reference.sheet.page', { name, page: String(background.page) });
});

const scale = computed(() =>
	tr(props.design.calibration === null ? 'designer.reference.scale.none' : 'designer.reference.scale.set'),
);

/**
 * Which coordinate groups still hold sheet pixels, in the order the user captured them.
 *
 * Read off the STORED flags, never re-derived from whether a calibration exists — the join
 * `GetAssetDesign`'s own `dimensionsUnscaled` docblock refuses for both of its readings.
 */
const pending = computed((): StringKey[] => {
	const shape = props.design.shape;
	if (shape === null) return [];
	return [
		...(shape.footprintPending ? (['designer.reference.pending.footprint'] as const) : []),
		...(shape.clearancePending ? (['designer.reference.pending.clearance'] as const) : []),
		...(shape.anchorPending ? (['designer.reference.pending.anchor'] as const) : []),
		...(shape.details.some((detail) => detail.pending) ? (['designer.reference.pending.graphics'] as const) : []),
	];
});

const relevant = computed(
	() => props.design.background !== null || props.design.calibration !== null || pending.value.length > 0,
);
</script>

<template>
	<section
		v-if="relevant"
		class="rp-designer-reference"
	>
		<h3 class="rp-designer-panel-title rp-designer-section-title">
			{{ tr('designer.reference') }}
		</h3>
		<dl class="rp-designer-reference-fields">
			<dt>{{ tr('designer.reference.sheet') }}</dt>
			<dd>{{ sheet }}</dd>
			<dt>{{ tr('designer.reference.scale') }}</dt>
			<dd>{{ scale }}</dd>
		</dl>
		<p
			v-for="key in pending"
			:key="key"
			class="rp-designer-unscaled"
		>
			{{ tr(key) }}
		</p>
		<p
			v-if="pending.length > 0"
			class="rp-designer-field-hint"
		>
			{{ tr('designer.reference.pending.hint') }}
		</p>
	</section>
</template>
