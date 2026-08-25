import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ReferenceError, ValidationError } from '../../../core/errors/AppError';
import type { Command } from '../Command';
import type { DeleteZoneInput } from './DeleteZone';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { Loaded } from '../../ports/versioning';
import type { Zone } from '../../../domain/zone/Zone';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { referenceError } from '../../errors';
import type { WriteLedger } from '../../editor/WriteLedger';
import { restoreZone } from './restore-zone';

export type DeleteCommand = Command<
	DeleteZoneInput,
	Result<{ zoneId: ZoneId }, ReferenceError | ValidationError | PersistenceError>
>;

// The same factory and the same CATEGORY as the sibling create adapter's. These two used
// to hand-build the identical `zone.nothing-to-undo` code as a `Reference` failure in one
// file and a `Persistence` failure in the other, so anything routing on category — which
// is what SDD §64 makes it a discriminant for — saw one logical failure as two.
function nothingToUndo(): ReferenceError {
	return referenceError('zone.nothing-to-undo', 'This zone deletion has no recorded state to undo.');
}

/**
 * The first delete-type reversible gesture (design slice 8), wrapping slice 3's plain
 * `DeleteZoneCommand` for the delete itself. Structurally an `UndoableCommand` — see the
 * sibling `reversible-create-zone-command.ts` for why an application class cannot NAME
 * that interface.
 *
 * **`execute()`** reads the full pre-delete snapshot through `ZoneRepository.getById`
 * BEFORE dispatching — once the wrapped command succeeds, the note and its sidecar entry
 * are gone and cannot be recovered from them. It presents the version THE HISTORY last
 * wrote (`WriteLedger`) when there is one — a redo after an undo must match what the
 * restore wrote — and forwards the input unchanged otherwise, leaving the wrapped
 * command's own load-version delete in force.
 *
 * **`undo()`** is the one inverse here that bypasses the command layer entirely:
 * deletion has no "delete the opposite thing" replay, so the snapshot is restored
 * directly through `restoreZone` — `zones.save(zone, 'absent')` plus the ledger record,
 * shared with the create adapter's redo, which needs the identical half. That publishes nothing — a restore is
 * not a creation, and announcing it as one would drive every `ZoneCreated` subscriber
 * (slice 13's save tracking among them) with an event describing something that did not
 * happen; the editor refresh (this slice's post-command decorator) re-reads state instead
 * of listening for events. `'absent'` because undo DELETED the note at this ID: if a note
 * is there now, it is somebody else's, and overwriting it is not an undo.
 *
 * Restoring the same ID rather than minting a fresh one relies on `save()` being an
 * ID-keyed upsert — slice 3's port contract, asserted in the shared repository contract
 * suite both persistence implementations run.
 *
 * **Slice 10 widens this adapter, not its shape**: once `DeleteZoneInput.resolution`
 * exists and the wrapped command can cascade to referencing entities, the snapshot grows
 * into "the Zone plus everything the delete touched" and `undo()` becomes a compensated
 * multi-write sequence. In THIS slice no entity can reference a Zone, so the pair above
 * is already a true inverse and stays exactly as written here.
 */
export class ReversibleDeleteZoneCommand {
	private snapshot: Loaded<Zone> | null = null;

	constructor(
		private readonly deleteCommand: DeleteCommand,
		private readonly zones: ZoneRepository,
		private readonly ledger: WriteLedger,
		private readonly input: DeleteZoneInput,
	) {}

	// Both halves are driven only through the `UndoableCommand` shape at the dispatch
	// site (`inspector.commit` → `dispatcher.run`), which is invisible to the dead-code
	// tool that resolves members through declared annotations — the same mark
	// `ReversibleCalibratePlanCommand` carries for the identical reason.
	// fallow-ignore-next-line unused-class-member
	async execute(): Promise<Result<void, ReferenceError | ValidationError | PersistenceError>> {
		const found = await this.zones.getById(this.input.zoneId);
		if (isErr(found)) return found;
		if (found.value === null) {
			return err(referenceError('zone.zone-not-found', `Zone ${this.input.zoneId} not found.`));
		}
		const snapshot = found.value;
		const expected = this.ledger.lastWritten(this.input.zoneId);
		const input: DeleteZoneInput =
			expected === null ? this.input : { ...this.input, expected };
		const result = await this.deleteCommand.execute(input);
		if (isErr(result)) return result;
		this.snapshot = snapshot;
		// The note is gone: the ledger stops answering a revision for this id rather than
		// keeping the pre-delete one — see `WriteLedger` for why that distinction matters
		// to whatever touches the id next.
		this.ledger.forget(this.input.zoneId);
		return ok(undefined);
	}

	// fallow-ignore-next-line unused-class-member
	async undo(): Promise<Result<void, PersistenceError | ValidationError | ReferenceError>> {
		const snapshot = this.snapshot;
		if (snapshot === null) return err(nothingToUndo());
		const written = await restoreZone(this.zones, this.ledger, snapshot);
		if (isErr(written)) return written;
		// The restored version, so a second undo after a redo presents what the LAST write
		// left rather than the original load's. The sibling create adapter always did this
		// and this one did not, with nothing marking the difference as deliberate.
		this.snapshot = written.value;
		return ok(undefined);
	}
}
