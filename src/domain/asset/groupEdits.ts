import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';
import { assetGroups, validateAssetShape, type AssetGroup, type AssetShape } from './AssetShape';
import { highestSuffix, resolveParticipants } from './detailEdits';

/**
 * Shallow grouping of graphics, and the one ORDER action a group has (contract C06, AD04 §4): make
 * a group, take one apart, and move its members to the front or the back of the drawing order as a
 * block.
 *
 * **Grouping changes no geometry and no order.** `groupDetails` writes one entry to `shape.groups`
 * and touches `shape.details` not at all, so world coordinates, the canonical array and everything
 * derived from it — the quantities, the placement, the library mark — are byte-identical before and
 * after. Interleaved members stay interleaved, which C06 states and `partRows.ts` already draws.
 * Ungrouping is the same statement in reverse, which is what makes group-then-ungroup an identity.
 *
 * **Membership is not a second z-order authority.** `details` remains the one draw order; the only
 * thing a group does to it is `moveGroupToEnd`, and that is an explicit user action rather than
 * something grouping does on its own.
 *
 * **What is deliberately NOT here: step-forward and step-backward for a group.** C06 keeps that
 * unavailable until its semantics are specified, and a noncontiguous group is exactly why — moving
 * `[a, _, b]` "one step forward" could mean one step for each member, one step for the block, or
 * closing the gap first, and the three disagree about where the graphic between them lands. A
 * single graphic keeps its own `reorderDetail`; a group gets the two ends, where the answer is the
 * same under all three readings.
 *
 * Every function ends in `validateAssetShape`, so the six group refusals the aggregate owns are
 * answered there rather than re-asked here in a second, drifting copy — **but two of the six are
 * PRE-EMPTED before the aggregate ever sees them, and the honest sentence has to say so.**
 * `groupDetails` resolves through `resolveParticipants` first, which answers `asset.part-not-found`
 * where `validateGroups` would answer `dangling-group-member`, and `asset.duplicate-part` where it
 * would answer `overlapping-groups` for the same graphic named twice. So those two aggregate codes
 * are unreachable through this door, and the codes a user sees are the resolver's — which are the
 * better-worded ones, because they are about the SELECTION the user made rather than about stored
 * membership. `overlapping-groups` itself stays reachable, for a graphic already in a DIFFERENT
 * group.
 */

const NUMBERED_GROUP = /^group-(\d+)$/;

/**
 * `group-<n>` with n one above the highest numeric suffix of that form — `nextDetailId`'s rule,
 * through the same `highestSuffix`, so a group id is never recycled onto a group a later undo
 * brings back under a different membership.
 */
export function nextGroupId(shape: AssetShape): string {
	return `group-${String(highestGroupNumber(shape) + 1)}`;
}

/** What `nextGroupId` counts from, exported so a repeat can allocate a run of group ids in one pass. */
export function highestGroupNumber(shape: AssetShape): number {
	return highestSuffix(
		assetGroups(shape).map((group) => group.id),
		NUMBERED_GROUP,
	);
}

/** The group a graphic belongs to, or `null` — the question every group control on a selection asks. */
export function groupOfDetail(shape: AssetShape, id: string): AssetGroup | null {
	return assetGroups(shape).find((group) => group.members.includes(id)) ?? null;
}

/**
 * One new group over the graphics `ids` names.
 *
 * Members are stored in CANONICAL order (`resolveParticipants`), not in the order they were
 * selected: the list is a set, and storing the click order would make two identical groups compare
 * unequal and a round-trip through the sidecar look like an edit.
 *
 * A graphic already in another group is refused — by `validateAssetShape`'s `overlapping-groups`,
 * which is the aggregate's own rule rather than a second copy of it here.
 */
export function groupDetails(shape: AssetShape, ids: readonly string[]): Result<AssetShape, ValidationError> {
	const chosen = resolveParticipants(shape, ids, { minimum: 2 });
	if (isErr(chosen)) return chosen;
	const group: AssetGroup = { id: nextGroupId(shape), members: chosen.value.map((detail) => detail.id) };
	return validateAssetShape({ ...shape, groups: [...assetGroups(shape), group] });
}

/** The group removed; its members stay exactly where they are, in the order and the place they were. */
export function ungroupDetails(shape: AssetShape, groupId: string): Result<AssetShape, ValidationError> {
	const groups = assetGroups(shape);
	if (!groups.some((group) => group.id === groupId)) return err(groupNotFound(groupId));
	return validateAssetShape({ ...shape, groups: groups.filter((group) => group.id !== groupId) });
}

/**
 * Every member of one group moved to one END of the drawing order as a STABLE BLOCK: the members
 * keep their order relative to each other, and so does everything else.
 *
 * `front` is the end of `details`, which is the graphic drawn last and therefore on top —
 * `reorderDetail`'s own `forward` direction, so the two controls cannot disagree about which way is
 * up.
 */
export function moveGroupToEnd(shape: AssetShape, groupId: string, to: 'front' | 'back'): Result<AssetShape, ValidationError> {
	const group = assetGroups(shape).find((found) => found.id === groupId);
	if (group === undefined) return err(groupNotFound(groupId));
	const members = new Set(group.members);
	const moved = shape.details.filter((detail) => members.has(detail.id));
	const rest = shape.details.filter((detail) => !members.has(detail.id));
	const details = to === 'front' ? [...rest, ...moved] : [...moved, ...rest];
	// **Already at that end is a no-op, and answers the very shape it was handed** (contract C05).
	// Bring group to front on a group that is already at the front is one press away at all times,
	// and an equal-but-fresh shape would cost a sidecar revision and an undo entry that appears to do
	// nothing. Identity is what `DesignerArrangePanel.commit` compares to answer `editShape`'s `null`.
	if (details.every((detail, index) => detail === shape.details[index])) return ok(shape);
	return validateAssetShape({ ...shape, details });
}

function groupNotFound(groupId: string): ValidationError {
	return assetError('group-not-found', `This design has no group "${groupId}".`);
}
