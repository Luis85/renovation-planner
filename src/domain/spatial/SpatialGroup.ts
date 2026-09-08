import type { Structure } from './Structure';
import type { ValidationError } from '../../core/errors/AppError';
import { err, ok, type Result } from '../../core/result/Result';

/** Explicit, flat groups belong to one floor. Hosted openings follow their wall. */
export interface SpatialGroup {
	readonly id: string;
	readonly name: string;
	readonly memberIds: readonly string[];
}
export interface GroupCatalogue { readonly zoneIds: readonly string[]; readonly structure: Structure }
function failure(): Result<never, ValidationError> {
	return err({ category: 'Validation', code: 'spatial-group.invalid', message: 'Groups need a name and unique, existing members on this floor.' });
}
export function validateSpatialGroups(groups: readonly SpatialGroup[], catalogue: GroupCatalogue): Result<void, ValidationError> {
	const available = new Set([...catalogue.zoneIds, ...catalogue.structure.walls.map(item => item.id), ...catalogue.structure.elements?.map(item => item.id) ?? []]);
	const ids = new Set<string>(), owned = new Set<string>();
	for (const group of groups) {
		if (!group.id.startsWith('group-') || ids.has(group.id) || available.has(group.id) || !group.name.trim() || group.name.length > 100 || !group.memberIds.length) return failure();
		ids.add(group.id);
		for (const id of group.memberIds) {
			if (!available.has(id) || owned.has(id)) return failure();
			owned.add(id);
		}
	}
	return ok(undefined);
}
/** Grouping an opening groups its host; every present and future hosted opening follows. */
export function groupRoots(ids: readonly string[], structure: Structure): string[] {
	return [...new Set(ids.map(id => structure.openings.find(opening => opening.id === id)?.hostId ?? id))];
}
export function groupMembers(group: SpatialGroup, structure: Structure): string[] {
	return [...group.memberIds, ...structure.openings.filter(opening => group.memberIds.includes(opening.hostId)).map(opening => opening.id)];
}
export function selectedGroup(groups: readonly SpatialGroup[], ids: readonly string[], structure: Structure): SpatialGroup | null {
	const roots = new Set(groupRoots(ids, structure));
	return groups.find(group => group.memberIds.length === roots.size && group.memberIds.every(id => roots.has(id))) ?? null;
}
/** Explicit grouping flattens overlapping groups, keeping unrelated groups and source order. */
export function regroup(groups: readonly SpatialGroup[], group: SpatialGroup, structure: Structure): SpatialGroup[] {
	const members = new Set(groupRoots(group.memberIds, structure));
	for (const previous of groups) if (previous.memberIds.some(id => members.has(id))) for (const id of previous.memberIds) members.add(id);
	return [...groups.filter(previous => !previous.memberIds.some(id => members.has(id))), { ...group, memberIds: [...members] }];
}
