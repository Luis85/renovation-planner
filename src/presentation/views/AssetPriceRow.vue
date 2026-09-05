<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { createMoney, type Money } from '../../core/money/Money';
import { isErr, ok, type Result } from '../../core/result/Result';
import type { ValidationError } from '../../core/errors/AppError';
import type { AssetPriceRowDto } from '../../application/queries/ListProjectAssetPrices';
import type { PriceRowExpectation } from '../../application/commands/asset-price/priceRowExpectation';
import type { Logger } from '../../application/ports/Logger';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import { useFieldCommit } from '../composables/use-field-commit';
import type { FieldErrorMap } from '../errors/route-error';
import { trError } from '../i18n/toUserMessage';
import { tr } from '../i18n/strings';
import FieldError from '../components/FieldError.vue';
import { notifyOperationFailure } from '../notices/notify';
import type { AssetPriceCommitResult, AssetPriceEdit } from './assetPriceEdit';

const props = defineProps<{
	readOnly?: boolean;
	draftReset?: number;
	refreshBlocked?: boolean;
	row: AssetPriceRowDto;

	currency: string;
	commit: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>;

	logger: Logger;
}>();

const PRICE_ERRORS: FieldErrorMap<{ unitCost: Money | null }> = {
	'asset-price.currency-mismatch': 'unitCost',
	'asset-price.negative-unit-cost': 'unitCost',
	'asset-price.revision-conflict': 'unitCost',
	'asset-price.external-modification': 'unitCost',
};

function expectationOf(row: AssetPriceRowDto): PriceRowExpectation {
	return row.overrideId === null || row.overrideVersion === null
		? 'absent'
		: { id: row.overrideId, version: row.overrideVersion };
}

const emit = defineEmits<{ editState: [dirty: boolean, pending: boolean] }>();
const dirty = ref(false);
const snapshot = ref<PriceRowExpectation | null>(null);

const expected = computed<PriceRowExpectation>(() => snapshot.value ?? expectationOf(props.row));

let parsed: Money | null = null;

// Remove acts on persisted identity, while Cancel only abandons the draft.
const overridden = computed(() => props.row.overrideId !== null);

function validatePrice(raw: string): string | null {
	parsed = null;
	if (raw.trim() === '') return overridden.value ? null : tr('view.project.price-invalid');
	if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(raw.trim())) return tr('view.project.price-invalid');
	const minted: Result<Money, ValidationError> = createMoney(raw.trim().replace(',', '.'), props.currency);
	if (isErr(minted)) return tr('view.project.price-invalid');
	if (minted.value.amount.startsWith('-')) return tr('view.project.price-negative');
	parsed = minted.value;
	return null;
}

async function dispatch(edit: AssetPriceEdit): Promise<DispatchResult> {
	const result = await props.commit(edit);
	if (result.settled === null) return result.dispatch;
	snapshot.value = null;
	dirty.value = false;
	return result.dispatch;
}

const price = useFieldCommit<string, { unitCost: Money | null }>({
	canonicalValue: () => props.row.override?.amount ?? '',
	buildCommand: (raw) => ({
		execute: () => dispatch(
			raw.trim() === ''
				? { kind: 'clear', assetId: props.row.assetId, expected: expected.value }
				: {
					kind: 'set',
					assetId: props.row.assetId,
					expected: expected.value,
					unitCost: parsed as Money,
				},
		),
		undo: () => Promise.resolve(ok('no-write')),
	}),
	history: { run: (command) => command.execute() },
	errorMap: PRICE_ERRORS,
	field: 'unitCost',
	toUserMessage: trError,

	notify: notifyOperationFailure,
	logger: props.logger,
	validate: validatePrice,
});

function onPriceInput(raw: string): void {
	if (price.pending.value || props.readOnly || props.refreshBlocked) return;
	dirty.value = true;
	// Freeze optimistic concurrency at the first edit, including across external refreshes.
	snapshot.value ??= expectationOf(props.row);
	price.onInput(raw);
}

function onPriceCancel(): void {
	if (price.pending.value) return;
	dirty.value = false;
	price.onCancel();
	snapshot.value = null;
}

async function onClear(): Promise<void> {
	if (price.pending.value || props.readOnly || props.refreshBlocked) return;
	onPriceInput('');
	await price.onCommit();
}

watch(() => props.draftReset, onPriceCancel);
const priceDisabled = computed(() => props.row.assetStatus !== 'known' || price.pending.value || props.refreshBlocked);
watch(() => [dirty.value, price.pending.value] as const, ([draft, pending]) => emit('editState', draft, pending), { flush: 'sync' });
onBeforeUnmount(() => emit('editState', false, false));
const candidate = computed(() => props.row.override ?? props.row.catalogue);
const showClear = computed(() => !props.readOnly && overridden.value);
const showDraftActions = computed(() => !props.readOnly && dirty.value);
const foreign = computed(() => candidate.value !== null && candidate.value.currency !== props.currency);

</script>

<template>
	<li class="rp-asset-price-row">
		<span class="rp-asset-price-name">{{ row.assetName ?? row.assetId }}</span>

		<span
			v-if="row.assetStatus === 'orphan'"
			class="rp-asset-price-orphan"
		>{{ tr('view.project.price-orphan') }}</span>
		<span
			v-else-if="row.assetStatus === 'unreadable'"
			class="rp-asset-price-unreadable"
		>{{ tr('view.project.price-unreadable') }}</span>

		<span
			v-if="row.catalogue !== null"
			class="rp-asset-price-catalogue"
		>
			{{ tr('view.project.price-catalogue') }}: {{ row.catalogue.amount }} {{ row.catalogue.currency }}
		</span>

		<span
			v-if="row.override !== null"
			class="rp-asset-price-yours"
		>
			{{ tr('view.project.price-yours') }}: {{ row.override.amount }} {{ row.override.currency }}
		</span>
		<FieldError
			v-if="!readOnly"
			v-slot="{ inputId, aria }"
			:message="price.error.value"
		>
			<label :for="inputId">

				{{ tr('view.project.price-set') }} ({{ currency }})
				<span class="rp-visually-hidden">{{ row.assetName ?? row.assetId }}</span>
			</label>
			<input
				:id="inputId"
				v-bind="aria"
				type="text"
				class="rp-asset-price-input"
				:disabled="priceDisabled"
				:aria-busy="price.pending.value"
				:value="price.draft.value"
				@input="onPriceInput(($event.target as HTMLInputElement).value)"
				@keydown.enter.prevent="price.onCommit()"
				@keydown.esc.stop="onPriceCancel()"
			>
		</FieldError>

		<button
			v-if="showClear"
			:disabled="price.pending.value || refreshBlocked"
			type="button"
			class="rp-asset-price-clear"
			@mousedown.prevent
			@click="onClear"
		>
			{{ tr('view.project.price-clear') }}
		</button>
		<button
			v-if="showDraftActions"
			type="button"
			class="rp-asset-price-apply"
			:disabled="priceDisabled"
			@click="price.onCommit()"
		>
			{{ tr('view.project.price-apply') }}
		</button>
		<button
			v-if="showDraftActions"
			type="button"
			class="rp-asset-price-cancel"
			:disabled="price.pending.value"
			@click="onPriceCancel"
		>
			{{ tr('view.project.price-cancel') }}
		</button>
		<span
			v-if="price.pending.value"
			role="status"
		>{{ tr('view.project.price-pending') }}</span>
		<span
			v-if="foreign"
			class="rp-asset-price-foreign"
		>{{ tr('view.project.price-foreign') }}</span>
		<span
			v-if="candidate === null || row.assetStatus !== 'known'"
			class="rp-asset-price-unusable"
		>{{ tr('view.project.price-none-usable') }}</span>
	</li>
</template>
