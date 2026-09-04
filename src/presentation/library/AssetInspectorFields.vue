<script setup lang="ts">
/**
 * §3.5 section 1 — **Definition**: name, category, unit, unit cost, waste factor, supplier,
 * SKU, notes and height, editable in place through `useFieldCommit` against the existing
 * `UpdateAsset` and `SetAssetHeight`.
 *
 * **A component of its own because the `:key` HAS to remount something.** §3.5's keying rule
 * says each field's commit state is keyed by `assetId` — and `useFieldCommit` is called in a
 * SETUP, so a `:key` on an element inside `AssetInspector.vue` would re-render markup while
 * leaving the nine composables, their drafts and their errors exactly where they were. Only a
 * child component instance can be discarded and rebuilt by a key. That is why this file exists
 * rather than being a block in the panel, and it is the reason the panel's own docblock names.
 *
 * **BOTH halves of that rule, because either alone leaves a real defect.** The key discards
 * A's retained draft when the user clicks B; `notifySubject` below discards an OUTCOME whose
 * subject is no longer selected, because a resolved promise still points at this retired
 * instance and would otherwise run `notify` — a toast about an asset the user has left. §3.5:
 * *"Keying alone leaves the resolved promise pointing at a retired instance, which is harmless
 * for the DOM and still runs `notify`."*
 *
 * **Category and unit are `<select>`s over their own closed vocabularies rather than text
 * fields**, and the reason is what the DOMAIN checks rather than what the seam looks like:
 * `Asset.create` refuses an unknown CATEGORY and validates no UNIT at all, so a typo'd `m22`
 * from a text field would have been persisted with nothing anywhere refusing it. Both paths
 * cast at `UpdateAssetInput.changes` either way — this file writes three casts — and the
 * `<select>` is what makes those casts SOUND rather than absent: the value came from the option
 * list the same constant built, so there is no string the control can produce that the type does
 * not already admit. An earlier version of this paragraph argued "a cast is a claim nothing
 * checks" from inside a file performing three, which is true of a text draft and not of this one.
 *
 * Height is here and not in Shape, per §3.5's own rule: *Shape lists what the sidecar derives;
 * Definition lists what the note stores and a field edits.* It is the one field of the nine
 * that does not go through `UpdateAsset`, because a height lives on the note (ADR-0014) and
 * `SetAssetHeight` is its command.
 *
 * No `<style>` block, ever (`vue/no-restricted-block`): Task 15 owns
 * `styles/asset-library-inspector.css`, and this file only emits the classes.
 */
import { computed } from 'vue';
import { Decimal } from 'decimal.js';
import { ok, isErr } from '../../core/result/Result';
import { of as moneyOf } from '../../core/money/Money';
import type { AppError } from '../../core/errors/AppError';
import { UNIT_KIND, type MeasurementUnit } from '../../core/units/MeasurementUnit';
import { ASSET_CATEGORIES, type AssetCategory } from '../../domain/asset/AssetCategory';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { UpdateAssetInput } from '../../application/commands/asset/UpdateAsset';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import { useFieldCommit, type UseFieldCommit } from '../composables/use-field-commit';
import type { FieldErrorMap } from '../errors/route-error';
import { notifyOperationFailure } from '../notices/notify';
import FieldError from '../components/FieldError.vue';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import type { StringKey } from '../i18n/locales/en';
import { useAssetLibraryContext } from './AssetLibraryContext';
import { useAssetSelectionStore } from '../stores/AssetSelectionStore';

const props = defineProps<{ entry: CatalogueEntryDto }>();

const context = useAssetLibraryContext();
const selection = useAssetSelectionStore();

/**
 * The form shape `routeError` places a refusal on — one flat record keyed by the field NAMES
 * this template renders, never `UpdateAssetInput['changes']`: `height` is not a member of that
 * type at all (it is `SetAssetHeight`'s), so a map typed to it could not carry the two height
 * codes and `field: 'height'` would not compile.
 */
interface DefinitionForm {
	name: string;
	category: string;
	unit: string;
	unitCost: string;
	waste: string;
	supplier: string;
	sku: string;
	notes: string;
	height: string;
}

/**
 * Every code copied from its RAISE SITE, never guessed from a field's name — a map keyed on a
 * code nothing raises is invisible to every gate, since `FieldErrorMap` takes any string and
 * `routeError` simply finds no entry.
 *
 * `asset.unit-kind-referenced` routes to **unit** and not to a banner (§3.5): a unit edit
 * crossing `UNIT_KIND` while a Requirement still references the asset is refused by
 * `UpdateAssetCommand.resolveKindChange`, and the unit is the field that is wrong.
 *
 * `asset.not-found` and every persistence code are deliberately absent: they are not about a
 * value in one of these inputs, so they take the notice door below.
 */
const DEFINITION_ERRORS: FieldErrorMap<DefinitionForm> = {
	'asset.empty-name': 'name',
	'asset.unknown-category': 'category',
	'asset.unit-kind-referenced': 'unit',
	'asset.negative-unit-cost': 'unitCost',
	'asset.negative-waste-factor-default': 'waste',
	'asset.waste-factor-default-above-one': 'waste',
	'asset.invalid-height': 'height',
	'asset.negative-height': 'height',
};

/**
 * §3.5's subject test, and the half a `:key` cannot perform.
 *
 * This instance is discarded the moment the selection moves, so its inline error goes with it
 * — but a dispatch already in flight settles afterwards and `useFieldCommit` calls `notify`
 * for anything it could not display. Without this guard the user, now reading asset B, is
 * told about a refusal concerning asset A.
 */
function notifySubject(error: AppError): void {
	if (selection.selectedId !== props.entry.assetId) return;
	notifyOperationFailure(error);
}

/** `UpdateAsset` answers the saved `Asset`; `useFieldCommit` reads only the failure arm, so the
 *  success is reduced to the `'wrote'` every accepted write on this surface is. */
async function updated(changes: UpdateAssetInput['changes']): Promise<DispatchResult> {
	const result = await context.commands.updateAsset.execute({
		assetId: props.entry.assetId,
		changes,
	});
	return isErr(result) ? result : ok('wrote');
}

/**
 * `RunnableCommand` requires both halves and this seam runs only the forward one: the Asset
 * library mounts no `CommandHistory`, and `updateAsset`/`setAssetHeight` are the guarded
 * commands the composition root composed. ONE function rather than nine identical closures —
 * `RequirementRow` states the same shape one seam down, twice; nine copies of an unreachable
 * arrow are nine uncovered functions against a 99% floor.
 */
const noUndo = (): Promise<DispatchResult> => Promise.resolve(ok('no-write'));

interface DefinitionField {
	readonly name: keyof DefinitionForm;
	readonly label: StringKey;
	readonly commit: UseFieldCommit<string>;
}

/**
 * One field, wired the same way nine times.
 *
 * The draft is the raw STRING for every one of them, exactly as `RequirementRow`'s two are and
 * for its stated reason: `moneyOf` and `new Decimal(...)` THROW on a malformed literal, so a
 * parsed draft rendered back through `:value` would throw out of the input handler before any
 * error could be set. Parsing happens inside `dispatch`, which `onCommit` reaches only once
 * `validate` has passed.
 */
function field(
	name: keyof DefinitionForm,
	label: StringKey,
	canonicalValue: () => string,
	dispatch: (raw: string) => Promise<DispatchResult>,
	validate?: (raw: string) => string | null,
): DefinitionField {
	return {
		name,
		label,
		commit: useFieldCommit<string, DefinitionForm>({
			canonicalValue,
			buildCommand: (raw) => ({ execute: () => dispatch(raw), undo: noUndo }),
			history: { run: (command) => command.execute() },
			errorMap: DEFINITION_ERRORS,
			field: name,
			toUserMessage: trError,
			notify: notifySubject,
			logger: context.logger,
			...(validate === undefined ? {} : { validate }),
		}),
	};
}

/** An empty text field means "no value" for the three nullable strings, and an empty string is
 *  not a supplier — trimming first is what stops a stray space persisting as one. */
function orNull(raw: string): string | null {
	return raw.trim() === '' ? null : raw.trim();
}

function canBeMoney(raw: string): boolean {
	try {
		moneyOf(raw, props.entry.currency);
		return true;
	} catch {
		return false;
	}
}

function canBeDecimal(raw: string): boolean {
	try {
		return new Decimal(raw).isFinite();
	} catch {
		return false;
	}
}

const name = field(
	'name',
	'form.new-asset.name',
	() => props.entry.name,
	(raw) => updated({ name: raw }),
);

const category = field(
	'category',
	'view.asset-library.category',
	() => props.entry.category,
	(raw) => updated({ category: raw as AssetCategory }),
);

const unit = field(
	'unit',
	'view.asset-library.unit',
	() => props.entry.unit,
	(raw) => updated({ unit: raw as MeasurementUnit }),
);

/**
 * The nullable-string trio plus the two parsed numbers and the height, in §3.5's own order.
 * Built as an array because the template draws them identically; `name` above and the two
 * selects below are separate only because their CONTROL differs, never their wiring.
 */
const rest: readonly DefinitionField[] = [
	field(
		'unitCost',
		'view.asset-library.unit-cost',
		() => props.entry.unitCostAmount,
		(raw) => updated({ unitCost: moneyOf(raw.trim(), props.entry.currency) }),
		(raw) => (canBeMoney(raw.trim()) ? null : tr('error.asset.unit-cost.unparseable')),
	),
	field(
		'waste',
		'view.asset-library.waste',
		() => props.entry.wasteFactorDefault,
		(raw) => updated({ wasteFactorDefault: new Decimal(raw.trim()) }),
		(raw) => (canBeDecimal(raw.trim()) ? null : tr('error.asset.waste.unparseable')),
	),
	field(
		'supplier',
		'view.asset-library.supplier',
		() => props.entry.supplier ?? '',
		(raw) => updated({ supplier: orNull(raw) }),
	),
	field(
		'sku',
		'view.asset-library.sku',
		() => props.entry.sku ?? '',
		(raw) => updated({ sku: orNull(raw) }),
	),
	field(
		'notes',
		'view.asset-library.notes',
		() => props.entry.notes ?? '',
		(raw) => updated({ notes: orNull(raw) }),
	),
	field(
		'height',
		'view.asset-library.height',
		() => (props.entry.height === null ? '' : String(props.entry.height)),
		// The one field of the nine that is not `UpdateAsset`'s: a height lives on the note
		// rather than in the change bag (ADR-0014), and `SetAssetHeight` is its command.
		(raw) =>
			context.commands.setAssetHeight.execute({
				assetId: props.entry.assetId,
				height: raw.trim() === '' ? null : Number(raw.trim()),
			}),
		// The EMPTY field is "say nothing about how tall this is", answered before `Number` is
		// consulted at all — `Number('')` is `0`, which is a real height and not an absence.
		(raw) =>
			raw.trim() === '' || Number.isFinite(Number(raw.trim()))
				? null
				: tr('designer.inspector.height.unparseable'),
	),
];

const units = computed((): readonly MeasurementUnit[] => Object.keys(UNIT_KIND) as MeasurementUnit[]);
const categories: readonly AssetCategory[] = ASSET_CATEGORIES;

/**
 * A `<select>` commits on CHANGE — there is no draft to type, so blur would delay a decision the
 * user has already made with one gesture.
 *
 * **It walks past `commitOnce`'s clean-field guard, deliberately.** `onInput` mints a draft
 * unconditionally, so `submitted` is never `null` by the time a round runs — the same shape
 * CLAUDE.md records `RequirementRow`'s Reset button paying for. It costs nothing HERE and the
 * difference is the control: a `<select>` fires `change` only when the value actually differs,
 * so there is no gesture a user can make that dispatches the value already stored. A test can
 * drive one; a person cannot.
 */
function choose(chosen: DefinitionField, value: string): void {
	chosen.commit.onInput(value);
	void chosen.commit.onCommit();
}
</script>

<template>
	<dl class="rp-al-fields">
		<dt class="rp-al-fields__key">
			{{ tr(name.label) }}
		</dt>
		<dd class="rp-al-fields__value">
			<FieldError
				v-slot="{ aria }"
				:message="name.commit.error.value"
			>
				<input
					v-bind="aria"
					type="text"
					class="rp-al-fields__input"
					:data-field="name.name"
					:aria-label="tr(name.label)"
					:aria-busy="name.commit.pending.value"
					:value="name.commit.draft.value"
					@input="name.commit.onInput(($event.target as HTMLInputElement).value)"
					@blur="name.commit.onCommit()"
					@keydown.enter="name.commit.onCommit()"
					@keydown.esc.stop="name.commit.onCancel()"
				>
			</FieldError>
		</dd>

		<dt class="rp-al-fields__key">
			{{ tr(category.label) }}
		</dt>
		<dd class="rp-al-fields__value">
			<FieldError
				v-slot="{ aria }"
				:message="category.commit.error.value"
			>
				<select
					v-bind="aria"
					class="rp-al-fields__select"
					data-field="category"
					:aria-label="tr(category.label)"
					:value="category.commit.draft.value"
					@change="choose(category, ($event.target as HTMLSelectElement).value)"
				>
					<option
						v-for="option in categories"
						:key="option"
						:value="option"
					>
						{{ option }}
					</option>
				</select>
			</FieldError>
		</dd>

		<dt class="rp-al-fields__key">
			{{ tr(unit.label) }}
		</dt>
		<dd class="rp-al-fields__value">
			<FieldError
				v-slot="{ aria }"
				:message="unit.commit.error.value"
			>
				<select
					v-bind="aria"
					class="rp-al-fields__select"
					data-field="unit"
					:aria-label="tr(unit.label)"
					:value="unit.commit.draft.value"
					@change="choose(unit, ($event.target as HTMLSelectElement).value)"
				>
					<option
						v-for="option in units"
						:key="option"
						:value="option"
					>
						{{ option }}
					</option>
				</select>
			</FieldError>
		</dd>

		<template
			v-for="row in rest"
			:key="row.name"
		>
			<dt class="rp-al-fields__key">
				{{ tr(row.label) }}
			</dt>
			<dd class="rp-al-fields__value">
				<FieldError
					v-slot="{ aria }"
					:message="row.commit.error.value"
				>
					<input
						v-bind="aria"
						type="text"
						class="rp-al-fields__input"
						:data-field="row.name"
						:aria-label="tr(row.label)"
						:aria-busy="row.commit.pending.value"
						:value="row.commit.draft.value"
						@input="row.commit.onInput(($event.target as HTMLInputElement).value)"
						@blur="row.commit.onCommit()"
						@keydown.enter="row.commit.onCommit()"
						@keydown.esc.stop="row.commit.onCancel()"
					>
				</FieldError>
			</dd>
		</template>
	</dl>
</template>
