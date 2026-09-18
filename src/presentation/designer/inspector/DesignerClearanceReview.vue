<script setup lang="ts">
/**
 * AD14's answer to *"mark it as needing review"*: the notice a PRESERVED clearance carries after
 * the object around it was resized, and the one action that answers it (ruling AD14-R1, ADR-0034).
 *
 * **What the user is looking at when this draws.** They typed a smaller width into Edit dimensions;
 * the footprint and every detail scaled about the anchor and the clearance did not, so the boundary
 * they authored is standing around a smaller object where it visibly no longer fits. That picture
 * is the notice — this block only explains it and offers the answer. Scaling the clearance instead
 * would have fabricated a boundary nobody chose and then asked the user to check a number that
 * looks chosen, which at 600 mm becoming 500 mm a glance accepts.
 *
 * **Drawn only while the flag is set, by a predicate, never by `:disabled`.** A control that is
 * drawn and can only refuse is the live control that does nothing, which this expansion has shipped
 * three times in three different cards; `DesignerUsePlan` beside it states the same rule. ONE
 * condition is enough and a second would be unreachable: `validateAssetShape` refuses the flag on
 * an absent clearance, so `clearanceNeedsReview === true` already implies there is a boundary.
 *
 * **`=== true` rather than a bare read**, because `AssetShape.clearanceNeedsReview` is optional —
 * that field's own docblock measures why, and names this component as one of its two readers.
 *
 * **A refusal goes to `notifyIfRefused`, not to a paragraph here.** This action has no input for a
 * user to correct: `markClearanceReviewed` cannot fail pre-write on a shape that is already valid,
 * so anything that comes back is a write-boundary outcome, which that door routes to the save
 * indicator. `DesignerClearanceHelper` shows its refusals inline for the opposite reason — its
 * refusals are about four numbers the user typed.
 */
import { computed } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import { markClearanceReviewed } from '../../../domain/asset/shapeEdits';
import { tr } from '../../i18n/strings';
import { notifyIfRefused } from '../../editor/report-failure';
import type { EditShape } from '../selection/editShape';

const props = defineProps<{ design: AssetDesignDto; editShape: EditShape }>();

/** The whole predicate: a set flag already implies a clearance, so nothing else is asked. */
const needsReview = computed(() => props.design.shape?.clearanceNeedsReview === true);

async function markReviewed(): Promise<void> {
	await notifyIfRefused(props.editShape(markClearanceReviewed));
}
</script>

<template>
	<section
		v-if="needsReview"
		class="rp-designer-clearance"
	>
		<!--
			`role="status"` rather than `alert`: nothing is broken and no write was refused — the
			object simply says something the user should look at. The same register the unscaled
			dimensions warning above it takes, and it borrows that warning's class rather than
			minting one, since it is the same kind of sentence in the same panel.
		-->
		<p
			class="rp-designer-unscaled"
			role="status"
		>
			{{ tr('designer.clearance.review.notice') }}
		</p>
		<!--
			**`.rp-designer-selection-button`, and NO new selector — this card spends none of the
			twelve lines `styles/designer.css` has left.** Its lease anticipated one more flat
			inspector button joining
			`.rp-designer-{edit-dimensions,start-preset,open-library,use-plan}` at three lines. That
			is the wrong family, measured against where this control actually sits: those four are
			panel-level actions standing directly in the `<aside>`, full width with a bottom margin,
			while this one is inside a `.rp-designer-clearance` section — and the button already in
			that exact section, `DesignerClearanceHelper`'s `generate-clearance`, is a
			`.rp-designer-selection-button`. A fifth flat-button selector would have made this the
			only sectioned button dressed as a panel-level one, for three lines out of twelve.

			`data-rp-action` is what the suites select on, the same attribute
			`DesignerUsePlan` and the multiple-selection checkbox use: a class is for appearance and
			an action attribute is for identity, and neither stands in for the other.
		-->
		<button
			type="button"
			class="rp-designer-selection-button"
			data-rp-action="clearance-reviewed"
			@click="() => void markReviewed()"
		>
			{{ tr('designer.clearance.review.action') }}
		</button>
	</section>
</template>
