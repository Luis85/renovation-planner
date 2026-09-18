<script setup lang="ts">
/**
 * Where this object's SCALE comes from (AD12 item 1, contract C07): which sheet it is drawn
 * over, whether that sheet has been calibrated, and which coordinate groups are still in the
 * sheet's own pixels.
 *
 * **It carries exactly ONE action, and the three it merely describes still have their own doors.**
 * The picker (`assetBackgroundPicker.ts`), the toolbar's Calibrate tool and the drawing tools are
 * each bound in `AssetDesignerRoot.vue`, and repeating any of them here would break CLAUDE.md's
 * "one action, every input" rule. What this block owns is the one gesture that had NO door
 * anywhere: taking the reference away again (AD12-R2). It belongs beside the sentence naming the
 * sheet because that sentence is the only place in the designer that says which sheet this is.
 *
 * **The Remove button is drawn only while there IS a sheet** — a predicate, never a `:disabled`,
 * which is the repository's own rule about a control that can only refuse. It is not confirmed
 * either: the gesture goes through `SetAssetBackground`'s reversible adapter like every other one
 * here, so Ctrl+Z puts back both the reference and the calibration that went with it.
 *
 * **`removeBackground` is OPTIONAL and has no default**, which is a statement about a wire rather
 * than about the feature. An optional callback with a permissive default is precisely how a rule
 * shipped last wave that no gate could fire (`lockedGraphics`); with no default, an unbound parent
 * draws no button at all and `designerReferenceView.test.ts` says so out loud. It should be made
 * REQUIRED once `DesignerInspector.vue` binds it — a one-word change in a file this card does not
 * own.
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

const props = defineProps<{ design: AssetDesignDto; removeBackground?: () => Promise<void> }>();

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

/**
 * Both halves, and both are load-bearing: there is a reference to take away, and something is
 * actually bound to take it away with. Either missing and no control is drawn.
 */
const canRemove = computed(() => props.design.background !== null && props.removeBackground !== undefined);

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
		<button
			v-if="canRemove"
			type="button"
			name="remove-reference"
			class="rp-designer-selection-button"
			@click="() => void props.removeBackground?.()"
		>
			{{ tr('designer.reference.remove') }}
		</button>
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
