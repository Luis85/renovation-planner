import type { Point } from '../../../core/geometry/Point';
import type { Opening, Wall } from '../../../domain/spatial/Structure';
import { wallLength, wallTangent } from '../../../domain/spatial/Structure';
import { wallFacePoint } from '../../../domain/spatial/wallFaceGeometry';
import { wallSideNormal } from '../../../domain/spatial/wallSides';
import { STAGE_PIXELS, worldToScreen, type Viewport } from '../viewport/Viewport';
import { wallSolidRanges } from './wallSolidRanges';

function separate(items: { x: number; y: number }[], normal: Point, space: { width: number; bottom: number; cardWidth: number; cardHeight: number }): void {
	const [a, b] = items, { width, bottom, cardWidth, cardHeight } = space;
	if (Math.abs(a.x - b.x) >= cardWidth + 8 || Math.abs(a.y - b.y) >= cardHeight + 8) return;
	const vertical = Math.abs(normal.y) > Math.abs(normal.x) && bottom - 16 >= cardHeight * 2 + 8;
	const axis = vertical ? 'y' : 'x', size = vertical ? cardHeight : cardWidth, min = vertical ? 16 : 8, max = vertical ? bottom : width - 8;
	const start = Math.max(min, Math.min(max - size * 2 - 8, (a[axis] + b[axis] - size - 8) / 2));
	const [first, second] = normal[axis] > 0 ? [b, a] : [a, b];
	first[axis] = start; second[axis] = start + size + 8;
}

/** Clamp controls, never the camera or the geometry. Tethers retain the face association. */
export function wallSideControlLayout(wall: Wall, viewport: Viewport, space: { width: number; bottom: number; cardHeight: number }, openings: readonly Opening[] = []) {
	const { width, bottom, cardHeight } = space, cardWidth = Math.min(144, (width - 32) / 2), top = 16, height = bottom - top;
	if (cardWidth < 144 || height < cardHeight) return null;
	const range = wallSolidRanges(wall, openings).toSorted((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
	if (!range) return null;
	const fraction = (range[0] + range[1]) / 2, tangent = wallTangent(wall, wallLength(wall) * fraction);
	const clamp = (point: Point): Point => ({ x: Math.max(8, Math.min(width - cardWidth - 8, point.x)), y: Math.max(top, Math.min(bottom - cardHeight, point.y)) });
	const items = (['a', 'b'] as const).map(side => {
		const face = worldToScreen(wallFacePoint(wall, side, fraction), viewport, STAGE_PIXELS), normal = wallSideNormal(tangent, side);
		const reach = Math.abs(normal.x) * cardWidth / 2 + Math.abs(normal.y) * cardHeight / 2 + 20;
		return { side, face, ...clamp({ x: face.x + normal.x * reach - cardWidth / 2, y: face.y + normal.y * reach - cardHeight / 2 }), width: cardWidth };
	});
	separate(items, wallSideNormal(tangent, 'a'), { width, bottom, cardWidth, cardHeight });
	return items.map(item => ({ ...item, tether: { x: item.x + cardWidth / 2, y: item.y + cardHeight / 2 } }));
}
