import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import { ASSET_PRESETS } from '../../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../../src/domain/asset/presets/presetGeometry';
import { placedOutline } from '../../../../src/domain/spatial/assetPlacement';
import { placementAt } from '../../../../src/presentation/editor/elements/assetPlacementDraft';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { WALL_LOOP } from '../../../helpers/structure';

/**
 * `Design an Asset.md` step 27: the toilet preset snapped to a wall has its TANK against the wall and its bowl
 * pointing into the room. `placementAt.test.ts` snaps an 800 x 600 box facing +x, where the designer's +y front
 * convention and the placement's turn never meet; this snaps the preset as it ships — facing +y, a round front,
 * the tank drawn at the back — against each of the loop's four walls, so the turn is 0, a quarter both ways and
 * a half.
 *
 * `into` is how far a plan point stands off that wall's inner face into the room (the walls are 150 thick about
 * their centre lines, so the faces sit 75 inside the 4000 x 3000 loop).
 */
const TOILET = (() => {
	const preset = expectDefined(ASSET_PRESETS.find((one) => one.id === 'toilet'), 'the toilet preset');
	return expectOk(preset.build(defaultValues(preset)));
})();

const WALLS: readonly { readonly name: string; readonly pointer: Point; readonly into: (point: Point) => number; readonly room: Point }[] = [
	{ name: 'wall-a (y = 0)', pointer: { x: 2000, y: 100 }, into: (point) => point.y - 75, room: { x: 0, y: 1 } },
	{ name: 'wall-b (x = 4000)', pointer: { x: 3900, y: 1500 }, into: (point) => 3925 - point.x, room: { x: -1, y: 0 } },
	{ name: 'wall-c (y = 3000)', pointer: { x: 2000, y: 2900 }, into: (point) => 2925 - point.y, room: { x: 0, y: -1 } },
	{ name: 'wall-d (x = 0)', pointer: { x: 100, y: 1500 }, into: (point) => point.x - 75, room: { x: 1, y: 0 } },
];

const span = (points: readonly Point[], into: (point: Point) => number) => {
	const offsets = points.map((point) => into(point));
	return { near: Math.min(...offsets), far: Math.max(...offsets) };
};

describe('the toilet preset snapped to a wall', () => {
	it.each(WALLS)('sits its tank against $name and points its bowl into the room', ({ pointer, into, room }) => {
		const points = placementAt(pointer, TOILET, WALL_LOOP.walls, 50);
		const placed = placedOutline({ points }, TOILET);
		const [tank, bowl] = placed.details.map((detail) => span(detail.points, into));

		// The back of the footprint, and the tank's back edge with it, on the face — not behind it, not off it.
		expect(span(placed.footprint, into).near).toBeCloseTo(0, 6);
		expect(tank.near).toBeCloseTo(0, 6);
		// The tank's 200 mm, then the bowl beyond it: the bowl is the part the room sees.
		expect(tank.far).toBeCloseTo(200, 6);
		expect(bowl.near).toBeGreaterThan(tank.far);
		// Facing into the room: the facing point is 1000 mm along the room's normal from the anchor.
		expect((points[1].x - points[0].x) / 1000).toBeCloseTo(room.x, 9);
		expect((points[1].y - points[0].y) / 1000).toBeCloseTo(room.y, 9);
	});
});
