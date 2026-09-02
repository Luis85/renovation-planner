<script setup lang="ts">
/**
 * One project (design slice 21): who it is, a way back, a way to its own note, and its plans.
 *
 * It draws only what it is given and emits intents — the row/emit division `ProjectList`
 * already states. `openNote` is a SECONDARY action rather than the row's behaviour, which is
 * what design slice 21 is for: criterion 1 replaces the project row's open-the-note behaviour
 * with navigation into this state, and `Project.md` then stays reachable from here because the
 * plugin would otherwise have no route to a project's own metadata.
 *
 * **The row navigates as of Task 9**, which wired `@open` to `context.navigate`. This paragraph
 * has now been wrong in BOTH directions and is worth keeping as the record: it first claimed the
 * navigation as present fact before any commit did it, and was corrected to say Task 8 would
 * make it so — then Task 9 made it so and the correction went stale in its turn. A sentence
 * about another commit's behaviour needs re-reading by whoever lands that commit, which is the
 * narrower lesson than "write the guarantee to the check".
 *
 * The status reuses the shared `statusLabel`, which moved out of `ProjectList.vue` at this
 * second consumer.
 */
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import type { AssetPriceRowDto } from '../../application/queries/ListProjectAssetPrices';
import type { Logger } from '../../application/ports/Logger';
import type { AssetPriceCommitResult, AssetPriceEdit } from './assetPriceEdit';
import type { EmptyStateProps } from '../emptyStates/resolve';
import EmptyState from '../components/EmptyState.vue';
import PlanList from './PlanList.vue';
import AssetPriceList from './AssetPriceList.vue';
import { statusLabel } from './statusLabel';
import { tr } from '../i18n/strings';

/**
 * `emptyState` is the resolved `EmptyState` props for a project with no plans, or `null`.
 * It is drawn INSIDE the plans region rather than in place of this component, because the
 * Back and Open note controls live in this header and nowhere else — replacing the whole
 * detail state with an empty state takes a newly created project's only way back with it.
 * Slice 14's own rule, arriving on a third surface: an empty state that replaces a region
 * hides the thing the region exists to show.
 */
defineProps<{
	project: ProjectSummaryDto;
	plans: readonly PlanSummaryDto[];
	/** How many of this project's plan notes could not be read; 0 draws no strip. */
	unreadablePlans: number;
	emptyState: EmptyStateProps | null;
	/** The whole shared catalogue with this project's own price beside each default. */
	assetPrices: readonly AssetPriceRowDto[];
	/**
	 * The mapped sentence for a price read that FAILED, or `null`. Its own region rather than a
	 * mode of the list, and it replaces only the list: a project whose prices could not be read
	 * is still a project the user can look at and work in, so this must not take the header, the
	 * plans or the way back with it.
	 */
	assetPricesFailure: string | null;
	commitAssetPrice: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>;
	logger: Logger;
}>();
defineEmits<{ back: []; openNote: []; openPlan: [planId: string]; createPlan: [] }>();
</script>

<template>
	<div class="rp-project-detail">
		<div class="rp-project-detail__header">
			<button
				type="button"
				class="rp-project-detail__back"
				@click="$emit('back')"
			>
				{{ tr('view.project.back') }}
			</button>
			<h2 class="rp-project-detail__name">
				{{ project.name }}
			</h2>
			<span class="rp-project-detail__status">{{ statusLabel(project.status) }}</span>
			<span class="rp-project-detail__currency">
				{{ tr('view.project.currency', { currency: project.currency }) }}
			</span>
			<button
				type="button"
				class="rp-project-detail__open-note"
				@click="$emit('openNote')"
			>
				{{ tr('view.project.open-note') }}
			</button>
		</div>
		<!--
			ONE scrolling body under a pinned header, and it exists because this state has TWO
			regions now. `.rp-plan-list` used to claim the pane's slack itself (`flex: 1;
			min-height: 0; overflow-y: auto`) — correct while it was the last child, and wrong the
			moment the price section followed it: measured in a real browser at 800px of leaf, the
			shell overflowed, the last price row was drawn below the pane, clipped, with no
			scrollbar and no gesture that reached it. That is the identical defect that block was
			written to fix, arriving from the other side once it stopped being the only region.

			The scroll moved UP rather than being given to the shell, because the shell holds the
			header: Back, the project's name and Open note stay pinned, which is what they were
			pinned for. The plans header scrolls with its own list now, which is the one thing
			given up and the honest price of two sections sharing one pane.
		-->
		<div class="rp-project-detail__body">
			<!--
			ADDITIVE, and above BOTH branches below rather than inside either: the plans this
			project has and the plan notes that refused are independent facts. `.rp-view-notice`
			is reused deliberately — the same additive-warning role `ViewRoot` gives it on this
			same view, already declared in the stylesheet.

			It cannot draw beside the empty state today, because `selectProjectDetailEmptyState`
			answers `null` when anything refused — "Create your first plan" and "1 plan could not
			be read" are two sentences contradicting each other. Placed above the branch anyway,
			so that decision living in the selector is the only thing keeping them apart.
		-->
			<p
				v-if="unreadablePlans > 0"
				class="rp-view-notice"
				role="status"
			>
				{{ tr('view.project.some-plans-unreadable', { count: String(unreadablePlans) }) }}
			</p>
			<!--
			`heading-level="3"` because this empty state is EMBEDDED in the plans region rather
			than replacing the view: the project's own name above is an `<h2>`, and the populated
			branch gives `Plans` an `<h3>`, so the empty branch has to sit at the same level or a
			just-created project announces "No plans yet" as a peer of the project itself.
		-->
			<EmptyState
				v-if="emptyState !== null"
				v-bind="emptyState"
				:heading-level="3"
				@action="$emit('createPlan')"
			/>
			<PlanList
				v-else
				:plans="plans"
				@open="(planId) => $emit('openPlan', planId)"
				@create="$emit('createPlan')"
			/>
			<!--
			BELOW the plans region, which is a decision about what this pane is for: a project's
			plans are what a user came here to open, and the price section is a setting they came
			here to change. Placing it above would put a list of every catalogue asset between the
			project's name and its plans.

			The failure region REPLACES the list and nothing else, for the reason
			`assetPricesFailure`'s own prop docblock gives: a failed price read is not a failed
			project.
		-->
			<p
				v-if="assetPricesFailure !== null"
				class="rp-asset-price-failure"
				role="status"
			>
				{{ assetPricesFailure }}
			</p>
			<AssetPriceList
				v-else
				:rows="assetPrices"
				:currency="project.currency"
				:commit="commitAssetPrice"
				:logger="logger"
			/>
		</div>
	</div>
</template>
