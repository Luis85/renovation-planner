<script setup lang="ts">
import type { Loaded } from '../../../application/ports/versioning';
import { quoteExpired, type Quote } from '../../../domain/quote/Quote';
import type { Supplier } from '../../../domain/supplier/Supplier';
import { tr } from '../../i18n/strings';
const props = defineProps<{ offer: Loaded<Quote>; suppliers: readonly Supplier[]; today: string; blocked: boolean }>();
defineEmits<{ edit: [offer: Loaded<Quote>]; revise: [offer: Loaded<Quote>] }>();
function supplier(quote: Quote): string { return props.suppliers.find(item => item.id === quote.supplierId)?.name ?? tr('quote.unresolved', { id: quote.supplierId }); }
</script>
<template>
	<th
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
</template>
