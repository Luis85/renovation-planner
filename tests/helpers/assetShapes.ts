/**
 * Asset shapes the part-edit, selection and drag suites act on, built through the domain's own
 * validation so a fixture cannot stand in for a shape the domain would refuse.
 */
import type { CurvedPolygon } from '../../src/core/geometry/CurvedPolygon';
import { createCurvedPath } from '../../src/core/geometry/CurvedPath';
import type { Point } from '../../src/core/geometry/Point';
import type { AssetDetail } from '../../src/domain/asset/AssetDetail';
import { validateAssetShape, type AssetShape } from '../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../src/domain/asset/presets/catalogue';
import { circle, defaultValues, rect } from '../../src/domain/asset/presets/presetGeometry';
import { expectDefined, expectOk } from './domain';

/** The bulge of a quarter-circle edge — what `circle` gives each of its four edges. */
export const QUARTER = Math.tan(Math.PI / 8);

/**
 * Every kind of part at round numbers: a 1000 x 600 footprint centred on the origin, a 1400 x 1000
 * clearance reaching 400 further toward +y, a straight solid `detail-1` ("top", 400 x 200 centred on
 * (-200, 0)) and a curved, dashed, PENDING `detail-2` ("bowl", a circle of diameter 200 centred on
 * (250, 0)). Anchor at the origin, facing +x.
 */
export function editableShape(overrides: Partial<AssetShape> = {}): AssetShape {
	return expectOk(
		validateAssetShape({
			footprint: rect(1000, 600),
			footprintOrigin: 'typed',
			footprintPending: false,
			clearance: rect(1400, 1000, 0, 200),
			clearancePending: false,
			anchor: { x: 0, y: 0 },
			anchorPending: false,
			facing: 0,
			details: [
				{ id: 'detail-1', name: 'top', outline: rect(400, 200, -200, 0), line: 'solid', pending: false },
				{ id: 'detail-2', name: 'bowl', outline: circle(200, 250, 0), line: 'dashed', pending: true },
			],
			...overrides,
		}),
	);
}

/**
 * The toilet preset at its defaults: footprint 380 wide with a semicircular front reaching y = 350,
 * clearance x -390..390 by y -350..950, `detail-1` the tank (x -190..190, y -350..-150), `detail-2`
 * the bowl (x -152..152, y -125..325), anchor at the origin, facing +y.
 */
export function toiletShape(): AssetShape {
	const toilet = expectDefined(
		ASSET_PRESETS.find((preset) => preset.id === 'toilet'),
		'the toilet preset',
	);
	return expectOk(toilet.build(defaultValues(toilet)));
}

/**
 * A graphic's CLOSED outline, for the many cases whose subject is a closed one — a bounding box, a
 * bulge array, an area. It throws for an open graphic rather than widening the case's type, which
 * is the point: the union exists so a surface cannot treat a path as a ring by accident, and a test
 * that means the ring should say so once here rather than casting at each read.
 */
export function closedOutlineOf(detail: AssetDetail): CurvedPolygon {
	if (detail.kind === 'open') throw new Error(`detail ${detail.id} is an open graphic; this case is about a closed one`);
	return detail.outline;
}

/** The open graphic's three points, exported so a case can assert against them rather than re-typing them. */
export const OPEN_POINTS = [{ x: -300, y: -200 }, { x: 0, y: -200 }, { x: 0, y: 100 }] as const;

/**
 * `editableShape()` with one OPEN graphic appended — a two-segment line inside the footprint, solid
 * so the "solid never fills an open graphic" rule has a subject, and measured so no case has to
 * reason about a pending flag as well.
 *
 * Built through `validateAssetShape` like every other fixture here, which is also what mints the
 * `CurvedPath` brand: a hand-written literal could not be one.
 */
export function shapeWithOpenGraphic(): AssetShape {
	const base = editableShape();
	return expectOk(validateAssetShape({ ...base, details: [...base.details, openGraphic('detail-3', OPEN_POINTS)] }));
}

/**
 * One OPEN graphic, built through `createCurvedPath` because that constructor is the only thing
 * that can mint the brand — a literal cannot be an `OpenDetail`, which is the access lock working
 * rather than an inconvenience.
 *
 */
export function openGraphic(id: string, points: readonly Point[], bulges?: readonly number[]): AssetDetail {
	const outline = expectOk(createCurvedPath({ points: [...points], ...(bulges === undefined ? {} : { bulges: [...bulges] }) }));
	return { id, name: id, kind: 'open', line: 'solid', pending: false, outline };
}

/** The side of one grid cell, and of the part drawn inside it, in millimetres. */
const CELL = 100;
const PART = 60;

/**
 * One part of `shapeWithParts`, by its index. The three kinds CYCLE, so a fixture of any size
 * carries all three: a straight closed square (4 points, no curved edge), a circle (4 points, all
 * four edges bulged — the only arm `validateCurvedBoundary` does any work on) and an open
 * two-segment polyline (3 points, no curved edge, and no interior to fill).
 *
 * A stress fixture of nothing but rectangles would understate the cost §6 asks about, since the
 * curved arm is the expensive one; a fixture of nothing but circles would overstate it.
 */
function partAt(index: number, x: number, y: number): AssetDetail {
	const id = `part-${index + 1}`;
	if (index % 3 === 0) return { id, name: id, outline: rect(PART, PART, x, y), line: 'solid', pending: false };
	if (index % 3 === 1) return { id, name: id, outline: circle(PART, x, y), line: 'dashed', pending: false };
	const half = PART / 2;
	return openGraphic(id, [{ x: x - half, y: y - half }, { x: x + half, y: y - half }, { x: x + half, y: y + half }]);
}

/**
 * **F12's performance fixture family: `parts` graphics on one shape, at documented vertex
 * complexity** (`ACCEPTANCE-AND-QA.md` §1 F12 and §6 — the 250-part selection and drag fixture and
 * the 1000-part stress one). It builds a fixture and asserts nothing: this repository has no
 * benchmark harness and no host to run one in, so what is closed here is the fixture half.
 *
 * The parts are laid out on a square-ish grid of {@link CELL}-millimetre cells, each part
 * {@link PART} millimetres across, with the footprint sized to the grid — so the graphics sit
 * INSIDE the object rather than piled on the origin, which is what makes a hit test or a
 * selection over this shape resemble one over a real drawing. Nothing in the domain requires
 * that; it is what makes the fixture worth measuring.
 *
 * Each part's vertex count is fixed by its kind (see {@link partAt}), so the totals are
 * arithmetic rather than a measurement. `tests/domain/asset/partFixtures.test.ts` asserts every
 * one of them, and asserts that the whole shape is accepted by the real `validateAssetShape`:
 *
 * | parts | squares | circles | open paths | vertices | curved edges |
 * |---|---|---|---|---|---|
 * | 25 | 9 | 8 | 8 | 92 | 32 |
 * | 250 | 84 | 83 | 83 | 917 | 332 |
 * | 1000 | 334 | 333 | 333 | 3667 | 1332 |
 *
 * No group, no clearance and no pending flag: each of those is another suite's subject, and a
 * benchmark that carried them could not say which of them it was timing.
 */
export function shapeWithParts(parts: number): AssetShape {
	const columns = Math.ceil(Math.sqrt(parts));
	const rows = Math.ceil(parts / columns);
	const details = Array.from({ length: parts }, (_, index) =>
		partAt(
			index,
			((index % columns) - (columns - 1) / 2) * CELL,
			(Math.floor(index / columns) - (rows - 1) / 2) * CELL,
		),
	);
	return expectOk(
		validateAssetShape({
			footprint: rect(columns * CELL, rows * CELL),
			footprintOrigin: 'typed',
			footprintPending: false,
			clearance: null,
			clearancePending: false,
			anchor: { x: 0, y: 0 },
			anchorPending: false,
			facing: 0,
			details,
		}),
	);
}

