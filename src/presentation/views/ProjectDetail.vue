<script setup lang="ts">
/**
 * One project's detail state (design slice 21, redrawn against screens P01/P02/P03/P05/P07):
 * who it is, a way back, a way to its own note, its entry paths, and its plans or its price
 * section.
 *
 * **The entry-path region lives in `ProjectEntryGuidance.vue`**, not here. It was a region of
 * this template until design slice 22 put three entry cards and the mobile `readOnly` branches
 * on it in one slice and fallow reported the template over its complexity budget — 28 cognitive
 * over 304 lines. The split is where the number came from rather than an ignore directive over
 * it; this file keeps the facts the region needs (`isNew`, `planRowsAbsent`) because they come
 * out of the same plan read the plans region below draws from, and it keeps the `PlanList` ref,
 * because "Choose a plan" hands the caret to a list this component is the one that renders.
 *
 * **`View schedule` and `Compare quotes` sit BELOW the plans**, not inside the guidance region.
 * P02's stated sequence is header → question → three entries → expanded plan list, and two more
 * buttons between the entries and the plans broke it; both stay reachable, one region later.
 */
import { computed, onMounted, ref } from 'vue';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import type { AssetPriceRowDto } from '../../application/queries/ListProjectAssetPrices';
import type { Logger } from '../../application/ports/Logger';
import type { AssetPriceCommitResult, AssetPriceEdit } from './assetPriceEdit';
import type { EmptyStateProps } from '../emptyStates/resolve';
import HostIcon from '../components/HostIcon.vue';
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
	/**
	 * P03: the stored continue context names a plan of THIS project that a SUCCESSFUL, COMPLETE
	 * plan read does not hold — a confirmed absence rather than a read this build could not
	 * finish. Resolved by `ProjectDetailState`, which is where both reads land.
	 */
	missingPlan?: boolean;
	/** The body scroller's saved offset, from the leaf-local session snapshot. */
	initialScroll?: number;

	unreadablePlans: number;
	emptyState: EmptyStateProps | null;

	assetPrices: readonly AssetPriceRowDto[];

	assetPricesFailure: string | null;
	commitAssetPrice: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>;
	logger: Logger;
}>();
defineEmits<{ back: []; openNote: []; openPlan: [planId: string]; createPlan: []; prices: []; schedule: []; quotes: []; toggleGuidance: []; refresh: []; retryPlans: []; scrolled: [top: number]; editState: [assetId: string, dirty: boolean, pending: boolean] }>();
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

/**
 * Whether no plan ROW will render — the fact "Choose a plan" needs, since it hands the caret to
 * a row rather than to the list element around it. Three terms, each a different way the rows
 * come out empty and none implying the others: a refused read draws its retry notice instead of
 * the list, an empty state replaces the list, and an all-unreadable read draws the LIST with no
 * rows in it — the plan empty state refuses on `unreadable > 0` before it looks at the length,
 * so it is null and the list renders empty.
 */
const planRowsAbsent = computed(() => (props.plansFailure ?? null) !== null || props.plans.length === 0);

/**
 * The plan read's warning, and it is TWO sentences rather than one with a count.
 *
 * `all-plans-unreadable` when the read succeeded, kept nothing and refused something: the state
 * matrix forbids "pretending confirmed emptiness", and an empty list under a notice saying SOME
 * notes refused says exactly that — the readable plans it points at do not exist.
 */
const plansNotice = computed(() =>
	props.unreadablePlans === 0
		? null
		: tr(props.plans.length === 0 ? 'view.project.all-plans-unreadable' : 'view.project.some-plans-unreadable'),
);

const heading = ref<HTMLElement | null>(null);
const recovery = ref<HTMLElement | null>(null);
const body = ref<HTMLElement | null>(null);

onMounted(() => {
	if (props.initialScroll !== undefined && body.value) body.value.scrollTop = props.initialScroll;
});

/**
 * Where the caret lands, CALLED by `ProjectDetailState` once its first hydrate has settled — not
 * decided here at mount.
 *
 * The timing is the whole reason it is imperative. This component is drawn from the `'ready'`
 * status, which the STORE sets partway through that hydrate; `missingPlan` is resolved after it,
 * against the plan list the same hydrate just read. Vue queues its flush at the first mutation,
 * so the mount runs BEFORE `missingPlan` arrives and an `onMounted` here read `false` every time
 * — measured in the recovery capture, which showed the ring on the project's name.
 *
 * A watcher would fix the timing and break the rule: a later hydrate flipping `missingPlan` true
 * is a BACKGROUND event, and §7 forbids one from moving focus. One call, from the one place that
 * knows the read has finished.
 *
 * The recovery heading wins over the project's own: after a failed resumption there is something
 * to read that the user did not ask for, and P03's rule is to focus the explanation rather than
 * an unrelated control.
 */
function focusEntry(): void {
	(props.missingPlan === true ? recovery.value : heading.value)?.focus();
}

defineExpose({ focusEntry });
</script>

<template>
	<div class="rp-project-detail">
		<div class="rp-project-detail__header">
			<button
				type="button"
				class="rp-project-detail__back"
				@click="$emit('back')"
			>
				<HostIcon name="arrow-left" />
				{{ tr(section === 'prices' ? 'view.project.prices-back' : 'view.project.back') }}
			</button>
			<h2
				ref="heading"
				class="rp-project-detail__name"
				tabindex="-1"
			>
				{{ project.name }}
			</h2>
			<p class="rp-project-detail__meta">
				<span class="rp-project-detail__status">
					<span
						class="rp-project-detail__status-dot"
						aria-hidden="true"
					/>
					{{ statusLabel(project.status) }}
				</span>
				<span
					class="rp-project-detail__meta-rule"
					aria-hidden="true"
				>|</span>
				<!--
					The bare code is what P01/P02/P07 draw, and the sentence `view.project.currency`
					carries is what an accessible name needs — "EUR" alone is a word rather than a
					fact about this project. Both, rather than one of them: the visible half is
					`aria-hidden` so the name is read once.
				-->
				<span class="rp-project-detail__currency">
					<span class="rp-visually-hidden">{{ tr('view.project.currency', { currency: project.currency }) }}</span>
					<span aria-hidden="true">{{ project.currency }}</span>
				</span>
			</p>
			<button
				type="button"
				class="rp-project-detail__open-note"
				@click="$emit('openNote')"
			>
				<HostIcon name="file-text" />
				{{ tr('view.project.open-note') }}
			</button>
		</div>

		<div
			ref="body"
			class="rp-project-detail__body"
			@scroll="$emit('scrolled', ($event.target as HTMLElement).scrollTop)"
		>
			<template v-if="section !== 'prices'">
				<!--
					ABOVE the guidance, which the state matrix requires outright ("guidance
					concealing warning"): three stacked entry cards at 460px push a warning drawn
					after them below the fold, so the region the user is told about is the one
					they cannot see.
				-->
				<div
					v-if="plansFailure"
					class="rp-view-notice"
				>
					<!--
						The RETRY sits outside the live region. `role="status"` on the wrapper
						re-announced the control with the sentence on every re-render, which is the
						flooding P03 names; the sentence alone is what changes.
					-->
					<p role="status">
						{{ plansFailure }}
					</p>
					<button
						type="button"
						@click="$emit('retryPlans')"
					>
						{{ tr('view.project.resume-retry') }}
					</button>
				</div>

				<p
					v-if="plansNotice !== null"
					class="rp-view-notice"
					role="status"
				>
					{{ plansNotice }}
				</p>

				<div
					v-if="missingPlan"
					class="rp-recovery__warning"
				>
					<HostIcon name="triangle-alert" />
					<span>{{ tr('view.project.resume-missing-plan') }}</span>
				</div>

				<ProjectEntryGuidance
					:guidance-hidden="guidanceHidden"
					:read-only="readOnly"
					:read-only-reason-id="readOnlyReasonId"
					:is-new="isNew"
					:plan-rows-absent="planRowsAbsent"
					:last-plan="lastPlan"
					@toggle-guidance="$emit('toggleGuidance')"
					@open-note="$emit('openNote')"
					@create-plan="$emit('createPlan')"
					@open-plan="(planId) => $emit('openPlan', planId)"
					@choose-plan="chooseFirstPlan"
					@prices="$emit('prices')"
				/>

				<div
					v-if="missingPlan"
					class="rp-recovery"
				>
					<h3
						ref="recovery"
						class="rp-recovery__title"
						tabindex="-1"
					>
						{{ tr('view.project.recovery-title') }}
					</h3>
					<p class="rp-recovery__body">
						{{ tr('view.project.recovery-body') }}
					</p>
				</div>

				<PlanList
					v-if="!plansFailure"
					ref="planList"
					:read-only="readOnly"
					:read-only-reason-id="readOnlyReasonId"
					:plans="plans"
					:empty-message="planEmpty === null ? null : planEmpty.body"
					@open="(planId) => $emit('openPlan', planId)"
					@create="$emit('createPlan')"
				/>

				<!--
					P02's sequence ends at the plan list, so these two follow it rather than
					sitting between the entries and the plans, which is where they were.
				-->
				<div class="rp-project-detail__entry-row">
					<button
						type="button"
						@click="$emit('schedule')"
					>
						{{ tr('schedule.open') }}
					</button>
					<button
						type="button"
						@click="$emit('quotes')"
					>
						{{ tr('quote.comparison') }}
					</button>
				</div>
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
