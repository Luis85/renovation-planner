<script setup lang="ts">
/**
 * The creation dialog for a new Asset — design slice A10, and the FIRST form in this plugin
 * whose submit is a SEQUENCE rather than one command: the catalogue entry is created, and
 * then, only if the user typed both dimensions, its rectangle footprint is written into the
 * geometry sidecar (§88).
 *
 * **No new dialog KIND**, exactly like both of its siblings: it is another `component` under
 * slice 15's existing `kind: 'form'`, so none of the five edits a new kind costs apply. It
 * lives beside the view rather than in `presentation/dialogs/` because that directory holds
 * no field knowledge and may not reach `application/`, and this form is typed against
 * `CreateAssetInput`.
 *
 * It OWNS its dispatch, for `NewProjectForm`'s reason: a rejection has to leave the dialog
 * OPEN with the error under the field it is about, and `openDialog` throws while a dialog is
 * already open, so a caller that dispatched only after this component resolved could never
 * reopen it to show one.
 *
 * **Two rules stop a failed footprint write stranding an asset**, and they are the whole
 * reason this file is longer than its siblings:
 *
 *  1. **Everything purely checkable is checked before anything is written.**
 *     `footprintFromDimensions` and `createMoney` are both pure, so a zero, a negative, a
 *     malformed amount and a malformed currency are all caught with the vault untouched.
 *  2. **The created id is kept and reused on retry.** The note is committed before the
 *     sidecar is opened, so a vault fault in between leaves an asset that exists and has no
 *     footprint — usable, simply undesigned. Re-creating it on the retry would turn one
 *     vault fault into two catalogue entries, and since design slice 19 a catalogue is
 *     VAULT-WIDE: the duplicate is permanent and visible to every project.
 *
 * **Rule 1 is not politeness about ordering, it is what keeps `Money.of` from becoming a
 * fault.** `CreateAssetCommand.execute` calls `moneyOf(input.unitCostAmount, input.currency)`
 * on its first line, and `of` THROWS on a malformed amount or currency rather than refusing —
 * so `4,50` in the cost field would be caught by `guardCommand`, mapped by the vault's
 * `ExceptionMapper` and shown as `vault.unexpected-failure`: "reading or writing the vault
 * failed unexpectedly", about a vault nothing opened, under no field at all. `createMoney` is
 * the refusing sibling of that same pair of patterns (`AMOUNT_PATTERN` is strictly narrower
 * than `of`'s `LITERAL_PATTERN`, and the currency pattern is the same one), so a value that
 * passes here cannot throw there.
 */
import { ref, type Ref } from 'vue';
import FormSubmitRow from '../dialogs/FormSubmitRow.vue';
import { useDialogFormBusy } from '../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../composables/use-invalid-field-focus';
import { useFormCommit } from '../composables/use-form-commit';
import type { FieldErrorMap } from '../errors/route-error';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import type { AppError, ValidationError } from '../../core/errors/AppError';
import { createMoney } from '../../core/money/Money';
import { footprintFromDimensions } from '../../domain/asset/AssetShape';
import type { Asset } from '../../domain/asset/Asset';
import type { AssetId } from '../../domain/asset/AssetId';
import type { CreateAssetInput } from '../../application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../application/commands/asset/SetAssetFootprint';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { Logger } from '../../application/ports/Logger';
import { ASSET_CATEGORY_LABELS, MEASUREMENT_UNIT_LABELS } from './assetLabels';
import { trError } from '../i18n/toUserMessage';
import { tr } from '../i18n/strings';
import FieldError from '../components/FieldError.vue';
import FormBanner from '../components/FormBanner.vue';

const props = defineProps<{
	createAsset: (input: CreateAssetInput) => Promise<Result<Asset, AppError>>;
	setFootprintFromDimensions: (
		input: SetAssetFootprintFromDimensionsInput,
	) => Promise<DispatchResult>;
	/**
	 * `FormDescriptor.busy`'s other end (design slice 16). Optional so this component mounts
	 * on its own with nothing wired to it; written FROM `submitting` below and never read
	 * here, so there is no second flag for the two ends to drift out of step with.
	 */
	busy?: Ref<boolean>;
	/**
	 * Required, exactly as both siblings' are: `useFormCommit` has one door no guard stands
	 * behind — a dispatch that THROWS — where the unmapped cause is the only detail that
	 * exists at all.
	 */
	logger: Logger;
}>();

const emit = defineEmits<{ submit: [assetId: AssetId] }>();

/**
 * What the user types. The two dimensions are STRINGS rather than numbers because "not
 * given" is a state a `number` cannot hold: `Number('')` is `0`, which
 * `footprintFromDimensions` correctly refuses as non-positive — so a form that parsed
 * eagerly would refuse the perfectly ordinary case of creating a catalogue entry with no
 * geometry yet. Blank-versus-typed is decided on the raw text, once, in `parseDimensions`.
 */
interface NewAssetValues {
	name: string;
	category: CreateAssetInput['category'];
	unit: CreateAssetInput['unit'];
	unitCostAmount: string;
	currency: string;
	width: string;
	depth: string;
}

/**
 * The one code this form MINTS rather than routes, and it is minted here because there is
 * no command behind it: a rectangle needs both halves, and a user who typed one is not
 * refused by anything downstream — `parseDimensions` would simply have to invent the other.
 * `presentation/editor/deleteZoneFlow.ts` mints `reference.no-reassignment-target` on the
 * same grounds, and `toUserMessage.test.ts` carries both with `presentation/` as the module
 * that mints them.
 *
 * `asset.` rather than a `form.` prefix, because `toUserMessage`'s lookup is an exact match
 * on `error.code` and every other refusal this form renders is an `asset.` one — a second
 * prefix would be a second vocabulary for one control.
 */
function dimensionsIncomplete(): ValidationError {
	return {
		category: 'Validation',
		code: 'asset.dimensions-incomplete',
		message: 'A rectangle needs both a width and a depth; one was given without the other.',
	};
}

/**
 * Read from the RAISE SITES, never invented and never copied from `en.ts` — a table derived
 * from the locale file agrees with a typo. The `asset.*` entries are minted by `Asset.create`
 * and `footprintFromDimensions` through `assetError`'s `asset.${code}` template
 * (`src/domain/asset/Asset.errors.ts`), so a grep for the whole string finds nothing; the two
 * `money.*` entries are `createMoney`'s own, in `src/core/money/Money.ts`.
 *
 * **Three codes route to the PAIR, and that is the codes' own doing rather than a choice.**
 * `asset.non-positive-dimension` is minted inside a loop over `[width, depth]` and names
 * neither in anything but developer English; `asset.dimension-underflow` and
 * `asset.invalid-footprint` are each about the rectangle the two produce together. Routing any
 * of them to `width` alone would be a second answer to which field is wrong, and a wrong one
 * half the time.
 *
 * **What is deliberately ABSENT**, so the gaps read as decisions rather than omissions. The
 * eleven other codes `AssetShape.ts` mints — the clearance, anchor, facing and pending-flag
 * refusals, and `asset.no-footprint` — are about attributes this form does not render and
 * cannot send; `asset.invalid-height` and `asset.negative-height` likewise, height being
 * `SetAssetHeightCommand`'s field. `asset.not-found` cannot arise from a form that has just
 * created the asset it is writing to, except through a deletion racing the sidecar write, and
 * there is no field that would be about. Each of those still has COPY in `en.ts`/`de.ts` —
 * absence from this map routes to the banner, which is where they belong, and an absent
 * locale entry would instead put the generic Validation sentence there.
 */
const NEW_ASSET_ERRORS: FieldErrorMap<NewAssetValues> = {
	'asset.empty-name': 'name',
	'asset.unknown-category': 'category',
	'asset.negative-unit-cost': 'unitCostAmount',
	'money.invalid-amount': 'unitCostAmount',
	'money.invalid-currency': 'currency',
	'asset.dimensions-incomplete': ['width', 'depth'],
	'asset.non-positive-dimension': ['width', 'depth'],
	'asset.dimension-underflow': ['width', 'depth'],
	'asset.invalid-footprint': ['width', 'depth'],
};

/**
 * `wasteFactorDefault`, `supplier`, `sku` and `notes` are all optional on
 * `CreateAssetInput` and this form sends none: they are catalogue detail rather than
 * identity, and `UpdateAssetCommand` is what edits them. The five fields below are exactly
 * the ones the command REQUIRES, which is why every one of them is rendered rather than
 * defaulted — inventing a currency in particular would price an asset in a currency nobody
 * chose, and `Money` refuses to add two of them.
 */
const INITIAL: NewAssetValues = {
	name: '',
	category: 'material',
	unit: 'piece',
	unitCostAmount: '0',
	currency: 'EUR',
	width: '',
	depth: '',
};

/** The blank-versus-typed decision, made once, on the raw text. */
function parseDimensions(
	values: NewAssetValues,
): Result<{ readonly width: number; readonly depth: number } | null, ValidationError> {
	const width = values.width.trim();
	const depth = values.depth.trim();
	if (width === '' && depth === '') return ok(null);
	if (width === '' || depth === '') return err(dimensionsIncomplete());
	return ok({ width: Number(width), depth: Number(depth) });
}

/**
 * The asset this form has already created, held across submits so a retry after a failed
 * FOOTPRINT write dispatches only the footprint. `null` until the first `createAsset`
 * succeeds, and never cleared: once the entry exists in the vault there is no press of this
 * form's button that should make a second one.
 */
const createdAssetId = ref<AssetId | null>(null);

/**
 * The whole sequence, as `useFormCommit`'s single `dispatch`. Ordered so that everything
 * checkable without a write happens first — see this component's own header for why that
 * ordering is load-bearing rather than tidy.
 */
async function createAssetAndFootprint(
	values: NewAssetValues,
): Promise<Result<{ readonly assetId: AssetId }, AppError>> {
	const dimensions = parseDimensions(values);
	if (isErr(dimensions)) return dimensions;
	const money = createMoney(values.unitCostAmount, values.currency);
	if (isErr(money)) return money;
	// The pure half of the footprint, run for its REFUSAL rather than for its polygon: the
	// command re-derives the rectangle itself from the same two numbers, so what is thrown
	// away here is a repeat of work that costs nothing, and what is bought is that a zero or
	// a negative is refused with the vault untouched.
	if (dimensions.value !== null) {
		const footprint = footprintFromDimensions(dimensions.value.width, dimensions.value.depth);
		if (isErr(footprint)) return footprint;
	}

	let assetId = createdAssetId.value;
	if (assetId === null) {
		const created = await props.createAsset({
			name: values.name,
			category: values.category,
			unit: values.unit,
			unitCostAmount: values.unitCostAmount,
			currency: values.currency,
		});
		if (isErr(created)) return created;
		assetId = created.value.id;
		createdAssetId.value = assetId;
	}

	if (dimensions.value === null) return ok({ assetId });
	const written = await props.setFootprintFromDimensions({
		assetId,
		width: dimensions.value.width,
		depth: dimensions.value.depth,
	});
	if (isErr(written)) return written;
	return ok({ assetId });
}

const form = useFormCommit<NewAssetValues, { readonly assetId: AssetId }>({
	initial: INITIAL,
	dispatch: createAssetAndFootprint,
	errorMap: NEW_ASSET_ERRORS,
	toUserMessage: trError,
	logger: props.logger,
});

const refuseWhileSubmitting = useDialogFormBusy(form.submitting, props.busy);

/**
 * `:value` + `@input`, calling `setField` — never `v-model`, which would assign straight past
 * it and make the sole-write-path rule this composable exists for unenforceable.
 *
 * ONE handler over a key rather than seven near-identical ones. The siblings spell a function
 * per field because their fields have different TYPES — a `Date | null`, a `ProjectStatus` —
 * and each needs its own conversion; every field here is a string on the wire, including the
 * two selects, whose values are members of their own unions and are narrowed by the cast that
 * the control's own option list makes true.
 */
function onFieldInput<K extends keyof NewAssetValues>(key: K, event: Event): void {
	const control = event.target as HTMLInputElement | HTMLSelectElement;
	if (refuseWhileSubmitting(control, form.values.value[key])) return;
	form.setField(key, control.value as NewAssetValues[K]);
}

function categoryLabel(category: NewAssetValues['category']): string {
	return tr(ASSET_CATEGORY_LABELS[category]);
}

function unitLabel(unit: NewAssetValues['unit']): string {
	return tr(MEASUREMENT_UNIT_LABELS[unit]);
}

/**
 * The two vocabularies, in the order their label Records declare them. Neither domain module
 * ships an ordered array this form could take instead — `ASSET_CATEGORIES` exists but
 * `MeasurementUnit` has no equivalent — and taking both from the label tables is what keeps
 * the two controls unable to render a member with no label.
 */
const CATEGORIES = Object.keys(ASSET_CATEGORY_LABELS) as NewAssetValues['category'][];
const UNITS = Object.keys(MEASUREMENT_UNIT_LABELS) as NewAssetValues['unit'][];

// The focus move a rejected submit owes, and the `<form>` ref it queries. One statement of
// both for all three creation forms — `useInvalidFieldFocus`'s docblock carries the WCAG
// argument, why the control is found by query rather than by a key list, and why the
// Inspector's blur-committed fields deliberately do not get this.
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();

/**
 * Emits `submit` only when the whole sequence succeeded, carrying the id so the view can say
 * which asset it now has. `form.submit()` drops a concurrent press itself, which is what keeps
 * one form from creating two assets; no `if (form.submitting.value) return;` guard sits above
 * it, for the reason both siblings measured at length.
 */
async function onSubmit(): Promise<void> {
	if (await form.submit()) {
		// Non-null by construction: `submit()` answers `true` only on an ok `Result`, and every
		// ok arm of `createAssetAndFootprint` runs after `createdAssetId` has been set.
		emit('submit', createdAssetId.value as AssetId);
		return;
	}
	await focusFirstInvalidControl();
}
</script>

<template>
	<form
		ref="formEl"
		class="rp-dialog-form"
		@submit.prevent="onSubmit"
	>
		<FormBanner :message="form.banner.value" />
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('name') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-asset.name') }}
				<input
					:id="inputId"
					v-bind="aria"
					type="text"
					data-field="name"
					:value="form.values.value.name"
					:readonly="form.submitting.value"
					@input="onFieldInput('name', $event)"
				>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('category') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-asset.category') }}
				<select
					:id="inputId"
					v-bind="aria"
					data-field="category"
					:value="form.values.value.category"
					:aria-disabled="form.submitting.value"
					@change="onFieldInput('category', $event)"
				>
					<option
						v-for="category in CATEGORIES"
						:key="category"
						:value="category"
					>
						{{ categoryLabel(category) }}
					</option>
				</select>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('unit') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-asset.unit') }}
				<select
					:id="inputId"
					v-bind="aria"
					data-field="unit"
					:value="form.values.value.unit"
					:aria-disabled="form.submitting.value"
					@change="onFieldInput('unit', $event)"
				>
					<option
						v-for="unit in UNITS"
						:key="unit"
						:value="unit"
					>
						{{ unitLabel(unit) }}
					</option>
				</select>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('unitCostAmount') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-asset.unit-cost') }}
				<input
					:id="inputId"
					v-bind="aria"
					type="text"
					inputmode="decimal"
					data-field="unitCostAmount"
					:value="form.values.value.unitCostAmount"
					:readonly="form.submitting.value"
					@input="onFieldInput('unitCostAmount', $event)"
				>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('currency') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-asset.currency') }}
				<input
					:id="inputId"
					v-bind="aria"
					type="text"
					data-field="currency"
					:value="form.values.value.currency"
					:readonly="form.submitting.value"
					@input="onFieldInput('currency', $event)"
				>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('width') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-asset.width') }}
				<input
					:id="inputId"
					v-bind="aria"
					type="number"
					min="0"
					data-field="width"
					:value="form.values.value.width"
					:readonly="form.submitting.value"
					@input="onFieldInput('width', $event)"
				>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('depth') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-asset.depth') }}
				<input
					:id="inputId"
					v-bind="aria"
					type="number"
					min="0"
					data-field="depth"
					:value="form.values.value.depth"
					:readonly="form.submitting.value"
					@input="onFieldInput('depth', $event)"
				>
			</label>
		</FieldError>
		<FormSubmitRow :submitting="form.submitting.value" />
	</form>
</template>
