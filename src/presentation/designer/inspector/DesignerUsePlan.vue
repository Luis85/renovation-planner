<script setup lang="ts">
/**
 * AD13's forward door: take the asset this leaf is designing into a plan.
 *
 * **What it does today, stated at the width of the check rather than at the width of its
 * label.** Pressing it hands this asset's id to `usePlan`, which opens the Plan Editor on a
 * plan — the one already open when exactly one is, and otherwise the one picked from
 * `PlanSuggestModal`.
 *
 * **The channel that carries the asset the rest of the way is COMPLETE at both ends**, and this
 * paragraph said the opposite for one commit. `ProjectOrigin.assetId`, `PlanEditorView`'s parse of
 * it and `useEditorArrival`'s arm of `assetPlacementTask` landed as the AD13 hand-off card's
 * receiving half: an origin of `{ planId, assetId }` set on a Plan Editor leaf arms
 * `AssetPlacementTool` with that asset, or refuses with the same reason the Add menu's picker
 * would give. The SENDER landed with the integration (ICR 1-H, `4521f6acf`) — `assetDesignerUsePlan`
 * in `src/plugin/renovationProjectOpenSeams.ts` arms a closure-scoped slot before it opens the
 * picker and spreads `{ planId, ...(assetId === undefined ? {} : { assetId }) }` into the origin
 * it opens with. Written from a grep of the three declarations rather than from memory:
 * `AssetDesignerContext.usePlan`, `DesignerInspector.vue`'s prop and this one all read
 * `(assetId: string) => void` at this commit, so the argument this template passes is carried
 * rather than dropped.
 *
 * **Drawn only where it can work, by a predicate, never by `:disabled`** — a control that is
 * drawn and can only refuse is the live control that does nothing, which this expansion has
 * shipped three times. Two conditions, and each is a real refusal downstream rather than a
 * guess:
 *
 * - **a door has to be bound.** `usePlan` is `undefined` under the browser harness and every
 *   component suite, where no composition root has wired navigation.
 * - **the asset has to be PLACEABLE**, which is `assetShapeAnswer`'s own three-way answer read
 *   off this surface's own DTO: it refuses `no-shape` when `shape` or `dimensions` is `null`, and
 *   `unscaled` when `footprintPending` is set — and `AssetDesignDto.dimensions` is `null` exactly
 *   in the first case while `dimensionsUnscaled` IS `footprintPending` (`GetAssetDesign` assigns
 *   it from that field). So `dimensions !== null && !dimensionsUnscaled` is the same predicate the
 *   placement flow applies, computed from the same numbers rather than from a second idea of what
 *   "ready" means. An asset in either refused state is one gesture away from being placeable —
 *   Set dimensions, or calibrate — and both of those controls are on this same panel.
 */
import { computed } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import { tr } from '../../i18n/strings';

const props = defineProps<{
	design: AssetDesignDto;
	/**
	 * The way into a plan, or `undefined` where no door is bound — see `AssetDesignerContext.usePlan`.
	 *
	 * It takes the asset id because that is what the door NEEDS to build a `{ planId, assetId }`
	 * origin. **Declaring it here makes NOTHING a type error**, which is worth keeping now that the
	 * sender exists, because it is why this seam needs a CASE rather than a compiler: `() => void`
	 * is assignable to `(assetId: string) => void`, so a narrower declaration anywhere along the
	 * chain would satisfy this prop and `vue-tsc` would still exit 0 with the argument silently
	 * dropped. Measured by running it when the sender was absent, not reasoned. The instrument that
	 * fails without the wiring is `tests/plugin/assetDesignerUsePlan.test.ts`, never the build.
	 */
	usePlan?: (assetId: string) => void;
}>();

/** `assetShapeAnswer`'s `placeable` arm, asked of the DTO this panel already holds. */
const placeable = computed(() => props.design.dimensions !== null && !props.design.dimensionsUnscaled);
</script>

<template>
	<!--
		**The class and its rules landed together, which was the whole of the ask**, and it had to
		be one change: `tests/gates/libraryComponentStyles.test.ts` refuses a class the assembled
		sheet does not declare, so the class alone would have been a red gate and the rules alone
		would have styled nothing.

		**WHERE those rules live has moved twice since, and this comment named the old place for
		two waves.** It said this was "the fourth flat inspector button, styled with its three
		siblings by `.rp-designer-inspector .rp-designer-{edit-dimensions,start-preset,open-library,use-plan}`
		in `styles/designer.css`". That family has been taken apart, each member following its
		button: AD18 moved this component into the header, where `DesignerHeader.vue` mounts it and
		`styles/designer-header.css` styles it as `.rp-designer-title-bar .rp-designer-use-plan`
		beside `.rp-designer-open-library`; and AD18-R6 moved `.rp-designer-start-preset` to the
		`Add` rail. `grep -rn "rp-designer-use-plan" styles/` prints FIVE lines in this edit: three
		selectors in `designer-header.css` (base, `:hover`, `:focus-visible`), and two comment
		lines, one in each partial, recording the move — none of the five under
		`.rp-designer-inspector`. The component still lives under `inspector/`,
		which is the last thing about the old arrangement that is still true. `data-rp-action` remains what the suites
		select on, the same attribute the multiple-selection checkbox above uses — a class is for
		appearance and an action attribute is for identity, and neither stands in for the other.
	-->
	<button
		v-if="usePlan !== undefined && placeable"
		type="button"
		class="rp-designer-use-plan"
		data-rp-action="use-in-plan"
		@click="usePlan(design.assetId)"
	>
		{{ tr('designer.inspector.use-in-plan') }}
	</button>
</template>
