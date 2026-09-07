<script setup lang="ts">
import { computed } from 'vue';
import type { ProjectOrigin } from '../../../application/navigation/ProjectDestination';
import type { QuoteComparisonRead } from '../../../application/commands/quote/QuoteServices';
import type { Loaded } from '../../../application/ports/versioning';
import type { Quote } from '../../../domain/quote/Quote';
import QuoteScopeRow from './QuoteScopeRow.vue';
import QuoteOfferHeader from './QuoteOfferHeader.vue';
import { quoteTotals } from '../../../domain/quote/compareQuotes';
import { quoteComparisonRows } from './quoteComparisonRows';
import { formatPlanningMoney } from '../../i18n/planningFormat';
import { tr } from '../../i18n/strings';
const props = defineProps<{ read: QuoteComparisonRead; today: string; blocked: boolean; origin?: ProjectOrigin }>();
defineEmits<{ edit: [offer: Loaded<Quote>]; revise: [offer: Loaded<Quote>] }>();
const rows = computed(() => quoteComparisonRows(props.read));
function totals(quote: Quote): string { const result = quoteTotals(quote); return result.ok ? result.value.map(value => formatPlanningMoney(value)).join(' · ') : tr('planning.totals-refused'); }
</script>
<template>
	<div
		class="rp-quote-comparison"
		tabindex="0"
		role="region"
		:aria-label="tr('quote.comparison')"
	>
		<table>
			<caption>{{ tr('quote.comparison') }}</caption>
			<thead>
				<tr>
					<th scope="col">
						{{ tr('quote.scope') }}
					</th><QuoteOfferHeader
						v-for="offer in read.offers"
						:key="offer.entity.id"
						:offer="offer"
						:suppliers="read.suppliers"
						:today="today"
						:blocked="blocked"
						@edit="$emit('edit', $event)"
						@revise="$emit('revise', $event)"
					/>
				</tr>
			</thead>
			<tbody>
				<QuoteScopeRow
					v-for="row in rows"
					:key="row.key"
					:row="row"
					:offers="read.offers"
					:origin="origin"
				/>
			</tbody>
			<tfoot>
				<tr>
					<th scope="row">
						{{ tr('quote.offer-total') }}
					</th><td
						v-for="offer in read.offers"
						:key="offer.entity.id"
					>
						{{ totals(offer.entity) }}
					</td>
				</tr>
			</tfoot>
		</table>
	</div>
</template>
