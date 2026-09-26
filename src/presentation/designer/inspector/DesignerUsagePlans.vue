<script setup lang="ts">
/**
 * The READY arm of the designer's usage scope — the plans themselves, or the sentence saying
 * there are none, plus the note that the list may be incomplete.
 *
 * **Extracted because `npm run analyze` said so, and factored rather than suppressed.**
 * `DesignerUsageScope.vue`'s template breached fallow's COGNITIVE threshold at 18: a `bound`
 * guard wrapping a three-way state branch, whose last arm then held a nested list-or-empty
 * choice and a third conditional note. Nesting is what cognitive complexity counts, and this
 * arm was the branchiest part with nowhere else to live — the same shape, and the same remedy,
 * this repository already recorded for AD09's two SFC findings and AD07's three template
 * breaches: *fixed by moving code; none suppressed.* A
 * `<!-- fallow-ignore-next-line complexity -->` was available and is refused, because the
 * complexity was real rather than miscounted.
 *
 * **It draws no state of its own and decides nothing about whether to appear.** The parent owns
 * the gate, the four states and their order; this owns what a READY answer looks like. So there
 * is no second opinion here about when a scope is unknown — the distinction
 * `DesignerUsageScope`'s header is built around — and nothing to keep in step with it.
 *
 * **No control, for the parent's reason** (ruling AD13-R1 part 2): this is a passive statement.
 * The rows are not links. Opening a plan from here would be a second navigation door beside
 * `Use in plan`, deciding on its own where to go, which is the shape `revealView`'s one-action
 * rule exists to refuse — and `AssetUsageScope.vue` declines the same thing for the same reason.
 */
import { tr } from '../../i18n/strings';

defineProps<{
	/**
	 * One row per plan, already labelled by the parent — which is deliberate rather than
	 * incidental. The label interpolates a plan name, its PROJECT's name and a placement count
	 * into one `view.asset-library.used-in-plans.plan` string, and that key is the library's;
	 * building it here would put a second caller on a string whose wording the parent's header
	 * argues about at length.
	 *
	 * The project is in the label and not a second element here for the reason
	 * `en/assetDuplicate.ts`'s header gives: `strings.ts` asks for one key per label rather than
	 * a translated fragment with markup choosing the punctuation around an interpolated name.
	 * It is also why this prop stays a flat `label` rather than growing a second field.
	 */
	rows: readonly { readonly planId: string; readonly label: string }[];
	/**
	 * How many plan notes could not be read. REQUIRED rather than defaulted to `0`: "none
	 * unreadable" and "nobody told me" are different claims at the one surface whose job is to
	 * state a blast radius, and a permissive default would collapse them into the reassuring
	 * one — this repository's own recorded defect shape, with the safety rule pointed the wrong
	 * way.
	 */
	unreadable: number;
}>();
</script>

<template>
	<ul
		v-if="rows.length > 0"
		class="rp-designer-usage-plans"
	>
		<li
			v-for="row in rows"
			:key="row.planId"
			:data-plan-id="row.planId"
		>
			{{ row.label }}
		</li>
	</ul>
	<p
		v-else
		class="rp-designer-usage-note"
	>
		{{ tr('view.asset-library.used-in-plans.none') }}
	</p>
	<!--
		A SIBLING of the pair above rather than a branch inside either, because it is true of both:
		a list of three plans with two notes unreadable is real and incomplete, and so is an empty
		list with two unreadable. Folding it into the list arm would silently drop the warning in
		exactly the case where it matters most — nothing found, and the reason unknown.
	-->
	<p
		v-if="unreadable > 0"
		class="rp-designer-usage-note"
		data-usage-incomplete="true"
	>
		{{ tr('view.asset-library.used-in-plans.unreadable', { count: String(unreadable) }) }}
	</p>
</template>
