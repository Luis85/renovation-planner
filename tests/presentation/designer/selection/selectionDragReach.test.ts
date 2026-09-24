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

/** Pointer x from `from` down to just above `to`, `step` millimetres apart. */
function inward(from: number, to: number, step = 0.5): number[] {
	return Array.from({ length: Math.ceil((from - to) / step) }, (_, index) => from - index * step).filter((x) => x > to);
}

/** The last millimetre before a fixed side at `side`, where the first factor itself can be refused (review I1). */
const nearSide = (side: number): number[] => [1, 0.1, 0.01, 0.001].map((gap) => side + gap);

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
		// Short of the fixed side, and into the last hundredth of a millimetre before it: a pointer past it is refused
		// as a mirror, as it always was.
		for (const x of [...inward(subject.limit + 40, Math.max(subject.limit - 400, subject.left)), ...nearSide(subject.left)]) {
			const landed = dragRight(subject, x);
			const nearest = Math.max(x, subject.limit);
			expect(landed.right, `pointer ${x}`).toBeGreaterThanOrEqual(nearest - 1e-6);
			// A pointer the part reaches with room to spare lands within TOLERANCE_MM of it, not merely REACH_MM.
			expect(landed.right, `pointer ${x}`).toBeLessThanOrEqual(nearest + (x >= subject.limit + REACH_MM ? 1e-6 : REACH_MM));
			// A reachable edge sits within TOLERANCE_MM (1e-6) of its own pointer, so neighbours may cross by twice that.
			expect(landed.right, `pointer ${x}`).toBeLessThanOrEqual(outer + 2e-6);
			expect(landed.left, `pointer ${x}`).toBeCloseTo(subject.left, 6);
			outer = landed.right;
		}
	});

	it('holds the opposite corner from a corner drag on the oval clearance, to the last hundredth before it', () => {
		// Handle 4, the bottom-right corner, along the bottom edge. The third pass (width again) starts from the width
		// the first left at its floor, and its own floor factor makes the arcs meet (`asset.invalid-clearance`), so it
		// bisects upward — and within 0.01 mm of the left side its FIRST factor is refused as well. Before fix round 1
		// that refusal fell back to the plain scale: pointer -1499.99 threw the left side from -1500 to -2600.
		const from = { x: 1500, y: 1100 };
		let outer = Number.POSITIVE_INFINITY;
		// Five millimetres apart: three solves a move, the third a bisection, is the costliest drag there is.
		for (const x of [...inward(740, -1499, 5), ...nearSide(OVAL.left)]) {
			const landed = box(expectOk(draggedShape({ shape: OVAL.shape, selection: CLEARANCE, role: { kind: 'box', index: 4 }, from }, { x, y: from.y }, FREE)), CLEARANCE);
			const [left, right] = [landed.centre.x - landed.width / 2, landed.centre.x + landed.width / 2];
			const nearest = Math.max(x, OVAL.limit);
			expect(left, `pointer ${x}`).toBeCloseTo(OVAL.left, 6);
			expect(landed.centre.y - landed.depth / 2, `pointer ${x}`).toBeCloseTo(-1100, 6);
			expect(landed.depth, `pointer ${x}`).toBeCloseTo(2200, 6);
			expect(right, `pointer ${x}`).toBeGreaterThanOrEqual(nearest - 1e-6);
			expect(right, `pointer ${x}`).toBeLessThanOrEqual(nearest + (x >= OVAL.limit + REACH_MM ? 1e-6 : REACH_MM));
			expect(right, `pointer ${x}`).toBeLessThanOrEqual(outer + 2e-6);
			outer = right;
		}
	});

	it.each([
		// The reviewer's move: the corner's depth pass lands its floor, and holding that outline was refused.
		[1.3, 0.2],
		// Stretched twice as wide at that floor, the third (width) pass's own first factor is refused as well.
		[2, 0.3],
		// Its held retry meets a factor `resizeBox` itself refuses, before any hold is tried.
		[1.7, 1e-4],
	])('holds the corner of the shrub\'s detail-1 stretched %d wide and flattened to %d deep', (u, v) => {
		// Before fix round 2 both fell back to the plain scale, which threw the held corner 82 to 126 mm.
		const shrub = preset('shrub');
		const part: OutlinePart = { kind: 'detail', id: 'detail-1' };
		const start = box(shrub, part);
		const heldCorner = { x: start.centre.x + start.width / 2, y: start.centre.y + start.depth / 2 };
		const from = { x: heldCorner.x - start.width, y: heldCorner.y - start.depth };
		const to = { x: heldCorner.x - start.width * u, y: heldCorner.y - start.depth * v };
		const landed = box(expectOk(draggedShape({ shape: shrub, selection: part, role: { kind: 'box', index: 0 }, from }, to, FREE)), part);
		expect(landed.centre.x + landed.width / 2).toBeCloseTo(heldCorner.x, 6);
		expect(landed.centre.y + landed.depth / 2).toBeCloseTo(heldCorner.y, 6);
		expect(landed.width).toBeLessThanOrEqual(start.width * u + 1e-6);
	});

	it('holds the corner of the washbasin\'s tap hole dragged to a millionth of its width', () => {
		// A circle 40 across: its width pass lands 0.0083 mm wide, where `REACH_MM / start` exceeds one and the depth-
		// then-width third pass once stopped on the unscaled start it never applied — a refusal, and the plain scale
		// moved the held side 0.004 mm. Found by the fix-round-2 grid, and on 0dccd1c56 as well.
		const basin = preset('washbasin');
		const part: OutlinePart = { kind: 'detail', id: 'detail-2' };
		const start = box(basin, part);
		const heldCorner = { x: start.centre.x + start.width / 2, y: start.centre.y + start.depth / 2 };
		const from = { x: heldCorner.x - start.width, y: heldCorner.y - start.depth };
		const to = { x: heldCorner.x - start.width * 1e-6, y: heldCorner.y - start.depth * 1e-3 };
		const landed = box(expectOk(draggedShape({ shape: basin, selection: part, role: { kind: 'box', index: 0 }, from }, to, FREE)), part);
		expect(landed.centre.x + landed.width / 2).toBeCloseTo(heldCorner.x, 6);
		expect(landed.centre.y + landed.depth / 2).toBeCloseTo(heldCorner.y, 6);
		expect(landed.width).toBeLessThanOrEqual(REACH_MM);
	});
});

