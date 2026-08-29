import { computed, readonly, ref, toValue, type DeepReadonly, type MaybeRefOrGetter, type Ref } from 'vue';
import { isErr, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import type { Logger } from '../../application/ports/Logger';
import { faultError } from '../notices/notify';
import { routeError, type FieldErrorMap } from '../errors/route-error';

/** What `CommandHistory.run` takes: anything with the two halves of a reversible write. */
interface RunnableCommand {
	execute(): Promise<Result<void, AppError>>;
	undo(): Promise<Result<void, AppError>>;
}

/**
 * The event name a continuation fault is logged under — FIXED here rather than taken as an
 * option, unlike every other `faultError` caller.
 *
 * The event says which DOOR faulted, and the door is this composable's own: a coalesced
 * round's unawaited continuation, which no caller holds and no caller can distinguish. A
 * per-caller name would be describing the caller instead, which is not what faulted.
 */
const CONTINUATION_FAULT_EVENT = 'field.commit.continuation.faulted';

/**
 * One Inspector field's draft, error and pending state.
 *
 * The commit boundary is blur/enter rather than a form submit — the ONLY thing that differs
 * from `useFormCommit`. Same `routeError`, same rendering pair, same rule that the named
 * methods are the only write paths.
 *
 * `onInput` clears `error` for exactly the reason `useFormCommit.setField` does: a rejected
 * commit's message must not outlive the user correcting the value it is about.
 */
export interface UseFieldCommit<T> {
	readonly draft: DeepReadonly<Ref<T>>;
	readonly error: Readonly<Ref<string | null>>;
	readonly pending: Readonly<Ref<boolean>>;
	/** Draft only — per slice 6 a keystroke never dispatches. It also clears `error`. */
	onInput(value: T): void;
	/**
	 * blur/enter. Dispatches the draft — but a gesture that lands while another is still
	 * in flight coalesces into ONE follow-up dispatch of the latest draft rather than
	 * stacking its own; see `useFieldCommit`'s own commitOnce for why.
	 */
	onCommit(): Promise<void>;
	/** Escape — discard the draft, clear the error, resync to canonical. Dispatches nothing. */
	onCancel(): void;
}

export function useFieldCommit<T, TInput>(options: {
	readonly canonicalValue: MaybeRefOrGetter<T>;
	readonly buildCommand: (value: T) => RunnableCommand;
	readonly history: { run(command: RunnableCommand): Promise<Result<void, AppError>> };
	readonly errorMap: FieldErrorMap<TInput>;
	readonly field: keyof TInput;
	readonly toUserMessage: (error: AppError) => string;
	/**
	 * Where a refusal this field cannot show goes instead — the ORIGINAL `AppError`, not a
	 * resolved string, so the caller's own door decides the copy.
	 *
	 * **Required, and it is the one option that must not be optional.** This composable
	 * converts every banner-routed failure to `error = null`, because the Inspector has no
	 * banner region to put one in. Without a second door that is not "show it elsewhere", it
	 * is "show it nowhere": a resolved vault failure during an override would produce no
	 * inline error AND no notice, which is strictly worse than the `notifyError` call in
	 * `commitEdit` that this slice narrows. Optional with a `?? noop` default, the forgetting
	 * call site is silent and nothing anywhere errors — the exact shape this repository keeps
	 * paying for. So it is required and every caller states its door.
	 */
	readonly notify: (error: AppError) => void;
	/**
	 * Where the DEVELOPER-facing half of a continuation fault goes — the original cause, at
	 * `error`, under this module's own event name.
	 *
	 * **Required, and for the same reason `notify` above is.** SDD §66 asks that the two
	 * representations of one failure come from ONE step rather than "drift into being
	 * produced from two independent code paths"; `reportContinuationFault` below is a door no
	 * guard stands behind, so the unmapped cause is the only detail that exists at all. A
	 * first version of it mapped the cause with a `createVaultExceptionMapper` of its own and
	 * notified, and logged NOTHING — the fault reached the user as a sentence and a developer
	 * as silence, verbatim the defect `notifyFault` in `presentation/notices/notify.ts`
	 * already had and had fixed once. Optional-with-a-default would put that back at whichever
	 * call site forgets it, silently; required means every caller states where its faults are
	 * recorded.
	 */
	readonly logger: Logger;
	/**
	 * A draft this field cannot even turn into a command — text where a number belongs, a
	 * malformed monetary literal. Returns a resolved message, or `null` when the draft is
	 * convertible.
	 *
	 * It lives HERE rather than at each call site on purpose. A guard at a call site is a
	 * second copy of a rule, and two copies disagree: with the check outside, every caller
	 * has to remember it, a caller that forgets dispatches an unconvertible draft, and
	 * nothing anywhere errors. Inside, every caller calls `onCommit` unconditionally and
	 * cannot get it wrong.
	 */
	readonly validate?: (draft: T) => string | null;
}): UseFieldCommit<T> {
	/**
	 * `null` means "clean": the field shows the canonical value and holds no draft of its
	 * own. A sentinel rather than seeding the draft with the canonical value, because those
	 * two states differ — a clean field must TRACK a canonical value that changes underneath
	 * it (the DTO refresh after a successful write), and a seeded draft would pin it.
	 */
	const drafted = ref<{ readonly value: T } | null>(null) as Ref<{ readonly value: T } | null>;
	const error = ref<string | null>(null);
	const pending = ref(false);

	// The coalescing state. Deliberately plain `let`s and not refs: nothing renders them,
	// and `pending` is the one piece of this a template may read.
	let inFlight = false;
	let recommit = false;
	let lastCommitted: { readonly value: T } | null = null;

	// NOT `drafted.value?.value ?? toValue(...)`: optional chaining plus nullish coalescing
	// collapses a draft that IS `null`/`undefined` into the canonical value, indistinguishable
	// from no draft at all. `T` is nullable by construction for this composable's real
	// consumers — `GetRequirementsForZone`'s override fields are `Decimal | null` /
	// `Money | null`, and `SetRequirementCostOverride` treats `input.cost ?? null` as "clear
	// the override" — so `onInput(null)` is a real user gesture ("clear this field") that the
	// `?.`/`??` spelling would silently defeat: it reads back as canonical, and `dispatchOnce`
	// would build a command from the canonical value instead of the clear the user asked for.
	// `drafted.value === null` is the ONLY question that means "clean"; the wrapper exists
	// precisely so that question is distinguishable from "the draft's own value is nullish".
	const draft = computed(() =>
		drafted.value === null ? toValue(options.canonicalValue) : drafted.value.value,
	);

	function onInput(value: T): void {
		drafted.value = { value };
		error.value = null;
	}

	function onCancel(): void {
		drafted.value = null;
		error.value = null;
		// The queued gesture goes with the draft that asked for it. Without this, a blur
		// during a pending write, then Escape, then fresh typing, left `recommit` set with a
		// NEWER draft under it — so the settling write's loop dispatched keystrokes the user
		// had never committed and had, moments earlier, explicitly abandoned. `recommit` is a
		// request about a value, not a standing intent.
		recommit = false;
	}

	/**
	 * One dispatch and its outcome. Split out of `commitOnce` so the coalescing mechanism
	 * below reads as the one thing it is; every rule here is unchanged from the
	 * single-dispatch version.
	 */
	async function dispatchOnce(): Promise<void> {
		// The exact draft this dispatch is about. `onInput` mints a FRESH wrapper object per
		// keystroke, so reference identity answers "is the field still showing what I sent"
		// with no value comparison and no equality rule per `T` — which is the second reason
		// the clean sentinel is a wrapper rather than a bare value.
		const submitted = drafted.value;
		lastCommitted = submitted;
		const result = await options.history.run(options.buildCommand(draft.value));
		if (!isErr(result)) {
			// Accepted: drop the draft so the field tracks the refreshed canonical value —
			// but ONLY the draft that was actually submitted. A slow vault write with the
			// user still typing would otherwise clear a NEWER draft and silently replace
			// their text with the canonical value, mid-word, with nothing erroring.
			if (drafted.value === submitted) {
				drafted.value = null;
				error.value = null;
			}
			return;
		}
		const routed = routeError(result.error, options.errorMap, options.toUserMessage);
		// A banner-routed error is not this field's to DISPLAY — the Inspector has no
		// banner region, and inventing a field error for one would attach a message to an
		// input the failure is not about. It is still this field's to REPORT, which is the
		// half a first draft dropped: it cleared the error and called nothing, so a
		// resolved vault failure reached the user through neither door.
		const mine = routed.kind === 'field' && routed.fields.includes(options.field);
		// Same staleness rule on the failure arm, for the mirror reason: a message about a
		// value the user has already replaced is telling them their current text is wrong
		// when it has never been dispatched.
		const current = drafted.value === submitted;
		if (current) error.value = mine ? routed.message : null;
		// **The notice covers whatever the field did not DISPLAY — not whatever was not
		// `mine`.** Those two read alike and differ on exactly one path: a refusal that IS this
		// field's own, arriving after the user has typed on. The inline half is suppressed as
		// stale, and a `!mine` test then skips the notice too, so a write that really did fail
		// was reported through neither door — the same shape as the first draft this composable
		// already fixed once, one condition further in. `displayed` is the question the notice
		// actually turns on, so there is no arm left where both halves stay silent.
		const displayed = mine && current;
		if (!displayed) options.notify(result.error);
	}

	/**
	 * What a coalesced round's OWN rejection reaches, since nobody is left holding that
	 * promise to catch it themselves (see `commitOnce`'s docblock below).
	 *
	 * BOTH representations, from ONE step. `faultError` — split out of `notifyFault` for
	 * exactly this shape of caller — maps the cause to the same coded `PersistenceError` a
	 * guarded service would have produced and logs it with the original cause; the mapped
	 * error then goes to `options.notify`, which is the door this composable already requires
	 * because the Inspector has no banner region of its own. `faultError` rather than
	 * `notifyFault` because the caller owns announcing: `notify` is the caller's door, and a
	 * Notice raised here on top of it would be one failure reported twice.
	 *
	 * NOT a no-op, and not half of one either. A first version discarded the cause entirely
	 * once `inFlight`/`pending` were repaired, which fixed the wedge and the unhandled
	 * rejection but left the field looking settled and idle while the edit was never
	 * persisted. The version after it notified and called no logger at all — the user-facing
	 * half alone, with the cause dropped — which is the defect `notifyFault`'s own history
	 * records, in the one place where the unmapped cause is the ONLY detail that exists,
	 * because no guard ran below to have recorded it.
	 */
	function reportContinuationFault(cause: unknown): void {
		options.notify(faultError(cause, options.logger, CONTINUATION_FAULT_EVENT));
	}

	/**
	 * One coalescing round: validate, dispatch, then either stop (clearing `inFlight`) or
	 * hand off to another round of itself.
	 *
	 * **The hand-off is a fired, unawaited continuation, not a loop iteration inside the
	 * SAME call.** A version that kept looping inside one `await`-chain made the ORIGINAL
	 * gesture's returned promise wait for every coalesced follow-up to finish too — so a
	 * caller that awaited its own `onCommit()` blocked on write cycles it never asked for
	 * and had no way to observe as separate. Firing the continuation lets the gesture that
	 * triggered it resolve as soon as ITS dispatch is decided, while `inFlight`/`pending`
	 * keep describing the field until the LAST round in the chain actually terminates.
	 *
	 * **Every exit resets `inFlight`/`pending` — EXCEPT the one that hands off to another
	 * round, which deliberately leaves them for that round to clear.** A first version reset
	 * them only on the two branches that end the chain in place (an invalid draft, and "no
	 * more rounds queued"), which left a THROW from `validate`, `buildCommand`,
	 * `history.run` or `notify` taking neither branch: `inFlight` stayed `true` forever, so
	 * `onCommit` swallowed every later gesture through its `if (inFlight)` early return and
	 * the field silently stopped writing — permanently, and on the continuation path with
	 * nobody even able to observe the rejection. `continuing` is the flag that tells the
	 * `finally` below which of those two shapes just happened: SET only immediately before
	 * firing the next round, so a throw anywhere above that point still finds it `false` and
	 * still gets the reset.
	 */
	async function commitOnce(): Promise<void> {
		let continuing = false;
		try {
			recommit = false;
			// A gesture with nothing to commit: the field is already clean and showing
			// canonical. Without this, a commit gesture that fires unconditionally on every
			// blur (Task 9 binds `@blur="onCommit"`, not "only when dirty") dispatched the
			// CANONICAL value back at itself on every blur of an untouched field — one undo
			// entry per tab-through, undoing nothing visible each time. Same argument as
			// `validate` below: the guard lives HERE, inside the one round every caller
			// funnels through, rather than at each call site where a caller could forget it.
			if (drafted.value === null) return;
			// Validated INSIDE this round, not once at the top of `onCommit`, because a
			// queued gesture carries a draft nobody has checked. A version of this validated
			// once at the top and returned early on an invalid draft WITHOUT clearing
			// `recommit` — so a valid commit, then malformed text, then a blur, left the flag
			// set and the next round dispatched the malformed draft the moment the first
			// write settled, straight into the throwing `moneyOf` this seam exists to keep it
			// away from. One rule, one place, every round.
			const invalid = options.validate?.(draft.value) ?? null;
			if (invalid !== null) {
				// This field's own refusal: no command to produce it, and no `AppError` for
				// `routeError` to place.
				error.value = invalid;
				return;
			}
			await dispatchOnce();
			// Only if the draft actually MOVED, and `!== null` is half of that test rather
			// than a defensive extra: a SUCCESSFUL dispatch clears `drafted` to null, and
			// `null !== lastCommitted` is true — so without it, two blurs with no edit
			// between them re-dispatched the canonical value, bought a second undo entry,
			// and could overwrite the edit just accepted if the refresh had not landed. Null
			// here means the field is clean and showing canonical, which is precisely
			// nothing to re-send.
			if (recommit && drafted.value !== null && drafted.value !== lastCommitted) {
				continuing = true;
				// Not `void`: no caller holds this specific promise, so a bare `void` gives a
				// throw here no handler at all. `reportContinuationFault` is that handler — it
				// notifies the SAME mapped fault a guarded service would have produced, rather
				// than merely observing the rejection and discarding it.
				commitOnce().catch(reportContinuationFault);
				return;
			}
		} finally {
			if (!continuing) {
				inFlight = false;
				pending.value = false;
			}
		}
	}

	async function onCommit(): Promise<void> {
		// A second commit gesture while the first is still in flight is COALESCED, not
		// dropped and not dispatched beside it. Task 9 leaves the control enabled on
		// purpose, so a user can blur, click back in, retype and blur again before a slow
		// vault write settles — and every one of those calls would otherwise start its own
		// `history.run`. `CommandHistory` serializes them, so they cannot interleave, but it
		// still EXECUTES and RECORDS each: N blurs become N undo entries for one edit, and
		// a round's cleanup clearing `pending` while a later one is still queued would
		// leave the flag describing the wrong thing.
		//
		// Dropping the extra call instead — what `useFormCommit.submit` correctly does — is
		// wrong HERE, and the asymmetry is the same one as the disable question: a repeated
		// SUBMIT is one intent pressed twice, so the second is redundant, while a repeated
		// FIELD commit carries a value the user has since changed, so dropping it discards
		// the edit. Remember that it was asked for, and honour it once the write settles.
		if (inFlight) {
			recommit = true;
			return;
		}
		inFlight = true;
		pending.value = true;
		await commitOnce();
	}

	return {
		draft: draft as DeepReadonly<Ref<T>>,
		error: readonly(error),
		pending: readonly(pending),
		onInput,
		onCommit,
		onCancel,
	};
}
