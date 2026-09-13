import type { UseFormCommit } from './use-form-commit';

/** The keys of `TInput` whose value IS the control's own string: a text input's, or a select's over a string union. Exported so a caller can name the handler's type. */
export type StringField<TInput> = { [K in keyof TInput]: TInput[K] extends string ? K : never }[keyof TInput];

/**
 * `:value` + `@input`/`@change` for one string-on-the-wire field, calling `setField` — never
 * `v-model`, which would assign straight past it and make the sole-write-path rule
 * `useFormCommit` exists for unenforceable. ONE handler over a key rather than one per field:
 * `NewAssetForm` had stated that once for its seven fields, and `NewPlanForm` and
 * `NewProjectForm` each spelled the same five lines per text field, which `npm run analyze`
 * reported as a clone the moment the plan form gained a select. A field that needs a
 * CONVERSION — a `Date | null`, an optional status rendered as `''` — is not this shape and
 * keeps its own handler beside this one.
 *
 * The refusal is `useDialogFormBusy`'s: a control marked inoperative, or any control while the
 * form is submitting, has its DOM value put back to what the form holds and the write dropped.
 * The cast on the way in is what the control's own option list (or the field's `string` type)
 * makes true; the constraint on `K` is what keeps a non-string field out of it at compile time.
 */
export function useFieldInput<TInput extends object>(
	form: Pick<UseFormCommit<TInput>, 'values' | 'setField'>,
	refuseWhileSubmitting: (control: HTMLElement & { value: string }, rendered: string) => boolean,
): <K extends StringField<TInput>>(key: K, event: Event) => void {
	return (key, event) => {
		const control = event.target as HTMLInputElement | HTMLSelectElement;
		// `values` is `DeepReadonly`, which TS will not index by a key narrowed through a conditional
		// type; the cast states what the constraint on `K` already holds — the field is a string.
		const held = (form.values.value as Readonly<Record<typeof key, string>>)[key];
		if (refuseWhileSubmitting(control, held)) return;
		form.setField(key, control.value as TInput[typeof key]);
	};
}
