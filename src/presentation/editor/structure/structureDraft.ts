import { openingOffsetAt } from '../../../domain/spatial/openingGeometry';
import { parseSwingDraft, type OpeningSwingDraft } from './openingSwingDraft';
import { reactive } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import { createEntityId } from '../../../core/identity/generateId';
import { EMPTY_STRUCTURE, projectOntoWall, samePoint, wallLength, type Opening, type Structure, type Wall } from '../../../domain/spatial/Structure';
import { closedChain, spatialError, validateStructure, validSpatialPoint } from '../../../domain/spatial/structureGeometry';
import type { AppError, ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import { splitWall } from '../../../domain/spatial/splitWall';
import type { WallJoin } from '../../../domain/spatial/wallJoin';
import { formatMetres, parseCoordinateMetres, parseMetres } from '../shell/formatLength';

export type StructureToolId = 'draw-wall' | 'place-door' | 'place-window' | 'place-opening';
export const isStructureTool = (id: string | null): id is StructureToolId => id === 'draw-wall' || id === 'place-door' || id === 'place-window' || id === 'place-opening';
/** A wall the chain starts or ends in the middle of, cut at `point` when the walls are saved. */
interface WallSplit { readonly wallId: string; readonly offset: number; readonly id: string; readonly point: Point }
export function createStructureDraft() {
	const swing: OpeningSwingDraft = { hinge: 'start', side: 'left', angle: '90' };
	return reactive({ kind: 'draw-wall', points: [] as Point[], cursor: null as Point | null, snapped: false,
		joins: { start: null as WallSplit | null, end: null as WallSplit | null }, pending: null as WallJoin | null,
		swing,
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
	const swing = draft.kind === 'place-opening' ? undefined : parseSwingDraft(draft.swing);
	if (swing === null) return null;
	return { id: 'opening-draft', kind: draft.kind === 'place-door' ? 'door' : draft.kind === 'place-window' ? 'window' : 'opening', ...(swing ? { swing } : {}), hostId: draft.text.hostId, width: width.mm, height: height.mm, offset: offset.mm, sill: sill.mm };
}

/** The draft's walls on the floor it is drawn on — with its cuts applied, so a preview and a save see one picture. A refused cut previews on the uncut floor; validation reports it. */
export function draftStructure(draft: StructureDraft, existing: Structure = EMPTY_STRUCTURE): Structure | null {
	if (draft.kind === 'draw-wall') {
		const walls = wallsFromDraft(draft), base = drawnOn(draft, draft.points, existing), floor = base.ok ? base.value : existing;
		return walls && walls.length > 0 ? { ...floor, walls: [...floor.walls, ...walls] } : null;
	}
	const opening = openingFromDraft(draft);
	return opening ? { ...existing, openings: [...existing.openings, opening] } : null;
}

export function validateDraftStructure(draft: StructureDraft, existing: Structure, roomIds: readonly string[]) {
	if (draft.kind !== 'draw-wall' && draft.kind !== 'place-opening' && !parseSwingDraft(draft.swing)) return err(spatialError('opening-swing'));
	if (draft.kind === 'draw-wall' && draft.text.length !== '') return err(spatialError('pending'));
	const base = drawnOn(draft, draft.points, existing);
	if (!base.ok) return base;
	const proposed = draftStructure(draft, existing);
	if (!proposed) return err(spatialError('wall-dimensions'));
	if (draft.room && (!closedChain(draft.points) || !draft.roomName.trim())) return err(spatialError('boundary'));
	return validateStructure(proposed, roomIds);
}

/**
 * The floor a chain of `points` is drawn on: `existing` with the start cut applied while the chain
 * still starts at it, THEN the end cut while the chain still ends at it. Sequential, because the end
 * join is resolved against the floor with the start cut already made (`endOnWall`), so two cuts on
 * one wall name whichever half each falls on.
 */
function drawnOn(draft: StructureDraft, points: readonly Point[], existing: Structure): Result<Structure, ValidationError> {
	let floor = existing;
	const { start, end } = draft.joins;
	for (const [split, anchor] of [[start, points[0]], [end, points.length > 1 ? points[points.length - 1] : undefined]] as const) {
		if (!split || !anchor || !samePoint(anchor, split.point)) continue;
		const cut = splitWall(floor, split.wallId, split.offset, split.id);
		if (!cut.ok) return cut;
		floor = cut.value.structure;
	}
	return ok(floor);
}

/** Where a wall drawn from `point` on `wallId` starts: an end within `tolerance`, else a whole-millimetre cut. */
function wallStart(existing: Structure, wallId: string, point: Point, tolerance: number): Result<{ point: Point; split: WallSplit | null }, ValidationError> {
	const wall = existing.walls.find(item => item.id === wallId);
	if (!wall) return err(spatialError('host-missing'));
	const length = wallLength(wall), along = projectOntoWall(wall, point).offset, id = createEntityId('wall');
	const offset = along <= tolerance ? 0 : along >= length - tolerance ? length : Math.round(along);
	const cut = splitWall(existing, wallId, offset, id);
	if (!cut.ok) return cut;
	return ok({ point: cut.value.point, split: cut.value.structure === existing ? null : { wallId, offset, id, point: cut.value.point } });
}
export const wallStartRefused = (existing: Structure, wallId: string, point: Point, tolerance: number): boolean => !wallStart(existing, wallId, point, tolerance).ok;

/** Starts the chain on a wall at the point nearest `point`, so the new wall joins it there. */
export function startFromWall(draft: StructureDraft, existing: Structure, wallId: string, point: Point, tolerance: number): boolean {
	const start = wallStart(existing, wallId, point, tolerance);
	if (!start.ok) { draft.error = start.error; return false; }
	const previous = draft.joins.start;
	draft.joins.start = start.value.split;
	if (addWallPoint(draft, start.value.point, existing)) return true;
	draft.joins.start = previous;
	return false;
}

/**
 * Ends the chain on a wall body at `join`, cutting the host there when the chain is saved. `join`
 * was resolved against the UNCUT floor (what the canvas shows), so it is re-found on the floor
 * with the draft's recorded cuts applied: the wall under `join.point` there is the half it falls on. A point
 * that turns out to be a wall end is a plain point and records no cut.
 */
export function endOnWall(draft: StructureDraft, existing: Structure, join: WallJoin): boolean {
	const base = drawnOn(draft, draft.points, existing);
	if (!base.ok) { draft.error = base.error; return false; }
	const hits = base.value.walls.map(wall => ({ wall, ...projectOntoWall(wall, join.point) })).filter(hit => hit.distance <= 1);
	const host = hits.reduce<(typeof hits)[number] | undefined>((best, hit) => !best || hit.distance < best.distance ? hit : best, undefined);
	if (!host) { draft.error = spatialError('host-missing'); return false; }
	const offset = Math.round(host.offset), id = createEntityId('wall');
	const cut = splitWall(base.value, host.wall.id, offset, id);
	if (!cut.ok) { draft.error = cut.error; return false; }
	const previous = draft.joins.end;
	draft.joins.end = cut.value.structure === base.value ? null : { wallId: host.wall.id, offset, id, point: cut.value.point };
	if (addWallPoint(draft, cut.value.point, existing)) return true;
	draft.joins.end = previous;
	return false;
}

export function addWallPoint(draft: StructureDraft, point: Point, existing: Structure): boolean {
	if (draft.busy || draft.loading || draft.conflict || !validSpatialPoint(point) || closedChain(draft.points)) return false;
	if (draft.points.length && samePoint(draft.points[draft.points.length - 1], point)) { draft.error = spatialError('wall-dimensions'); return false; }
	const points = [...draft.points, point];
	const walls = wallsFromDraft({ ...draft, points }), base = drawnOn(draft, points, existing);
	if (!base.ok) { draft.error = base.error; return false; }
	const checked = walls ? validateStructure({ ...base.value, walls: [...base.value.walls, ...walls] }, existing.boundaries.map(b => b.roomId)) : null;
	if (!checked?.ok) { draft.error = checked ? checked.error : spatialError('wall-dimensions'); return false; }
	draft.points = points; draft.error = null; draft.cursor = null; draft.pending = null;
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

/** Endpoint snap first (a candidate POINT), then the previous point's axes; `axis` marks the second so a caller can let a wall-body join take precedence over it. */
export function snapWallPoint(point: Point, points: readonly Point[], walls: readonly Wall[], tolerance: number): { point: Point; snapped: boolean; axis?: true } {
	const candidates = [...points, ...walls.flatMap(wall => [wall.start, wall.end])];
	const close = candidates.map(candidate => ({ point: candidate, distance: Math.hypot(candidate.x - point.x, candidate.y - point.y) })).filter(candidate => candidate.distance <= tolerance).reduce<{ point: Point; distance: number } | undefined>((best, hit) => !best || hit.distance < best.distance ? hit : best, undefined);
	if (close) return { point: close.point, snapped: true };
	const last = points[points.length - 1];
	if (!last) return { point, snapped: false };
	const x = Math.abs(last.x - point.x) <= tolerance ? last.x : point.x;
	const y = Math.abs(last.y - point.y) <= tolerance ? last.y : point.y;
	const snapped = x !== point.x || y !== point.y;
	return snapped ? { point: { x, y }, snapped, axis: true } : { point, snapped };
}

export function pickHost(draft: StructureDraft, point: Point, walls: readonly Wall[], tolerance: number): void {
	const hits = walls.map(wall => ({ wall, ...projectOntoWall(wall, point), length: wallLength(wall) })).filter(hit => hit.distance <= tolerance);
	const hit = hits.reduce<(typeof hits)[number] | undefined>((best, candidate) => !best || candidate.distance < best.distance ? candidate : best, undefined);
	draft.snapped = hit !== undefined;
	if (hit) {
		const width = parseMetres(draft.text.width);
		if (!width.ok) { draft.snapped = false; draft.error = spatialError('opening-containment'); return; }
		const offset = openingOffsetAt(hit.wall, point, width.mm);
		if (offset === null) { draft.snapped = false; draft.error = spatialError('opening-containment'); return; }
		draft.text.hostId = hit.wall.id; draft.text.offset = formatMetres(Math.min(Math.round(offset), Math.floor(hit.length - width.mm))); draft.error = null;
	}
}
