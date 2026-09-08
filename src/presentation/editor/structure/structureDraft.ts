import { reactive } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import { createEntityId } from '../../../core/identity/generateId';
import { EMPTY_STRUCTURE, samePoint, type Opening, type Structure, type Wall } from '../../../domain/spatial/Structure';
import { closedChain, spatialError, validateStructure, validSpatialPoint } from '../../../domain/spatial/structureGeometry';
import type { AppError } from '../../../core/errors/AppError';
import { err } from '../../../core/result/Result';
import { formatMetres, parseCoordinateMetres, parseMetres } from '../shell/formatLength';

export type StructureToolId = 'draw-wall' | 'place-door' | 'place-window' | 'place-opening';
export const isStructureTool = (id: string | null): id is StructureToolId => id === 'draw-wall' || id === 'place-door' || id === 'place-window' || id === 'place-opening';
export function createStructureDraft() {
	return reactive({ kind: 'draw-wall', points: [] as Point[], cursor: null as Point | null, snapped: false,
		busy: false, loading: false, conflict: false, error: null as AppError | null, room: false, roomName: '',
		text: { x: '0', y: '0', length: '', angle: '0', height: '2.4', thickness: '0.15', hostId: '', offset: '0', width: '0.9', openingHeight: '2.1', sill: '0' },
	});
}
export type StructureDraft = ReturnType<typeof createStructureDraft>;

export function wallsFromDraft(draft: StructureDraft): Wall[] | null {
	const height = parseMetres(draft.text.height), thickness = parseMetres(draft.text.thickness);
	if (!height.ok || !thickness.ok) return null;
	return draft.points.slice(1).map((end, index) => ({ id: `wall-draft-${index}`, start: draft.points[index], end, height: height.mm, thickness: thickness.mm }));
}

export function openingFromDraft(draft: StructureDraft): Opening | null {
	const width = parseMetres(draft.text.width), height = parseMetres(draft.text.openingHeight);
	const offset = parseCoordinateMetres(draft.text.offset), sill = parseCoordinateMetres(draft.text.sill);
	if (!width.ok || !height.ok || !offset.ok || !sill.ok) return null;
	return { id: 'opening-draft', kind: draft.kind === 'place-door' ? 'door' : draft.kind === 'place-window' ? 'window' : 'opening', hostId: draft.text.hostId, width: width.mm, height: height.mm, offset: offset.mm, sill: sill.mm };
}

export function draftStructure(draft: StructureDraft, existing: Structure = EMPTY_STRUCTURE): Structure | null {
	if (draft.kind === 'draw-wall') {
		const walls = wallsFromDraft(draft);
		return walls && walls.length > 0 ? { ...existing, walls: [...existing.walls, ...walls] } : null;
	}
	const opening = openingFromDraft(draft);
	return opening ? { ...existing, openings: [...existing.openings, opening] } : null;
}

export function validateDraftStructure(draft: StructureDraft, existing: Structure, roomIds: readonly string[]) {
	if (draft.kind === 'draw-wall' && draft.text.length !== '') return err(spatialError('pending'));
	const proposed = draftStructure(draft, existing);
	if (!proposed) return err(spatialError('wall-dimensions'));
	if (draft.room && (!closedChain(draft.points) || !draft.roomName.trim())) return err(spatialError('boundary'));
	return validateStructure(proposed, roomIds);
}

export function addWallPoint(draft: StructureDraft, point: Point, existing: Structure): boolean {
	if (draft.busy || draft.loading || draft.conflict || !validSpatialPoint(point) || closedChain(draft.points)) return false;
	if (draft.points.length && samePoint(draft.points[draft.points.length - 1], point)) { draft.error = spatialError('wall-dimensions'); return false; }
	const points = [...draft.points, point];
	const walls = wallsFromDraft({ ...draft, points });
	const checked = walls ? validateStructure({ ...existing, walls: [...existing.walls, ...walls] }, existing.boundaries.map(b => b.roomId)) : null;
	if (!checked?.ok) { draft.error = checked ? checked.error : spatialError('wall-dimensions'); return false; }
	draft.points = points; draft.error = null; draft.cursor = null;
	return true;
}

export function numericWallPoint(draft: StructureDraft): Point | null {
	if (!draft.points.length) {
		const x = parseCoordinateMetres(draft.text.x), y = parseCoordinateMetres(draft.text.y);
		return x.ok && y.ok ? { x: x.mm, y: y.mm } : null;
	}
	const length = parseMetres(draft.text.length), angle = draft.text.angle.trim().replace(',', '.');
	if (!length.ok || !/^-?\d+(?:\.\d+)?$/.test(angle) || Math.abs(Number(angle)) > 360) return null;
	const start = draft.points[draft.points.length - 1], radians = Number(angle) * Math.PI / 180;
	const dx = Math.cos(radians) * length.mm, dy = Math.sin(radians) * length.mm;
	return { x: start.x + (Math.abs(dx) < 1e-8 ? 0 : dx), y: start.y + (Math.abs(dy) < 1e-8 ? 0 : dy) };
}

export function mintStructure(structure: Structure): Structure {
	return { ...structure, walls: structure.walls.map(wall => wall.id.startsWith('wall-draft-') ? { ...wall, id: createEntityId('wall') } : wall),
		openings: structure.openings.map(opening => opening.id === 'opening-draft' ? { ...opening, id: createEntityId('opening') } : opening) };
}

export function snapWallPoint(point: Point, points: readonly Point[], walls: readonly Wall[], tolerance: number): { point: Point; snapped: boolean } {
	const candidates = [...points, ...walls.flatMap(wall => [wall.start, wall.end])];
	const close = candidates.map(candidate => ({ point: candidate, distance: Math.hypot(candidate.x - point.x, candidate.y - point.y) })).filter(candidate => candidate.distance <= tolerance).reduce<{ point: Point; distance: number } | undefined>((best, hit) => !best || hit.distance < best.distance ? hit : best, undefined);
	if (close) return { point: close.point, snapped: true };
	const last = points[points.length - 1];
	if (!last) return { point, snapped: false };
	const x = Math.abs(last.x - point.x) <= tolerance ? last.x : point.x;
	const y = Math.abs(last.y - point.y) <= tolerance ? last.y : point.y;
	return { point: { x, y }, snapped: x !== point.x || y !== point.y };
}

export function pickHost(draft: StructureDraft, point: Point, walls: readonly Wall[], tolerance: number): void {
	const hits = walls.map(wall => {
		const dx = wall.end.x - wall.start.x, dy = wall.end.y - wall.start.y, length = Math.hypot(dx, dy);
		const offset = ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / length;
		const distance = Math.hypot(point.x - wall.start.x - dx * offset / length, point.y - wall.start.y - dy * offset / length);
		return { wall, offset, distance, length };
	}).filter(hit => hit.offset >= 0 && hit.offset <= hit.length && hit.distance <= tolerance);
	const hit = hits.reduce<(typeof hits)[number] | undefined>((best, candidate) => !best || candidate.distance < best.distance ? candidate : best, undefined);
	draft.snapped = hit !== undefined;
	if (hit) { draft.text.hostId = hit.wall.id; draft.text.offset = formatMetres(hit.offset); }
}
