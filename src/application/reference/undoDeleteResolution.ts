import { err, isErr, ok, type Result } from '../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../core/errors/AppError';
import type { Requirement } from '../../domain/requirement/Requirement';
import type { Expected, Loaded } from '../ports/versioning';
import type { Logger } from '../ports/Logger';
import type { RequirementRepository } from '../ports/RequirementRepository';
import type { ReferenceLocks } from './ReferenceLocks';
import type { ResolvedSequence, SequenceProgress } from './deleteResolution';

/**
 * `runDeleteResolution` run backwards — the other sequence of the shape "Compensated
 * multi-entity sequences" states the contract for, and the one slice 8 shipped with
 * endpoint locks and nothing else because at the time no entity could reference a Zone.
 *
 * Three things it takes from that contract, each of which the forward engine also takes:
 *
 * - **Both lock levels, held through the compensation.** Level 1 for the restored entity,
 *   level 2 for every Requirement this undo will write, in ONE acquisition each. Released
 *   in a `finally` that runs after the rollback, not at the last write — a rollback racing
 *   whoever acquired the locks next would undo that writer's work instead of its own.
 * - **The exact reverse order.** The resolution wrote the Requirements and then deleted
 *   the entity, so the undo restores the entity and then the Requirements, walking
 *   `affectedAfter` from the end.
 * - **Every write hands back its own inverse**, taken from what was actually there before
 *   it (`getById` before the save, `'absent'` versus a version from `affectedAfter`), so a
 *   failure part-way leaves the Vault exactly as the delete left it rather than
 *   half-restored. Undo is where a partial failure is easiest to miss: the command returns
 *   an error and stays on `undoStack` as if nothing had happened.
 *
 * What it deliberately does NOT do is write a durable `delete-undo` marker. The forward
 * engine's marker exists so a COLD process can finish what a crash interrupted, and its
 * recovery restores from `affectedBefore` — the pre-resolution state. A half-completed
 * undo has to be rolled back toward the POST-resolution state instead, which no field of
 * `SequenceMarker` carries, so a marker written here would be recovered wrongly rather
 * than not at all. The `'delete-undo'` member of `SequenceMarker['kind']` is the design's
 * name for that future shape and has no writer yet; a crash during an undo leaves the
 * partially restored Vault this function's rollback would otherwise have repaired.
 */

export type UndoSequenceErrors = PersistenceError | ValidationError;

/** A write's own inverse, handed back BY that write so the caller never re-derives it. */
export type Compensation = () => Promise<Result<void, UndoSequenceErrors>>;

export interface UndoSequenceOps {
	/** The restored entity's id — its level-1 lock, and what a failed compensation logs. */
	readonly entityId: string;
	readonly logger: Logger;
	readonly requirements: RequirementRepository;
	/**
	 * The one per-kind half: put the deleted entity back (at `'absent'` — the note this is
	 * restoring was deleted, so anything there now is somebody else's) and hand back the
	 * write that takes it away again.
	 */
	restoreEntity(): Promise<Result<Compensation, UndoSequenceErrors>>;
}

async function restoreOne(
	requirements: RequirementRepository,
	snapshot: Loaded<Requirement>,
	entry: SequenceProgress,
): Promise<Result<Compensation, UndoSequenceErrors>> {
	// Read BEFORE overwriting, so the compensation replays what was actually there rather
	// than what the resolution is assumed to have left.
	const current = await requirements.getById(snapshot.entity.id);
	if (isErr(current)) return current;
	// The expectation is what THIS resolution's own write produced. The pre-resolution
	// version the snapshot carries was superseded by that write, so presenting it would
	// conflict against the command's own effect with no race involved.
	const expected: Expected = entry.outcome === 'written' ? entry.version : 'absent';
	const written = await requirements.save(snapshot.entity, expected);
	if (isErr(written)) return written;

	const live = current.value;
	const restoredVersion = written.value.version;
	if (live === null) {
		return ok(() => requirements.delete(snapshot.entity.id, restoredVersion));
	}
	return ok(async () => {
		const back = await requirements.save(live.entity, restoredVersion);
		return isErr(back) ? back : ok(undefined);
	});
}

async function rollBack(
	ops: UndoSequenceOps,
	done: readonly Compensation[],
	cause: UndoSequenceErrors,
): Promise<Result<never, UndoSequenceErrors>> {
	for (const compensation of [...done].toReversed()) {
		const undone = await compensation();
		if (isErr(undone)) {
			// The original failure is what the caller is told about; a compensation that
			// also failed is a second fault and belongs in the log, not in the return.
			ops.logger.error('sequence.undo-compensation.failed', {
				entityId: ops.entityId,
				cause: undone.error,
			});
		}
	}
	return err(cause);
}

export async function undoDeleteResolution(
	ops: UndoSequenceOps,
	sequence: Pick<ResolvedSequence, 'affectedBefore' | 'affectedAfter'>,
	locks: ReferenceLocks,
): Promise<Result<void, UndoSequenceErrors>> {
	const release = await locks.acquire(
		[ops.entityId],
		sequence.affectedAfter.map((entry) => entry.id),
	);
	const done: Compensation[] = [];
	try {
		const entity = await ops.restoreEntity();
		if (isErr(entity)) return entity;
		done.push(entity.value);

		for (const entry of [...sequence.affectedAfter].toReversed()) {
			// `affectedAfter` names only what the resolution TOUCHED; a Requirement it never
			// wrote has nothing here and is left alone.
			const snapshot = sequence.affectedBefore.find((r) => r.entity.id === entry.id);
			if (snapshot === undefined) continue;
			const restored = await restoreOne(ops.requirements, snapshot, entry);
			if (isErr(restored)) return await rollBack(ops, done, restored.error);
			done.push(restored.value);
		}
		return ok(undefined);
	} finally {
		release();
	}
}
