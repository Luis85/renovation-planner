import type { DomainEvent, EventBus } from '../../src/core/events/EventBus';
// `Disposable` is declared in its own module and `EventBus` only IMPORTS it — a re-export it
// never made. Erased by vitest's transpile-only pipeline, so this named nothing for as long
// as nothing type-checked this file.
import type { Disposable } from '../../src/core/events/Disposable';
import { err, type Result } from '../../src/core/result/Result';
import type { PersistenceError } from '../../src/core/errors/AppError';
import type { ObservationToken } from '../../src/application/ports/versioning';

/**
 * An EventBus that records what was published. Commands must publish exactly one event,
 * on the success path only — every failure-path assertion leans on `published` staying
 * empty.
 */
export class RecordingEventBus implements EventBus {
	readonly published: DomainEvent[] = [];

	publish<E extends DomainEvent>(event: E): Promise<void> {
		this.published.push(event);
		return Promise.resolve();
	}

	subscribe<TType extends string>(
		type: TType,
		handler: (event: DomainEvent<TType>) => void | Promise<void>,
	): Disposable {
		void type;
		void handler;
		return { dispose: () => undefined };
	}
}

/** The one error the injected-failure repositories resolve with. */
export function injectedPersistenceError(): PersistenceError {
	return {
		category: 'Persistence',
		code: 'test.injected-failure',
		message: 'Injected persistence failure.',
	};
}

export function injectedReadFailure(): Result<never, PersistenceError> {
	return err(injectedPersistenceError());
}

export function observationToken(value: string): ObservationToken {
	return value as ObservationToken;
}

/**
 * Unwraps an expected-ok Result, failing the test with the error if it is not.
 *
 * The error type is `unknown` rather than a second parameter, and that is what lets these
 * take a UNION of results. `expectOk<T, E>(result: Result<T, E>)` cannot infer one `E` across
 * `Result<A, E1> | Result<B, E2>` — a shape every "each of these calls refuses" loop produces
 * — so four call sites failed at the argument while the helper looked general. Nothing reads
 * `E` here: `expectOk` throws the error stringified and returns the value. Measured when the
 * parameter was dropped: four errors cleared, none introduced.
 */
export function expectOk<T>(result: Result<T, unknown>): T {
	if (!result.ok) {
		throw new Error(`Expected ok, got error: ${JSON.stringify(result.error)}`);
	}
	return result.value;
}

/** The mirror of expectOk, for failure-path assertions. */
export function expectErr<E>(result: Result<unknown, E>): E {
	if (result.ok) {
		throw new Error(`Expected error, got ok: ${JSON.stringify(result.value)}`);
	}
	return result.error;
}

/**
 * Unwraps a repository read that was expected to FIND something: ok, and not `null`.
 *
 * `getById` answers `Result<Loaded<T> | null, …>`, so `expectOk` alone leaves the null arm
 * live and every use of the value below it is a `possibly null` error — 87 of them across
 * `tests/**` when the compiler was first pointed at it, which is the single largest class of
 * the debt in `scripts/typecheck-tests-baseline.json`.
 *
 * A `!` would silence each one, and this is worth the helper instead: a seed that failed to
 * land throws a TypeError several lines later, naming a property rather than the read, while
 * this fails at the read with the question it was asking. Two arms and two messages, never
 * one — an absent entity and a refusing repository are different test failures.
 */
export function expectFound<T>(result: Result<T | null, unknown>): T {
	const value = expectOk(result);

	if (value === null) {
		throw new Error('Expected the entity to be found, got null.');
	}
	return value;
}

/**
 * Unwraps a value a test expects to be present, failing with a named question when it is not.
 *
 * The plain-value sibling of `expectFound`, for the reads that answer `T | undefined` without
 * a `Result` around them — a `Map.get`, an index lookup, an optional field. Same argument as
 * that one: a `!` silences the compiler and leaves a TypeError several lines later naming a
 * property, while this fails where the value was asked for.
 *
 * `what` is required rather than optional, because the whole gain over `!` is the message,
 * and an optional one is the parameter every call site forgets.
 */
export function expectDefined<T>(value: T | null | undefined, what: string): T {
	if (value === null || value === undefined) {
		throw new Error(`Expected ${what} to be present, got ${String(value)}.`);
	}
	return value;
}
