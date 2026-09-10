<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
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
	readOnlyReasonId?: string;
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
/**
 * P04's resting/editing split: the mockup shows ONE open editor and every other row at rest,
 * reading its values with an `Edit`/`Set project price` link. Before this the row drew a live
 * `<input>` on every asset unconditionally, so a section with forty assets was forty focus stops
 * over forty controls nobody had asked to open.
 */
const editing = ref(false);
/**
 * The confirmed `Saved` state, and it is a fact about the LAST WRITE rather than about the row:
 * `dirty` going false says only that this field holds no draft, which is equally true of a row
 * nobody has ever touched. Cleared the moment the user starts editing again, because a
 * confirmation standing over a fresh draft is a confirmation about the wrong value.
 */
const saved = ref(false);
const snapshot = ref<PriceRowExpectation | null>(null);
const field = ref<HTMLInputElement | null>(null);

const expected = computed<PriceRowExpectation>(() => snapshot.value ?? expectationOf(props.row));

let parsed: Money | null = null;

// Remove acts on persisted identity, while Cancel only abandons the draft.
const overridden = computed(() => props.row.overrideId !== null);

/**
 * **At most two fractional digits, and a group separator is REFUSED rather than stripped.**
 *
 * The pattern used to be `\d+(?:[.,]\d+)?` followed by `replace(',', '.')`, which read `1,234`
 * — one thousand two hundred and thirty-four in every locale that groups with a comma — as the
 * number 1.234, and accepted `1.234` as a price with three minor units. One digit cap closes
 * both: three digits after a single separator is exactly the grouped spelling, and execution
 * record decision 6 caps the minor units at two either way. REFUSED and never rounded — the
 * state matrix forbids silently changing a number the user typed.
 *
 * Multi-group (`1,234,567`) and mixed separators (`1,234.50`) were already refused by the
 * single-separator shape and stay refused. The `-?` survives so a negative reaches the branch
 * below and is told it is negative, rather than being told it is unreadable.
 */
const PRICE_PATTERN = /^-?\d+(?:[.,]\d{1,2})?$/;

function validatePrice(raw: string): string | null {
	parsed = null;
	if (raw.trim() === '') return overridden.value ? null : tr('view.project.price-invalid');
	if (!PRICE_PATTERN.test(raw.trim())) return tr('view.project.price-invalid');
	const minted: Result<Money, ValidationError> = createMoney(raw.trim().replace(',', '.'), props.currency);
	if (isErr(minted)) return tr('view.project.price-invalid');
	if (minted.value.amount.startsWith('-')) return tr('view.project.price-negative');
	parsed = minted.value;
	return null;
}

/**
 * **`settled` goes INTO the snapshot, which is what `AssetPriceCommitResult`'s own docblock has
 * always said this adapter does.** It was read as a boolean — "something settled, so release the
 * freeze" — and the pair the command actually established was discarded.
 *
 * The difference is only visible in the window between a confirmed write and the re-read landing:
 * `props.row` still describes the PRE-write pair there, so a row that released the freeze and a
 * user who edited again immediately submitted a version the vault had already moved past, and the
 * second edit refused with `asset-price.revision-conflict` about their own save. A failed refresh
 * locks the row, which is the only thing that was hiding it.
 *
 * Released by the watcher below rather than here, so a clean field still follows the vault.
 */
async function dispatch(edit: AssetPriceEdit): Promise<DispatchResult> {
	const result = await props.commit(edit);
	if (result.settled === null) return result.dispatch;
	snapshot.value = result.settled;
	dirty.value = false;
	if (!isErr(result.dispatch)) {
		editing.value = false;
		saved.value = true;
	}
	return result.dispatch;
}

/**
 * The release the line above hands over: a CLEAN field follows the vault, so the moment the
 * props carry a pair different from the one the row is holding, the freeze goes. Without it a
 * row would keep the pair its last save established for the life of the leaf and refuse the
 * next edit over a change the user can see on screen.
 *
 * Two separate getters rather than one returning a tuple, so Vue compares each source instead of
 * a fresh array that is never equal to the last one.
 */
watch(
	[() => props.row.overrideId, () => props.row.overrideVersion?.observed],
	() => {
		if (!dirty.value) snapshot.value = null;
	},
);

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

const priceUnavailable = computed(() => props.row.assetStatus !== 'known');
const pricePaused = computed(() => price.pending.value || props.refreshBlocked === true);

/** Opening the editor is a user gesture, so it takes the focus the gesture asked for. */
function beginEdit(): void {
	if (props.readOnly === true || priceUnavailable.value || pricePaused.value) return;
	saved.value = false;
	editing.value = true;
	void nextTick(() => field.value?.focus());
}

function onPriceInput(raw: string): void {
	if (price.pending.value || props.readOnly || props.refreshBlocked) return;
	dirty.value = true;
	saved.value = false;
	// Freeze optimistic concurrency at the first edit, including across external refreshes.
	snapshot.value ??= expectationOf(props.row);
	price.onInput(raw);
}

/**
 * Throwing the draft away, with no guard of its own — every caller states which pauses apply to
 * it, because they differ. `onPriceCancel` refuses while the row is paused; `draftReset` must
 * not, since the dirty-navigation dialog has already told the user the draft was discarded and
 * a refresh-blocked row that kept it would make that sentence false.
 */
function discardDraft(): void {
	dirty.value = false;
	editing.value = false;
	price.onCancel();
	snapshot.value = null;
}

function onPriceCancel(): void {
	if (price.pending.value || props.refreshBlocked) return;
	discardDraft();
}

/**
 * The guarded door onto `price.onCommit()` — Enter and Apply both route through this rather
 * than calling it directly, so a paused row (mid-write, read-only, or a `refreshBlocked`
 * concurrent change) refuses the commit instead of racing it. House pattern:
 * `RequirementRow.vue`'s `resetQuantity`.
 */
function onPriceCommit(): void {
	if (price.pending.value || props.readOnly || props.refreshBlocked) return;
	void price.onCommit();
}

async function onClear(): Promise<void> {
	if (price.pending.value || props.readOnly || props.refreshBlocked) return;
	editing.value = true;
	onPriceInput('');
	await price.onCommit();
}

watch(() => props.draftReset, discardDraft);
/**
 * The ARIA value rather than the boolean itself: `aria-disabled` is only ever present as the
 * literal string `'true'` (or absent), never `'false'`, so one place decides that mapping
 * instead of the template repeating the same ternary on the input and on Apply/Clear/Cancel.
 */
const pausedAria = computed(() => (pricePaused.value ? 'true' : undefined));
watch(() => [dirty.value, price.pending.value] as const, ([draft, pending]) => emit('editState', draft, pending), { flush: 'sync' });
onBeforeUnmount(() => emit('editState', false, false));
/**
 * What this project actually pays — the SAVED state and never the draft, which is P04's own
 * Gherkin: a 46.50 draft over a 49.90 catalogue price with no Apply still uses 49.90. It reads
 * `props.row` alone, so there is no path by which a draft could reach it.
 */
const candidate = computed(() => props.row.override ?? props.row.catalogue);
const showClear = computed(() => overridden.value);
const readOnlyReason = computed(() => (props.readOnly === true ? props.readOnlyReasonId : undefined));
const foreign = computed(() => candidate.value !== null && candidate.value.currency !== props.currency);

/**
 * The row's states, named once each.
 *
 * These are NOT template sugar. `npm run analyze` scores a template as one unit, and every
 * `a || b` re-spelled at four bindings is counted there as four branches in one 400-line
 * function — which is how this template reached a HIGH complexity finding while no single
 * question it asks is hard. Named here, each is a one-line function and the template reads as
 * the picture it draws.
 */
/**
 * Whether the row HAS a price in force. Both figures the row draws carry their own label in the
 * markup at every width — the column strip is decorative and the wide layout merely hides them —
 * so this decides between a figure and the sentence that says there is none, never between a
 * figure and a zero.
 */
/** The row's heading. A row whose asset is gone has no name, so its id stands in — never blank. */
const displayName = computed(() => props.row.assetName ?? props.row.assetId);
/**
 * **The price actually in force, and a FOREIGN candidate is not one.** `resolveEffectiveUnitCost`
 * refuses a currency that is not the project's — cost calculation never converts — so a catalogue
 * figure in another currency is a candidate this project cannot spend, exactly as P04 says: "a
 * catalogue price in another currency is not automatically usable in the project", and "no
 * usable price, never invented zero".
 *
 * Reading it as usable is what put `11.90 EUR` and `Different currency; not usable in this
 * project` in the same cell, which a capture found and no gate could: the column answers "what
 * does this project pay" and it was answering with a number the project cannot pay.
 */
const usable = computed<Money | null>(() =>
	priceUnavailable.value || foreign.value ? null : candidate.value,
);
/**
 * The resting row's own price. `Remove project price` is deliberately NOT paired with it: that
 * control is offered in BOTH states — beside `Edit` at rest, under the field when open — so it
 * is written once in the shared actions row rather than twice in two branches that drift.
 */
const savedFigure = computed<Money | null>(() => (editing.value ? null : props.row.override));
const editLabel = computed(() =>
	overridden.value ? tr('view.project.price-edit') : tr('view.project.price-set'),
);
/**
 * Opening an editor: refused on mobile, on a row no set could succeed against, and while paused.
 *
 * All three of the refusals below are real `disabled` rather than `aria-disabled` alone. The
 * handlers already returned early, so a focusable control that silently did nothing was the
 * live-control-that-does-nothing shape PBI-07 names when it asks for a clearly locked row. The
 * INPUT is the exception and keeps `readonly` + `aria-busy` instead, because disabling the
 * focused control drops focus to `body` mid-write.
 */
const editRefused = computed(() => props.readOnly === true || priceUnavailable.value || pricePaused.value);
const applyRefused = computed(() => priceUnavailable.value || pricePaused.value);
const clearRefused = computed(() => props.readOnly === true || pricePaused.value);
const fieldRefused = computed(() => priceUnavailable.value || props.readOnly === true);

/**
 * **`aria-describedby` takes an ID LIST, and the two producers here used to overwrite each
 * other.** `:aria-describedby="readOnlyReason"` sat before `v-bind="aria"`, so the later binding
 * won and the read-only reason vanished from the control for exactly as long as a field error was
 * showing — the moment a user most needs to know why the field will not take their correction.
 *
 * The parameter is typed structurally rather than as `FieldError`'s union so the `{}` arm (no
 * error) assigns without a cast.
 */
function describedBy(aria: { 'aria-describedby'?: string }): string | undefined {
	const ids = [readOnlyReason.value, aria['aria-describedby']].filter(
		(id): id is string => id !== undefined && id !== '',
	);
	return ids.length === 0 ? undefined : ids.join(' ');
}
</script>

<template>
	<li
		class="rp-asset-price-row"
		:class="{ 'rp-asset-price-row--editing': editing }"
	>
		<span class="rp-asset-price-name">{{ displayName }}</span>

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
			<span class="rp-asset-price-label">{{ tr('view.project.price-catalogue') }}</span>
			<span class="rp-asset-price-value">{{ row.catalogue.amount }} {{ row.catalogue.currency }}</span>
		</span>

		<div class="rp-asset-price-own">
			<span
				v-if="savedFigure"
				class="rp-asset-price-yours"
			>
				<span class="rp-asset-price-label">{{ tr('view.project.price-yours') }}</span>
				<span class="rp-asset-price-value">{{ savedFigure.amount }} {{ savedFigure.currency }}</span>
			</span>
			<!--
				The resting label on a row with no override (P04's `Kein eigener Preis`). It is the
				ABSENCE of a project price stated as a fact, which is the one thing this column must
				never leave to inference: an empty cell beside a catalogue figure reads as a price of
				nothing, and "missing price is not zero" is P04's own rule. Hidden while editing,
				where the field itself is the answer.
			-->
			<span
				v-else-if="!editing"
				class="rp-asset-price-none"
			>{{ tr('view.project.price-none') }}</span>

			<FieldError
				v-if="editing"
				v-slot="{ inputId, aria }"
				:message="price.error.value"
			>
				<label :for="inputId">

					{{ tr('view.project.price-set') }} ({{ currency }})
					<span class="rp-visually-hidden">{{ displayName }}</span>
				</label>
				<span class="rp-asset-price-field">
					<input
						:id="inputId"
						ref="field"
						v-bind="aria"
						:aria-describedby="describedBy(aria)"
						type="text"
						class="rp-asset-price-input"
						:disabled="fieldRefused"
						:readonly="pricePaused"
						:aria-disabled="pausedAria"
						:aria-busy="price.pending.value"
						:value="price.draft.value"
						@input="onPriceInput(($event.target as HTMLInputElement).value)"
						@keydown.enter.prevent="onPriceCommit()"
						@keydown.esc.stop="onPriceCancel()"
					>
					<span
						class="rp-asset-price-currency"
						aria-hidden="true"
					>{{ currency }}</span>
				</span>
			</FieldError>

			<div class="rp-asset-price-actions">
				<button
					v-if="!editing"
					type="button"
					class="rp-asset-price-edit"
					:disabled="editRefused"
					:aria-describedby="readOnlyReason"
					@click="beginEdit"
				>
					{{ editLabel }}
				</button>
				<template v-else>
					<button
						type="button"
						class="rp-asset-price-apply"
						:disabled="applyRefused"
						:aria-disabled="pausedAria"
						@click="onPriceCommit()"
					>
						{{ tr('view.project.price-apply') }}
					</button>
					<button
						type="button"
						class="rp-asset-price-cancel"
						:disabled="pricePaused"
						:aria-disabled="pausedAria"
						@click="onPriceCancel"
					>
						{{ tr('view.project.price-cancel') }}
					</button>
				</template>
				<button
					v-if="showClear"
					:disabled="clearRefused"
					:aria-describedby="readOnlyReason"
					:aria-disabled="pausedAria"
					type="button"
					class="rp-asset-price-clear"
					@mousedown.prevent
					@click="onClear"
				>
					{{ tr('view.project.price-clear') }}
				</button>
			</div>

			<span
				v-if="dirty"
				class="rp-asset-price-unsaved"
			>
				<span
					class="rp-asset-price-dot"
					aria-hidden="true"
				/>{{ tr('view.project.price-unsaved') }}
			</span>
			<span
				v-if="saved"
				class="rp-asset-price-saved"
				role="status"
			>{{ tr('view.project.price-saved') }}</span>
			<span
				v-if="price.pending.value"
				role="status"
			>{{ tr('view.project.price-pending') }}</span>
		</div>

		<span class="rp-asset-price-used">
			<span class="rp-asset-price-label">{{ tr('view.project.price-used') }}</span>
			<span
				v-if="usable"
				class="rp-asset-price-value"
			>{{ usable.amount }} {{ usable.currency }}</span>
			<!--
				The foreign sentence NAMES the reason there is no usable price, so it stands in for
				the generic one rather than beside it — two sentences saying the same absence read
				as two different problems.
			-->
			<span
				v-if="foreign"
				class="rp-asset-price-foreign"
			>{{ tr('view.project.price-foreign') }}</span>
			<span
				v-else-if="!usable"
				class="rp-asset-price-unusable"
			>{{ tr('view.project.price-none-usable') }}</span>
		</span>
	</li>
</template>
