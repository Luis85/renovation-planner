import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import { expectOk } from '../../../helpers/domain';
import { WALL_LOOP } from '../../../helpers/structure';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { placementAt } from '../../../../src/presentation/editor/elements/assetPlacementDraft';

const rounded = (points: readonly Point[]) => points.map(p => ({ x: Math.round(p.x * 1e6) / 1e6 + 0, y: Math.round(p.y * 1e6) / 1e6 + 0 }));
const shape = expectOk(shapeFromDimensions(800, 600)); // facing +x, anchor centred: 400 mm behind the anchor

describe('placementAt', () => {
	it('places freely with the asset\'s own facing away from walls or with snapping off', () => {
		expect(rounded(placementAt({ x: 2000, y: 1500 }, shape, WALL_LOOP.walls, 50))).toEqual([{ x: 2000, y: 1500 }, { x: 3000, y: 1500 }]);
		expect(rounded(placementAt({ x: 2000, y: 100 }, shape, WALL_LOOP.walls, null))).toEqual([{ x: 2000, y: 100 }, { x: 3000, y: 100 }]);
	});
	it('puts the back edge on the wall face on the pointer\'s side, facing into the room', () => {
		// wall-a runs along y = 0, 150 thick: its inner face is y = 75.
		expect(rounded(placementAt({ x: 2000, y: 100 }, shape, WALL_LOOP.walls, 50))).toEqual([{ x: 2000, y: 475 }, { x: 2000, y: 1475 }]);
		expect(rounded(placementAt({ x: 2000, y: -100 }, shape, WALL_LOOP.walls, 50))).toEqual([{ x: 2000, y: -475 }, { x: 2000, y: -1475 }]);
	});
});
