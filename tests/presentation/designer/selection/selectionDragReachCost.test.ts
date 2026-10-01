import { describe, expect, it, vi } from 'vitest';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../../src/domain/asset/presets/presetGeometry';
import type * as ScaleSolve from '../../../../src/domain/asset/scaleSolve';
import type { ScaleAttempt } from '../../../../src/domain/asset/scaleSolve';
import { partMeasure, type PartBox } from '../../../../src/presentation/designer/selection/partExtent';
import { draggedShape } from '../../../../src/presentation/designer/selection/selectionDrag';
import { expectDefined, expectOk } from '../../../helpers/domain';

/**
 * AD18-R23 Task 11, fix round 1: what one pointer move costs on the drag that costs the most — a corner drag of the
 * oval table's clearance past its reach — counted as `apply` calls per `solveScale` run, since `selectionDrag.ts`
 * states that bound. The solver is wrapped, not replaced: every run below is the shipped one.
 *
 * Its third pass (width again) bisects: it starts from the width pass 1 left at its floor, with 0.0027 mm of
 * straight run, and that pass's own floor factor makes the arcs meet. Measured over every curved preset part's
 * drags, that pass is the costliest run there is — up to 21 calls — and this drag costs up to 23 a move. The
 * costliest MOVE on `fittedResize`'s grid is this clearance's too: 24, from the top-left corner (runs of 2, 1 and 21).
 */
const runs = vi.hoisted(() => [] as number[]);
vi.mock('../../../../src/domain/asset/scaleSolve', async (original) => {
	const real = await original<typeof ScaleSolve>();
	return {
		solveScale: <T>(attempt: ScaleAttempt<T>) => {
			let calls = 0;
			const solved = real.solveScale({ ...attempt, apply: (factor) => ((calls += 1), attempt.apply(factor)) });
			runs.push(calls);
			return solved;
		},
	};
});

const CLEARANCE = { kind: 'clearance' } as const;
const FREE = { shift: false, snapRotation: (radians: number) => radians };

function preset(id: string): AssetShape {
	const found = expectDefined(ASSET_PRESETS.find((each) => each.id === id), id);
	return expectOk(found.build(defaultValues(found)));
}

describe('a corner drag past the oval clearance\'s reach', () => {
	it('bisects on its third pass, within the bound selectionDrag.ts states', () => {
		const oval = preset('oval-table');
		const from = { x: 1500, y: 1100 };
		let worst = 0;
		for (let x = 700; x > -1500; x -= 50) {
			runs.length = 0;
			const landed = expectDefined(partMeasure(expectOk(draggedShape({ shape: oval, selection: CLEARANCE, role: { kind: 'box', index: 4 }, from }, { x, y: from.y }, FREE)), CLEARANCE), 'clearance') as PartBox;
			// Width, depth, width: the third is the bisection, and it still lands the nearest edge.
			expect(runs, `pointer ${x}`).toHaveLength(3);
			expect(runs[2], `pointer ${x}`).toBeGreaterThan(10);
			expect(landed.centre.x + landed.width / 2, `pointer ${x}`).toBeCloseTo(700, 5);
			worst = Math.max(worst, runs[0] + runs[1] + runs[2]);
		}
		expect(worst).toBeLessThanOrEqual(23);
	});
});
