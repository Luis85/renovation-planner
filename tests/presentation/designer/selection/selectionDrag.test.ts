import { describe, expect, it, vi } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import type { DesignerSelection } from '../../../../src/presentation/designer/selection/designerSelection';
import { draggedShape, type DragOptions, type DragStart } from '../../../../src/presentation/designer/selection/selectionDrag';
import { editableShape, QUARTER } from '../../../helpers/assetShapes';
import { expectErr, expectOk } from '../../../helpers/domain';

/**
 * Spec 2026-09-13 Decision 10 and Amendment 1: what a drag would write, per role. `editableShape`'s
 * `detail-1` ("top") spans x -400..0 by y -100..100 — box handles TL (-400,-100), T (-200,-100),
 * TR (0,-100), R (0,0), BR (0,100), B (-200,100), BL (-400,100), L (-400,0) — and `detail-2`
 * ("bowl") is a circle of radius 100 on (250, 0).
 */
const SHAPE = editableShape();
const FOOTPRINT: DesignerSelection = { kind: 'footprint' };
const TOP: DesignerSelection = { kind: 'detail', id: 'detail-1' };
const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };
const STEP = Math.PI / 12;
const snapToStep = (radians: number): number => Math.round(radians / STEP) * STEP;
const FREE: DragOptions = { shift: false, snapRotation: snapToStep };
const SHIFT: DragOptions = { shift: true, snapRotation: snapToStep };
const ORIGIN: Point = { x: 0, y: 0 };

const near = (pairs: readonly (readonly [number, number])[]) =>
	pairs.map(([x, y]) => ({ x: expect.closeTo(x, 9), y: expect.closeTo(y, 9) }));

function drag(start: Omit<DragStart, 'shape'>, to: Point, options: DragOptions = FREE) {
	return draggedShape({ shape: SHAPE, ...start }, to, options);
}

describe('a body drag', () => {
	it('moves the footprint by the pointer’s travel', () => {
		const moved = expectOk(drag({ selection: FOOTPRINT, role: { kind: 'body' }, from: ORIGIN }, { x: 30, y: -40 }));
		expect(moved.footprint.points).toEqual([{ x: -470, y: -340 }, { x: 530, y: -340 }, { x: 530, y: 260 }, { x: -470, y: 260 }]);
	});

	it('moves a detail, bulges and all, and nothing else', () => {
		const moved = expectOk(drag({ selection: BOWL, role: { kind: 'body' }, from: { x: 250, y: 0 } }, { x: 260, y: 10 }));
		expect(moved.details[1].outline.points).toEqual(near([[260, -90], [360, 10], [260, 110], [160, 10]]));
		expect(moved.details[1].outline.bulges).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
		expect([moved.details[0], moved.footprint]).toEqual([SHAPE.details[0], SHAPE.footprint]);
	});
});

describe('a box handle drag', () => {
	it('moves both axes from a corner, holding the opposite corner', () => {
		const resized = expectOk(drag({ selection: TOP, role: { kind: 'box', index: 4 }, from: { x: 0, y: 100 } }, { x: 200, y: 300 }));
		expect(resized.details[0].outline.points).toEqual([{ x: -400, y: -100 }, { x: 200, y: -100 }, { x: 200, y: 300 }, { x: -400, y: 300 }]);
	});

	it('moves one axis from a side, holding the opposite side', () => {
		const resized = expectOk(drag({ selection: TOP, role: { kind: 'box', index: 3 }, from: ORIGIN }, { x: 100, y: 55 }));
		expect(resized.details[0].outline.points).toEqual([{ x: -400, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -400, y: 100 }]);
	});

	it('keeps proportions from a corner with Shift, taking the factor that strays further from 1', () => {
		// x by 1.5, y by 1.25: 1.5 wins.
		const resized = expectOk(drag({ selection: TOP, role: { kind: 'box', index: 4 }, from: { x: 0, y: 100 } }, { x: 200, y: 150 }, SHIFT));
		expect(resized.details[0].outline.points).toEqual([{ x: -400, y: -100 }, { x: 200, y: -100 }, { x: 200, y: 200 }, { x: -400, y: 200 }]);
	});

	it('keeps proportions from a side with Shift, scaling the other axis about the fixed side’s midpoint', () => {
		// The bottom handle doubles the depth, so the width doubles about x = -200.
		const resized = expectOk(drag({ selection: TOP, role: { kind: 'box', index: 5 }, from: { x: -200, y: 100 } }, { x: 0, y: 300 }, SHIFT));
		expect(resized.details[0].outline.points).toEqual([{ x: -600, y: -100 }, { x: 200, y: -100 }, { x: 200, y: 300 }, { x: -600, y: 300 }]);
	});

	it.each([
		['onto', -400],
		['past', -450],
	])('refuses a right handle dragged %s the left edge', (_label, x) => {
		const refused = drag({ selection: TOP, role: { kind: 'box', index: 3 }, from: ORIGIN }, { x, y: 0 });
		expect(expectErr(refused).code).toBe('asset.invalid-scale');
	});

	it('answers part-not-found for a selection the design no longer has', () => {
		const stale = drag({ selection: { kind: 'detail', id: 'detail-9' }, role: { kind: 'box', index: 0 }, from: ORIGIN }, ORIGIN);
		expect(expectErr(stale).code).toBe('asset.part-not-found');
	});
});

describe('a rotate handle drag', () => {
	it('turns the outline about its box centre by the pointer’s swept angle, keeping bulges', () => {
		const turned = expectOk(drag({ selection: BOWL, role: { kind: 'rotate' }, from: { x: 350, y: 0 } }, { x: 250, y: 100 }));
		expect(turned.details[1].outline.points).toEqual(near([[350, 0], [250, 100], [150, 0], [250, -100]]));
		expect(turned.details[1].outline.bulges).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
	});

	it('snaps the swept angle with Shift', () => {
		const snapRotation = vi.fn<(radians: number) => number>(snapToStep);
		const raw = (50 * Math.PI) / 180;
		const to = { x: -200 + 100 * Math.cos(raw), y: 100 * Math.sin(raw) };
		const turned = expectOk(drag({ selection: TOP, role: { kind: 'rotate' }, from: ORIGIN }, to, { shift: true, snapRotation }));
		expect(snapRotation).toHaveBeenCalledWith(expect.closeTo(raw, 9));
		// 50 degrees snaps to 45, about the top's centre (-200, 0).
		const half = Math.SQRT1_2;
		expect(turned.details[0].outline.points).toEqual(
			near([
				[-200 - 100 * half, -300 * half],
				[-200 + 300 * half, 100 * half],
				[-200 + 100 * half, 300 * half],
				[-200 - 300 * half, -100 * half],
			]),
		);
	});
});

describe('the other drags', () => {
	it('moves a vertex to the pointer', () => {
		const moved = expectOk(drag({ selection: TOP, role: { kind: 'vertex', index: 2 }, from: ORIGIN }, { x: 50, y: 150 }));
		expect(moved.details[0].outline.points).toEqual([{ x: -400, y: -100 }, { x: 0, y: -100 }, { x: 50, y: 150 }, { x: -400, y: 100 }]);
	});

	it('moves the anchor by the pointer’s travel', () => {
		const moved = expectOk(drag({ selection: { kind: 'anchor' }, role: { kind: 'body' }, from: { x: 5, y: 5 } }, { x: 20, y: 0 }));
		expect(moved.anchor).toEqual({ x: 15, y: -5 });
	});

	it('turns the facing to the pointer’s bearing from the anchor', () => {
		const turned = expectOk(drag({ selection: { kind: 'facing' }, role: { kind: 'body' }, from: ORIGIN }, { x: 0, y: 100 }));
		expect(turned.facing).toBeCloseTo(Math.PI / 2, 12);
	});

	it('snaps the facing’s bearing with Shift', () => {
		// atan2(90, 100) is about 42 degrees, which snaps to 45.
		const turned = expectOk(drag({ selection: { kind: 'facing' }, role: { kind: 'body' }, from: ORIGIN }, { x: 100, y: 90 }, SHIFT));
		expect(turned.facing).toBeCloseTo(Math.PI / 4, 12);
	});
});
