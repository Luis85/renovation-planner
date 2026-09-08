<script setup lang="ts">
import type { Loaded } from '../../../application/ports/versioning';
import type { ProjectOrigin } from '../../../application/navigation/ProjectDestination';
import type { Quote } from '../../../domain/quote/Quote';
import type { QuoteScopeRow } from './quoteComparisonRows';
import { formatPlanningMoney } from '../../i18n/planningFormat';
import { tr } from '../../i18n/strings';
defineProps<{ row: QuoteScopeRow; offers: readonly Loaded<Quote>[]; origin?: ProjectOrigin }>();
</script>
<template>
	<tr
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
			v-for="offer in offers"
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
</template>
