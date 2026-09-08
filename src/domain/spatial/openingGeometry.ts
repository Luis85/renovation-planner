import type { Point } from '../../core/geometry/Point';
import { alongWall, projectOntoWall, wallLength, wallTangent, type Opening, type Wall } from './Structure';
import { arcPolyline } from '../../core/geometry/curvePolyline';
import { openingSwing } from './openingSwing';

/** Clicks place the opening centre; near an endpoint its complete width stays on the host. */
export function openingOffsetAt(wall: Wall, point: Point, width: number): number | null {
	const length = wallLength(wall);
	if (![point.x, point.y, width, length].every(value => Number.isFinite(value)) || width <= 0 || width > length) return null;
	const projected = projectOntoWall(wall, point).offset;
	return Math.max(0, Math.min(length - width, projected - width / 2));
}

/** Native host-relative plan symbols, independent from reference imagery and canvas pixels. */
export function openingSymbol(opening: Opening, host: Wall, tolerance = 1): { cut: readonly Point[]; frame: readonly (readonly Point[])[]; leaf: readonly Point[]; arc: readonly Point[] } {
	const start = alongWall(host, opening.offset), end = alongWall(host, opening.offset + opening.width);
	const bulge = Math.tan(Math.atan(host.bulge ?? 0) * opening.width / wallLength(host));
	const cut = arcPolyline({ start, end, bulge }, tolerance);
	const shift = (point: Point, distance: number, fraction: number): Point => {
		const tangent = wallTangent(host, opening.offset + fraction * opening.width);
		return { x: point.x + tangent.y * distance, y: point.y - tangent.x * distance };
	};
	const frame: (readonly Point[])[] = [[shift(start, -host.thickness / 2, 0), shift(start, host.thickness / 2, 0)], [shift(end, -host.thickness / 2, 1), shift(end, host.thickness / 2, 1)]];
	if (opening.kind === 'window') {
		for (const distance of [-host.thickness / 3, host.thickness / 3]) frame.push(cut.map((point, index) => shift(point, distance, index / (cut.length - 1))));
	}
	const swing = openingSwing(opening);
	if (!swing) return { cut, frame, leaf: [], arc: [] };
	const tangent = wallTangent(host, opening.offset + (swing.hinge === 'end' ? opening.width : 0)), normal = { x: tangent.y, y: -tangent.x };
	const hinge = swing.hinge === 'start' ? start : end, forward = swing.hinge === 'start' ? 1 : -1, side = swing.side === 'left' ? 1 : -1;
	const tip = (angle: number): Point => ({ x: hinge.x + opening.width * (forward * tangent.x * Math.cos(angle) + side * normal.x * Math.sin(angle)), y: hinge.y + opening.width * (forward * tangent.y * Math.cos(angle) + side * normal.y * Math.sin(angle)) });
	const radians = swing.angle * Math.PI / 180;
	const count = Math.max(1, Math.ceil(swing.angle / 5));
	const arc = swing.angle === 0 ? [] : Array.from({ length: count + 1 }, (_, index) => tip(radians * index / count));
	return { cut, frame, leaf: opening.kind === 'window' && swing.angle === 0 ? cut : [hinge, tip(radians)], arc };
}
