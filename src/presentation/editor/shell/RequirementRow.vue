<script setup lang="ts">
/**
 * One row of design slice 10's Requirements panel: the asset it links, its effective
 * quantity and cost with §52's overridden/calculated distinction rendered for each
 * INDEPENDENTLY, and the two override controls.
 *
 * Its own component rather than a block in `InspectorPanel.vue`, and the reason is
 * measured rather than stylistic: the inline version put the whole panel's template at
 * cognitive complexity 31 over 248 lines, which `npm run analyze` reports as a refactoring
 * target. Splitting it also retires the two draft `Map`s the panel kept keyed by
 * requirement id — a component instance per row already IS that keying, and a Map outlives
 * the row it describes while a component instance does not.
 *
 * It dispatches through the `commit` prop the panel hands it — `runtime.commitField`,
 * `commitEdit`'s fault-guarded sibling (design slice 16) over the same underlying
 * `inspector.commit` — which is still the Inspector's ONE commit path (SDD §59). A row
 * reaching for a dispatcher of its own would silently break the post-command refresh and
 * the reactive undo/redo flags, with nothing erroring anywhere.
 */
import { ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import { of as moneyOf } from '../../../core/money/Money';
import type { Money } from '../../../core/money/Money';
import type { RequirementInspectorDTO } from '../../../application/queries/GetRequirementsForZone';
import type { InspectorEdit } from '../inspector/inspector-store';
import type { Logger } from '../../../application/ports/Logger';
import { useFieldCommit } from '../../composables/use-field-commit';
import type { FieldErrorMap } from '../../errors/route-error';
import { trError } from '../../i18n/toUserMessage';
import { notifyError } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import FieldError from '../../components/FieldError.vue';

const props = defineProps<{
	row: RequirementInspectorDTO;
	commit: (edit: InspectorEdit) => Promise<Result<void, AppError>>;
	/**
	 * This leaf's logger (`runtime.logger`, which is `PlanEditorCommandServices.logger`),
	 * required by `useFieldCommit` for the one failure it owns both halves of: a coalesced
	 * round's own continuation rejecting with nobody left to catch it. `notify` below is the
	 * user-facing half; this is the developer-facing one, and SDD §66 asks that they come from
	 * one step rather than two — which is why the composable takes the logger rather than
	 * mapping the cause a second time for a Notice alone.
	 */
	logger: Logger;
}>();

/**
 * Every code here is copied from the RAISE SITE, never guessed from the field's name. The
 * command raises `requirement.negative-quantity` (`SetRequirementQuantityOverride.ts`,
 * `applyQuantityOverride`'s negative-value branch) — a map keyed on a code nothing raises
 * is invisible to every gate, since `FieldErrorMap` takes any string and `routeError`
 * simply finds no entry.
 *
 * `requirement.not-found` and every persistence code are deliberately ABSENT: they are not
 * about the value in this input, so they take the notice door below.
 */
const QUANTITY_ERRORS: FieldErrorMap<{ quantity: number | null }> = {
	'requirement.negative-quantity': 'quantity',
};

/**
 * Empty TODAY, and that is a finding rather than an omission: `SetRequirementCostOverride`
 * raises no field-attributable refusal at all, so every cost failure is banner-routed and
 * reaches the user through `notify` below. Declared anyway, so the seam exists and the next
 * cost refusal is one entry rather than a new mechanism.
 */
const COST_ERRORS: FieldErrorMap<{ cost: Money | null }> = {};

/**
 * The parse failure is the ROW's, not the command's: `Number('abc')` never reaches a
 * dispatch, so there is no `AppError` for `routeError` to place. It is handed to the
 * composable as `validate` rather than guarded here, so it clears on the same keystroke as
 * a refusal does and the user cannot tell the two apart — which is right, since to them
 * both are "this field is wrong".
 */
const quantity = useFieldCommit<number | null, { quantity: number | null }>({
	// The DTO's `Decimal | null` converted to the plain number this seam and
	// `InspectorEdit`'s `quantity-override` variant both carry.
	canonicalValue: () => props.row.quantity.override?.toNumber() ?? null,
	buildCommand: (value) => ({
		execute: () => props.commit({
			kind: 'quantity-override',
			requirementId: props.row.requirementId,
			quantity: value,
		}),
		undo: () => Promise.resolve(ok(undefined)),
	}),
	// The reversible wrapping and the history entry are `commitEdit`'s job, one seam up —
	// this row supplies only the shape `useFieldCommit` takes, without adding a second
	// history of its own.
	history: { run: (command) => command.execute() },
	errorMap: QUANTITY_ERRORS,
	field: 'quantity',
	toUserMessage: trError,
	// The half `commitEdit` keeps: a refusal with no field to sit under is still announced.
	notify: notifyError,
	logger: props.logger,
	validate: (value) =>
		value === null || Number.isFinite(value) ? null : tr('error.requirement.quantity.unparseable'),
});

function onQuantityInput(raw: string): void {
	// A keystroke never dispatches (slice 6). `onInput` clears the error too, for the same
	// reason `setField` does: a message about a value the user has since corrected is
	// telling them something untrue.
	quantity.onInput(raw.trim() === '' ? null : Number(raw));
}

/**
 * `null` is a VALUE in this seam — "reset to calculated" — so it commits like any other,
 * which is also what clears the draft and the error on success. Routed THROUGH the
 * composable rather than around it: after a refused override the composable still holds a
 * non-null drafted value and its error, and neither is its own to clear.
 */
async function resetQuantity(): Promise<void> {
	quantity.onInput(null);
	await quantity.onCommit();
}

/**
 * A total predicate over `moneyOf`'s own literal pattern — `Money` exports no standalone
 * check of "is this a monetary literal", so this is a `try`/`catch` around the one
 * constructor that already owns that rule, rather than a second, hand-written regex that
 * could disagree with it the moment `Money` changes.
 */
function canBeMoney(raw: string): boolean {
	try {
		moneyOf(raw, props.row.cost.effective.currency);
		return true;
	} catch {
		return false;
	}
}

/**
 * The cost field's draft is a raw STRING, and this is not symmetry with quantity — it is
 * the opposite of it. `Number('abc')` yields `NaN`, a value to inspect; `moneyOf('abc', …)`
 * THROWS (`Money.ts`: a non-matching literal is refused at the door). So repeating the
 * quantity shape would throw out of the input handler before any error could be set,
 * taking the click handler's promise with it. The text stays the draft, and `moneyOf` is
 * constructed only inside `buildCommand`, which `onCommit` reaches only once `validate`
 * below has passed.
 */
const cost = useFieldCommit<string, { cost: Money | null }>({
	// The canonical value RENDERED, not parsed: a draft is text until it is committed.
	canonicalValue: () => props.row.cost.override?.amount ?? '',
	buildCommand: (raw) => ({
		// Reached only once `validate` below has passed, so `moneyOf` cannot throw here.
		execute: () => props.commit({
			kind: 'cost-override',
			requirementId: props.row.requirementId,
			cost: raw.trim() === '' ? null : moneyOf(raw.trim(), props.row.cost.effective.currency),
		}),
		undo: () => Promise.resolve(ok(undefined)),
	}),
	history: { run: (command) => command.execute() },
	errorMap: COST_ERRORS,
	field: 'cost',
	toUserMessage: trError,
	notify: notifyError,
	logger: props.logger,
	validate: (raw) =>
		raw.trim() === '' || canBeMoney(raw.trim()) ? null : tr('error.requirement.cost.unparseable'),
});

function onCostInput(raw: string): void {
	cost.onInput(raw);
}

async function resetCost(): Promise<void> {
	cost.onInput('');
	await cost.onCommit();
}
</script>

<template>
	<li class="rp-editor-requirement">
		<p
			v-if="row.recalculationStatus === 'stale'"
			class="rp-editor-requirement-stale"
		>
			{{ tr('editor.inspector.requirement.stale') }}
		</p>
		<dl class="rp-editor-inspector-fields">
			<dt>{{ tr('editor.inspector.requirement.asset') }}</dt>
			<!-- An asset that is gone renders from its ID plus the reason, which is why
			     `assetName` is nullable: typed `string`, this row could not be built at all. -->
			<dd v-if="row.missingTarget !== null">
				{{ row.assetId }} — {{ tr('editor.inspector.requirement.missing-asset') }}
			</dd>
			<dd v-else>
				{{ row.assetName ?? row.assetId }}
			</dd>

			<dt>{{ tr('editor.inspector.requirement.quantity') }}</dt>
			<dd>
				{{ row.quantity.effective.toString() }} {{ row.unit }}
				<template v-if="row.quantity.override !== null">
					<span class="rp-editor-requirement-badge">
						{{ tr('editor.inspector.requirement.overridden') }}
					</span>
					<!-- The calculated figure stays visible beside the override: a badge alone
					     would hide the number the user is overriding. -->
					<span>({{ row.quantity.calculated.toString() }})</span>
				</template>
			</dd>

			<dt>{{ tr('editor.inspector.requirement.cost') }}</dt>
			<dd>
				{{ row.cost.effective.amount }} {{ row.cost.effective.currency }}
				<template v-if="row.cost.override !== null">
					<span class="rp-editor-requirement-badge">
						{{ tr('editor.inspector.requirement.overridden') }}
					</span>
					<span>({{ row.cost.calculated.amount }})</span>
				</template>
			</dd>
		</dl>

		<div class="rp-editor-requirement-overrides">
			<FieldError
				v-slot="{ inputId, aria }"
				:message="quantity.error.value"
			>
				<label :for="inputId">
					{{ tr('editor.inspector.quantity-override.label') }} {{ row.assetName }}
				</label>
				<input
					:id="inputId"
					v-bind="aria"
					type="text"
					data-field="quantity"
					:aria-busy="quantity.pending.value"
					:value="quantity.draft.value ?? ''"
					@input="onQuantityInput(($event.target as HTMLInputElement).value)"
					@blur="quantity.onCommit()"
					@keydown.esc.stop="quantity.onCancel()"
				>
			</FieldError>
			<button
				type="button"
				class="rp-requirement-reset-quantity"
				@click="resetQuantity"
			>
				{{ tr('editor.inspector.override.reset') }}
			</button>

			<FieldError
				v-slot="{ inputId, aria }"
				:message="cost.error.value"
			>
				<label :for="inputId">
					{{ tr('editor.inspector.cost-override.label') }} {{ row.assetName }}
				</label>
				<input
					:id="inputId"
					v-bind="aria"
					type="text"
					data-field="cost"
					:aria-busy="cost.pending.value"
					:value="cost.draft.value"
					@input="onCostInput(($event.target as HTMLInputElement).value)"
					@blur="cost.onCommit()"
					@keydown.esc.stop="cost.onCancel()"
				>
			</FieldError>
			<button
				type="button"
				class="rp-requirement-reset-cost"
				@click="resetCost"
			>
				{{ tr('editor.inspector.override.reset') }}
			</button>
		</div>
	</li>
</template>
