import { readonly, ref, type DeepReadonly, type Ref } from 'vue';
import { err, isErr, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import type { Logger } from '../../application/ports/Logger';
import { faultError } from '../notices/notify';
import { routeError, type FieldErrorMap } from '../errors/route-error';

/**
 * The event name a thrown dispatch is logged under — FIXED here rather than taken as an
 * option, for the reason `useFieldCommit`'s own continuation event is: the event says which
 * DOOR faulted, and the door is this composable's submit, not the caller wired behind it.
 */
const SUBMIT_FAULT_EVENT = 'form.commit.submit.faulted';

/**
 * A creation dialog's commit boundary: every field at once, on one explicit submit.
 *
 * There is no entity yet, so there is nothing to blur-commit each field against — which is
 * the ONLY way this differs from `useFieldCommit`. Both call the same `routeError` and both
 * render through the same `<FieldError>` / `<FormBanner>` pair.
 *
 * Every returned member is read-only to the component and `setField` is the only write path.
 * `values` is DEEP-readonly for a measured reason: `Readonly<Ref<TInput>>` is a shallow
 * mapped type, so it freezes the binding and not the object — it would permit both
 * `values.value.name = x` from script and `v-model="values.name"` from markup, since a ref
 * unwraps in templates. Those are exactly the two writes that walk past `setField`.
 */
export interface UseFormCommit<TInput> {
	readonly values: DeepReadonly<Ref<TInput>>;
	/**
	 * A Ref, not a bare `ReadonlyMap`. A plain Map handed out of a composable is a SNAPSHOT,
	 * so a form whose submit was rejected would compute its errors and render none of them.
	 * Not deep, and does not need to be: `ReadonlyMap` already refuses `set`/`delete`, and
	 * its values are strings.
	 */
	readonly fieldErrors: Readonly<Ref<ReadonlyMap<keyof TInput, string>>>;
	readonly banner: Readonly<Ref<string | null>>;
	readonly submitting: Readonly<Ref<boolean>>;
	/**
	 * Writes the field AND clears the routed error it belongs to — every field of it, not
	 * just this key. A cross-field error (`project.target-before-start` sits under `start`
	 * AND `targetCompletion`) describes a PAIR, so correcting either one retires the whole
	 * claim: leaving the twin behind would display a stale message about a pair that may now
	 * be valid, which is the exact untruth this clearing exists to prevent.
	 */
	setField<K extends keyof TInput>(key: K, value: TInput[K]): void;
	/** `true` only on an ok `Result` — the caller closes the dialog on that and nothing else. */
	submit(): Promise<boolean>;
}

export function useFormCommit<TInput extends object, TResult>(options: {
	readonly initial: TInput;
	readonly dispatch: (input: TInput) => Promise<Result<TResult, AppError>>;
	readonly errorMap: FieldErrorMap<TInput>;
	readonly toUserMessage: (error: AppError) => string;
	/**
	 * Where the DEVELOPER-facing half of a THROWN dispatch goes — the original cause, at
	 * `error`, under this module's own event name.
	 *
	 * **Required, exactly as `useFieldCommit`'s is, and for the same reason.** SDD §66 asks
	 * that the two representations of one failure come from ONE step; `submit` below stands
	 * where no guard did, so the unmapped cause is the only detail that exists. Optional with
	 * a default, the forgetting call site is silent and nothing anywhere errors.
	 *
	 * The USER-facing half needs no option beside it, and that is the one asymmetry with the
	 * field composable: a form HAS a banner, which is where a failure that belongs to no field
	 * goes. `useFieldCommit` needs its `notify` precisely because the Inspector has no banner
	 * region to put one in.
	 */
	readonly logger: Logger;
}): UseFormCommit<TInput> {
	const values = ref({ ...options.initial }) as Ref<TInput>;
	const fieldErrors = ref<ReadonlyMap<keyof TInput, string>>(new Map());
	const banner = ref<string | null>(null);
	const submitting = ref(false);

	/**
	 * Which fields shared one routed error, so a cross-field message can be retired as the
	 * unit it is. A per-key Map cannot express "these two are one claim" — it only knows that
	 * two keys happen to hold equal strings, which is not the same thing and would collapse
	 * two genuinely separate errors that read alike.
	 *
	 * **Every key `fieldErrors` holds is a member of this array**, and that one-directional
	 * subset — not an equality, since `setField` shrinks `fieldErrors` and leaves this alone —
	 * is what lets `setField` clear the group without first asking whether `key` belongs to it.
	 * It holds because the three writers of `fieldErrors` each maintain it: `submit` empties
	 * BOTH in one statement pair, `submit`'s field arm assigns this from the very
	 * `routed.fields` it builds the new map out of, and `setField` only DELETES, which cannot
	 * add a key the array lacks. A fourth writer that refreshes one side alone breaks it, and
	 * the symptom is silent — the field the user has just corrected keeps its message.
	 *
	 * The two `retires …` cases in `useFormCommit.test.ts` are what go red when it does, and
	 * the single-field one only since the per-key fallback below was deleted. Measured, by
	 * dropping this assignment and running both ways: with the fallback there, that case stayed
	 * GREEN under a broken pairing, because `[key]` cleared the very key it was asserting on.
	 * Deleting a branch nothing could reach gave an existing test back its teeth.
	 */
	let routedGroup: readonly (keyof TInput)[] = [];

	function setField<K extends keyof TInput>(key: K, value: TInput[K]): void {
		values.value = { ...values.value, [key]: value };
		if (!fieldErrors.value.has(key)) return;
		const next = new Map(fieldErrors.value);
		// The whole group, not just this key: correcting either half of a pair retires the
		// claim about the pair. No per-key fallback beside it: the line above has just proved
		// `key` is in `fieldErrors`, and every key of `fieldErrors` is in the group.
		for (const field of routedGroup) next.delete(field);
		fieldErrors.value = next;
	}

	/**
	 * The dispatch, with the one thing its type does not promise handled: a REJECTION.
	 *
	 * `submit` is bound to a `<form>`'s `@submit.prevent`, which discards the promise it
	 * returns — so a throw from below was an unhandled rejection with the dialog still open and
	 * nothing said to anyone, the exact shape `runtime.ts`'s `reportFault` and
	 * `useFieldCommit`'s `reportContinuationFault` each exist to close at their own door.
	 *
	 * Every dispatch wired today is a `guardCommand` wrapper that cannot throw, which is what
	 * made this invisible rather than harmless: the hole opens for whoever wires the first
	 * unguarded one, and it opens silently. `faultError` maps the cause to the same coded
	 * `PersistenceError` a guard would have produced and logs it with that cause — one step for
	 * both representations — and the mapped error is then routed like any other failure, which
	 * lands it in the banner, since no field map has an entry for a vault code.
	 */
	async function dispatchOrFault(input: TInput): Promise<Result<TResult, AppError>> {
		try {
			return await options.dispatch(input);
		} catch (cause) {
			return err(faultError(cause, options.logger, SUBMIT_FAULT_EVENT));
		}
	}

	async function submit(): Promise<boolean> {
		// Two quick Enter presses produce two submit events. `CreateProjectCommand` mints a
		// fresh id per call, so without this guard one form creates two projects — and
		// `submitting` existed as an observation flag that nothing consulted, which is a flag
		// that describes the defect rather than preventing it.
		if (submitting.value) return false;
		// Cleared BEFORE the dispatch, so a stale message from the previous submit cannot
		// outlive the submit that fixed it.
		fieldErrors.value = new Map();
		routedGroup = [];
		banner.value = null;
		submitting.value = true;
		try {
			const result = await dispatchOrFault(values.value);
			if (!isErr(result)) return true;

			const routed = routeError(result.error, options.errorMap, options.toUserMessage);
			if (routed.kind === 'banner') {
				banner.value = routed.message;
				return false;
			}
			const next = new Map<keyof TInput, string>();
			for (const field of routed.fields) next.set(field, routed.message);
			routedGroup = routed.fields;
			fieldErrors.value = next;
			return false;
		} finally {
			submitting.value = false;
		}
	}

	return {
		values: readonly(values),
		fieldErrors: readonly(fieldErrors) as Readonly<Ref<ReadonlyMap<keyof TInput, string>>>,
		banner: readonly(banner),
		submitting: readonly(submitting),
		setField,
		submit,
	};
}
