<script setup lang="ts">
import type { AssetPriceRowDto } from '../../application/queries/ListProjectAssetPrices';
import type { Logger } from '../../application/ports/Logger';
import type { AssetPriceCommitResult, AssetPriceEdit } from './assetPriceEdit';
import AssetPriceList from './AssetPriceList.vue';
import { tr } from '../i18n/strings';
defineProps<{
	assetPrices: readonly AssetPriceRowDto[];
	assetPricesFailure: string | null;
	pricesLoading?: boolean;
	readOnly?: boolean;
	draftReset?: number;
	currency: string;
	commitAssetPrice: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>;
	logger: Logger;
}>();
defineEmits<{ refresh: []; editState: [assetId: string, dirty: boolean, pending: boolean] }>();
</script>

<template>
	<p
		v-if="assetPricesFailure !== null"
		class="rp-asset-price-failure"
		role="status"
	>
		{{ assetPricesFailure }}
	</p>
	<button
		v-if="assetPricesFailure !== null"
		type="button"
		class="rp-price-refresh"
		@click="$emit('refresh')"
	>
		{{ tr('view.project.price-refresh') }}
	</button>
	<p
		v-if="pricesLoading"
		role="status"
	>
		{{ tr('view.project.loading') }}
	</p>
	<AssetPriceList
		v-if="!pricesLoading && (assetPricesFailure === null || assetPrices.length > 0)"
		:rows="assetPrices"
		:read-only="readOnly"
		:draft-reset="draftReset"
		:refresh-blocked="assetPricesFailure !== null"
		:currency="currency"
		:commit="commitAssetPrice"
		:logger="logger"
		@edit-state="(id, dirty, pending) => $emit('editState', id, dirty, pending)"
	/>
</template>
