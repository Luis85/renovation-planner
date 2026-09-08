<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import type { StringKey } from '../i18n/locales/en';
import type { AssetPriceRowDto } from '../../application/queries/ListProjectAssetPrices';
import type { Logger } from '../../application/ports/Logger';
import type { AssetPriceCommitResult, AssetPriceEdit } from './assetPriceEdit';
import type { EmptyStateProps } from '../emptyStates/resolve';
import EmptyState from '../components/EmptyState.vue';
import PlanList from './PlanList.vue';
import ProjectPrices from './ProjectPrices.vue';
import { statusLabel } from './statusLabel';
import { tr } from '../i18n/strings';

const props = defineProps<{
	section?: 'details' | 'prices';
	guidanceHidden?: boolean;
	readOnly?: boolean;
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
const emit = defineEmits<{ back: []; openNote: []; openPlan: [planId: string]; createPlan: []; prices: []; schedule: []; quotes: []; toggleGuidance: []; refresh: []; retryPlans: []; editState: [assetId: string, dirty: boolean, pending: boolean] }>();
const planEmpty = computed(() => (props.plansFailure ? null : props.emptyState));

/**
 * One entry path: a task worded as a benefit, and exactly one control that starts it (design
 * package `components/component-library.md`, `ProjectEntryAction`).
 *
 * A DESCRIPTOR rather than three near-identical blocks in the template, because the two variants
 * differ only in the ORDER of the same three entries and in which one is primary — spelling that
 * out twice is two places for the plan entry's four states to drift apart, and the template's own
 * cognitive complexity is already a measured constraint here (see `planEmptyActionLabel`).
 */
interface Entry {
	readonly key: string;
	readonly title: StringKey;
	readonly body: StringKey;
	/** Resolved rather than a key, because the plan entry's label interpolates a plan's name. */
	readonly label: string;
	readonly disabled: boolean;
	readonly act: () => void;
}

const planList = ref<InstanceType<typeof PlanList> | null>(null);

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

const noteEntry = computed<Entry>(() => ({
	key: 'note',
	title: 'view.project.entry-note-title',
	body: 'view.project.entry-note-body',
	label: tr('view.project.entry-note-action'),
	disabled: false,
	act: () => emit('openNote'),
}));

/**
 * The one entry with four states: create on a new project, and on an active one either the plan
 * the user last worked in BY NAME or, with nothing stored that still resolves, a hand-off to the
 * list below rather than a guess at which plan they meant.
 */
const planEntry = computed<Entry>(() => {
	const last = props.lastPlan ?? null;

	return {
		key: 'plan',
		title: isNew.value ? 'view.project.entry-plan-start-title' : 'view.project.entry-plan-continue-title',
		body: isNew.value ? 'view.project.entry-plan-start-body' : 'view.project.entry-plan-continue-body',
		label: isNew.value
			? tr('view.project.entry-plan-create')
			: last === null
				? tr('view.project.entry-plan-choose')
				: tr('view.project.entry-plan-open', { planName: last.name }),
		// The only entry a read-only surface withholds (P12): the other two navigate and read.
		disabled: props.readOnly === true,
		act: isNew.value
			? () => emit('createPlan')
			: last === null
				? () => void planList.value?.focusFirst()
				: () => emit('openPlan', last.id),
	};
});

const pricesEntry = computed<Entry>(() => ({
	key: 'prices',
	title: 'view.project.entry-prices-title',
	body: 'view.project.entry-prices-body',
	label: tr('view.project.prices-open'),
	disabled: false,
	act: () => emit('prices'),
}));

/**
 * Note first on a new project and the plan first on an active one — P01 and P02's own orders.
 * The FIRST entry is the primary one, which is what `mod-cta` on its action says; nothing else
 * about an entry changes with its position.
 */
const entries = computed<readonly Entry[]>(() =>
	isNew.value
		? [noteEntry.value, planEntry.value, pricesEntry.value]
		: [planEntry.value, noteEntry.value, pricesEntry.value],
);
// `ViewRoot.vue:314`'s own `emptyActionLabel` is the model: keep the empty state on a
// read-only surface (mobile), drop only the action it cannot dispatch. A dedicated computed
// rather than the ternary inline in the template, which pushed the template's own cognitive
// complexity over `fallow`'s threshold for one more branch.
const planEmptyActionLabel = computed(() => (props.readOnly ? undefined : planEmpty.value?.actionLabel));
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
				<div class="rp-project-guidance">
					<button
						type="button"
						class="rp-project-guidance__toggle"
						:aria-expanded="!guidanceHidden"
						@click="$emit('toggleGuidance')"
					>
						{{ tr(guidanceHidden ? 'view.project.guidance-show' : 'view.project.guidance-hide') }}
					</button>
					<template v-if="!guidanceHidden">
						<h3>{{ tr(isNew ? 'view.project.guidance-start-title' : 'view.project.guidance-title') }}</h3>
						<p v-if="isNew">
							{{ tr('view.project.guidance-optional-plan') }}
						</p>
					</template>
					<!--
						Hiding guidance drops the EXPLANATIONS and keeps every action (P01's own
						acceptance criterion), so the same three buttons in the same order collapse
						into the compact row the downstream pair below already uses.

						`rp-project-prices-open` is spelled here as a LITERAL rather than carried on
						the entry descriptor, and that is about a scan rather than about style:
						`tests/helpers/buttonRules.ts` reads `rp-*` tokens out of a `<button>` tag's
						own class attributes, so a class arriving through a variable is a class both
						button gates stop seeing — a selector older than this region quietly leaving
						the sweep, which is the shape those files keep paying for. The class itself
						is kept because two checks and this region's focus ring key on it.
					-->
					<div
						class="rp-project-detail__entries"
						:class="{ 'rp-project-detail__entry-row': guidanceHidden }"
					>
						<div
							v-for="(entry, at) in entries"
							:key="entry.key"
							class="rp-project-detail__entry"
						>
							<template v-if="!guidanceHidden">
								<h4 class="rp-project-detail__entry-title">
									{{ tr(entry.title) }}
								</h4>
								<p class="rp-project-detail__entry-body">
									{{ tr(entry.body) }}
								</p>
							</template>
							<button
								type="button"
								class="rp-project-detail__entry-action"
								:class="{ 'rp-project-prices-open': entry.key === 'prices', 'mod-cta': at === 0 }"
								:disabled="entry.disabled"
								@click="entry.act()"
							>
								{{ entry.label }}
							</button>
						</div>
					</div>
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
				</div>
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
					:action-label="planEmptyActionLabel"
					@action="$emit('createPlan')"
				/>
				<PlanList
					v-else-if="!plansFailure"
					ref="planList"
					:read-only="readOnly"
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
