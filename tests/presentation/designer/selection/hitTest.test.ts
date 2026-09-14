import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { rect } from '../../../../src/domain/asset/presets/presetGeometry';
import { facingTip } from '../../../../src/presentation/designer/layers/anchorLayer';
import type { DesignerSelection, SelectionMode } from '../../../../src/presentation/designer/selection/designerSelection';
import { hitDesign, type DesignerHit } from '../../../../src/presentation/designer/selection/hitTest';
import { toiletShape } from '../../../helpers/assetShapes';

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
		// The bowl's rotate handle sits 18 px above its box, at (0, -143); this point is also inside the tank.
		['1: a handle drawn over a detail is the handle', TOILET, { x: 0, y: -150.5 }, BOWL, 'transform', { kind: 'handle', role: { kind: 'rotate' } }],
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
