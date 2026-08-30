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

/** Unwraps an expected-ok Result, failing the test with the error if it is not. */
export function expectOk<T, E>(result: Result<T, E>): T {
	if (!result.ok) {
		throw new Error(`Expected ok, got error: ${JSON.stringify(result.error)}`);
	}
	return result.value;
}

/** The mirror of expectOk, for failure-path assertions. */
export function expectErr<T, E>(result: Result<T, E>): E {
	if (result.ok) {
		throw new Error(`Expected error, got ok: ${JSON.stringify(result.value)}`);
	}
	return result.error;
}
