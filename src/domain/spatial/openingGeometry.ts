import type { Point } from '../../core/geometry/Point';
import { alongWall, wallLength, type Opening, type Wall } from './Structure';
import { openingSwing } from './openingSwing';

/** Clicks place the opening centre; near an endpoint its complete width stays on the host. */
export function openingOffsetAt(wall: Wall, point: Point, width: number): number | null {
	const length = wallLength(wall);
	if (![point.x, point.y, width, length].every(value => Number.isFinite(value)) || width <= 0 || width > length) return null;
	const projected = ((point.x - wall.start.x) * (wall.end.x - wall.start.x) + (point.y - wall.start.y) * (wall.end.y - wall.start.y)) / length;
	return Math.max(0, Math.min(length - width, projected - width / 2));
}

/** Native host-relative plan symbols, independent from reference imagery and canvas pixels. */
export function openingSymbol(opening: Opening, host: Wall): { cut: readonly Point[]; frame: readonly (readonly Point[])[]; leaf: readonly Point[]; arc: readonly Point[] } {
	const start = alongWall(host, opening.offset), end = alongWall(host, opening.offset + opening.width);
	const length = wallLength(host), tangent = { x: (host.end.x - host.start.x) / length, y: (host.end.y - host.start.y) / length };
	const normal = { x: tangent.y, y: -tangent.x };
	const shift = (point: Point, distance: number): Point => ({ x: point.x + normal.x * distance, y: point.y + normal.y * distance });
	const frame: (readonly Point[])[] = [[shift(start, -host.thickness / 2), shift(start, host.thickness / 2)], [shift(end, -host.thickness / 2), shift(end, host.thickness / 2)]];
	if (opening.kind === 'window') {
		for (const distance of [-host.thickness / 3, host.thickness / 3]) frame.push([shift(start, distance), shift(end, distance)]);
	}
	const swing = openingSwing(opening);
	if (!swing) return { cut: [start, end], frame, leaf: [], arc: [] };
	const hinge = swing.hinge === 'start' ? start : end, forward = swing.hinge === 'start' ? 1 : -1, side = swing.side === 'left' ? 1 : -1;
	const tip = (angle: number): Point => ({ x: hinge.x + opening.width * (forward * tangent.x * Math.cos(angle) + side * normal.x * Math.sin(angle)), y: hinge.y + opening.width * (forward * tangent.y * Math.cos(angle) + side * normal.y * Math.sin(angle)) });
	const radians = swing.angle * Math.PI / 180;
	const count = Math.max(1, Math.ceil(swing.angle / 5));
	const arc = swing.angle === 0 ? [] : Array.from({ length: count + 1 }, (_, index) => tip(radians * index / count));
	return { cut: [start, end], frame, leaf: [hinge, tip(radians)], arc };
}
