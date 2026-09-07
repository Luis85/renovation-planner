import type { Structure } from '../../../domain/spatial/Structure';
import type { RenovationBaseline, RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { editWall } from '../../../domain/spatial/structureGeometry';

/** Invariants reject remaining Work/Decision referents; this never cascades away records. */
export function removeRenovationRecord(read: RenovationBaseline, id: string, proposalOnly: boolean): RenovationInput {
	const value = read.plan.entity.renovation ?? EMPTY_RENOVATION;
	const subject = value.subjects.find(item => item.id === id);
	let intended = read.geometry.document.intended;
	if (subject?.planned && intended) {
		const current = read.geometry.document.structure;
		const wall = current?.walls.find(item => item.id === subject.targetId);
		const opening = current?.openings.find(item => item.id === subject.targetId);
		intended = restoreElement(intended, current, subject.targetId);
		intended = { ...intended, openings: intended.openings.filter(item => item.id !== subject.targetId) };
		if (wall) intended = intended.walls.some(item => item.id === wall.id) ? editWall(intended, wall) : { ...intended, walls: [...intended.walls, wall] };
		else intended = { ...intended, walls: intended.walls.filter(item => item.id !== subject.targetId) };
		if (opening) intended = { ...intended, openings: [...intended.openings, opening] };
		const ids = new Set(intended.walls.map(item => item.id));
		const restored = current?.boundaries.filter(item => item.wallIds.includes(subject.targetId) && item.wallIds.every(wallId => ids.has(wallId))) ?? [];
		intended = { ...intended, boundaries: [...intended.boundaries.filter(item => !restored.some(other => other.roomId === item.roomId)), ...restored] };
	}
	return { intended, renovation: {
		...value,
		subjects: value.subjects.flatMap(item => item.id !== id ? [item] : proposalOnly && item.existing ? [{ ...item, planned: null }] : []),
		work: value.work.filter(item => item.id !== id), decisions: value.decisions.filter(item => item.id !== id),
	} };
}

function restoreElement(intended: Structure, current: Structure | undefined, id: string): Structure {
 const element = current?.elements?.find(item => item.id === id);
 return element || intended.elements ? { ...intended, elements: [...(intended.elements ?? []).filter(item => item.id !== id), ...(element ? [element] : [])] } : intended;
}
