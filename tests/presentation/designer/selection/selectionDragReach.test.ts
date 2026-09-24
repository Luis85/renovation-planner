import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../../src/domain/asset/presets/presetGeometry';
import type { OutlinePart } from '../../../../src/domain/asset/shapeEdits';
import { partMeasure, resizeToExtent, type PartBox } from '../../../../src/presentation/designer/selection/partExtent';
import { draggedShape } from '../../../../src/presentation/designer/selection/selectionDrag';
import { expectDefined, expectOk } from '../../../helpers/domain';

/**
 * AD18-R23 Task 11: a right-side drag inward past what a curved part's kept bulges can reach lands the NEAREST
 * reachable edge, and moving the pointer further in does not throw that edge back out (beyond the 1e-6 a
 * reachable edge lands within) — through the drag (`draggedShape`) and the typed Width it matches
 * (`resizeToExtent`), since both solve through `solveScale`.
 *
 * Each part at its preset's defaults: the oval table's clearance is a stadium 3000 wide whose ends reach 2200
 * whatever their spacing, so from a left side at -1500 no edge lands left of 700; the round table's is a circle of
 * diameter 2100 whose four arcs reach (sqrt 2 - 1) / 2 of it, 434.92, so from -1050 none lands left of -615.08; the
 * vanity's basin is a stadium 360 wide whose ends reach 270, so from -180 none lands left of 90.
 */
const REACH_MM = 0.01;
const FREE = { shift: false, snapRotation: (radians: number) => radians };

function preset(id: string): AssetShape {
	const found = expectDefined(ASSET_PRESETS.find((each) => each.id === id), id);
	return expectOk(found.build(defaultValues(found)));
}

const CLEARANCE: OutlinePart = { kind: 'clearance' };
const BASIN: OutlinePart = { kind: 'detail', id: 'detail-2' };
const PARTS = [
	{ name: 'oval-table clearance', shape: preset('oval-table'), part: CLEARANCE, handle: { x: 1500, y: 0 }, left: -1500, limit: 700 },
	{ name: 'round-table clearance', shape: preset('round-table'), part: CLEARANCE, handle: { x: 1050, y: 0 }, left: -1050, limit: -1050 + (2100 * (Math.SQRT2 - 1)) / 2 },
	{ name: 'vanity basin', shape: preset('vanity'), part: BASIN, handle: { x: 180, y: 36 }, left: -180, limit: 90 },
] as const;
const [OVAL] = PARTS;

const box = (shape: AssetShape, part: OutlinePart): PartBox => expectDefined(partMeasure(shape, part), 'part');

/** Where the right edge and the left side land when the right-middle handle (3) is dragged from `handle` to `x`. */
function dragRight({ shape, part, handle }: (typeof PARTS)[number], x: number) {
	const to: Point = { x, y: handle.y };
	const landed = box(expectOk(draggedShape({ shape, selection: part, role: { kind: 'box', index: 3 }, from: handle }, to, FREE)), part);
	return { right: landed.centre.x + landed.width / 2, left: landed.centre.x - landed.width / 2, width: landed.width };
}

describe('a right-side drag past a curved part\'s reach', () => {
	it.each([700.5, 700, 699.5, 650, 0, -1400])('lands the oval clearance\'s nearest edge for pointer x %d (Task 5 review, I1)', (x) => {
		// Before: 700.50, 1286.67, 773.32, 771.67, 750.00, 703.33.
		const landed = dragRight(OVAL, x);
		const nearest = Math.max(x, OVAL.limit);
		expect(landed.right).toBeGreaterThanOrEqual(nearest - 1e-6);
		expect(landed.right).toBeLessThanOrEqual(nearest + REACH_MM);
		expect(landed.left).toBeCloseTo(OVAL.left, 6);
		expect(landed.width).toBeCloseTo(box(expectOk(resizeToExtent(OVAL.shape, CLEARANCE, 'width', x - OVAL.left)), CLEARANCE).width, 9);
	});

	it.each(PARTS)('lands the $name nearest the pointer and never further out as it moves in', (subject) => {
		let outer = Number.POSITIVE_INFINITY;
		// Short of the fixed side: a pointer past it is refused as a mirror, as it always was.
		for (let x = subject.limit + 40; x > Math.max(subject.limit - 400, subject.left); x -= 0.5) {
			const landed = dragRight(subject, x);
			const nearest = Math.max(x, subject.limit);
			expect(landed.right, `pointer ${x}`).toBeGreaterThanOrEqual(nearest - 1e-6);
			expect(landed.right, `pointer ${x}`).toBeLessThanOrEqual(nearest + REACH_MM);
			// A reachable edge sits within TOLERANCE_MM (1e-6) of its own pointer, so neighbours may cross by twice that.
			expect(landed.right, `pointer ${x}`).toBeLessThanOrEqual(outer + 2e-6);
			expect(landed.left, `pointer ${x}`).toBeCloseTo(subject.left, 6);
			outer = landed.right;
		}
	});
});
