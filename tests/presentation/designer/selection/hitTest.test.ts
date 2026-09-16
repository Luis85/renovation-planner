import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { rect } from '../../../../src/domain/asset/presets/presetGeometry';
import { facingTip } from '../../../../src/presentation/designer/layers/anchorLayer';
import type { DesignerSelection, SelectionMode } from '../../../../src/presentation/designer/selection/designerSelection';
import { hitDesign, type DesignerHit } from '../../../../src/presentation/designer/selection/hitTest';
import { shapeWithOpenGraphic, toiletShape } from '../../../helpers/assetShapes';

/**
 * Spec 2026-09-13 Decision 10's hit order, as a table over one toilet at one millimetre per screen
 * pixel, so the grab radius is 8 mm. The toilet: footprint x -190..190 with its semicircular front
 * reaching y 350; clearance x -390..390 by y -350..950; tank (`detail-1`) x -190..190 by y -350..-150;
 * bowl (`detail-2`) x -152..152 by y -125..325 around the anchor at the origin; facing +y, so the
 * facing tip is at (0, 44).
 */
const TOILET = toiletShape();
const SEATED: AssetShape = {
	...TOILET,
	details: [...TOILET.details, { id: 'detail-3', name: 'seat', outline: rect(100, 100, 0, 250), line: 'solid', pending: false }],
};
const NO_CLEARANCE: AssetShape = { ...TOILET, clearance: null, clearancePending: false };

const FOOTPRINT: DesignerSelection = { kind: 'footprint' };
const CLEARANCE: DesignerSelection = { kind: 'clearance' };
const TANK: DesignerSelection = { kind: 'detail', id: 'detail-1' };
const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };
const ANCHOR: DesignerSelection = { kind: 'anchor' };
const FACING: DesignerSelection = { kind: 'facing' };

const part = (selection: DesignerSelection): DesignerHit => ({ kind: 'part', selection });

describe('hitDesign', () => {
	it.each<readonly [string, AssetShape, Point, DesignerSelection | null, SelectionMode, DesignerHit]>([
		['1: a box handle of the selection, outside every part', TOILET, { x: 190, y: 352 }, FOOTPRINT, 'transform', { kind: 'handle', role: { kind: 'box', index: 4 } }],
		// The bowl's rotate handle sits 30 px above its box, at (0, -155); this point is also inside the tank.
		['1: a handle drawn over a detail is the handle', TOILET, { x: 0, y: -160.5 }, BOWL, 'transform', { kind: 'handle', role: { kind: 'rotate' } }],
		['1: a vertex handle in Edit points', TOILET, { x: 192, y: -148 }, TANK, 'points', { kind: 'handle', role: { kind: 'vertex', index: 2 } }],
		['1: an edge handle in Bend edges', TOILET, { x: 193, y: -95 }, FOOTPRINT, 'bend', { kind: 'handle', role: { kind: 'edge', index: 1 } }],
		['2: the anchor, over the bowl it sits in', TOILET, { x: 3, y: 0 }, null, 'transform', part(ANCHOR)],
		['2: the selected anchor, which offers no handles', TOILET, { x: 0, y: 0 }, ANCHOR, 'transform', part(ANCHOR)],
		['2: the facing tip', TOILET, { x: 0, y: 47 }, null, 'transform', part(FACING)],
		['3: a detail over the footprint is the detail', TOILET, { x: 0, y: 250 }, null, 'transform', part(BOWL)],
		['3: the topmost of two overlapping details', SEATED, { x: 0, y: 250 }, null, 'transform', part({ kind: 'detail', id: 'detail-3' })],
		['3: the tank', TOILET, { x: 0, y: -300 }, FOOTPRINT, 'transform', part(TANK)],
		['4: inside both footprint and clearance is the footprint', TOILET, { x: 150, y: 0 }, null, 'transform', part(FOOTPRINT)],
		['5: the clearance band, outside the footprint', TOILET, { x: 300, y: 0 }, null, 'transform', part(CLEARANCE)],
		['6: nothing', TOILET, { x: 1000, y: 0 }, null, 'transform', null],
		['6: outside a footprint that has no clearance', NO_CLEARANCE, { x: 300, y: 0 }, null, 'transform', null],
	])('%s', (_label, shape, point, selection, mode, expected) => {
		expect(hitDesign(shape, point, { selection, mode, worldPerPixel: 1 })).toEqual(expected);
	});

	it('scales the grab radius with the camera: 8 screen pixels at 10 mm per pixel reach 80 mm', () => {
		expect(hitDesign(TOILET, { x: 75, y: 0 }, { selection: null, mode: 'transform', worldPerPixel: 10 })).toEqual(part(ANCHOR));
	});

	it('finds the facing tip where the arrow draws it', () => {
		expect(facingTip(TOILET, 2)).toEqual({ x: expect.closeTo(0, 9), y: expect.closeTo(88, 9) });
	});
});

/**
 * AD05: an open graphic has no interior, so it is hit by its STROKE. Asking `curvedContains` of one
 * answers about a ring the object has not got — nothing selectable where the user clicked, and the
 * occasional hit inside an implied area that is not drawn.
 *
 * `shapeWithOpenGraphic` puts a two-segment line at (-300,-200)→(0,-200)→(0,100), well clear of
 * `editableShape`'s other parts, at one millimetre per screen pixel — an 8 mm grab radius.
 */
describe('hitting an open graphic', () => {
	const shape = shapeWithOpenGraphic();
	const hit = (point: Point): DesignerHit => hitDesign(shape, point, { selection: null, mode: 'transform', worldPerPixel: 1 });

	it('takes a press on the line itself', () => {
		expect(hit({ x: -150, y: -200 })).toEqual({ kind: 'part', selection: { kind: 'detail', id: 'detail-3' } });
	});

	it('takes a press just beside the line, within the grab radius', () => {
		expect(hit({ x: -150, y: -195 })).toEqual({ kind: 'part', selection: { kind: 'detail', id: 'detail-3' } });
	});

	/** On the second segment and clear of the anchor at the origin, which is asked before any graphic. */
	it('takes a press on the far segment too, not only the first', () => {
		expect(hit({ x: 0, y: 80 })).toEqual({ kind: 'part', selection: { kind: 'detail', id: 'detail-3' } });
	});

	/**
	 * The point that decides it. (-100, -150) is INSIDE the triangle the three vertices would
	 * enclose if anything closed them — checked by hand: the hypotenuse runs (-300,-200)→(0,100),
	 * which is at y = 0 where x = -100, and the interior is below it — and it is 50 mm, 100 mm and
	 * 106 mm from the three segments, so far outside the 8 mm grab radius. A closed reading selects
	 * the graphic here; the open reading must not.
	 *
	 * Its first version used (-250, -100), which is OUTSIDE that triangle, so it passed under both
	 * readings and proved nothing. The revert check is what caught it.
	 */
	it('does not take a press inside the area its points would enclose if it closed', () => {
		expect(hit({ x: -100, y: -150 })).not.toEqual({ kind: 'part', selection: { kind: 'detail', id: 'detail-3' } });
	});
});
