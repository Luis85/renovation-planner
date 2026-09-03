import type { DispatchResult } from '../DispatchOutcome';
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	GeometryError,
	ReferenceError,
} from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { Command } from '../Command';
import type { CreateZoneInput } from './CreateZone';
import type { DeleteZoneInput } from './DeleteZone';
import type { EventBus } from '../../../core/events/EventBus';
import type { Logger } from '../../ports/Logger';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { Loaded } from '../../ports/versioning';
import type { Zone } from '../../../domain/zone/Zone';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { zoneCreated } from '../../../domain/zone/Zone.events';
import { requirementInvalidated } from '../../../domain/requirement/Requirement.events';
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
import { persistenceError, referenceError } from '../../errors';
import { projectIndexRebuilt } from '../../events/projectIndex.events';
import { restoreZone } from './restore-zone';

export type CreateCommand = Command<
	CreateZoneInput,
	Result<{ zone: Loaded<Zone> }, ReferenceError | GeometryError | RepositoryError>
>;
export type UndoDeleteCommand = Command<
	DeleteZoneInput,
	Result<{ zoneId: ZoneId }, ReferenceError | RepositoryError>
>;

/**
 * What the redo half needs that the create half does not, plus the one repository port the
 * create half already took positionally. A bundle rather than the four separate
 * parameters that would otherwise put this constructor at six — `max-params` caps at five,
 * `DeleteZoneUndoDeps` is the sibling's shape for the identical reason, and `zones` moves in
 * here rather than `deps` growing a fourth field beside it that only `execute`/`undo` read:
 * every member below is read from `deps` now, so there is exactly one bundle of
 * collaborators rather than a port living outside it for no reason but history.
 */
export interface ReversibleCreateZoneDeps {
	readonly zones: ZoneRepository;
	readonly events: EventBus;
	/**
	 * The reverse lookup, and a NEW dependency rather than bookkeeping this adapter already
	 * has: it retains `snapshot: Loaded<Zone>` and nothing else, and its `undo` dispatches
	 * `DeleteZoneCommand`, which resolves the referents internally and hands back none.
	 */
	readonly requirements: RequirementRepository;
	/** Records a refused or faulted reverse lookup — see `announceRestore`. */
	readonly logger: Logger;
}

// Through the factory, not a hand-built literal: the sibling delete adapter minted the
// same `zone.nothing-to-undo` code with a DIFFERENT category, and category is the
// discriminant SDD §64 makes it so a consumer can route on it — one logical failure
// arriving as two is exactly what that would break.
function nothingToUndo(): ReferenceError {
	return referenceError('zone.nothing-to-undo', 'This zone creation has no recorded state to undo.');
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
 * Every WRITE records into the same shared ledger, the restore included — the move
 * adapter's next dispatch reads its expectation from there, and a restore that went
 * unrecorded would hand it a stale version. The delete in `undo()` records nothing,
 * because a deleted note has no revision; it FORGETS the id instead, so no later half
 * presents a revision for a note that does not exist. `WriteLedger` states that rule
 * once for all four adapters.
 *
 * **The redo restore announces now, both halves.** The first `execute` publishes
 * `ZoneCreated` (through the plain command) and `undo` publishes `ZoneDeleted` (likewise);
 * the redo restore used to publish nothing, so create → undo → redo → undo emitted one
 * create and two deletes. `announceRestore` closes that — see its own docblock for why a
 * restore needs a SECOND event beside `ZoneCreated`, and for the one case it still
 * over-claims.
 */
export class ReversibleCreateZoneCommand {
	private snapshot: Loaded<Zone> | null = null;
	/**
	 * The ledger generation this gesture's last execute ran under, refreshed on every one
	 * (a redo restores and is a fresh premise) and compared again at `undo`.
	 *
	 * **This adapter can never DETECT a foreign write and it still needs the counter**, which
	 * is the clearest illustration of why the generation lives on the shared ledger rather
	 * than on each adapter. A first execute MINTS the id, so there is no prior entry for it to
	 * disagree with; a redo restores with `'absent'`, which refuses if anything is there. But
	 * its undo DELETES, conditioned on the ledger's tip — and a sibling gesture's own undo
	 * advances that tip past a peer's write, after which the delete matches and takes the
	 * peer's edit with it. What refuses is another adapter's observation, read here.
	 */
	private generation: number | null = null;

	constructor(
		private readonly createCommand: CreateCommand,
		private readonly deleteCommand: UndoDeleteCommand,
		private readonly ledger: WriteLedger,
		private readonly input: CreateZoneInput,
		private readonly deps: ReversibleCreateZoneDeps,
	) {}

	async execute(): Promise<DispatchResult> {
		const snapshot = this.snapshot;
		if (snapshot === null) {
			const result = await this.createCommand.execute(this.input);
			if (isErr(result)) return result;
			this.snapshot = result.value.zone;
			this.ledger.record(result.value.zone.entity.id, result.value.zone.version);
			this.generation = this.ledger.generation(result.value.zone.entity.id);
			return ok('wrote');
		}
		const written = await restoreZone(this.deps.zones, this.ledger, snapshot);
		if (isErr(written)) return written;
		// The next undo must delete what THIS redo wrote, not what the original create did.
		this.snapshot = written.value;
		// And it must rest on the premise THIS redo ran under: the restore succeeded against
		// an `'absent'` condition, so whatever a foreign write did before it is now moot.
		this.generation = this.ledger.generation(written.value.entity.id);
		await this.announceRestore(written.value);
		return ok('wrote');
	}

	async undo(): Promise<DispatchResult> {
		const snapshot = this.snapshot;
		if (snapshot === null) return err(nothingToUndo());
		if (this.generation !== null && this.ledger.generation(snapshot.entity.id) !== this.generation) {
			return err(undoSuperseded(snapshot.entity.id));
		}
		const expected = this.ledger.lastWritten(snapshot.entity.id) ?? snapshot.version;
		const input: DeleteZoneInput = { zoneId: snapshot.entity.id, expected };
		const result = await this.deleteCommand.execute(input);
		if (isErr(result)) return result;
		// The note is gone, so the ledger must stop answering a revision for it — see
		// `WriteLedger`'s own account of why a delete forgets rather than records.
		this.ledger.forget(snapshot.entity.id);
		return ok('wrote');
	}

	/** Set once `execute()` has succeeded; how the drawing tool selects what it drew. */
	get createdZoneId(): ZoneId | null {
		return this.snapshot?.entity.id ?? null;
	}

	/**
	 * A restore is a write, and until this existed it was a write nobody heard. Two events,
	 * because they answer two different questions and neither subsumes the other.
	 *
	 * `ZoneCreated` is what the plain command would have raised, and it is filtered by every
	 * consumer to the ZONE's project. That is right for the zone and insufficient for its
	 * dependents: nothing subscribes to `ZoneCreated` at all today (the cascade handlers are
	 * `onZoneGeometryChanged`, `onAssetPriceOverrideChanged` and `onAssetUpdated`), so a
	 * dependent in ANOTHER project — a hand-edited requirement whose `origin.zoneId` sits
	 * here — keeps a `missingTarget` badge a fresh read would already have cleared.
	 *
	 * So the surviving dependents get `RequirementInvalidated`, which carries the
	 * requirement's own id and claims a recalculation is OWED. That is truthful rather than a
	 * name picked off the list: the dependents that SURVIVE a delete resolution are exactly
	 * the ones `delete-anyway` marked stale through `markStalePersisted`, and restoring the
	 * zone does not un-mark them, so one is genuinely owed and can now actually succeed.
	 *
	 * **Where it over-claims, stated rather than left to be found:** a hand-edited requirement
	 * pointing at a zone id that never existed, whose id a later redo happens to create. That
	 * row was never marked stale, so "a recalculation is owed" is stronger than its state
	 * supports. It takes a hand edit and a coincidence of ids, and the alternative is minting
	 * a neutral "this row may read differently" event, which is one gap with two callers and
	 * belongs to whatever forces it rather than to a fix for a naming mistake.
	 */
	private async announceRestore(restored: Loaded<Zone>): Promise<void> {
		const zone = restored.entity;
		await this.deps.events.publish(
			zoneCreated({ zoneId: zone.id, planId: zone.planId, projectId: zone.projectId }),
		);

		// `listByZone` can REJECT as well as refuse. The repository ports are raw at this
		// boundary — `CLAUDE.md` records that carve-out, and it is the reason a vault fault
		// arrives here as a throw rather than as a coded `Result`. Letting it escape is worse
		// than the silence this method exists to fix: `execute()` would reject with the zone
		// already restored, `CommandHistory` would leave the command on the REDO stack, and the
		// retry would hit `restoreZone`'s `'absent'` condition against a zone that is now
		// present — an existing zone that history can neither undo nor redo.
		const referents = await this.deps.requirements.listByZone(zone.id).catch((cause: unknown) =>
			err(
				persistenceError(
					'zone.restore.referents-faulted',
					'Reading the requirements referencing the restored zone failed unexpectedly.',
					cause,
				),
			),
		);
		if (isErr(referents)) {
			// The zone write has ALREADY succeeded, so this cannot fail the operation — and
			// staying silent leaves a cross-project dependent stale, which is the state the
			// per-referent publish exists to prevent. `listByZone` walks every requirement id
			// in the vault and refuses on the first unreadable one, so this needs a malformed
			// note that has nothing to do with this zone.
			//
			// `ProjectIndexRebuilt` is the payload-less "cannot say which entities changed,
			// refresh anyway" arm, and it is the truthful signal here for exactly that reason:
			// the adapter genuinely cannot say which requirements were affected. Every
			// project's summary re-reads once, on a path needing a malformed note AND a zone
			// restore in the same session.
			this.deps.logger.error('zone.restore.referents-unreadable', {
				zoneId: zone.id,
				cause: referents.error,
			});
			await this.deps.events.publish(projectIndexRebuilt());
			return;
		}

		for (const referent of referents.value) {
			await this.deps.events.publish(requirementInvalidated(referent.entity.id));
		}
	}
}
