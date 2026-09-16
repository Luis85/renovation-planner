import type { AppError } from '../../core/errors/AppError';
import { isErr } from '../../core/result/Result';
import { createEntityId } from '../../core/identity/generateId';
import type { Logger } from '../ports/Logger';
import type { WriteIncidentStore } from '../ports/WriteIncidentStore';
import type { UncompensatedWrite } from '../commands/DispatchOutcome';
import {
	WRITE_INCIDENT_SCHEMA_VERSION,
	unreadableWriteIncident,
	type WriteIncident,
} from './WriteIncident';

/**
 * The open write incidents, in memory, so the gate can answer SYNCHRONOUSLY.
 *
 * `guardCommand` runs on every command dispatch and cannot afford a file read per call, so
 * the durable store is read once at load and mirrored here. The mirror is append-only for
 * the same reason the port has no removal door (ADR-0034): nothing in the plugin retires an
 * incident.
 */
export class WriteIncidentRegistry {
	private readonly open: WriteIncident[] = [];

	constructor(
		private readonly store: WriteIncidentStore,
		private readonly logger: Logger,
	) {}

	/**
	 * Read the durable record once, at load, so an incident raised in a previous session
	 * closes the gate before the user can write anything.
	 *
	 * **A failed read FAILS CLOSED.** SDD §87 rule 8: a file this build cannot read is never
	 * presented as zero open incidents, so a refused list seeds one unreadable incident and
	 * the gate shuts. That is the same answer rule 7 gives an unsupported schema version, and
	 * it is the answer ADR-0034 requires of this file specifically.
	 */
	async seed(): Promise<void> {
		const listed = await this.store.list();
		if (isErr(listed)) {
			this.open.push(unreadableWriteIncident(null));
			this.logger.error('incident.seed-failed', { cause: listed.error });
			return;
		}
		this.open.push(...listed.value);
	}

	/** Is any incident open? The gate's whole question, asked without touching the vault. */
	anyOpen(): boolean {
		return this.open.length > 0;
	}

	/**
	 * Record a refusal that left writes behind — in memory FIRST, then durably.
	 *
	 * **A failed durable write does not un-raise the incident.** The command's own write
	 * already failed and the vault is already inconsistent; losing the record of that because
	 * the record itself could not be written would manufacture exactly the all-clear ADR-0034
	 * refuses. So the incident stays open for this session either way and the failure is
	 * logged. The gate closes on the in-memory list, which is already appended to by the time
	 * the store is asked.
	 *
	 * Resolves rather than rejects for every fault, including a store that throws instead of
	 * answering a `Result`: callers `void` this, and an unhandled rejection at load is a
	 * defect this repository has already paid for once in `recoverInterruptedSequences`.
	 */
	async record(error: AppError & UncompensatedWrite): Promise<void> {
		const incident: WriteIncident = {
			schemaVersion: WRITE_INCIDENT_SCHEMA_VERSION,
			incidentId: createEntityId('incident'),
			raisedAt: new Date().toISOString(),
			code: error.code,
			category: error.category,
			affected: error.uncompensatedWrite,
		};
		this.open.push(incident);
		try {
			const written = await this.store.add(incident);
			if (isErr(written)) this.logger.error('incident.write-failed', { cause: written.error });
		} catch (cause) {
			this.logger.error('incident.write-failed', { cause });
		}
	}
}

/**
 * The registry the guard consults, installed once by the composition root.
 *
 * **A module-level holder rather than a parameter, and the reason is the call sites.** The
 * refusal has to reach every guarded command, and there are 44 `guardCommand` call sites in
 * 13 files (`grep -rnE "guardCommand[<(]" src/plugin/`, 2026-09-16). A fifth parameter would
 * have to be threaded through all of them, and an OPTIONAL one would relocate the forgetting
 * rather than close it — a site that omitted it would be silently ungated, which is the exact
 * shape ADR-0034 rejects intersection gating for. What that grep cannot see: a call reached
 * through an alias, a re-export or a variable, since it matches the literal text
 * `guardCommand(` or `guardCommand<`.
 *
 * `null` until something installs one, which is correct for a caller composing services
 * without a session: there is no vault whose incidents it could be answering about. The
 * plugin installs one at load and takes it back off at `onunload` — a global this code
 * installs is a global this code removes.
 *
 * It is mutable module state, so a test that installs one owes every later case in its own
 * FILE a reset. Vitest gives each file in the `suite` project its own module registry, so
 * nothing leaks between files.
 */
let active: WriteIncidentRegistry | null = null;

export function installWriteIncidentRegistry(registry: WriteIncidentRegistry | null): void {
	active = registry;
}

export function activeWriteIncidentRegistry(): WriteIncidentRegistry | null {
	return active;
}
