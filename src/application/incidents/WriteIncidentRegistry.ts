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
 * What a reader — today only the diagnostics snapshot — is told about open incidents.
 *
 * Declared beside the registry that PRODUCES it rather than beside the query that consumes
 * it, which is this repository's own layering rule: a type placed with its consumer makes the
 * pure layer depend on the effectful one.
 *
 * `path` is the ONE path anything here carries. It is plugin-local
 * (`<plugin dir>/write-incidents.json`) and holds no user content, which is what lets it
 * through SDD §86's content-free rule while a note path would not. It is here because
 * ADR-0034 makes removing that file the ONLY retirement there is — the plugin offers no "I
 * have repaired this" control, because nothing here can tell a repaired vault from an
 * unrepaired one — so a read-only report naming the file is the whole of how that gesture
 * becomes discoverable.
 */
export interface WriteIncidentReport {
	readonly path: string;
	readonly open: readonly WriteIncident[];
}

/**
 * What a caller composing without a session is told: no registry is installed, so there is no
 * vault whose incidents this could be answering about — which is a different fact from "a
 * vault that has none", and both render as an empty list. Safe only because it is unreachable
 * from a composed plugin: `SessionStores` installs a registry at CONSTRUCTION rather than at
 * seeding, so the accessor is non-null from load.
 */
export const NO_WRITE_INCIDENTS: WriteIncidentReport = { path: '', open: [] };

/**
 * The open write incidents, in memory, so the gate can answer SYNCHRONOUSLY.
 *
 * **Recorded in ONE place: `markUncompensated`, where every stamp is made** (owner ruling 13).
 * The two doors that used to record — `guardCommand` on a stamped result, and the host-rename
 * listener — reached only the stamps that returned through them, and six raise sites had paths
 * that returned through neither. A recorded stamp is durable (the store below, re-read at every
 * load), so each of those paths now pauses the vault across restarts, not only for the session.
 *
 * `guardCommand` runs on every command dispatch and cannot afford a file read per call, so
 * the durable store is read once at load and mirrored here. The mirror is append-only for
 * the same reason the port has no removal door (ADR-0034): nothing in the plugin retires an
 * incident.
 *
 * **Read once means exactly once: nothing re-reads the file after `seed()`.** So the only way
 * out of the gate is deleting the file AND loading the plugin again — which is what the user
 * copy now says in both locales (`locales/en/writeIncident.ts` and its German twin) and what
 * `docs/using-planning-recovery.md` now tells the user to do. A user who deletes the file and
 * keeps working instead opens a window where memory and disk disagree for the rest of the
 * session: this list still holds the deleted incidents and still refuses every guarded write,
 * and the next `record()` writes a FRESH envelope — `WriteIncidentFileStore.add` reads the
 * file, finds none, and appends to an empty list — holding only the new incident. That
 * divergence is real and reachable; the copy is the whole of what keeps it rare.
 *
 * **The RECORD is vault-scoped; this GATE is process-scoped, and ADR-0034's title word covers
 * only the first.** Two Obsidian windows open on one vault are two plugin instances, each with
 * its own registry seeded once at its own load, so an incident recorded in one closes only that
 * one's gate until the other reloads. `WriteIncidentFileStore`'s docblock carries the matching
 * fact about its queue.
 */
export class WriteIncidentRegistry {
	private readonly open: WriteIncident[] = [];

	// Guards `seed()` itself rather than relying on a caller to call it once. `startPersistence`
	// (`RenovationPlannerPlugin.ts`) is re-entered by every settings save, ABOVE the
	// `listenersRegistered` guard that stops the rest of that method's body from re-running —
	// so without this flag, every settings save re-read the store and re-pushed the SAME
	// durable incidents onto `open`, unbounded. `anyOpen()`'s `length > 0` test cannot see
	// that: any positive length answers the same, which is why the regression was invisible
	// until something counted rather than merely tested presence.
	private seeded = false;

	// Saves running against this registry, and what to do when the last one ends — `hold()`.
	private held = 0;
	private idle: (() => void) | null = null;

	/**
	 * @param location Where the durable record sits, for the diagnostics report to NAME —
	 * never for this class to read or write, which is the store's whole job. It is carried
	 * here rather than fetched from the store because `WriteIncidentStore` deliberately
	 * declares exactly two methods and the absence of a third is load-bearing (its own
	 * docblock), so widening that port to expose a path would trade a real guarantee for a
	 * string this class is already handed at construction.
	 */
	constructor(
		private readonly store: WriteIncidentStore,
		private readonly logger: Logger,
		private readonly location = '',
	) {}

	/**
	 * Read the durable record once, at load, so an incident raised in a previous session
	 * closes the gate before the user can write anything.
	 *
	 * **Idempotent by its OWN guard, not by a caller's discipline.** A second call is a no-op:
	 * `seeded` is set before the read starts, so a re-entrant call made while the first is
	 * still in flight also finds it set. That is what lets `RenovationPlannerPlugin` call this
	 * from `startPersistence` without tracking, elsewhere, whether that method has already run
	 * this session.
	 *
	 * **A failed read FAILS CLOSED.** SDD §87 rule 8: a file this build cannot read is never
	 * presented as zero open incidents, so a refused list seeds one unreadable incident and
	 * the gate shuts. That is the same answer rule 7 gives an unsupported schema version, and
	 * it is the answer ADR-0034 requires of this file specifically.
	 *
	 * **Skips a listed incident this registry's own `open` already holds, by `incidentId`.**
	 * A reload installs a NEW registry over the same durable file at CONSTRUCTION, before
	 * `startPersistence` calls `seed()` at `onLayoutReady` — a window in which a save still in
	 * flight from the OLD session can half-fail and `record()` into this (the now-active) one,
	 * pushing the incident into `open` and onto disk before `seed()` ever runs. Without the
	 * check, `seed()` read that same incident back off the store and pushed the listed copy a
	 * second time: two in-memory entries sharing one `incidentId`, one record on disk.
	 */
	async seed(): Promise<void> {
		if (this.seeded) return;
		this.seeded = true;
		const listed = await this.store.list();
		if (isErr(listed)) {
			this.open.push(unreadableWriteIncident(null));
			this.logger.error('incident.seed-failed', { cause: listed.error });
			return;
		}
		const known = new Set(this.open.map((incident) => incident.incidentId));
		this.open.push(...listed.value.filter((incident) => !known.has(incident.incidentId)));
	}

	/**
	 * A save starting: its end is the returned function. One-shot — a second call is ignored,
	 * because `whenIdle` tests `held === 0` exactly and a double release would count a save
	 * still running as ended.
	 *
	 * Owner ruling 16 — the record is not released at unload while a save is still running,
	 * because Obsidian's teardown blurs a typed field BEFORE `onunload` and the write that blur
	 * commits reaches the vault AFTER it (`tests/e2e/unloadWindow.e2e.ts`, 1.13.7). Taken at the
	 * two doors a gesture reaches synchronously — `guardCommand` and the editors'
	 * `withSaveStateTracking` — so a save counts from its gesture, not from its guard, which two
	 * serial queues put after `onunload`. Two holders sit outside those doors: `useFieldCommit`
	 * holds from a field's commit gesture until its chain of rounds ends — which covers a value
	 * QUEUED behind a round in flight, and the designer's height field, whose path queues before
	 * its door — and `evidenceRenamed` holds for its whole relocation. Any other path that awaits
	 * before reaching a door is not counted until it does.
	 */
	hold(): () => void {
		this.held += 1;
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.held -= 1;
			if (this.held > 0) return;
			const idle = this.idle;
			this.idle = null;
			idle?.();
		};
	}

	/**
	 * Run `callback` now if no save is running, else when the last one ends. One waiter: its
	 * only caller is `SessionStores.dispose()`, which a session runs once.
	 */
	whenIdle(callback: () => void): void {
		if (this.held === 0) callback();
		else this.idle = callback;
	}

	/** Is any incident open? The gate's whole question, asked without touching the vault. */
	anyOpen(): boolean {
		return this.open.length > 0;
	}

	/**
	 * What the diagnostics report reads — every open incident, and where the file holding them
	 * sits (ADR-0034 requires `GetDiagnosticsSnapshotQuery` to name both).
	 *
	 * **Read-only and SYNCHRONOUS for the same reason `anyOpen()` is**: the snapshot query's
	 * public contract is a plain `Promise<DiagnosticsSnapshot>` rather than a `Result` because
	 * every source answers from memory, and a file read here would be the one source that could
	 * fail — changing that contract for a fact this object already holds.
	 *
	 * Hands out a COPY of the array, like `DiagnosticsLedger.issues()` and for the same reason:
	 * `readonly` is erased at runtime, and the mirror the gate closes on is not a caller's to
	 * splice. The incidents themselves are frozen only by their `readonly` fields.
	 */
	report(): WriteIncidentReport {
		return { path: this.location, open: [...this.open] };
	}

	/**
	 * Record a refusal that left writes behind — in memory FIRST, then durably. Its one caller in
	 * `src/` is `markUncompensated`, which `void`s it; a test may record directly.
	 *
	 * **A failed durable write does not un-raise the incident.** The command's own write
	 * already failed and the vault is already inconsistent; losing the record of that because
	 * the record itself could not be written would manufacture exactly the all-clear ADR-0034
	 * refuses. So the incident stays open for this session either way and the failure is
	 * logged. The gate closes on the in-memory list, which is already appended to by the time
	 * the store is asked.
	 *
	 * **But the incident is then SESSION-scoped only, and that is the limit of this
	 * mechanism's durability.** Nothing beyond the `incident.write-failed` log line survives:
	 * the next load asks a store whose file was never created, `readRecords` answers `ok([])`
	 * for a file that does not exist, and the gate opens — the manufactured all-clear ADR-0034
	 * exists to refuse, reached from the one direction it cannot cover. Durability rests on the
	 * plugin folder being writable; where it is not, this class is exactly the per-session flag
	 * it replaced. Stated rather than fixed: there is no second place to put the record that is
	 * not also a file in a folder that may refuse a write.
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
 * The registry the guard consults and `markUncompensated` records into, installed once by the
 * composition root.
 *
 * **A module-level holder rather than a parameter, and the reason is the call sites.** The
 * refusal has to reach every guarded command, and there are 46 `guardCommand` call sites in
 * 14 files (`grep -rnE "guardCommand[<(]" src/plugin/ | wc -l`, and the same pattern under
 * `-rlE` for the files; re-measured 2026-09-17, 44 in 13 before BP-02 slice 4 added the
 * Inspector's two zone edits). A fifth parameter would
 * have to be threaded through all of them, and an OPTIONAL one would relocate the forgetting
 * rather than close it — a site that omitted it would be silently ungated, which is the exact
 * shape ADR-0034 rejects intersection gating for. What that grep cannot see: a call reached
 * through an alias, a re-export or a variable, since it matches the literal text
 * `guardCommand(` or `guardCommand<`.
 *
 * `null` until something installs one, which is correct for a caller composing services
 * without a session: there is no vault whose incidents it could be answering about. The
 * plugin installs one at load and takes it back off at `onunload`, or when the last save
 * still running then ends (`hold()`) — a global this code installs is a global this code
 * removes.
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
