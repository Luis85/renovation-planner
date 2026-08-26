import type { RepositoryError } from './repositoryErrors';
import type { Result } from '../../core/result/Result';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { Requirement } from '../../domain/requirement/Requirement';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { Expected, EntityVersion, Loaded } from './versioning';

/**
 * Every read is a file read plus a Zod parse, so it can fail just as a write can — "not
 * found" is `ok(null)`, `isErr` means the read did not happen.
 *
 * `save` is a compare-and-swap on the shared conditional-write terms: the stored revision
 * against `expected.revision`, and the bytes against `expected.observed` — the token THIS
 * caller's read handed back — so a note hand-edited between the read and the write is
 * caught even though a hand edit bumps no revision. Refuses with
 * `requirement.revision-conflict` / `requirement.external-modification`, serialized per
 * RequirementId so the compare and the write are one operation. `'absent'` means insert,
 * and fail if anything already holds this ID — what makes restoring a deleted Requirement
 * atomic, since reading for absence then inserting is the check-then-act this contract
 * exists to remove.
 *
 * `delete` is conditional for the same reason save() is, and NOT covered by save()'s CAS:
 * an assignment undo deletes the requirement its execute() created, and another tab may
 * have set an override or landed a recalculation on it since.
 */
export interface RequirementRepository {
	getById(id: RequirementId): Promise<Result<Loaded<Requirement> | null, RepositoryError>>;
	save(
		requirement: Requirement,
		expected: Expected,
	): Promise<Result<Loaded<Requirement>, RepositoryError>>;
	delete(id: RequirementId, expected: EntityVersion): Promise<Result<void, RepositoryError>>;
	listByZone(zoneId: ZoneId): Promise<Result<Loaded<Requirement>[], RepositoryError>>;
	listByAsset(assetId: AssetId): Promise<Result<Loaded<Requirement>[], RepositoryError>>;
	/**
	 * Sets `recalculationStatus: "stale"` and persists it — one targeted-property write,
	 * not a full save() of a (possibly not-yet-recalculated) Requirement. Needs no
	 * expected version: it sets one field in one direction, and nothing may move it back
	 * except a successful recalculation.
	 */
	markStale(id: RequirementId): Promise<Result<void, RepositoryError>>;
}
