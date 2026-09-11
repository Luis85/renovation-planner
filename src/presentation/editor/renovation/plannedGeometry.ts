import { createEntityId } from '../../../core/identity/generateId';
import type { RenovationBaseline, RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import { err, ok } from '../../../core/result/Result';
import { EMPTY_STRUCTURE, type Structure } from '../../../domain/spatial/Structure';
import { editWall, spatialError } from '../../../domain/spatial/structureGeometry';
import { formatMetres, parseCoordinateMetres } from '../shell/formatLength';
import { EMPTY_RENOVATION, type RenovationSubject } from '../../../domain/renovation/Renovation';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import type { CoordinateEdits } from '../resize/outlineProposal';
import { plannedElementGeometry } from '../elements/plannedElementGeometry';

export interface PlannedGeometryDraft {
	kind: 'none' | 'wall' | 'opening' | 'element';
	element?: SpatialElement;
	elementEdits?: CoordinateEdits;
	id: string;
	hostId: string;
	openingKind: 'door' | 'window' | 'opening';
	text: Record<string, string>;
}
function geometryText(wall: Structure['walls'][number] | undefined, opening: Structure['openings'][number] | undefined): Record<string, string> {
	const actual = wall ?? { start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, height: opening?.height ?? 2400, thickness: 150 };
	const { start, end } = actual;
	return Object.fromEntries(Object.entries({ x: start.x, y: start.y, endX: end.x, endY: end.y,
		height: actual.height, thickness: actual.thickness,
		width: opening?.width ?? 900, offset: opening?.offset ?? 0, sill: opening?.sill ?? 0,
	}).map(([key, value]) => [key, formatMetres(value)]));
}
function geometryIdentity(wall: Structure['walls'][number] | undefined, opening: Structure['openings'][number] | undefined, element: SpatialElement | undefined): Pick<PlannedGeometryDraft, 'kind' | 'id' | 'element' | 'elementEdits'> {
 return { kind: wall ? 'wall' : opening ? 'opening' : element ? 'element' : 'none', id: wall?.id ?? opening?.id ?? element?.id ?? '', ...(element ? { element, elementEdits: element.points.map(() => ({})) } : {}) };
}
export function plannedGeometryDraft(baseline: RenovationBaseline, subject: RenovationSubject): PlannedGeometryDraft {
	const current = baseline.geometry.document.structure ?? EMPTY_STRUCTURE;
	const structure = baseline.geometry.document.intended ?? current;
	const wall = [...structure.walls, ...current.walls].find(item => item.id === subject.targetId);
	const opening = [...structure.openings, ...current.openings].find(item => item.id === subject.targetId);
	const element = [...structure.elements ?? [], ...current.elements ?? []].find(item => item.id === subject.targetId);
	return { ...geometryIdentity(wall, opening, element),
		hostId: opening?.hostId ?? structure.walls[0]?.id ?? '', openingKind: opening?.kind ?? 'opening', text: geometryText(wall, opening) };
}
export function geometryFields(draft: PlannedGeometryDraft): readonly ('x' | 'y' | 'endX' | 'endY' | 'height' | 'thickness' | 'offset' | 'width' | 'sill')[] {
	return draft.kind === 'wall' ? ['x', 'y', 'endX', 'endY', 'height', 'thickness'] : draft.kind === 'opening' ? ['offset', 'width', 'height', 'sill'] : [];
}
function changeGeometry(current: Structure, before: Structure, draft: PlannedGeometryDraft, change: string, values: Record<string, number>): Structure {
	const id = draft.id;
	if (change === 'remove') {
		return { ...before, walls: before.walls.filter(item => item.id !== id), openings: before.openings.filter(item => item.id !== id),
			boundaries: before.boundaries.filter(item => !item.wallIds.includes(id)) };
	}
	if (draft.kind === 'wall') {
		const original = current.walls.find(item => item.id === id);
		const wall = change === 'unchanged' && original ? original : { id, start: { x: values.x, y: values.y }, end: { x: values.endX, y: values.endY }, height: values.height, thickness: values.thickness };
		return before.walls.some(item => item.id === id) ? editWall(before, wall) : { ...before, walls: [...before.walls, wall] };
	}
	{
		const original = current.openings.find(item => item.id === id);
		const opening = change === 'unchanged' && original ? original : { id, kind: draft.openingKind, hostId: draft.hostId, offset: values.offset, width: values.width, height: values.height, sill: values.sill };
		return { ...before, openings: [...before.openings.filter(item => item.id !== id), opening] };
	}
}
export function applyPlannedGeometry(baseline: RenovationBaseline, input: RenovationInput, subject: RenovationSubject, draft: PlannedGeometryDraft) {
	if (draft.kind === 'none') return ok(input);
	const current = baseline.geometry.document.structure ?? EMPTY_STRUCTURE;
	const before = input.intended ?? current;
	const change = subject.planned?.change;
	if (!change) return ok(input);
	if (draft.kind === 'element') {
		const proposed = plannedElementGeometry(current, before, { id: draft.id, element: draft.element, edits: draft.elementEdits, change });
		return proposed.ok ? ok({ ...input, intended: proposed.value }) : proposed;
	}
	// An addition's id is allocated per call and never written INTO the draft: Preview and
	// Apply both come through here, and `PlannedGeometryFields` keeps its kind selector only
	// while `draft.id` is empty — so a preview of the wrong kind used to lock the choice
	// before anything was persisted (a Codex P2 on pull request #87). Only the committed
	// proposal's id reaches the sidecar, so a fresh one per preview costs nothing.
	const id = draft.id || createEntityId(draft.kind === 'wall' ? 'wall' : 'opening');
	const values: Record<string, number> = {};
	for (const field of geometryFields(draft)) {
		const parsed = parseCoordinateMetres(draft.text[field]);
		if (!parsed.ok) return err(spatialError('numeric'));
		values[field] = parsed.mm;
	}
	const intended = changeGeometry(current, before, { ...draft, id }, change, values);
	// This edits a subject that already exists on the floor's own renovation, so `input.renovation`
	// (built by `applyRenovationDraft`) is always real here; the fallback only keeps the type honest.
	const renovation = input.renovation ?? EMPTY_RENOVATION;
	return ok({ renovation: { ...renovation, subjects: renovation.subjects.map(item => item.id === subject.id ? { ...item, targetId: id } : item) }, intended });
}
