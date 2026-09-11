import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { rotate } from '../../../src/core/geometry/operations';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { backDepth, membershipProbe, placedOutline, placementHeading, placementPoints } from '../../../src/domain/spatial/assetPlacement';

const rounded = (points: readonly Point[]): Point[] => points.map(p => ({ x: Math.round(p.x * 1e6) / 1e6 + 0, y: Math.round(p.y * 1e6) / 1e6 + 0 }));
const rect = (w: number, d: number): Point[] => [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }];
function shape(patch: Partial<AssetShape> = {}): AssetShape {
	return { footprint: { points: rect(1000, 600) }, footprintOrigin: 'typed', footprintPending: false, clearancePending: false, anchorPending: false, clearance: null, anchor: { x: 0, y: 0 }, facing: 0, ...patch };
}

describe('asset placement geometry', () => {
	it('translates a centred, unrotated footprint onto the anchor', () => {
		const element = { points: placementPoints({ x: 1000, y: 2000 }, 0) };
		expect(rounded(placedOutline(element, shape()).footprint)).toEqual([{ x: 500, y: 1700 }, { x: 1500, y: 1700 }, { x: 1500, y: 2300 }, { x: 500, y: 2300 }]);
		expect(placedOutline(element, shape()).clearance).toBeNull();
	});

	it('turns by the placement heading minus the asset facing, about an off-centre anchor', () => {
		// The asset faces +y and is anchored on its back edge; placed facing +x at (1000, 1000).
		const element = { points: placementPoints({ x: 1000, y: 1000 }, 0) };
		const footprint = rounded(placedOutline(element, shape({ anchor: { x: 0, y: -300 }, facing: Math.PI / 2 })).footprint);
		expect(footprint).toEqual([{ x: 1000, y: 1500 }, { x: 1000, y: 500 }, { x: 1600, y: 500 }, { x: 1600, y: 1500 }]);
	});

	it('places the clearance with the same transform as the footprint', () => {
		const element = { points: placementPoints({ x: 0, y: 0 }, Math.PI) };
		const outline = placedOutline(element, shape({ clearance: { points: rect(1200, 800) } }));
		expect(rounded(outline.clearance ?? [])).toEqual(rounded(rotate({ points: rect(1200, 800) }, Math.PI, { x: 0, y: 0 }).points));
	});

	it('derives the same footprint from rotated stored points as from rotating the derived footprint', () => {
		const element = { points: placementPoints({ x: 700, y: -300 }, 0.4) }, pivot = { x: 2500, y: 900 }, angle = 1.1;
		const rotatedPoints = { points: rotate({ points: element.points }, angle, pivot).points };
		expect(rounded(placedOutline(rotatedPoints, shape({ anchor: { x: 100, y: 50 }, facing: 0.3 })).footprint))
			.toEqual(rounded(rotate({ points: placedOutline(element, shape({ anchor: { x: 100, y: 50 }, facing: 0.3 })).footprint }, angle, pivot).points));
	});

	it('reads the heading from the two stored points and puts the facing point 1000 mm out', () => {
		const [anchor, facing] = placementPoints({ x: 10, y: 20 }, 0);
		expect(anchor).toEqual({ x: 10, y: 20 });
		expect(facing).toEqual({ x: 1010, y: 20 });
		expect(placementHeading({ points: [{ x: 0, y: 0 }, { x: 0, y: 5 }] })).toBeCloseTo(Math.PI / 2);
	});

	it('probes 10 mm in front of the anchor', () => {
		expect(rounded([membershipProbe({ points: [{ x: 0, y: 0 }, { x: 0, y: 1000 }] })])).toEqual([{ x: 0, y: 10 }]);
	});

	it('measures how far the footprint reaches behind the anchor, never negative', () => {
		expect(backDepth(shape())).toBe(500);
		expect(backDepth(shape({ facing: Math.PI / 2 }))).toBeCloseTo(300);
		expect(backDepth(shape({ anchor: { x: -500, y: 0 } }))).toBe(0);
		expect(backDepth(shape({ anchor: { x: -800, y: 0 } }))).toBe(0);
	});
});
