<script setup lang="ts">
import { computed } from 'vue';
import type { ProjectOrigin } from '../../../application/navigation/ProjectDestination';
import type { QuoteComparisonRead } from '../../../application/commands/quote/QuoteServices';
import type { Loaded } from '../../../application/ports/versioning';
import type { Quote } from '../../../domain/quote/Quote';
import { quoteExpired } from '../../../domain/quote/Quote';
import { quoteTotals } from '../../../domain/quote/compareQuotes';
import { quoteComparisonRows } from './quoteComparisonRows';
import { formatPlanningMoney } from '../../i18n/planningFormat';
import { tr } from '../../i18n/strings';
const props = defineProps<{ read: QuoteComparisonRead; today: string; blocked: boolean; origin?: ProjectOrigin }>();
defineEmits<{ edit: [offer: Loaded<Quote>]; revise: [offer: Loaded<Quote>] }>();
const rows = computed(() => quoteComparisonRows(props.read));
function supplier(quote: Quote): string { return props.read.suppliers.find(item => item.id === quote.supplierId)?.name ?? tr('quote.unresolved', { id: quote.supplierId }); }
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
					</th><th
						v-for="offer in read.offers"
						:key="offer.entity.id"
						scope="col"
					>
						<span>{{ offer.entity.title }}</span><p>{{ supplier(offer.entity) }}</p>
						<p>{{ tr(offer.entity.status === 'received' ? 'quote.received' : 'quote.draft') }} · {{ offer.entity.issuedOn }}</p>
						<p v-if="offer.entity.validUntil">
							{{ tr('quote.valid-until') }}: {{ offer.entity.validUntil }}
						</p>
						<p v-if="quoteExpired(offer.entity, today)">
							{{ tr('quote.expired') }}
						</p>
						<button
							v-if="offer.entity.status === 'draft'"
							type="button"
							:aria-disabled="blocked"
							@click="$emit('edit', offer)"
						>
							{{ tr('quote.edit') }}
						</button>
						<button
							type="button"
							:aria-disabled="blocked"
							@click="$emit('revise', offer)"
						>
							{{ tr('quote.revise') }}
						</button>
					</th>
				</tr>
			</thead>
			<tbody>
				<tr
					v-for="row in rows"
					:key="row.key"
					:class="{ 'is-selected': origin?.workId && row.labels.some(label => label.id === JSON.stringify([origin?.planId, origin?.workId])) }"
				>
					<th scope="row">
						<span v-if="row.unmapped">{{ tr('quote.unmapped') }}</span><ul v-else>
							<li
								v-for="label in row.labels"
								:key="label.id"
							>
								{{ label.name ?? tr('quote.unresolved', { id: label.id }) }}
							</li>
						</ul>
					</th>
					<td
						v-for="offer in read.offers"
						:key="offer.entity.id"
					>
						<p v-if="!row.cells.has(offer.entity.id)">
							{{ tr('quote.not-covered') }}
						</p>
						<ul v-else>
							<li
								v-for="item in row.cells.get(offer.entity.id)"
								:key="item.id"
							>
								{{ item.description }} · {{ formatPlanningMoney(item.amount) }}
							</li>
						</ul>
					</td>
				</tr>
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
