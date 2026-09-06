import type { AppError } from '../../core/errors/AppError';

/**
 * Which field(s) a command's error code is ABOUT, declared per form beside the fields it
 * renders.
 *
 * There is no global registry of codes and there deliberately is not one: slice 2 leaves
 * each error-producing module to own its own catalogue. Values are typed `keyof TInput`, so
 * a typo'd field name — or a field the command was refactored to remove — fails to compile
 * rather than pointing an error at nothing.
 *
 * **A code with NO entry here is not an omission to fill in later.** It is the explicit
 * statement "this failure is not about one field", and it routes to the banner. The
 * calibration case is the clearest instance: `calibration.coincident-points` is a failure of
 * a PAIR the user expressed by clicking, and there is no input to render it under.
 */
export type FieldErrorMap<TInput> = Readonly<
	Record<string, keyof TInput | readonly (keyof TInput)[]>
>;

export type RoutedError<TInput> =
	| { readonly kind: 'field'; readonly fields: readonly (keyof TInput)[]; readonly message: string }
	| { readonly kind: 'banner'; readonly message: string };

/**
 * Where one `AppError` belongs on one form. It decides WHERE, never WHAT.
 *
 * `toUserMessage` arrives pre-bound as `(error) => string` rather than as a language plus a
 * table, which is what keeps this function pure and language-agnostic. The same call
 * produces the message whether it lands at a field or in the banner — one message, one place
 * it is produced, shown in one of two places. A form never authors a second wording for the
 * same error.
 *
 * Keyed on `error.code` and never on `error.category`: a `ValidationError` and a
 * `CalculationError` route identically here. Whether a category may reach a field at all is
 * slice 17's decision table, applied before anything gets here.
 *
 * **`hasOwnProperty`, not a bare index (finding V10).** `map` is a `Record<string, …>`, and a
 * plain `map[error.code]` resolves an INHERITED member exactly as it would an own one — a code
 * of `constructor` answers `Object.prototype.constructor`, a function, which is not
 * `undefined` and would route to `kind: 'field'` with that function standing in for a key. No
 * minted code collides with an `Object.prototype` member today, which is what keeps this
 * latent rather than observed.
 */
export function routeError<TInput>(
	error: AppError,
	map: FieldErrorMap<TInput>,
	toUserMessage: (error: AppError) => string,
): RoutedError<TInput> {
	const fields = Object.prototype.hasOwnProperty.call(map, error.code) ? map[error.code] : undefined;
	const message = toUserMessage(error);
	if (fields === undefined) {
		return { kind: 'banner', message };
	}
	return {
		kind: 'field',
		fields: Array.isArray(fields) ? fields : [fields as keyof TInput],
		message,
	};
}
