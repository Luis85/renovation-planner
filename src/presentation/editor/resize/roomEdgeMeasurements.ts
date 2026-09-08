import type { Point } from '../../../core/geometry/Point';
import { distance } from '../../../core/geometry/operations';
import type { PolygonSketch } from '../tools/render-state';
import { roomDimensions } from './roomDimensions';

/** The open sketch has placed edges and one proposed edge, never an invented closing edge. */
export function roomSketchPoints(sketch: PolygonSketch | null): readonly Point[] {
	if (!sketch) return [];
	const points = [...sketch.vertices], next = sketch.nextVertex, last = points.at(-1);
	if (next && last && distance(last, next) > 0) points.push(next);
	return points;
}

/** Lengths follow actual segments; axis-aligned size controls may represent two of those edges. */
export function roomEdges(points: readonly Point[], closed: boolean, omitAxisControls = false) {
	const box = omitAxisControls ? roomDimensions(points) : null;
	const winding = points.reduce((sum, a, index) => { const b = points[(index + 1) % points.length]; return sum + a.x * b.y - b.x * a.y; }, 0);
	const result = [];
	for (let index = 0; index < points.length - (closed ? 0 : 1); index++) {
		const a = points[index], b = points[(index + 1) % points.length], length = distance(a, b);
		if (!Number.isFinite(length) || length === 0) continue;
		if (box && ((a.y === box.min.y && b.y === box.min.y) || (a.x === box.min.x && b.x === box.min.x))) continue;
		const sign = winding < 0 ? -1 : 1;
		result.push({ index, length, midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, normal: { x: sign * (b.y - a.y) / length, y: sign * (a.x - b.x) / length } });
	}
	return result;
}
