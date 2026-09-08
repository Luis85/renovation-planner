<script setup lang="ts">
/**
 * One project's detail state (design slice 21): who it is, a way back, a way to its own note,
 * its entry paths, and its plans or its price section.
 *
 * **The entry-path region lives in `ProjectEntryGuidance.vue`**, not here. It was a region of
 * this template until design slice 22 put three entry cards and the mobile `readOnly` branches
 * on it in one slice and fallow reported the template over its complexity budget — 28 cognitive
 * over 304 lines. The split is where the number came from rather than an ignore directive over
 * it; this file keeps the facts the region needs (`isNew`, `planListAbsent`) because they come
 * out of the same plan read the plans region below draws from, and it keeps the `PlanList` ref,
 * because "Choose a plan" hands the caret to a list this component is the one that renders.
 */
import { computed, ref } from 'vue';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import type { AssetPriceRowDto } from '../../application/queries/ListProjectAssetPrices';
import type { Logger } from '../../application/ports/Logger';
import type { AssetPriceCommitResult, AssetPriceEdit } from './assetPriceEdit';
import type { EmptyStateProps } from '../emptyStates/resolve';
import EmptyState from '../components/EmptyState.vue';
import PlanList from './PlanList.vue';
import ProjectEntryGuidance from './ProjectEntryGuidance.vue';
import ProjectPrices from './ProjectPrices.vue';
import { statusLabel } from './statusLabel';
import { tr } from '../i18n/strings';

const props = defineProps<{
	section?: 'details' | 'prices';
	guidanceHidden?: boolean;
	readOnly?: boolean;
	/**
	 * The id of `ViewRoot`'s ONE mobile notice, or absent on desktop. Every control this
	 * component refuses points at it with `aria-describedby`, so the reason travels with the
	 * refusal rather than being discovered by pressing a dead button (requirement 4a).
	 */
	readOnlyReasonId?: string;
	draftReset?: number;
	plansFailure?: string | null;
	pricesLoading?: boolean;
	project: ProjectSummaryDto;
	plans: readonly PlanSummaryDto[];
	/**
	 * The plan the stored continue context names, when it is one of `plans` and belongs to THIS
	 * project — resolved by `ProjectDetailState`, which is where the read happens. `null` is the
	 * ordinary case and the only thing this component does with it is choose between naming a
	 * plan and offering the list.
	 */
	lastPlan?: PlanSummaryDto | null;

	unreadablePlans: number;
	emptyState: EmptyStateProps | null;

	assetPrices: readonly AssetPriceRowDto[];

	assetPricesFailure: string | null;
	commitAssetPrice: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>;
	logger: Logger;
}>();
defineEmits<{ back: []; openNote: []; openPlan: [planId: string]; createPlan: []; prices: []; schedule: []; quotes: []; toggleGuidance: []; refresh: []; retryPlans: []; editState: [assetId: string, dirty: boolean, pending: boolean] }>();
const planEmpty = computed(() => (props.plansFailure ? null : props.emptyState));

const planList = ref<InstanceType<typeof PlanList> | null>(null);

/**
 * "Choose a plan" names a destination `PlanList` owns and there is nothing for the guidance
 * region to dispatch, so it emits `choosePlan` and the caret moves here — the ref is where the
 * list is rendered, which is this component and not the region above it.
 */
const chooseFirstPlan = (): void => void planList.value?.focusFirst();

/**
 * **A project with no plans, as opposed to a project whose plans this build could not read.**
 *
 * All three halves are required and the two beyond `length` are the point: a refused read and a
 * partly unreadable one both leave `plans` empty, and inviting a FIRST plan onto a project that
 * may already hold several is the one thing the start variant must never do (P01, "unreadable
 * plans show a read-error state, not this 'new' layout"). The notices for both cases are drawn
 * below, so the user is told what happened; the guidance simply stops claiming to know.
 */
const isNew = computed(() => props.plans.length === 0 && props.unreadablePlans === 0 && (props.plansFailure ?? null) === null);

const planListAbsent = computed(() => (props.plansFailure ?? null) !== null || planEmpty.value !== null);
</script>

<template>
	<div class="rp-project-detail">
		<div class="rp-project-detail__header">
			<button
				type="button"
				class="rp-project-detail__back"
				@click="$emit('back')"
			>
				{{ tr(section === 'prices' ? 'view.project.prices-back' : 'view.project.back') }}
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

		<div class="rp-project-detail__body">
			<template v-if="section !== 'prices'">
				<ProjectEntryGuidance
					:guidance-hidden="guidanceHidden"
					:read-only="readOnly"
					:read-only-reason-id="readOnlyReasonId"
					:is-new="isNew"
					:plan-list-absent="planListAbsent"
					:last-plan="lastPlan"
					@toggle-guidance="$emit('toggleGuidance')"
					@open-note="$emit('openNote')"
					@create-plan="$emit('createPlan')"
					@open-plan="(planId) => $emit('openPlan', planId)"
					@choose-plan="chooseFirstPlan"
					@prices="$emit('prices')"
					@schedule="$emit('schedule')"
					@quotes="$emit('quotes')"
				/>

				<div
					v-if="plansFailure"
					class="rp-view-notice"
					role="status"
				>
					<p>{{ plansFailure }}</p>
					<button
						type="button"
						@click="$emit('retryPlans')"
					>
						{{ tr('view.project.resume-retry') }}
					</button>
				</div>

				<p
					v-if="unreadablePlans > 0"
					class="rp-view-notice"
					role="status"
				>
					{{ tr('view.project.some-plans-unreadable', { count: String(unreadablePlans) }) }}
				</p>

				<EmptyState
					v-if="planEmpty !== null"
					v-bind="planEmpty"
					:heading-level="3"
					:action-disabled="readOnly"
					:action-described-by="readOnly ? readOnlyReasonId : undefined"
					@action="$emit('createPlan')"
				/>
				<PlanList
					v-else-if="!plansFailure"
					ref="planList"
					:read-only="readOnly"
					:read-only-reason-id="readOnlyReasonId"
					:plans="plans"
					@open="(planId) => $emit('openPlan', planId)"
					@create="$emit('createPlan')"
				/>
			</template>
			<ProjectPrices
				v-else
				:asset-prices="assetPrices"
				:asset-prices-failure="assetPricesFailure"
				:prices-loading="pricesLoading"
				:read-only="readOnly"
				:read-only-reason-id="readOnlyReasonId"
				:draft-reset="draftReset"
				:currency="project.currency"
				:commit-asset-price="commitAssetPrice"
				:logger="logger"
				@refresh="$emit('refresh')"
				@edit-state="(id, dirty, pending) => $emit('editState', id, dirty, pending)"
			/>
		</div>
	</div>
</template>
