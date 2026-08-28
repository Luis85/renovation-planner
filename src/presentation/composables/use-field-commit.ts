import { computed, readonly, ref, toValue, type DeepReadonly, type MaybeRefOrGetter, type Ref } from 'vue';
import { isErr, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import { routeError, type FieldErrorMap } from '../errors/route-error';

/** What `CommandHistory.run` takes: anything with the two halves of a reversible write. */
interface RunnableCommand {
	execute(): Promise<Result<void, AppError>>;
	undo(): Promise<Result<void, AppError>>;
}

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

	const draft = computed(() => drafted.value?.value ?? toValue(options.canonicalValue));

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
		// when it has never been dispatched. The NOTICE still fires either way — the write
		// really did fail, and that is true of the vault regardless of what the input now
		// holds.
		if (drafted.value === submitted) error.value = mine ? routed.message : null;
		if (!mine) options.notify(result.error);
	}

	/**
	 * One coalescing round: validate, dispatch, then either stop (clearing `inFlight`) or
	 * hand off to another round of itself.
	 *
	 * **The hand-off is a fired, unawaited continuation, not a loop iteration inside the
	 * SAME call.** A version that kept looping inside one `await`-chain made the ORIGINAL
	 * gesture's returned promise wait for every coalesced follow-up to finish too — so a
	 * caller that awaited its own `onCommit()` blocked on write cycles it never asked for
	 * and had no way to observe as separate. Firing the continuation with `void` lets the
	 * gesture that triggered it resolve as soon as ITS dispatch is decided, while
	 * `inFlight`/`pending` keep describing the field until the LAST round in the chain
	 * actually terminates — which is also why only the terminating branches reset them.
	 */
	async function commitOnce(): Promise<void> {
		recommit = false;
		// Validated INSIDE this round, not once at the top of `onCommit`, because a queued
		// gesture carries a draft nobody has checked. A version of this validated once at
		// the top and returned early on an invalid draft WITHOUT clearing `recommit` — so a
		// valid commit, then malformed text, then a blur, left the flag set and the next
		// round dispatched the malformed draft the moment the first write settled, straight
		// into the throwing `moneyOf` this seam exists to keep it away from. One rule, one
		// place, every round.
		const invalid = options.validate?.(draft.value) ?? null;
		if (invalid !== null) {
			// This field's own refusal: no command to produce it, and no `AppError` for
			// `routeError` to place.
			error.value = invalid;
			inFlight = false;
			pending.value = false;
			return;
		}
		await dispatchOnce();
		// Only if the draft actually MOVED, and `!== null` is half of that test rather than
		// a defensive extra: a SUCCESSFUL dispatch clears `drafted` to null, and
		// `null !== lastCommitted` is true — so without it, two blurs with no edit between
		// them re-dispatched the canonical value, bought a second undo entry, and could
		// overwrite the edit just accepted if the refresh had not landed. Null here means
		// the field is clean and showing canonical, which is precisely nothing to re-send.
		if (recommit && drafted.value !== null && drafted.value !== lastCommitted) {
			void commitOnce();
			return;
		}
		inFlight = false;
		pending.value = false;
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
