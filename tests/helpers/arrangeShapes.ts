/**
 * The fixtures AD10's composition suites act on: several graphics at round coordinates, so an
 * alignment, a distribution or a repeat can be asserted as numbers rather than as "it moved".
 *
 * Built through `validateAssetShape` like every fixture in `assetShapes.ts`, so none of them can
 * stand in for a shape the domain would refuse — and so the open graphic's brand is minted by the
 * one constructor that may mint it.
 */
import { rotate } from '../../src/core/geometry/operations';
import type { AssetDetail, ClosedDetail } from '../../src/domain/asset/AssetDetail';
import { validateAssetShape, type AssetGroup, type AssetShape } from '../../src/domain/asset/AssetShape';
import { circle, rect } from '../../src/domain/asset/presets/presetGeometry';
import { openGraphic } from './assetShapes';
import { expectOk } from './domain';

/** A closed graphic with no curves, named by its id so a case can read the result without a lookup table. */
function boxGraphic(id: string, width: number, depth: number, cx: number, cy: number): ClosedDetail {
	return { id, name: id, outline: rect(width, depth, cx, cy), line: 'solid', pending: false };
}

/**
 * Three boxes at known extents and nothing else moving:
 *
 * | id | x | y |
 * |---|---|---|
 * | `detail-1` | -50 … 50 | -50 … 50 |
 * | `detail-2` | 200 … 400 | 70 … 130 |
 * | `detail-3` | 680 … 720 | -220 … -180 |
 *
 * So their shared box is x -50 … 720, y -220 … 130, and no two of them share an edge, a centre or a
 * size — which is what makes a wrong axis, a wrong edge or a wrong reference visible in one number.
 */
export function threeBoxes(overrides: Partial<AssetShape> = {}): AssetShape {
	return expectOk(
		validateAssetShape({
			footprint: rect(2000, 1000),
			footprintOrigin: 'typed',
			footprintPending: false,
			clearance: null,
			clearancePending: false,
			anchor: { x: 0, y: 0 },
			anchorPending: false,
			facing: 0,
			details: [
				boxGraphic('detail-1', 100, 100, 0, 0),
				boxGraphic('detail-2', 200, 60, 300, 100),
				boxGraphic('detail-3', 40, 40, 700, -200),
			],
			...overrides,
		}),
	);
}

/**
 * `threeBoxes` with two awkward participants appended, which is the point of it:
 *
 * - `detail-4` is a 100 × 100 square turned 45° about its own centre (300, 300). Its CORNERS are no
 *   longer axis aligned, so its box is the ~141 × 141 diamond's, and a case that measured points
 *   instead of extents reads it wrong.
 * - `detail-5` is an OPEN vertical line from (500, 0) to (500, 200): zero extent in x, no interior,
 *   and therefore the participant that proves these operations do not go through a closed-only path.
 */
export function awkwardParts(): AssetShape {
	const base = threeBoxes();
	const square = boxGraphic('detail-4', 100, 100, 300, 300);
	const turned: AssetDetail = { ...square, outline: rotate(square.outline, Math.PI / 4, { x: 300, y: 300 }) };
	const line = openGraphic('detail-5', [{ x: 500, y: 0 }, { x: 500, y: 200 }]);
	return expectOk(validateAssetShape({ ...base, details: [...base.details, turned, line] }));
}

/** `threeBoxes` with a CURVED participant: `detail-4` is a circle of diameter 200 centred on (1000, 0). */
export function withCurvedPart(): AssetShape {
	const base = threeBoxes();
	const disc: AssetDetail = { id: 'detail-4', name: 'disc', outline: circle(200, 1000, 0), line: 'solid', pending: false };
	return expectOk(validateAssetShape({ ...base, details: [...base.details, disc] }));
}

/** `threeBoxes` with `members` already in one group, so the group operations have a subject. */
export function grouped(members: readonly string[], overrides: Partial<AssetGroup> = {}): AssetShape {
	const base = threeBoxes();
	return expectOk(validateAssetShape({ ...base, groups: [{ id: 'group-1', members: [...members], ...overrides }] }));
}

/**
 * `threeBoxes` with `ids` still in BACKGROUND PIXELS — the input ruling AD10-R1 is about. A
 * selection holding one of these beside a measured graphic mixes two coordinate spaces; a selection
 * holding only these shares one, and is therefore an ordinary arrangement.
 */
export function withPending(ids: readonly string[]): AssetShape {
	const base = threeBoxes();
	return expectOk(
		validateAssetShape({
			...base,
			details: base.details.map((detail) => (ids.includes(detail.id) ? { ...detail, pending: true } : detail)),
		}),
	);
}

/** One graphic by id, THROWING where it is absent — never `as never`, which makes every later read an error. */
export function requireDetail(shape: AssetShape, id: string): AssetDetail {
	const found = shape.details.find((detail) => detail.id === id);
	if (found === undefined) throw new Error(`no ${id} on this shape`);
	return found;
}

/** Every graphic's id, in canonical draw order — what a reorder or a repeat is asserted against. */
export const graphicIds = (shape: AssetShape): string[] => shape.details.map((detail) => detail.id);
