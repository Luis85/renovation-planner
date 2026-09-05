<script setup lang="ts">
import { computed } from 'vue';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
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

	unreadablePlans: number;
	emptyState: EmptyStateProps | null;

	assetPrices: readonly AssetPriceRowDto[];

	assetPricesFailure: string | null;
	commitAssetPrice: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>;
	logger: Logger;
}>();
defineEmits<{ back: []; openNote: []; openPlan: [planId: string]; createPlan: []; prices: []; toggleGuidance: []; refresh: []; retryPlans: []; editState: [assetId: string, dirty: boolean, pending: boolean] }>();
const planEmpty = computed(() => props.plansFailure || props.readOnly ? null : props.emptyState);
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
						<h3>{{ tr('view.project.guidance-title') }}</h3>
						<p>{{ tr('view.project.guidance-body') }}</p>
					</template>
					<button
						type="button"
						class="rp-project-prices-open"
						@click="$emit('prices')"
					>
						{{ tr('view.project.prices-open') }}
					</button>
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
					@action="$emit('createPlan')"
				/>
				<PlanList
					v-else-if="!plansFailure"
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
