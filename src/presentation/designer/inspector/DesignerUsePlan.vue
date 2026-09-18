<script setup lang="ts">
/**
 * AD13's forward door: take the asset this leaf is designing into a plan.
 *
 * **What it does today, stated at the width of the check rather than at the width of its
 * label.** Pressing it opens the Plan Editor on a plan — the one already open when exactly one
 * is, and otherwise the one picked from `PlanSuggestModal` — and stops there, leaving the user
 * in the surface where this plugin's ONE placement path lives (`AssetPlacementTool`, armed by
 * `assetPlacementTask.choose`). It does not arm that tool with this asset.
 *
 * **That last sentence is a missing CHANNEL and not a missing gesture**, which is why the
 * control ships rather than waiting. The only route into a Plan Editor leaf that is already open
 * is its `origin` view state — `prepareEditorArrival` writes it, `PlanEditorView.setState` parses
 * it and `useEditorArrival` acts on it — and `ProjectOrigin` names a room, a work item or a cost
 * with no asset arm at all, so an asset id put into it is stripped by `projectOriginFrom` and the
 * bare `{ planId }` that survives makes `useEditorArrival` warn about a record it cannot find.
 * Three files outside AD13's navigation lease own that channel; the task report names the exact
 * change each needs. Until it lands, this button's honest reach is the navigation, and nothing
 * here claims more.
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
	/** The way into a plan, or `undefined` where no door is bound — see `AssetDesignerContext.usePlan`. */
	usePlan?: () => void;
}>();

/** `assetShapeAnswer`'s `placeable` arm, asked of the DTO this panel already holds. */
const placeable = computed(() => props.design.dimensions !== null && !props.design.dimensionsUnscaled);
</script>

<template>
	<!--
		**The class and its rules landed together, which was the whole of the ask.** This button is
		the fourth flat inspector button, styled with its three siblings by
		`.rp-designer-inspector .rp-designer-{edit-dimensions,start-preset,open-library,use-plan}`
		in `styles/designer.css` — base, `:hover` and `:focus-visible`, three rules, one class name
		added to each. It had to be one change: `tests/build/libraryComponentStyles.test.ts` refuses
		a class the assembled sheet does not declare, so the class alone would have been a red gate
		and the rules alone would have styled nothing. `data-rp-action` remains what the suites
		select on, the same attribute the multiple-selection checkbox above uses — a class is for
		appearance and an action attribute is for identity, and neither stands in for the other.
	-->
	<button
		v-if="usePlan !== undefined && placeable"
		type="button"
		class="rp-designer-use-plan"
		data-rp-action="use-in-plan"
		@click="usePlan"
	>
		{{ tr('designer.inspector.use-in-plan') }}
	</button>
</template>
