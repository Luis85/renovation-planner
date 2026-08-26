import type { AppError, PersistenceError } from '../../core/errors/AppError';
import { err, type Result } from '../../core/result/Result';
import type { Logger } from '../ports/Logger';
import type { Command } from '../commands/Command';
import type { Query } from '../queries/Query';
import type { VaultExceptionMapper } from './exceptionMapper';

/**
 * The Error Boundary's last line (SDD §66, §65): whatever a command or query runs
 * against CAN throw — an unexpected fault past the repositories' own expected-failure
 * `Result`s — but nothing may throw PAST the application layer. These two wrappers are
 * wired around every command and query at the composition root, so a service's public
 * contract is a resolved failed `Result` for every input, never a rejection.
 *
 * Both halves of the logging policy happen HERE, at one step (SDD §67):
 * - an exception mapped to `PersistenceError` is logged with its original cause, and
 * - a RESOLVED failed `Result` — the repositories' expected-refusal channel — is logged
 *   with the `AppError` as its cause. Without this second half, a revision conflict or
 *   an unsupported schema version reaches the user as a Notice with no log line
 *   anywhere, and the terse message and its detail drift into two code paths.
 *
 * The return type is what makes the mapping safe — there is no cast in either body.
 * The wrapped contract is `Result<T, E | PersistenceError>`: for every service wired
 * today that union collapses to E itself (each command/query error union already
 * includes `RepositoryError`, which includes `PersistenceError`), so it assigns back to
 * the field's declared type. For a future service whose error union NARROWED away
 * `PersistenceError`, the widened union would refuse to assign at the composition root
 * — the compiler, not a comment, refuses a guard whose mapped error its contract
 * cannot carry.
 */
/**
 * The doors a guard wraps, recorded ON the wrapper it hands back.
 *
 * A symbol, and non-enumerable, so it changes nothing a caller can observe: it is absent
 * from `Object.keys`, from a spread and from JSON, and only code importing this module can
 * name it. What reads it is `tests/plugin/guardCategory.test.ts`, which walks everything
 * the composition root hands out and refuses an `execute`-bearing service that carries no
 * mark — the category form of SDD §66, checked at the forbidden thing rather than by
 * listing the members somebody remembered.
 *
 * It records the method NAMES rather than a bare `true`, because "is this a wrapper?"
 * already had a green answer while the wrapper sat on the wrong method: `guardCommand`
 * wraps `execute`, and the Inspector's reversible adapters dispatch an override through
 * `executeWithVersion`. Naming the doors lets the check compare what is guarded against
 * what a caller can actually reach, and fail on the difference.
 */
export const GUARDED_DOORS: unique symbol = Symbol('renovation-planner.guarded-doors');

/**
 * Stamp a wrapper with the doors it guards. Every guard in the app returns through here —
 * the two below, and the composite guards in `plugin/guardedServices.ts` that build a
 * multi-door facade out of them.
 */
export function markGuarded<T extends object>(wrapper: T, doors: readonly string[]): T {
	Object.defineProperty(wrapper, GUARDED_DOORS, { value: doors });
	return wrapper;
}

function withBoundary<I, T, E extends AppError>(
	execute: (input: I) => Promise<Result<T, E>>,
	event: string,
	logger: Logger,
	map: VaultExceptionMapper,
): (input: I) => Promise<Result<T, E | PersistenceError>> {
	return async (input) => {
		try {
			const result = await execute(input);
			if (!result.ok) {
				logger.error(event, { cause: result.error });
			}
			return result;
		} catch (cause) {
			const mapped: Result<T, E | PersistenceError> = err(map(cause));
			logger.error(event, { cause });
			return mapped;
		}
	};
}

export function guardCommand<I, T, E extends AppError>(
	command: Command<I, Result<T, E>>,
	event: string,
	logger: Logger,
	map: VaultExceptionMapper,
): Command<I, Result<T, E | PersistenceError>> {
	return markGuarded({ execute: withBoundary(command.execute.bind(command), event, logger, map) }, ['execute']);
}

export function guardQuery<I, T, E extends AppError>(
	query: Query<I, Result<T, E>>,
	event: string,
	logger: Logger,
	map: VaultExceptionMapper,
): Query<I, Result<T, E | PersistenceError>> {
	return markGuarded({ execute: withBoundary(query.execute.bind(query), event, logger, map) }, ['execute']);
}
