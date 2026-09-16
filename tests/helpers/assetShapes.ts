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
 * Not exported: its only caller is `shapeWithOpenGraphic` above. A case that needs a curved or a
 * differently-shaped one exports it then, with that case.
 */
function openGraphic(id: string, points: readonly Point[], bulges?: readonly number[]): AssetDetail {
	const outline = expectOk(createCurvedPath({ points: [...points], ...(bulges === undefined ? {} : { bulges: [...bulges] }) }));
	return { id, name: id, kind: 'open', line: 'solid', pending: false, outline };
}

