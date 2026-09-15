import type { Point } from '../../core/geometry/Point';
import { alongWall, projectOntoWall, wallLength, wallTangent, type Opening, type Wall } from './Structure';
import { arcPolyline } from '../../core/geometry/curvePolyline';
import { openingSwing } from './openingSwing';
import { asymmetricWall, wallSideExtents } from './wallSides';
import { wallFacePolygon } from './wallFaceGeometry';
import { clipWallPolygon, clipWallPolyline, type WallClip } from './wallSideJunctions';

/** Clicks place the opening centre; near an endpoint its complete width stays on the host. */
export function openingOffsetAt(wall: Wall, point: Point, width: number): number | null {
	const length = wallLength(wall);
	if (![point.x, point.y, width, length].every(value => Number.isFinite(value)) || width <= 0 || width > length) return null;
	const projected = projectOntoWall(wall, point).offset;
	return Math.max(0, Math.min(length - width, projected - width / 2));
}

/** Native host-relative plan symbols, independent from reference imagery and canvas pixels. */
function openingPath(opening: Opening, host: Wall) {
	const start = alongWall(host, opening.offset), end = alongWall(host, opening.offset + opening.width);
	const bulge = Math.tan(Math.atan(host.bulge ?? 0) * opening.width / wallLength(host));
	return { start, end, bulge };
}
export function openingSymbol(opening: Opening, host: Wall, tolerance = 1, clips: readonly WallClip[] = []): { cut: readonly Point[]; frame: readonly (readonly Point[])[]; leaf: readonly Point[]; arc: readonly Point[] } {
	const { start, end, bulge } = openingPath(opening, host);
	const cut = arcPolyline({ start, end, bulge }, tolerance);
	const shift = (point: Point, distance: number, fraction: number): Point => {
		const tangent = wallTangent(host, opening.offset + fraction * opening.width);
		return { x: point.x + tangent.y * distance, y: point.y - tangent.x * distance };
	};
	const sides = wallSideExtents(host);
	const frame: (readonly Point[])[] = [[shift(start, -sides.b, 0), shift(start, sides.a, 0)], [shift(end, -sides.b, 1), shift(end, sides.a, 1)]];
	if (opening.kind === 'window') {
		for (const distance of [-sides.b * 2 / 3, sides.a * 2 / 3]) frame.push(asymmetricWall(host) ? arcPolyline({ start: shift(start, distance, 0), end: shift(end, distance, 1), bulge }, tolerance) : cut.map((point, index) => shift(point, distance, index / (cut.length - 1))));
	}
	const clippedFrame = frame.flatMap(points => clipWallPolyline(points, clips)), swing = openingSwing(opening);
	if (!swing) return { cut, frame: clippedFrame, leaf: [], arc: [] };
	const tangent = wallTangent(host, opening.offset + (swing.hinge === 'end' ? opening.width : 0)), normal = { x: tangent.y, y: -tangent.x };
	const hinge = swing.hinge === 'start' ? start : end, forward = swing.hinge === 'start' ? 1 : -1, side = swing.side === 'left' ? 1 : -1;
	const tip = (angle: number): Point => ({ x: hinge.x + opening.width * (forward * tangent.x * Math.cos(angle) + side * normal.x * Math.sin(angle)), y: hinge.y + opening.width * (forward * tangent.y * Math.cos(angle) + side * normal.y * Math.sin(angle)) });
	const radians = swing.angle * Math.PI / 180;
	const count = Math.max(1, Math.ceil(swing.angle / 5));
	const arc = swing.angle === 0 ? [] : Array.from({ length: count + 1 }, (_, index) => tip(radians * index / count));
	return { cut, frame: clippedFrame, leaf: opening.kind === 'window' && swing.angle === 0 ? cut : [hinge, tip(radians)], arc };
}

/** An opening masks the actual two host faces, without translating its along-wall placement. */
export function openingCutPolygon(opening: Opening, host: Wall, tolerance = 1, padding = 0, clips: readonly WallClip[] = []): readonly Point[] {
	const sides = wallSideExtents(host);
	return clips.reduce((points, clip) => clipWallPolygon(points, clip), wallFacePolygon({ ...host, ...openingPath(opening, host), sideExtents: { a: sides.a + padding, b: sides.b + padding }, thickness: host.thickness + padding * 2 }, tolerance));
}
