import type { Point } from '../../../core/geometry/Point';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { createCurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { arcLength, arcPoint, arcRadius, type CircularEdge } from '../../../core/geometry/circularArc';
import { distance } from '../../../core/geometry/operations';
import type { PlanGeometryDocument } from '../../../application/ports/PlanGeometrySidecar';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import { formatMetres } from '../shell/formatLength';

export interface CurveTarget { id: string; kind: 'room' | 'wall'; name: string; geometry: CurvedPolygon }
export function curveSource(document: PlanGeometryDocument, target: CurveTarget): CurvedPolygon | null {
	if (target.kind === 'room') {
		const object = document.objects.find(item => item.id === target.id);
		return object ? { points: object.points, bulges: object.bulges?.some(value => value !== 0) ? object.bulges : undefined } : null;
	}
	const wall = document.structure?.walls.find(item => item.id === target.id);
	return wall ? { points: [wall.start, wall.end], bulges: [wall.bulge ?? 0, 0] } : null;
}
export function curveEdges(target: CurveTarget) {
	return target.geometry.points.slice(0, target.kind === 'wall' ? 1 : target.geometry.points.length).map((start, index) => {
		const edge: CircularEdge = { start, end: target.geometry.points[(index + 1) % target.geometry.points.length], bulge: target.geometry.bulges?.[index] ?? 0 };
		return { ...edge, index, midpoint: arcPoint(edge, 0.5), length: arcLength(edge), radius: arcRadius(edge), depth: distance(edge.start, edge.end) * edge.bulge / 2 };
	});
}
export function curveText(edge: CircularEdge): { depth: string; radius: string } {
	const radius = arcRadius(edge);
	return { depth: formatMetres(distance(edge.start, edge.end) * edge.bulge / 2), radius: radius === null ? '' : formatMetres(radius) };
}
/** Signed depth uses (dy, -dx), left of the edge arrow on the y-down screen; maximum is a semicircle. */
export function bulgeAt(edge: CircularEdge, point: Point): number {
	const dx = edge.end.x - edge.start.x, dy = edge.end.y - edge.start.y, squared = dx * dx + dy * dy;
	return squared === 0 ? 0 : Math.max(-1, Math.min(1, 2 * ((point.x - edge.start.x) * dy - (point.y - edge.start.y) * dx) / squared));
}
export function typedBulge(edge: CircularEdge, field: 'depth' | 'radius', text: string): number | null {
	if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text.trim())) return null;
	const value = Number(text.replace(',', '.')) * 1000, chord = distance(edge.start, edge.end);
	if (!Number.isFinite(value) || chord <= 0) return null;
	if (field === 'depth') { const bulge = 2 * value / chord; return Math.abs(bulge) <= 1 ? bulge : null; }
	if (value < chord / 2) return null;
	const ratio = chord / (2 * value);
	return Math.sign(edge.bulge || 1) * ratio / (1 + Math.sqrt(Math.max(0, 1 - ratio * ratio)));
}
export function withCurve(target: CurveTarget, index: number, bulge: number): CurveTarget {
	const bulges = target.geometry.points.map((_, edge) => edge === index ? bulge : target.geometry.bulges?.[edge] ?? 0);
	return { ...target, geometry: { ...target.geometry, bulges } };
}
export function curveDocument(document: PlanGeometryDocument, target: CurveTarget): PlanGeometryDocument {
	if (target.kind === 'room') return { ...document, objects: document.objects.map(object => object.id === target.id ? { ...object, ...target.geometry, bulges: target.geometry.bulges?.some(value => value !== 0) ? target.geometry.bulges : undefined } : object) };
	return { ...document, structure: document.structure ? { ...document.structure, walls: document.structure.walls.map(wall => wall.id === target.id ? { ...wall, bulge: target.geometry.bulges?.[0] ?? 0 } : wall) } : undefined };
}
export function curveError(document: PlanGeometryDocument, target: CurveTarget) {
	if (target.kind === 'room') { const checked = createCurvedPolygon(target.geometry); if (!checked.ok) return checked.error; }
	const next = curveDocument(document, target);
	if (next.structure) { const checked = validateStructure(next.structure, next.objects.map(object => object.id)); if (!checked.ok) return checked.error; }
	return null;
}
