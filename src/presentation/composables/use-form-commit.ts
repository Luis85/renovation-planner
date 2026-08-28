import { readonly, ref, type DeepReadonly, type Ref } from 'vue';
import { isErr, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import { routeError, type FieldErrorMap } from '../errors/route-error';

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
	 */
	let routedGroup: readonly (keyof TInput)[] = [];

	function setField<K extends keyof TInput>(key: K, value: TInput[K]): void {
		values.value = { ...values.value, [key]: value };
		if (!fieldErrors.value.has(key)) return;
		const next = new Map(fieldErrors.value);
		// The whole group, not just this key: correcting either half of a pair retires the
		// claim about the pair.
		for (const field of routedGroup.includes(key) ? routedGroup : [key]) next.delete(field);
		fieldErrors.value = next;
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
			const result = await options.dispatch(values.value);
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
