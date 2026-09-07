<script setup lang="ts">
import { computed } from 'vue';
import type { QuoteComparisonRead } from '../../../application/commands/quote/QuoteServices';
import type { QuoteItemDraft } from './quoteDraft';
import { restoreInoperativeChoice } from '../../editor/forms/inoperativeControl';
import { tr } from '../../i18n/strings';
const item = defineModel<QuoteItemDraft>({ required: true });
const props = defineProps<{ read: QuoteComparisonRead; frozen: boolean }>();
const workKeys = computed(() => item.value.work.map(link => JSON.stringify([link.planId, link.workId])));
const choices = computed(() => {
 const known = props.read.work.rows.map(row => ({ key: JSON.stringify([row.planId, row.work.id]), planId: row.planId, workId: row.work.id, label: row.floor + ' · ' + row.work.title }));
 const keys = new Set(known.map(choice => choice.key));
 const missing = item.value.work.filter(link => !keys.has(JSON.stringify([link.planId, link.workId]))).map(link => ({ ...link, key: JSON.stringify([link.planId, link.workId]), label: tr('quote.unresolved', { id: link.workId }) }));
 return [...known, ...missing];
});
const assets = computed(() => [...props.read.assets, ...item.value.assetIds.filter(id => !props.read.assets.some(asset => asset.id === id)).map(id => ({ id, name: tr('quote.unresolved', { id }) }))]);
function workChanged(event: Event): void {
 const control = event.target as HTMLInputElement;
 if (props.frozen) { control.checked = workKeys.value.includes(control.value); return; }
 const chosen = choices.value.find(value => value.key === control.value);
 if (!chosen) return;
 const remaining = item.value.work.filter(link => link.planId !== chosen.planId || link.workId !== chosen.workId);
 item.value.work = control.checked ? [...remaining, { planId: chosen.planId, workId: chosen.workId }] : remaining;
}
</script>
<template>
	<label>{{ tr('planning.description') }}<input
		v-model="item.description"
		name="item-description"
		:readonly="frozen"
		required
	></label>
	<label>{{ tr('planning.amount') }}<input
		v-model="item.amount"
		name="item-amount"
		inputmode="decimal"
		:readonly="frozen"
		required
	></label>
	<label>{{ tr('quote.currency') }}<input
		v-model="item.currency"
		name="item-currency"
		:readonly="frozen"
		required
		maxlength="3"
	></label>
	<details>
		<summary>{{ tr('quote.link-work') }} ({{ item.work.length }})</summary>
		<label
			v-for="choice in choices"
			:key="choice.key"
		><input
			type="checkbox"
			:value="choice.key"
			:checked="workKeys.includes(choice.key)"
			:aria-disabled="frozen"
			@change.capture="restoreInoperativeChoice($event, workKeys)"
			@change="workChanged"
		>{{ choice.label }}</label>
	</details>
	<details>
		<summary>{{ tr('quote.link-assets') }} ({{ item.assetIds.length }})</summary>
		<label
			v-for="asset in assets"
			:key="asset.id"
		><input
			v-model="item.assetIds"
			type="checkbox"
			:value="asset.id"
			:aria-disabled="frozen"
			@change.capture="restoreInoperativeChoice($event, item.assetIds)"
		>{{ asset.name }}</label>
	</details>
</template>
