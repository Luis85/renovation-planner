/**
 * The Result pattern (SDD §65): expected business failures are values, not thrown
 * exceptions. A function returns `Result<T, E>` when some inputs make its answer
 * undefined; a thrown exception is reserved for unexpected technical failure, which an
 * application boundary translates (§66).
 *
 * Both arms are deeply readonly — a Result is a value that has already happened, not a
 * cell to write into.
 */
export type Result<T, E> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Readonly<{ ok: true; value: T }> {
	return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Readonly<{ ok: false; error: E }> {
	return !result.ok;
}
