import type { Point } from '../../../core/geometry/Point';
import { distance } from '../../../core/geometry/operations';
import type { PolygonSketch } from '../tools/render-state';
import { roomDimensions } from './roomDimensions';
import { arcLength, arcPoint, arcTangent, arcSegmentMoments } from '../../../core/geometry/circularArc';

/** The open sketch has placed edges and one proposed edge, never an invented closing edge. */
export function roomSketchPoints(sketch: PolygonSketch | null): readonly Point[] {
	if (!sketch) return [];
	const points = [...sketch.vertices], next = sketch.nextVertex, last = points.at(-1);
	if (next && last && distance(last, next) > 0) points.push(next);
	return points;
}

/** Lengths follow actual segments; axis-aligned size controls may represent two of those edges. */
export function roomEdges(points: readonly Point[], closed: boolean, omitAxisControls = false, bulges?: readonly number[]) {
	const box = omitAxisControls ? roomDimensions(points, bulges) : null;
	const winding = points.reduce((sum, a, index) => { const b = points[(index + 1) % points.length]; return sum + a.x * b.y - b.x * a.y + 2 * arcSegmentMoments({ start: a, end: b, bulge: bulges?.[index] ?? 0 }).area; }, 0);
	const result = [];
	for (let index = 0; index < points.length - (closed ? 0 : 1); index++) {
		const a = points[index], b = points[(index + 1) % points.length], edge = { start: a, end: b, bulge: bulges?.[index] ?? 0 }, length = arcLength(edge);
		if (!Number.isFinite(length) || length === 0) continue;
		if (box && ((a.y === box.min.y && b.y === box.min.y) || (a.x === box.min.x && b.x === box.min.x))) continue;
		const sign = winding < 0 ? -1 : 1;
		const tangent = arcTangent(edge, 0.5);
		result.push({ index, length, midpoint: arcPoint(edge, 0.5), normal: { x: sign * tangent.y, y: -sign * tangent.x } });
	}
	return result;
}
