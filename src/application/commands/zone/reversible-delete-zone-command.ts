import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { DispatchOutcome } from '../DispatchOutcome';
import type { ReferenceError } from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { Command } from '../Command';
import type { DeleteZoneInput } from './DeleteZone';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { Loaded } from '../../ports/versioning';
import type { Zone } from '../../../domain/zone/Zone';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { referenceError } from '../../errors';
import type { WriteLedger } from '../../editor/WriteLedger';
import type { Logger } from '../../ports/Logger';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import type { ResolvedSequence } from '../../reference/deleteResolution';
import { undoDeleteResolution, type Compensation } from '../../reference/undoDeleteResolution';
import { restoreZone } from './restore-zone';

export type DeleteCommand = Command<
	DeleteZoneInput,
	Result<ResolvedSequence & { zoneId: ZoneId }, ReferenceError | RepositoryError>
>;

/**
 * What the undo half needs and the delete half does not: the Requirements the resolution
 * touched are restored through the port, under the same two lock levels the forward
 * sequence took, and a compensation that also fails is logged rather than returned.
 */
export interface DeleteZoneUndoDeps {
	readonly requirements: RequirementRepository;
	readonly locks: ReferenceLocks;
	readonly logger: Logger;
}

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
 * not a creation, and announcing it as one would drive every `ZoneCreated` subscriber with
 * an event describing something that did not happen. This sentence named slice 13's save
 * tracking as one of those subscribers; slice 13 landed with a decorator over the command
 * DISPATCHER that subscribes to nothing, so the example is WITHDRAWN rather than left
 * standing — the argument for restoring silently does not rest on it. The editor refresh
 * (this slice's post-command decorator) re-reads state instead of listening for events. `'absent'` because undo DELETED the note at this ID: if a note
 * is there now, it is somebody else's, and overwriting it is not an undo.
 *
 * **This is the one reversible adapter that takes NEITHER half of the `WriteLedger`
 * generation guard, and the absence is a measurement rather than an oversight** — its four
 * siblings all take one, so a later reader tidying for uniformity would add it here. The
 * guard exists for a foreign write SANDWICHED between two of this history's gestures
 * (`WriteLedger` walks the five steps), and this adapter can be neither end of that
 * sandwich:
 *
 * - not the SECOND gesture, the one whose successful write advances the ledger's tip past a
 *   peer. Its forward delete presents `ledger.lastWritten`, so a foreign write since our last
 *   one refuses the delete itself — nothing is written and nothing is recorded;
 * - not the FIRST gesture, the one whose inverse goes stale. Its restore writes `'absent'`
 *   and its Requirement restores present the expectations the forward resolution's own result
 *   reported, so each of them refuses a foreign write on its own terms.
 *
 * `reversibleDeleteZone.test.ts`'s last block asserts both, because "it refused" is one word
 * for two mechanisms and an argument kept only in prose is what goes stale.
 *
 * Restoring the same ID rather than minting a fresh one relies on `save()` being an
 * ID-keyed upsert — slice 3's port contract, asserted in the shared repository contract
 * suite both persistence implementations run.
 *
 * **Slice 10 widened it, exactly as slice 8 predicted it would.** A `Requirement` can
 * reference a Zone now, so the wrapped command cascades: the snapshot is "the Zone plus
 * everything the delete touched" (`affectedBefore`, with `affectedAfter` carrying the
 * expectation each restore must present), and `undo()` is the compensated multi-write
 * sequence `undoDeleteResolution` owns. Restoring the Zone alone would not be an inverse
 * of anything: a Zone brought back with its Requirements still deleted, or still repointed
 * at another Asset, is not the state the user had before pressing Delete.
 */
export class ReversibleDeleteZoneCommand {
	private snapshot: Loaded<Zone> | null = null;
	/**
	 * What the resolution did, as the resolution itself reported it. Empty for an
	 * unreferenced Zone, which is what makes the single-write case of slice 8 a special
	 * case of this one rather than a second path.
	 */
	private sequence: Pick<ResolvedSequence, 'affectedBefore' | 'affectedAfter'> = {
		affectedBefore: [],
		affectedAfter: [],
	};

	constructor(
		private readonly deleteCommand: DeleteCommand,
		private readonly zones: ZoneRepository,
		private readonly ledger: WriteLedger,
		private readonly input: DeleteZoneInput,
		private readonly undoDeps: DeleteZoneUndoDeps,
	) {}

	// This used to carry the same note `execute` does — driven only through the
	// `UndoableCommand` shape at the dispatch site (`inspector.commit` → `dispatcher.run`),
	// which the dead-code tool cannot resolve — plus a `fallow-ignore-next-line` mark.
	// `reversibleDeleteZone.test.ts`'s foreign-write block now constructs this class into an
	// annotated local and calls `undo()` on it directly, so the tool resolves the member and
	// reported the SUPPRESSION as stale. Removed rather than worked around: an ignore for an
	// issue that no longer exists reads on as a live exception, and if the reach goes away
	// again the gate says so and the next author puts it back.
	async execute(): Promise<Result<DispatchOutcome, ReferenceError | RepositoryError>> {
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
		// Taken from the RESULT, never re-read: `affectedAfter` holds the versions this
		// command's own writes produced, which a read after the fact could only guess at.
		this.sequence = {
			affectedBefore: result.value.affectedBefore,
			affectedAfter: result.value.affectedAfter,
		};
		// The note is gone: the ledger stops answering a revision for this id rather than
		// keeping the pre-delete one — see `WriteLedger` for why that distinction matters
		// to whatever touches the id next.
		this.ledger.forget(this.input.zoneId);
		return ok('wrote');
	}

	async undo(): Promise<Result<DispatchOutcome, RepositoryError | ReferenceError>> {
		const snapshot = this.snapshot;
		if (snapshot === null) return err(nothingToUndo());
		// A box rather than a local, because the assignment happens inside the callback the
		// sequence drives and is read after it returns.
		const restored: { value: Loaded<Zone> | null } = { value: null };

		const undone = await undoDeleteResolution(
			{
				entityId: this.input.zoneId,
				logger: this.undoDeps.logger,
				requirements: this.undoDeps.requirements,
				restoreEntity: async () => {
					const written = await restoreZone(this.zones, this.ledger, snapshot);
					if (isErr(written)) return written;
					restored.value = written.value;
					return ok(this.removeAgain(written.value.version));
				},
			},
			this.sequence,
			this.undoDeps.locks,
		);
		if (isErr(undone)) return undone;

		// The restored version, so a second undo after a redo presents what the LAST write
		// left rather than the original load's. The sibling create adapter always did this
		// and this one did not, with nothing marking the difference as deliberate. Advanced
		// only on SUCCESS: a rolled-back undo deleted the note again, so the pre-delete
		// snapshot is still what a retry has to restore.
		if (restored.value !== null) this.snapshot = restored.value;
		return ok('wrote');
	}

	/** The inverse of the zone half of `undo()`, handed to the sequence by the write itself. */
	private removeAgain(version: Loaded<Zone>['version']): Compensation {
		return async () => {
			const removed = await this.zones.delete(this.input.zoneId, version);
			if (isErr(removed)) return removed;
			this.ledger.forget(this.input.zoneId);
			return ok(undefined);
		};
	}
}
