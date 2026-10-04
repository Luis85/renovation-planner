import type { AppError, PersistenceError } from '../../core/errors/AppError';
import { err, type Result } from '../../core/result/Result';
import type { Logger } from '../ports/Logger';
import type { Command } from '../commands/Command';
import type { Query } from '../queries/Query';
import { activeWriteIncidentRegistry, type WriteIncidentRegistry } from '../incidents/WriteIncidentRegistry';
import { persistenceError } from '../errors';
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

/**
 * The code a command refused because the vault holds an open write incident. It is also a
 * locale key, spelled identically in `locales/en/writeIncident.ts` and its German twin —
 * `toUserMessage` resolves a code directly when a key of that exact name exists.
 */
export const WRITES_PAUSED_CODE = 'write-incident.writes-paused';

/**
 * The one refusal a paused vault answers with, minted in ONE place.
 *
 * It has two callers and they sit in different layers — this module's `guardCommand`, which
 * refuses a forward COMMAND, and `presentation/editor/tools/with-incident-gate.ts`, which
 * refuses an UNDO the command chokepoint never sees. A second hand-spelled copy is how the two
 * drift into answering different things for the same vault state, and the code above is the
 * thing `toUserMessage` keys its copy off in both locales.
 */
export function writesPausedRefusal(): PersistenceError {
	return persistenceError(
		WRITES_PAUSED_CODE,
		'Writing is paused: an earlier write left the vault half-written and was not undone.',
	);
}

/**
 * ADR-0034's gate, on the COMMAND door only.
 *
 * While any write incident is open — a write landed, its compensating undo also failed, and
 * the vault is half-written — every guarded command is refused BEFORE its `execute` runs.
 *
 * **It records nothing, since owner ruling 13.** The record used to be taken here, on a failed
 * result carrying the stamp, and that reached only the stamps whose error returned through a
 * guarded door — six raise sites had paths that returned through `CommandHistory` over raw ports
 * instead, and reached no recorder at all. `markUncompensated` records where it stamps now, so
 * every stamp is recorded once whichever door it leaves by, and a recorder kept here would count
 * each stamp that does leave through a guarded door a second time. What that trade costs: the
 * record is taken into whatever registry the holder answers AT STAMP TIME rather than the one
 * this guard read at dispatch start, which is why the hold below matters for it too.
 *
 * **The refusal is NOT in `withBoundary`, which also backs `guardQuery`, and that is the
 * decision rather than an oversight.** Queries must keep working: `docs/using-planning-
 * recovery.md` tells the user to inspect their data against a backup, and a gate that blocked
 * reads would make the vault uninspectable at exactly the moment inspecting it is the only
 * remedy on offer.
 *
 * **The gate is COARSE — every guarded write in the vault, not only writes touching the
 * recorded entities — by decision, not by omission.** The wrapper cannot know which entities
 * a command WOULD touch: `Command<I, R>`'s `I` carries no constraint and `withBoundary`
 * passes `input` through unread, and eleven sampled command input types use five different id
 * field names (`assetId`, `planId`, `zoneId`, `requirementId`, `projectId`) while the two
 * creation commands carry no id of their own at all — `CreatePlanInput` carries its PARENT's.
 * An intersection gate would therefore need a declaration added at every `guardCommand` call
 * site — **46 of them in 14 files**, re-measured 2026-09-17 with
 * `grep -rnE "guardCommand[<(]" src/plugin/ | wc -l` for the sites and the same pattern under
 * `-rlE … | wc -l` for the files (it read 44 in 13 until BP-02 slice 4 brought the Inspector's
 * two zone edits inside the gate; a count is a fact that goes stale, so it is re-derived rather
 * than remembered) — which relocates the forgetting rather than closing it. What that grep
 * cannot see: a call reached through an alias, a re-export or a variable, since it matches the
 * literal text `guardCommand(` or `guardCommand<`. And the recorded affected set
 * is knowingly incomplete (ADR-0034's identity ruling), so a gate built on it would read as
 * precise while missing the writes the incomplete sites failed to name.
 *
 * A `PersistenceError` needs no signature change anywhere: every guarded door's declared
 * return is already `Result<T, E | PersistenceError>`.
 */
export function guardCommand<I, T, E extends AppError>(
	command: Command<I, Result<T, E>>,
	event: string,
	logger: Logger,
	map: VaultExceptionMapper,
): Command<I, Result<T, E | PersistenceError>> {
	const guarded = withBoundary(command.execute.bind(command), event, logger, map);
	return {
		execute: async (input) => {
			// Annotated so fallow resolves `hold` through it (CLAUDE.md's Gotchas).
			const incidents: WriteIncidentRegistry | null = activeWriteIncidentRegistry();
			if (incidents !== null && incidents.anyOpen()) {
				const refusal = writesPausedRefusal();
				logger.error(event, { cause: refusal });
				return err(refusal);
			}
			// Held for the whole dispatch, so a stamp this command makes — recorded by
			// `markUncompensated` through the holder — still finds the registry installed when a
			// teardown ran meanwhile (owner ruling 16, `WriteIncidentRegistry.hold`).
			const release = incidents?.hold();
			try {
				return await guarded(input);
			} finally {
				release?.();
			}
		},
	};
}

export function guardQuery<I, T, E extends AppError>(
	query: Query<I, Result<T, E>>,
	event: string,
	logger: Logger,
	map: VaultExceptionMapper,
): Query<I, Result<T, E | PersistenceError>> {
	return { execute: withBoundary(query.execute.bind(query), event, logger, map) };
}
