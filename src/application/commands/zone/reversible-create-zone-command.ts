import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	AppError,
	GeometryError,
	PersistenceError,
	ReferenceError,
	ValidationError,
} from '../../../core/errors/AppError';
import type { Command } from '../Command';
import type { CreateZoneInput } from './CreateZone';
import type { DeleteZoneInput } from './DeleteZone';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { Loaded } from '../../ports/versioning';
import type { Zone } from '../../../domain/zone/Zone';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { WriteLedger } from '../../editor/WriteLedger';

export type CreateCommand = Command<
	CreateZoneInput,
	Result<{ zone: Loaded<Zone> }, ValidationError | ReferenceError | GeometryError | PersistenceError>
>;
export type UndoDeleteCommand = Command<
	DeleteZoneInput,
	Result<{ zoneId: ZoneId }, ReferenceError | ValidationError | PersistenceError>
>;

function nothingToUndo(): AppError {
	return {
		category: 'Reference',
		code: 'zone.nothing-to-undo',
		message: 'This zone creation has no recorded state to undo.',
	};
}

/**
 * The undoable creation gesture (design slice 8, PRD §68) wrapping slice 3's plain
 * `CreateZoneCommand`. Structurally an `UndoableCommand` — an `execute()` and an `undo()`
 * with matching shapes — but it does not name that interface: it lives in
 * `application/`, which may not import `presentation/` (the layer ban). It is still bound:
 * `commandDispatcher.run(command: UndoableCommand)` accepts it structurally at every
 * dispatch site, exactly as `ReversibleCalibratePlanCommand` is.
 *
 * Three halves, each conditional on what its own previous write left (slice 6's rule):
 *
 * - **First `execute()`** dispatches the plain command and captures the created
 *   `Loaded<Zone>` — the snapshot both later halves need.
 * - **Every later `execute()` (redo)** re-saves that snapshot VERBATIM through
 *   `ZoneRepository.save(zone, 'absent')`, so the ID survives undo/redo. Re-dispatching
 *   the plain command would mint a second identity: draw → move → undo → undo → redo →
 *   redo would replay the move against an ID the re-created zone no longer have.
 *   `'absent'` because undo deleted the note — a note holding that ID now belongs to
 *   somebody else, and restoring over it is not an undo.
 * - **`undo()`** dispatches `DeleteZoneCommand` for the created ID, presenting the version
 *   THE HISTORY last wrote (`WriteLedger`), never this adapter's own captured one: after
 *   create → move → undo-the-move, the vault's revision sits two writes past the create's,
 *   and a per-adapter expectation would refuse the exact sequence design slice 8's testing
 *   strategy requires to succeed ("create, move, undo, undo, redo, redo"). A zone edited
 *   OUTSIDE the editor since still refuses — its revision left the ledger's behind.
 *
 * Every successful write records into the same shared ledger, including the restore: the
 * move adapter's next dispatch reads its expectation from there, and a restore that went
 * unrecorded would hand it a stale version.
 */
export class ReversibleCreateZoneCommand {
	private snapshot: Loaded<Zone> | null = null;

	constructor(
		private readonly createCommand: CreateCommand,
		private readonly deleteCommand: UndoDeleteCommand,
		private readonly zones: ZoneRepository,
		private readonly ledger: WriteLedger,
		private readonly input: CreateZoneInput,
	) {}

	async execute(): Promise<Result<void, AppError>> {
		const snapshot = this.snapshot;
		if (snapshot === null) {
			const result = await this.createCommand.execute(this.input);
			if (isErr(result)) return result;
			this.snapshot = result.value.zone;
			this.ledger.record(result.value.zone.entity.id, result.value.zone.version);
			return ok(undefined);
		}
		const written = await this.zones.save(snapshot.entity, 'absent');
		if (isErr(written)) return written;
		this.snapshot = written.value;
		this.ledger.record(written.value.entity.id, written.value.version);
		return ok(undefined);
	}

	async undo(): Promise<Result<void, AppError>> {
		const snapshot = this.snapshot;
		if (snapshot === null) return err(nothingToUndo());
		const expected = this.ledger.lastWritten(snapshot.entity.id) ?? snapshot.version;
		const input: DeleteZoneInput = { zoneId: snapshot.entity.id, expected };
		const result = await this.deleteCommand.execute(input);
		if (isErr(result)) return result;
		return ok(undefined);
	}

	/** Set once `execute()` has succeeded; how the drawing tool selects what it drew. */
	get createdZoneId(): ZoneId | null {
		return this.snapshot?.entity.id ?? null;
	}
}
