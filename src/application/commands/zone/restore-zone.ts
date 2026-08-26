import { isErr, ok, type Result } from '../../../core/result/Result';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { Loaded } from '../../ports/versioning';
import type { Zone } from '../../../domain/zone/Zone';
import type { WriteLedger } from '../../editor/WriteLedger';

/**
 * Put a `Zone` snapshot back at its own id — the inverse half both reversible zone
 * adapters need, written once because they had a copy each and the copies had already
 * drifted on whether they refreshed their own snapshot afterwards.
 *
 * Two things about it are load-bearing and are the reason it is worth a function rather
 * than four inline lines:
 *
 * - **`'absent'`, always.** The undo this reverses DELETED the note at this id. If a note
 *   is there now it is somebody else's, and overwriting it is not an undo — so the write
 *   is conditional on nothing being there. A future widening of that precondition (slice
 *   10's cascade turns the snapshot into "the Zone plus everything the delete touched")
 *   has one place to change instead of two, and missing one of two would silently
 *   overwrite a stranger's note.
 * - **It records into the shared ledger.** A restore that went unrecorded hands the next
 *   sibling adapter a stale version, and every later undo of a move on that zone is
 *   refused with a revision conflict that no unit test of either adapter can produce
 *   alone.
 *
 * It resolves the freshly written `Loaded<Zone>` so a caller that keeps a snapshot of its
 * own can advance it; the one that does not simply ignores the value.
 */
export async function restoreZone(
	zones: ZoneRepository,
	ledger: WriteLedger,
	snapshot: Loaded<Zone>,
): Promise<Result<Loaded<Zone>, RepositoryError>> {
	const written = await zones.save(snapshot.entity, 'absent');
	if (isErr(written)) return written;
	ledger.record(written.value.entity.id, written.value.version);
	return ok(written.value);
}
