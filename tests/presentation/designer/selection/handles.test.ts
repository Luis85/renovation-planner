import { describe, expect, it } from 'vitest';
import type { DesignerSelection } from '../../../../src/presentation/designer/selection/designerSelection';
import { selectionHandles } from '../../../../src/presentation/designer/selection/handles';
import { editableShape, toiletShape } from '../../../helpers/assetShapes';

/**
 * Spec 2026-09-13 Decision 10: where a selection's handles sit in each mode. `editableShape`'s
 * `detail-1` spans x -400..0 by y -100..100, and `detail-2` is a circle of radius 100 on (250, 0).
 */
const TOP: DesignerSelection = { kind: 'detail', id: 'detail-1' };
const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };
const HALF_DIAGONAL = 50 * Math.SQRT2;

describe('selectionHandles', () => {
	it.each<readonly [string, DesignerSelection | null]>([
		['no selection', null],
		['the anchor', { kind: 'anchor' }],
		['the facing', { kind: 'facing' }],
		['an unknown detail', { kind: 'detail', id: 'detail-9' }],
	])('offers nothing for %s', (_label, selection) => {
		expect(selectionHandles(editableShape(), selection, 'transform', 1)).toEqual([]);
	});

	it('offers nothing for a clearance the shape has not got', () => {
		expect(selectionHandles(editableShape({ clearance: null }), { kind: 'clearance' }, 'points', 1)).toEqual([]);
	});

	it('transform: eight box handles clockwise from the top-left, then the rotate handle above the top centre', () => {
		expect(selectionHandles(editableShape(), TOP, 'transform', 2)).toEqual([
			{ role: { kind: 'box', index: 0 }, at: { x: -400, y: -100 } },
			{ role: { kind: 'box', index: 1 }, at: { x: -200, y: -100 } },
			{ role: { kind: 'box', index: 2 }, at: { x: 0, y: -100 } },
			{ role: { kind: 'box', index: 3 }, at: { x: 0, y: 0 } },
			{ role: { kind: 'box', index: 4 }, at: { x: 0, y: 100 } },
			{ role: { kind: 'box', index: 5 }, at: { x: -200, y: 100 } },
			{ role: { kind: 'box', index: 6 }, at: { x: -400, y: 100 } },
			{ role: { kind: 'box', index: 7 }, at: { x: -400, y: 0 } },
			// 30 screen pixels above the box at two millimetres per pixel.
			{ role: { kind: 'rotate' }, at: { x: -200, y: -160 } },
		]);
	});

	it('transform: the box is the curve-aware extent, so the toilet’s front arc is inside it', () => {
		const handles = selectionHandles(toiletShape(), { kind: 'footprint' }, 'transform', 1);
		expect(handles[4]).toEqual({ role: { kind: 'box', index: 4 }, at: { x: expect.closeTo(190, 9), y: expect.closeTo(350, 9) } });
	});

	it('points: one handle per vertex, at the vertex', () => {
		const shape = editableShape();
		expect(selectionHandles(shape, TOP, 'points', 1)).toEqual(
			shape.details[0].outline.points.map((at, index) => ({ role: { kind: 'vertex', index }, at })),
		);
	});

	it('bend: one handle per edge at its midpoint, on a straight outline', () => {
		expect(selectionHandles(editableShape(), TOP, 'bend', 1).map((handle) => handle.at)).toEqual([
			{ x: -200, y: -100 },
			{ x: 0, y: 0 },
			{ x: -200, y: 100 },
			{ x: -400, y: 0 },
		]);
	});

	it('bend: an edge that curves has its handle on the arc, not on the chord', () => {
		const handles = selectionHandles(editableShape(), BOWL, 'bend', 1);
		expect(handles.map((handle) => handle.role)).toEqual([0, 1, 2, 3].map((index) => ({ kind: 'edge', index })));
		expect(handles.map((handle) => handle.at)).toEqual([
			{ x: expect.closeTo(250 + HALF_DIAGONAL, 9), y: expect.closeTo(-HALF_DIAGONAL, 9) },
			{ x: expect.closeTo(250 + HALF_DIAGONAL, 9), y: expect.closeTo(HALF_DIAGONAL, 9) },
			{ x: expect.closeTo(250 - HALF_DIAGONAL, 9), y: expect.closeTo(HALF_DIAGONAL, 9) },
			{ x: expect.closeTo(250 - HALF_DIAGONAL, 9), y: expect.closeTo(-HALF_DIAGONAL, 9) },
		]);
	});
});
