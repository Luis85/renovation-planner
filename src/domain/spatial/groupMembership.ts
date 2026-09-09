import { err, ok, type Result } from '../../core/result/Result';
import type { ValidationError } from '../../core/errors/AppError';
import type { SpatialGroup } from './SpatialGroup';
import type { Structure } from './Structure';

function membershipContent(groups: readonly SpatialGroup[] | undefined) { return (groups ?? []).map(group => [group.id, group.name, group.memberIds]); }
/** History preserves the stored member order as well as each group's identity and name. */
export function sameGroupMembership(a: readonly SpatialGroup[] | undefined, b: readonly SpatialGroup[] | undefined): boolean {
	return JSON.stringify(membershipContent(a)) === JSON.stringify(membershipContent(b));
}

/** Remove only deleted identities, preserving surviving names, order and unrelated groups. */
export function removeGroupMembers(groups: readonly SpatialGroup[], removed: ReadonlySet<string>): SpatialGroup[] {
	return groups.map(group => ({ ...group, memberIds: group.memberIds.filter(id => !removed.has(id)) })).filter(group => group.memberIds.length > 0);
}

/** Structural edits can delete walls/elements; Zone identities remain independently owned. */
export function groupsAfterStructureChange(groups: readonly SpatialGroup[] | undefined, before: Structure | undefined, next: Structure | undefined): readonly SpatialGroup[] | undefined {
	if (!groups) return groups;
	const surviving = new Set([...next?.walls ?? [], ...next?.elements ?? []].map(item => item.id));
	const removed = new Set([...before?.walls ?? [], ...before?.elements ?? []].map(item => item.id).filter(id => !surviving.has(id)));
	return removeGroupMembers(groups, removed);
}

function conflict(): Result<never, ValidationError> {
	return err({ category: 'Validation', code: 'spatial-group.restore-conflict', message: 'Group membership changed after deletion; it cannot be restored safely.' });
}

/** Restore one deleted Zone's membership only while its expected remnant is unchanged. */
export function restoreGroupMember(before: readonly SpatialGroup[], current: readonly SpatialGroup[], id: string): Result<readonly SpatialGroup[], ValidationError> {
	const original = before.find(group => group.memberIds.includes(id));
	if (!original) return ok(current);
	const remaining = original.memberIds.filter(member => member !== id), present = current.find(group => group.id === original.id);
	if (current.some(group => group.memberIds.includes(id))) return conflict();
	if (present) {
		if (!remaining.length || present.name !== original.name || JSON.stringify(present.memberIds) !== JSON.stringify(remaining)) return conflict();
		return ok(current.map(group => group.id === original.id ? original : group));
	}
	if (remaining.length) return conflict();
	// A removed singleton returns before its first surviving successor; unrelated peer groups stay intact.
	const successors = before.slice(before.indexOf(original) + 1).map(group => group.id);
	const at = current.findIndex(group => successors.includes(group.id)), result = [...current];
	result.splice(at < 0 ? result.length : at, 0, original);
	return ok(result);
}
