<script setup lang="ts">
/**
 * One asset's row in the project's price section: the library's shared default, this project's
 * own price if it has one, an input that sets it and a button that gives it back.
 *
 * **Its own component rather than a block inside `AssetPriceList`'s `v-for`, and the reason is
 * mechanical rather than stylistic.** Each row owns a `useFieldCommit` and a frozen expectation
 * snapshot, and a composable cannot be instantiated per iteration of a `v-for`. The alternative
 * is a pair of `Map`s on the list keyed by asset id — which is exactly what `RequirementRow`'s
 * own docblock records retiring, because "a component instance per row already IS that keying,
 * and a Map outlives the row it describes while a component instance does not". This is
 * `RequirementRow`'s shape for `RequirementRow`'s reason.
 *
 * It dispatches through the `commit` prop the list hands it, which is `ProjectDetailState`'s one
 * write path for this section. A row reaching for a command of its own would bypass the re-read
 * that follows a successful write, with nothing erroring anywhere.
 */
import { computed, ref, watch } from 'vue';
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
import type { AssetPriceCommitResult, AssetPriceEdit } from './assetPriceEdit';

const props = defineProps<{
	row: AssetPriceRowDto;
	/**
	 * The PROJECT's currency, handed down from the section rather than read off the row, and it
	 * is load-bearing rather than decoration. This increment's central case is a GBP project
	 * pricing an EUR catalogue asset with no override yet — the row's only available currency
	 * there is the catalogue's EUR, so minting from it would submit EUR,
	 * `SetAssetPriceOverrideCommand` would refuse on its coherence rule, and the dead end this
	 * increment exists to close would be reachable through the shipped surface.
	 */
	currency: string;
	commit: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>;
	/**
	 * The view's logger, required by `useFieldCommit` for the one failure it owns both halves
	 * of: a coalesced round's own continuation rejecting with nobody left to catch it.
	 */
	logger: Logger;
}>();

/**
 * Every code here is copied from the RAISE SITE. `asset-price.currency-mismatch` is
 * `SetAssetPriceOverrideCommand`'s coherence refusal and `asset-price.negative-unit-cost` is
 * `AssetPriceOverride.create`'s, and both are about the number in this input — so both draw
 * under it. The staleness pair (`asset-price.revision-conflict`,
 * `asset-price.external-modification`) is deliberately here too: the recovery for either is to
 * DISCARD this field's entry, so the message belongs beside the entry being discarded.
 *
 * Every persistence code is deliberately ABSENT: those are not about the value in this input,
 * so they take the `notify` door below.
 */
const PRICE_ERRORS: FieldErrorMap<{ unitCost: Money | null }> = {
	'asset-price.currency-mismatch': 'unitCost',
	'asset-price.negative-unit-cost': 'unitCost',
	'asset-price.revision-conflict': 'unitCost',
	'asset-price.external-modification': 'unitCost',
};

/** What the row is rendering right now, as an expectation the two commands take. */
function expectationOf(row: AssetPriceRowDto): PriceRowExpectation {
	return row.overrideId === null || row.overrideVersion === null
		? 'absent'
		: { id: row.overrideId, version: row.overrideVersion };
}

/**
 * **The expectation this row LAST KNEW, not the one it is rendering.**
 *
 * Reading the props at dispatch time defeats the whole guard at exactly the moment it is needed:
 * `useFieldCommit` deliberately keeps an uncommitted draft while the canonical value moves
 * underneath it, so a sync or another leaf refreshes this row to a new `overrideId`/
 * `overrideVersion`, the user's blur then builds `expected` from the REFRESHED row, and the
 * stale draft saves over a price the user never saw. That is the lost update
 * `SetAssetPriceOverrideInput.expected` exists to stop, reintroduced one layer above the command.
 *
 * `null` means "follow the row" and a value means "frozen at this". ONE ref rather than a
 * `frozen` flag beside it: the two would be the same fact written twice — every writer sets or
 * clears both together — and a flag true beside a null snapshot is a state nothing can produce
 * and nothing could then have tested. Making the disagreement unrepresentable rather than
 * checking for it is this repository's own rule about a value derived from two inputs.
 *
 * Two writers, one field:
 *
 * - while the field is CLEAN the snapshot is `null` and `expected` TRACKS the row, because a
 *   clean field has nothing to protect and must follow the vault. `onInput` is the only thing
 *   that mints a draft here, so it is the one place the field goes dirty;
 * - a SUCCESSFUL command overwrites it with `AssetPriceCommitResult.settled` — the pair as the
 *   command actually left it, which is the newest thing this component knows to be true about
 *   it, and what makes the pending-clear gesture work: the queued clear is built after the set
 *   settles and expects exactly what the set wrote. A REFUSAL settles nothing, so `settled` is
 *   `null` there and the snapshot stays exactly where it was.
 *
 * **Unfreezing is keyed on `pending` falling AFTER a success, and neither half of that is
 * incidental.** The success half is slice 16's rule: a refused commit KEEPS the draft, so the
 * field is still the user's and re-arming from the row would silently replace the version their
 * next submit is about. The `pending` half is the pending-clear gesture: the set settles while
 * the queued clear is still to run, so unfreezing at the moment `settled` arrives would let that
 * clear read the props instead — measured, it then submits `'absent'` against the pair the set
 * had just created and refuses, which is the user's cancellation failing for the second time in
 * one gesture and the exact defect `settled` exists to prevent.
 *
 * A resubmit against a pair that really did move therefore refuses with
 * `asset-price.revision-conflict`, which is the right answer and needs a recovery the user can
 * perform: `onCancel` — Escape, and the clear button's own no-op arm — is that discard, and it
 * returns the field to clean, which re-arms the snapshot from the refreshed row. Keeping the
 * draft through a refusal is slice 16's rule; re-arming on the deliberate discard is what stops
 * that rule turning into a field that can never be submitted again.
 */
const snapshot = ref<PriceRowExpectation | null>(null);
/**
 * The fallback arm is UNREACHABLE today and earns its place by making the type total, which is a
 * different reason from its neighbours' and is stated rather than left to be discovered:
 * `onPriceInput` is the only door to a dispatch here — the clear routes through it too — and it
 * seeds the snapshot, so nothing ever reads this computed with `snapshot` still `null`. Typed
 * `PriceRowExpectation | null` instead, `buildCommand` would have no value to send.
 *
 * Not the dead branch this repository records DELETING (`boundsOfZones`), which was unreachable
 * AND redundant: a door that dispatched without minting a draft would read the row here, which is
 * the right answer for it.
 */
const expected = computed<PriceRowExpectation>(() => snapshot.value ?? expectationOf(props.row));

/** Whether the LAST dispatch this row made was accepted — the success half of the rule above. */
let lastAccepted = false;

/**
 * **PARSED ONCE.** `validate` holds the minted `Money` and `buildCommand` reuses it rather than
 * parsing a second time, so the two cannot disagree at all rather than merely agreeing today.
 * `commitOnce` calls the two in sequence inside one round with no `await` between them, so the
 * value here is always the one the draft being dispatched minted.
 *
 * `createMoney`, never `moneyOf` — and this is the one place copying `RequirementRow`'s
 * `canBeMoney` would have been wrong. That helper wraps `moneyOf`, whose `LITERAL_PATTERN`
 * accepts `+1`, `.5` and `1e3`; this row MINTS with `createMoney`, whose `AMOUNT_PATTERN`
 * refuses all three. Two constructors, two answers, and a validator built on the other one would
 * pass drafts the commit cannot build — a `Result` with no arm for it, at the one door that
 * exists to stop exactly that. `RequirementRow` is consistent for ITSELF because it dispatches
 * through `moneyOf` too; copying half of that pairing is what breaks.
 */
let parsed: Money | null = null;

/**
 * The EMPTY field is "use the library price" in this seam — `buildCommand` turns it into the
 * clear command — so it is answered BEFORE `createMoney` is consulted at all rather than after,
 * exactly as `RequirementRow` answers its own empty case before `Number`.
 *
 * `AMOUNT_PATTERN` admits a leading `-` on purpose — `Money` is signed — so `createMoney` alone
 * is not the whole guard either. Without the negative arm, `-1.00` reaches
 * `AssetPriceOverride.create`, raises `asset-price.negative-unit-cost`, and the user is told a
 * price cannot be negative by a round trip to the vault. That code keeps its locale copy anyway:
 * a code held out of reach by a guard degrades to the wrong sentence the day the guard moves.
 */
function validatePrice(raw: string): string | null {
	parsed = null;
	if (raw.trim() === '') return null;
	const minted: Result<Money, ValidationError> = createMoney(raw.trim(), props.currency);
	if (isErr(minted)) return tr('view.project.price-invalid');
	if (minted.value.amount.startsWith('-')) return tr('view.project.price-negative');
	parsed = minted.value;
	return null;
}

/**
 * The row's ONE dispatch, and the one place `AssetPriceCommitResult` is unpacked: `settled` moves
 * the snapshot, `dispatch` is what `useFieldCommit` sees. The composable is NOT widened — it is
 * a composable eight other fields already use, and the one thing this surface needs that the
 * others do not is a fact about a pair.
 */
async function dispatch(edit: AssetPriceEdit): Promise<DispatchResult> {
	const result = await props.commit(edit);
	lastAccepted = result.settled !== null;
	// The snapshot adopts what the command established and stays FROZEN — a follow-up queued
	// during this dispatch is built from it, and the props have no answer better than the one the
	// command just gave. `watch(price.pending)` below is what releases it.
	if (result.settled !== null) snapshot.value = result.settled;
	return result.dispatch;
}

const price = useFieldCommit<string, { unitCost: Money | null }>({
	// The canonical value RENDERED, not parsed — a draft is text until it is committed. A row
	// with no override of its own shows an empty field, which is what the library price beside
	// it already says in words.
	canonicalValue: () => props.row.override?.amount ?? '',
	// A UNION, never a set with the price left off: the two spellings dispatch different commands
	// and a shape that admitted both in one branch is a shape the state would have to re-derive
	// the intent from. An empty draft that clears nothing is answered by
	// `ClearAssetPriceOverrideCommand` itself — it reports `cleared: false` and publishes
	// NOTHING, so no revision moves and no cascade runs — which is why the guard in `onClear`
	// below is about the gesture rather than about protecting the vault.
	buildCommand: (raw) => ({
		// Reached only once `validate` above has passed, so `parsed` is the Money that this draft
		// minted rather than a second parse of the same text.
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
	// Where a refusal this field cannot show goes instead. The section has no banner region, so
	// without a second door a resolved vault failure would reach the user through neither.
	notify: (error) => {
		props.logger.warn('view.project.price-commit.refused', { code: error.code });
	},
	logger: props.logger,
	validate: validatePrice,
});

/**
 * The field has finished every round it had — no dispatch in flight and none queued. If the last
 * one was ACCEPTED the draft is gone and the field is clean, so the snapshot goes back to
 * tracking the row; if it was refused the draft is still on screen and the frozen expectation is
 * what the user's next submit is about.
 *
 * A watcher on `pending` rather than a flag cleared inside `dispatch`, because `dispatch` returns
 * while a coalesced follow-up may still be queued — see the snapshot's own docblock for what
 * releasing it there costs.
 */
watch(
	() => price.pending.value,
	(busy) => {
		if (busy || !lastAccepted) return;
		snapshot.value = null;
	},
);

function onPriceInput(raw: string): void {
	// A keystroke never dispatches (slice 6). The snapshot freezes HERE, at the one place a draft
	// is minted, so a refresh landing under an uncommitted entry cannot move it.
	snapshot.value ??= expectationOf(props.row);
	price.onInput(raw);
}

function onPriceCancel(): void {
	price.onCancel();
	// Back to clean, so the snapshot re-arms from whatever the row says NOW. This is the recovery
	// the staleness copy names: discard the entry and the field shows the current price again.
	snapshot.value = null;
}

/** An override this project actually holds — the thing Clear has to remove. */
const overridden = computed(() => props.row.overrideId !== null);

/**
 * **BOTH halves of the guard, and the second one is not politeness.**
 *
 * `commitOnce` returns early on a CLEAN field, and this handler mints a draft before any round
 * runs, so by then the field is dirty by construction and that guard can never fire for this
 * path. Without `overridden`, Clear on a row holding no override dispatches a real
 * override-clearing command: a vault write, a revision bump and a project-wide cascade standing
 * for a change nobody made.
 *
 * `pending` is the other half. The row's DTO has not refreshed while a commit is in flight, so
 * `overrideId` still reads `null` for a write that is on its way to persisting one — type a
 * price into an empty row, Tab to this button, press it before the vault answers, and testing
 * `overridden` alone would discard the user's cancellation and let the set persist. Routed
 * through `onCommit` instead, it becomes the queued follow-up the composable's coalescing
 * already knows how to answer once that write settles — and the snapshot the clear submits is
 * what the SET wrote, because `dispatch` above put it there.
 *
 * With neither, there is nothing persisted to clear and nothing in flight to cancel, so the
 * gesture is a DRAFT DISCARD — which is `onCancel`, the same thing Escape does.
 */
async function onClear(): Promise<void> {
	if (!overridden.value && !price.pending.value) {
		onPriceCancel();
		return;
	}
	// Emptying the field IS the clear in this seam — `buildCommand` reads an empty draft as the
	// clear command — so the gesture goes through the composable rather than around it. Routed
	// around it, a clear landing while a set is in flight would start its own dispatch beside the
	// one running instead of becoming the queued follow-up the coalescing already answers.
	onPriceInput('');
	await price.onCommit();
}

/**
 * `assetStatus !== 'known'` is the whole binding, and it is the STATUS rather than
 * `assetName === null` because two different states share that nullness.
 *
 * `SetAssetPriceOverrideCommand` loads the asset BEFORE it reaches the write and propagates a
 * failed read unchanged, so a set dispatched against either unhappy row refuses EVERY time — a
 * live input over a guaranteed refusal is the control-that-does-nothing slice 14's own amendment
 * refuses. Clear stays live on both: an orphan row exists so the user can get rid of it, and an
 * unreadable one's override is waiting on a note the user can still fix.
 */
const priceDisabled = computed(() => props.row.assetStatus !== 'known');
</script>

<template>
	<li class="rp-asset-price-row">
		<span class="rp-asset-price-name">{{ row.assetName ?? row.assetId }}</span>
		<!--
			TWO classes and two sentences, never one styled two ways. Both rows draw an id in place
			of a name and both disable the price input, so it would be easy to give them one
			selector and vary only the text — and the SENTENCE is exactly what they must not share:
			one names a deletion, the other names a read that failed, and the two commit to
			opposite remedies. A shared class would leave nothing to key that split on.
		-->
		<span
			v-if="row.assetStatus === 'orphan'"
			class="rp-asset-price-orphan"
		>{{ tr('view.project.price-orphan') }}</span>
		<span
			v-else-if="row.assetStatus === 'unreadable'"
			class="rp-asset-price-unreadable"
		>{{ tr('view.project.price-unreadable') }}</span>
		<!--
			§89's "beside what it replaced": the shared default stays visible next to this
			project's own price, so the user can see what they are overriding. Both unhappy rows
			draw no library price at all — `catalogue` is null on both, and there is nothing to
			compare against on either.
		-->
		<span
			v-if="row.catalogue !== null"
			class="rp-asset-price-catalogue"
		>
			{{ tr('view.project.price-catalogue') }}: {{ row.catalogue.amount }} {{ row.catalogue.currency }}
		</span>
		<!--
			§89's "beside what it replaced", the other half of it: the library default above and
			what this project actually pays, as a FIGURE rather than only as the input's contents.
			`RequirementRow` draws its own overridden figures the same way, beside the field that
			edits them, and for the same reason — a control holding a number is not a statement
			about what is in force.

			Only when there IS one: a row with no override of its own has nothing to put here that
			the library price does not already say.
		-->
		<span
			v-if="row.override !== null"
			class="rp-asset-price-yours"
		>
			{{ tr('view.project.price-yours') }}: {{ row.override.amount }} {{ row.override.currency }}
		</span>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="price.error.value"
		>
			<!--
				TWO spans, one accessible name. The visible half is short and the same on every row,
				which is what lets the field COLUMN line up — the first capture of this section had
				the label sizing its own column, so a long asset name shoved that row's input and
				its button right and the controls stopped forming a column, which is slice 19's own
				recorded defect (`.rp-project-list__overlap`) arriving on a third surface.

				The hidden half is what keeps the accessible name distinguishing: `Set a price` on
				every row is a set of identical labels, and a screen-reader user moving between
				them by form control would hear the same three words each time. It is visually
				hidden rather than dropped, because the ROW's own name — the thing a sighted user
				reads it against — is already on screen a few centimetres to the left.
			-->
			<label :for="inputId">
				<!--
					THE CURRENCY IS ON THE LABEL, and the capture is what said it had to be. The
					field held `41.50` beside `Library price: 48.00 EUR` with nothing to say which
					currency the typed number is in — and the one place that WAS said, the header's
					`Priced in GBP`, is pinned above a body that has scrolled the whole plan list
					past by the time this row is on screen. A user reading two numbers in one row
					reads them in one currency unless something says otherwise, which is precisely
					the confusion this increment exists to end.
				-->
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
				@blur="price.onCommit()"
				@keydown.enter="price.onCommit()"
				@keydown.esc.stop="onPriceCancel()"
			>
		</FieldError>
		<!--
			`@mousedown.prevent`, and it is not a nicety. A browser blurs the focused input on this
			button's `mousedown`, BEFORE the `click` that runs the handler — so without it one
			gesture on a dirty field is TWO commands: a set persisting the price the user is
			discarding, then the clear. Two writes, two `AssetPriceOverrideChanged` events and two
			project-wide cascades for one click, and if the clear then refuses, the typed price
			stands over the library price the user asked for. `RequirementRow.vue` carries the
			identical guard with the identical reasoning, learned there the hard way, and
			`DialogHost.onMousedown` uses the same mechanism. `preventDefault` on `mousedown`
			preserves focus and cancels nothing else, so the click still fires.

			It covers the POINTER path only, which is what makes it compatible with the in-flight
			gesture above rather than a contradiction of it: reaching this button by Tab still
			blurs and still commits, and that is CORRECT — tabbing away is itself the commit
			gesture `useFieldCommit`'s contract names, so the set is a real user intent and the
			clear becomes the queued follow-up the coalescing already answers. One keyboard
			gesture and one pointer gesture with different right answers.
		-->
		<button
			type="button"
			class="rp-asset-price-clear"
			@mousedown.prevent
			@click="onClear"
		>
			{{ tr('view.project.price-clear') }}
		</button>
	</li>
</template>
