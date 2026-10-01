<script setup lang="ts">
/**
 * The creation dialog for a new Asset — design slice A10, and the FIRST form in this plugin
 * whose submit is a SEQUENCE rather than one command: the catalogue entry is created, and
 * then, if a footprint was given — both dimensions typed, or an `outline` prop from a plan
 * item (2026-09-13 item modes spec §B) standing in their place — its rectangle footprint is
 * written into the geometry sidecar (§88).
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
 *     `shapeFromDimensions`, `shapeFromOutline` and `createMoney` are all pure, so a zero, a
 *     negative, a malformed amount and a malformed currency are all caught with the vault
 *     untouched — for BOTH footprint sources, since the outline preflight runs the same
 *     `validateAssetShape` a typed rectangle does. The preflight runs the WHOLE shape
 *     validation, not the half of it about the two numbers: `footprintFromDimensions` alone
 *     accepts `Number.MIN_VALUE * 2`, whose four vertices are distinct and whose shoelace
 *     products all underflow, so the note was committed and only then was the footprint
 *     refused as degenerate — this rule broken by the code claiming it.
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
import { computed, ref, useId, type Ref } from 'vue';
import FormSubmitRow from '../dialogs/FormSubmitRow.vue';
import { useDialogFormBusy } from '../composables/use-dialog-form-busy';
import { useFieldInput } from '../composables/use-field-input';
import { useInvalidFieldFocus } from '../composables/use-invalid-field-focus';
import { useFormCommit } from '../composables/use-form-commit';
import type { FieldErrorMap } from '../errors/route-error';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import type { AppError, ValidationError } from '../../core/errors/AppError';
import { createMoney } from '../../core/money/Money';
import { normalizeDecimalInput } from '../library/decimalInput';
import { shapeFromDimensions, shapeFromOutline } from '../../domain/asset/AssetShape';
import type { Point } from '../../core/geometry/Point';
import type { Asset } from '../../domain/asset/Asset';
import type { AssetId } from '../../domain/asset/AssetId';
import type { CreateAssetInput } from '../../application/commands/asset/CreateAsset';
import type {
	SetAssetFootprintFromDimensionsInput,
	SetAssetFootprintInput,
} from '../../application/commands/asset/SetAssetFootprint';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { Logger } from '../../application/ports/Logger';
import { ASSET_CATEGORY_LABELS, MEASUREMENT_UNIT_LABELS } from './assetLabels';
import { trError } from '../i18n/toUserMessage';
import { tr } from '../i18n/strings';
import FieldError from '../components/FieldError.vue';
import FormBanner from '../components/FormBanner.vue';
import SimilarNameHint from './SimilarNameHint.vue';
import NumericField from './NumericField.vue';

const props = defineProps<{
	createAsset: (input: CreateAssetInput) => Promise<Result<Asset, AppError>>;
	setFootprintFromDimensions: (
		input: SetAssetFootprintFromDimensionsInput,
	) => Promise<DispatchResult>;
	/**
	 * AL03's similar-name hint. Optional and absent for the Renovation project view's own
	 * caller, which has no catalogue reachable to search — see `newAssetDialog.ts`'s
	 * `NewAssetDialogDeps.findExisting`.
	 */
	findExisting?: (name: string) => { readonly assetId: AssetId; readonly name: string } | null;
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
	defaultCurrency: string;
	/** Opened from a plan item (2026-09-13 item modes spec §B): the item's name to start from. */
	initialName?: string;
	/**
	 * The same gesture's outline, centred and in millimetres, with the write that stores it measured. Present,
	 * it REPLACES the two dimension fields: the footprint is decided, and a width and depth typed beside it
	 * would be a second answer to the same question.
	 */
	outline?: {
		readonly points: readonly Point[];
		write(input: SetAssetFootprintInput): Promise<DispatchResult>;
	};
}>();

const emit = defineEmits<{
	submit: [outcome: { readonly assetId: AssetId; readonly created: boolean }];
}>();

/**
 * What the user types. The two dimensions are STRINGS rather than numbers because "not
 * given" is a state a `number` cannot hold: `Number('')` is `0`, which
 * `shapeFromDimensions` correctly refuses as non-positive — so a form that parsed
 * eagerly would refuse the perfectly ordinary case of creating a catalogue entry with no
 * geometry yet. Blank-versus-typed is decided on the raw text, once, in `parseDimensions`.
 *
 * `height` is a string for the same reason and a SHARPER one: unlike a dimension, a zero height
 * is VALID — `checkHeight` accepts it, because a flat thing is a real answer and refusing it
 * would invent a rule nobody asked for. So an eagerly parsed blank would not be refused
 * anywhere; it would silently record every asset created through this form as nought
 * millimetres tall. `parseHeight` decides blank-versus-typed on the raw text.
 */
interface NewAssetValues {
	name: string;
	category: CreateAssetInput['category'];
	unit: CreateAssetInput['unit'];
	unitCostAmount: string;
	currency: string;
	height: string;
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
 * **Four codes route to the PAIR, and that is the codes' own doing rather than a choice.**
 * `asset.non-positive-dimension` is minted inside a loop over `[width, depth]` and names
 * neither in anything but developer English; `asset.dimension-underflow`,
 * `asset.invalid-footprint` and `asset.degenerate-footprint` are each about the rectangle the
 * two produce together. Routing any of them to `width` alone would be a second answer to which
 * field is wrong, and a wrong one half the time.
 *
 * `asset.degenerate-footprint` became reachable from this form only when the preflight moved
 * from `footprintFromDimensions` to `shapeFromDimensions`; before that it could arrive from the
 * COMMAND, after a write, which is the defect that move closed.
 *
 * **`asset.negative-height` is `Asset.create`'s `checkHeight`, and it arrives with the vault
 * untouched** — not because this form preflights it (it does not; `footprintPreflight` is
 * about the rectangle alone), but because `CreateAssetCommand.execute` runs `Asset.create`
 * before `this.assets.save`. That is a property of the COMMAND, so it is checked in
 * `tests/application/commands/asset/assetCommands.test.ts` rather than here. Its field is not
 * a footprint one and does not want to be: a height is a NOTE field, which is why its control
 * survives outline mode and why this entry is absent from
 * `NEW_ASSET_ERRORS_FOR_OUTLINE`'s omission list below.
 *
 * **`asset.negative-height`'s TWIN is deliberately absent, and the reason is measured rather
 * than reasoned.** `asset.invalid-height` cannot arise from this form at all: the height is a
 * `type="number"` control, and the HTML value-sanitization algorithm empties one whose content
 * is not a finite floating-point number — so `1e999` reaches `parseHeight` as `''` and is sent
 * as `null`, never as `Infinity`. `newAssetFormHeight.test.ts` drives exactly that rather than
 * asserting the absence, because an absence asserted is green on the day it stops being true.
 * Routing it anyway would be a map entry no press of this form can reach.
 *
 * **What is deliberately ABSENT**, so the gaps read as decisions rather than omissions. The
 * other codes `AssetShape.ts` mints — the clearance, anchor, facing and pending-flag
 * refusals, and `asset.no-footprint` — are about attributes this form does not render and
 * cannot send. `asset.not-found` cannot arise from a form that has just
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
	'asset.negative-height': 'height',
	'asset.dimensions-incomplete': ['width', 'depth'],
	'asset.non-positive-dimension': ['width', 'depth'],
	'asset.dimension-underflow': ['width', 'depth'],
	'asset.invalid-footprint': ['width', 'depth'],
	'asset.degenerate-footprint': ['width', 'depth'],
};

/**
 * Outline mode renders no `width`/`depth` fields (the outline paragraph stands where they
 * would), so the two footprint codes `NEW_ASSET_ERRORS` routes to that pair would land on a
 * `FieldError` nothing renders — the preflight's refusal would be checked and then invisible
 * (fix round 1, finding 1). Derived by OMISSION rather than a second hand-copied table, so the
 * two cannot drift: a code renamed or added to `NEW_ASSET_ERRORS` above is renamed or added here
 * for free, and only these two codes are ever about a rectangle with no field left to sit under.
 */
const {
	'asset.invalid-footprint': _outlineInvalidFootprintUnrouted,
	'asset.degenerate-footprint': _outlineDegenerateFootprintUnrouted,
	...NEW_ASSET_ERRORS_FOR_OUTLINE
} = NEW_ASSET_ERRORS;

/**
 * `wasteFactorDefault`, `supplier`, `sku` and `notes` are all optional on
 * `CreateAssetInput` and this form sends none: they are catalogue detail rather than
 * identity, and `UpdateAssetCommand` is what edits them. The first five fields below are
 * exactly the ones the command REQUIRES, which is why every one of them is rendered rather
 * than defaulted — inventing a currency in particular would price an asset in a currency
 * nobody chose, and `Money` refuses to add two of them.
 *
 * **`height` is the one OPTIONAL `CreateAssetInput` field this form does send**, which is AD07
 * implementation item 3 and not an inconsistency with the paragraph above. It is here rather
 * than left to the designer's `SetAssetHeightCommand` because the item asks for a height *at
 * creation time*; it is sent rather than defaulted because a blank one means "says nothing
 * about how tall it is", which is `null` and not a number. It stays DESCRIPTIVE (ADR-0014,
 * contract C07) — nothing in this form or below it feeds it to a clash check.
 */
const INITIAL: NewAssetValues = {
	name: '',
	category: 'material',
	unit: 'piece',
	unitCostAmount: '',
	currency: '',
	height: '',
	width: '',
	depth: '',
};

/**
 * The height's own blank-versus-typed decision, made once, on the raw text — `null` for a
 * blank, and whatever `Number` makes of anything else. Deliberately NOT a refusal: `1e999`
 * parses to `Infinity` and `-5` to a negative, and `checkHeight` inside `Asset.create` is the
 * one rule about both. Routing its two codes is this form's whole job there, which is the
 * difference between this and `parseDimensions` — that one MINTS a code no command would.
 *
 * **Where the control sits, since the template says it in one line.** It is OUTSIDE the
 * outline-or-dimensions pair, so it renders in BOTH modes: a height is a note field rather
 * than sidecar geometry, so an item outline decides the footprint and says nothing about how
 * tall the thing is, and hiding the field in outline mode would be a question this dialog
 * never gets to ask again. And it is bound `:readonly="catalogueInoperative"` where width and
 * depth take `form.submitting` alone, because `createAsset` is what carries a height: a retry
 * skips that call, so a height edited after the freeze would be accepted by the input and
 * discarded by the code behind it — the same defect the `catalogueFrozen` docblock records for
 * the other five. `NumericField` makes `readonly` a REQUIRED prop for exactly this reason.
 */
function parseHeight(values: NewAssetValues): number | null {
	const height = values.height.trim();
	return height === '' ? null : Number(height);
}

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
 * The SIX catalogue fields are frozen once the note exists, and the two dimensions are not.
 * Six counted from the `createAsset` call in `createAssetAndFootprint` rather than remembered:
 * `name`, `category`, `unit`, `unitCostAmount`, `currency` and — since AD07 Amendment 1 —
 * `height`. The dimensions are absent from that call, which is exactly what leaves them live.
 *
 * This is the cost of rule 2 above rather than an independent decision: keeping the created
 * id is what stops a retry making a second entry, and it also means every later submit skips
 * `createAsset` — so an edit to any of those six was accepted by the input, discarded by the
 * code behind it, and the dialog then closed reporting success over an asset still carrying
 * the old values. An edit silently ignored is worse than one refused.
 *
 * **Frozen rather than persisted**, which is the choice the other remedy would have taken.
 * Sending them again means `UpdateAssetCommand` — a second dependency, a second write in a
 * sequence whose whole difficulty is already that it has two — for a gesture this dialog has
 * no reason to own: the entry exists and is editable everywhere an asset is. What is left of
 * this form's job is the footprint, so what stays live is exactly what a retry re-dispatches.
 *
 * **Inoperative, never `:disabled`** — the framework invariant `FormDialog.vue` states, and
 * this form broke it: the freeze flips WHILE the dialog is open, so the control it disables is
 * the one the user is standing on, and Chromium blurs a disabled element to `<body>` — outside
 * `.rp-dialog`, where `DialogHost` binds `Escape`. That is a THIRD route into the stranded-key
 * state `DialogHost`'s own header enumerates two of, and neither of its two covers it: there is
 * no mousedown to intercept and focus never leaves the view. The app blurred the control itself.
 *
 * `readonly` on the three text inputs and `aria-disabled` on the two `<select>`s, which is the
 * split `useDialogFormBusy` already states and `styles/dialogs.css` already dims. `readonly`
 * does nothing at all to a `<select>`, so what makes those two real is that composable's
 * restore — which reads the inoperative state off the CONTROL, so this template is its single
 * statement and the two cannot disagree.
 */
const catalogueFrozen = computed(() => createdAssetId.value !== null);

/**
 * What `.rp-new-asset__created` below is minted for: the id a PAUSED `<select>` names in its
 * own `aria-describedby`, naming the reason rather than leaving `aria-disabled` to announce
 * "unavailable" with nothing about why (V7). This form already prints that sentence for a
 * sighted user, so a screen-reader one gets the SAME text rather than a second copy invented
 * for this attribute alone.
 *
 * Named only while `catalogueFrozen`, never merely while `submitting`: the paragraph it points
 * at is itself `v-if="catalogueFrozen"`, and a describedby naming an id that renders nothing
 * would be a dangling reference — worse than none at all.
 */
const catalogueFrozenReasonId = useId();

/**
 * Never a join, and that is not a simplification of a case this form can reach: while
 * `catalogueFrozen`, `useFormCommit#submit` has already cleared `fieldErrors` to a fresh
 * `Map` before the dispatch that could set it again ("Cleared BEFORE the dispatch, so a
 * stale message from the previous submit cannot outlive the submit that fixed it"), and a
 * frozen retry's own dispatch (`createAssetAndFootprint`) never calls `createAsset` again —
 * the only call that could route an error to `category` or `unit` — so no code in
 * `NEW_ASSET_ERRORS` ever lands a message on either field once frozen. `fieldDescribedBy` is
 * therefore always `undefined` here, and a field-level error cannot coexist with the frozen
 * state at all.
 */
function pausedDescribedBy(aria: { readonly 'aria-describedby'?: string }): string | undefined {
	if (!catalogueFrozen.value) return aria['aria-describedby'];
	return catalogueFrozenReasonId;
}

/** Either mode's dimensions, once `parseDimensions` has decided blank-versus-typed. */
type Dimensions = { readonly width: number; readonly depth: number } | null;

/**
 * The pure half of the footprint, run for its REFUSAL rather than for its shape: the command
 * re-derives the rectangle itself from the same two numbers, so what is thrown away here is a
 * repeat of work that costs nothing, and what is bought is that every refusal the numbers
 * alone can earn is taken with the vault untouched.
 *
 * `shapeFromDimensions` rather than `footprintFromDimensions`, because the command's own path
 * is `withFootprint(current, …)` followed by `validateAssetShape` — and for an asset this form
 * has just created there IS no current shape, so what it validates is exactly `UNDESIGNED`
 * plus the typed rectangle, which is what `shapeFromDimensions` composes. The two are the same
 * shape by construction, so this preflight cannot refuse something the command would accept,
 * nor accept something it would refuse.
 */
function footprintPreflight(dimensions: Dimensions): Result<void, AppError> {
	if (props.outline) {
		const shape = shapeFromOutline(props.outline.points);
		if (isErr(shape)) return shape;
		return ok(undefined);
	}
	if (dimensions !== null) {
		const shape = shapeFromDimensions(dimensions.width, dimensions.depth);
		if (isErr(shape)) return shape;
	}
	return ok(undefined);
}

/** The footprint write itself, for either mode, once the asset id exists. */
async function writeFootprint(
	assetId: AssetId,
	dimensions: Dimensions,
): Promise<Result<{ readonly assetId: AssetId }, AppError>> {
	if (props.outline) {
		const written = await props.outline.write({ assetId, points: props.outline.points, measured: true });
		if (isErr(written)) return written;
		return ok({ assetId });
	}
	if (dimensions === null) return ok({ assetId });
	const written = await props.setFootprintFromDimensions({
		assetId,
		width: dimensions.width,
		depth: dimensions.depth,
	});
	if (isErr(written)) return written;
	return ok({ assetId });
}

/**
 * The whole sequence, as `useFormCommit`'s single `dispatch`. Ordered so that everything
 * checkable without a write happens first — see this component's own header for why that
 * ordering is load-bearing rather than tidy. Reads create → footprint now that both halves'
 * outline/dimensions branching lives in `footprintPreflight` and `writeFootprint`.
 */
async function createAssetAndFootprint(
	values: NewAssetValues,
): Promise<Result<{ readonly assetId: AssetId }, AppError>> {
	const dimensions = parseDimensions(values);
	if (isErr(dimensions)) return dimensions;
	// The cost is optional: blank saves as zero, so an asset is created without a price to hand.
	const unitCostAmount = normalizeDecimalInput(values.unitCostAmount) || '0';
	const money = createMoney(unitCostAmount, values.currency);
	if (isErr(money)) return money;
	const preflight = footprintPreflight(dimensions.value);
	if (isErr(preflight)) return preflight;

	let assetId = createdAssetId.value;
	if (assetId === null) {
		const created = await props.createAsset({
			name: values.name,
			category: values.category,
			unit: values.unit,
			unitCostAmount,
			currency: values.currency,
			height: parseHeight(values),
		});
		if (isErr(created)) return created;
		assetId = created.value.id;
		createdAssetId.value = assetId;
	}

	return writeFootprint(assetId, dimensions.value);
}

const form = useFormCommit<NewAssetValues, { readonly assetId: AssetId }>({
	initial: { ...INITIAL, name: props.initialName ?? '', currency: props.defaultCurrency },
	dispatch: createAssetAndFootprint,
	errorMap: props.outline ? NEW_ASSET_ERRORS_FOR_OUTLINE : NEW_ASSET_ERRORS,
	toUserMessage: trError,
	logger: props.logger,
});

const refuseWhileSubmitting = useDialogFormBusy(form.submitting, props.busy);
/**
 * The six catalogue controls' rendered state, stated once rather than six times. `submitting`
 * is the form-wide half every dialog form has; `catalogueFrozen` is this form's own, and the
 * footprint control below deliberately takes the first alone — in dimensions mode that is the
 * two width/depth fields, exactly what a retry re-dispatches, so freezing them would leave the
 * retry unable to change the numbers it exists for; in outline mode there is no control at all
 * to freeze, since the outline came from the item and this form never edits it.
 */
const catalogueInoperative = computed(() => form.submitting.value || catalogueFrozen.value);

/** The already-created banner's key ternary, out of the template and behind fallow's cognitive-complexity threshold. */
const alreadyCreatedKey = computed(() =>
	props.outline ? 'form.new-asset.already-created-outline' : 'form.new-asset.already-created',
);

/** The outline's width × depth in whole millimetres, for the one line standing where the dimension fields would. */
const outlineSize = computed(() => {
	if (!props.outline) return null;
	const xs = props.outline.points.map(point => point.x), ys = props.outline.points.map(point => point.y);
	return { width: String(Math.round(Math.max(...xs) - Math.min(...xs))), depth: String(Math.round(Math.max(...ys) - Math.min(...ys))) };
});

/**
 * AL03's hint: whatever `findExisting` answers for the name AS TYPED, re-evaluated on every
 * keystroke. `null` when the prop is absent (the Renovation project view's caller) or when
 * nothing matches, either of which draws no `SimilarNameHint` at all.
 */
const similar = computed(() => props.findExisting?.(form.values.value.name) ?? null);

/** The hint's own door: resolve `submit` with the EXISTING asset rather than dispatching
 *  `createAsset` at all — AL03's "a hint, not an automatic merge" means the user chose this. */
function showExisting(assetId: AssetId): void {
	emit('submit', { assetId, created: false });
}

/**
 * ONE handler over a key for all eight fields of `NewAssetValues` — every one is a string on
 * the wire, including the two selects — and `useFieldInput`'s docblock carries the `:value` +
 * `@input` rule and why a field needing a conversion is not this shape.
 */
const onFieldInput = useFieldInput(form, refuseWhileSubmitting);

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
		emit('submit', { assetId: createdAssetId.value as AssetId, created: true });
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
		<p
			v-if="catalogueFrozen"
			:id="catalogueFrozenReasonId"
			class="rp-new-asset__created"
		>
			{{ tr(alreadyCreatedKey) }}
		</p>
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
					:readonly="catalogueInoperative"
					@input="onFieldInput('name', $event)"
				>
			</label>
		</FieldError>
		<!--
			`!catalogueInoperative`, not `!catalogueFrozen` alone: the hint is a DOOR out of
			this dialog exactly like every other control, so it follows the same gate. A press
			while `form.submitting` is true (createAsset in flight, `catalogueFrozen` still
			false) would resolve `submit` with `{ created: false }` immediately — which is what
			the caller reads to decide whether to refresh — while the pending dispatch went on
			to land a duplicate asset nobody's refresh would ever pick up.
		-->
		<SimilarNameHint
			v-if="similar !== null && !catalogueInoperative"
			:existing="similar"
			@show="showExisting"
		/>
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
					:aria-disabled="catalogueInoperative"
					:aria-describedby="pausedDescribedBy(aria)"
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
					:aria-disabled="catalogueInoperative"
					:aria-describedby="pausedDescribedBy(aria)"
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
					:readonly="catalogueInoperative"
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
					:readonly="catalogueInoperative"
					@input="onFieldInput('currency', $event)"
				>
			</label>
		</FieldError>
		<p
			v-if="outlineSize"
			class="rp-new-asset__outline"
		>
			{{ tr('form.new-asset.outline', outlineSize) }}
		</p>
		<template v-else>
			<NumericField
				label-key="form.new-asset.width"
				field="width"
				:message="form.fieldErrors.value.get('width') ?? null"
				:value="form.values.value.width"
				:readonly="form.submitting.value"
				@input="onFieldInput('width', $event)"
			/>
			<NumericField
				label-key="form.new-asset.depth"
				field="depth"
				:message="form.fieldErrors.value.get('depth') ?? null"
				:value="form.values.value.depth"
				:readonly="form.submitting.value"
				@input="onFieldInput('depth', $event)"
			/>
		</template>
		<!-- Outside the pair above, and `catalogueInoperative` unlike them: `parseHeight`'s docblock has both. -->
		<NumericField
			label-key="form.new-asset.height"
			field="height"
			:message="form.fieldErrors.value.get('height') ?? null"
			:value="form.values.value.height"
			:readonly="catalogueInoperative"
			@input="onFieldInput('height', $event)"
		/>
		<FormSubmitRow :submitting="form.submitting.value" />
	</form>
</template>
