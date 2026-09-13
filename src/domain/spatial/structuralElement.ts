import type { Point } from '../../core/geometry/Point';

/** A new post's cross-section, world mm (structural posts and beams design §3). */
export const DEFAULT_POST_SECTION = { width: 140, depth: 140 } as const;
/** A new beam's width across its axis, world mm (design §3). */
export const DEFAULT_BEAM_WIDTH = 160;

/** Four corners of a post centred on `centre` whose first edge bears `angle` radians; the outline IS the stored geometry. */
function corners(centre: Point, width: number, depth: number, angle: number): Point[] {
	const ux = Math.cos(angle), uy = Math.sin(angle), halfWidth = width / 2, halfDepth = depth / 2;
	return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) => ({
		x: centre.x + along * halfWidth * ux - across * halfDepth * uy,
		y: centre.y + along * halfWidth * uy + across * halfDepth * ux,
	}));
}

/** An axis-aligned post outline centred on `centre`. */
export function postOutline(centre: Point, width: number, depth: number): Point[] {
	return corners(centre, width, depth, 0);
}

/** Width and depth read back off a post outline: its first and second edges. */
export function postSection(points: readonly Point[]): { width: number; depth: number } | null {
	if (points.length !== 4) return null;
	return { width: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y), depth: Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y) };
}

/** A post with a new section about the same centre, keeping the bearing of its first edge so a rotation survives. */
export function resizedPost(points: readonly Point[], width: number, depth: number): Point[] | null {
	if (points.length !== 4) return null;
	const centre = { x: points.reduce((sum, point) => sum + point.x, 0) / 4, y: points.reduce((sum, point) => sum + point.y, 0) / 4 };
	return corners(centre, width, depth, Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x));
}

/** The band a beam covers in plan: its axis widened by `width`, or nothing for a degenerate axis or width. */
export function beamOutline(points: readonly Point[], width: number): Point[] {
	if (points.length !== 2 || !(width > 0)) return [];
	const [start, end] = points, length = Math.hypot(end.x - start.x, end.y - start.y);
	if (!(length > 0)) return [];
	const nx = -(end.y - start.y) / length * width / 2, ny = (end.x - start.x) / length * width / 2;
	return [{ x: start.x + nx, y: start.y + ny }, { x: end.x + nx, y: end.y + ny }, { x: end.x - nx, y: end.y - ny }, { x: start.x - nx, y: start.y - ny }];
}
