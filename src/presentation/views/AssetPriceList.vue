<script setup lang="ts">
/**
 * What this project pays for each shared catalogue asset (the per-project price override
 * increment): the library's default, this project's own price beside it, and the controls that
 * set and clear one.
 *
 * `PlanList.vue`'s sibling in SHAPE — an `<h3>` header, then a `<ul>` of rows — so the two read
 * as one person's work rather than two. `<h3>` and not `<h2>`: `ProjectDetail`'s project name is
 * the `<h2>` this sits under, and heading order is one of the five things
 * `tests/harness/accessibility.test.ts` actually grades.
 *
 * It DISPATCHES nothing itself: each row commits through the `commit` prop, which
 * `ProjectDetailState` binds to the guarded commands. A section reaching for a command of its
 * own would bypass the re-read that follows a successful write.
 *
 * **The whole catalogue rather than only the overrides**, because the section's question is
 * "what does this project pay", and a sparse list hides the comparison against the shared
 * default that §89 asks for.
 */
import type { AssetPriceRowDto } from '../../application/queries/ListProjectAssetPrices';
import type { Logger } from '../../application/ports/Logger';
import AssetPriceRow from './AssetPriceRow.vue';
import { tr } from '../i18n/strings';
import type { AssetPriceCommitResult, AssetPriceEdit } from './assetPriceEdit';

defineProps<{
	rows: readonly AssetPriceRowDto[];
	/**
	 * The PROJECT's currency, on the LIST rather than on every row: one project, one currency,
	 * and a per-row copy is a value that can disagree with itself. `ProjectSummaryDto.currency`
	 * is where it comes from — the field slice 21 renders in the header, which this increment
	 * gives its first consumer.
	 */
	currency: string;
	commit: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>;
	logger: Logger;
}>();
</script>

<template>
	<div class="rp-asset-price-header">
		<h3 class="rp-asset-price-title">
			{{ tr('view.project.prices-title') }}
		</h3>
	</div>
	<!--
		The project-wide disclosure, rendered ONCE with the section and never per row. It is a fact
		about what the control DOES — every requirement in this project on that asset is repriced —
		rather than about any one asset, so a per-row repetition would be the same sentence N times
		and would read as a per-row consequence. It sits under the `<h3>` and before the list, so it
		is read before the first control rather than discovered after one.

		This is the disclosure that justifies the affordance living on the project surface rather
		than on the Inspector's requirement row, which is why its absence would not be cosmetic:
		`I18N_LITERAL_BAN` fires at a literal and never at an absent one, so nothing but the
		rendering case in `assetPriceList.test.ts` can see whether it is here at all.
	-->
	<p class="rp-asset-price-scope">
		{{ tr('view.project.price-scope') }}
	</p>
	<!--
		The empty state is the LIST's, not the section's: the header and the disclosure stay drawn,
		because an empty state that replaces a region hides the thing the region exists to show —
		slice 14's own rule, and the reason `ProjectDetail` draws its no-plans state inside the
		plans region rather than in place of itself.
	-->
	<p
		v-if="rows.length === 0"
		class="rp-asset-price-empty"
	>
		{{ tr('view.project.no-assets') }}
	</p>
	<ul
		v-else
		class="rp-asset-price-list"
	>
		<AssetPriceRow
			v-for="row in rows"
			:key="row.assetId"
			:row="row"
			:currency="currency"
			:commit="commit"
			:logger="logger"
		/>
	</ul>
</template>
