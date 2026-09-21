import { describe, expect, it } from 'vitest';
import { createCurvedPath } from '../../../src/core/geometry/CurvedPath';
import { validateAssetShape, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { addDetail, deleteDetail, detailBox, duplicateDetail } from '../../../src/domain/asset/detailEdits';
import { groupDetails, ungroupDetails } from '../../../src/domain/asset/groupEdits';
import {
	moveOutline,
	moveVertex,
	outlineOf,
	partPoints,
	resizeBox,
	rotateOutline,
	setBulge,
	type OutlinePart,
} from '../../../src/domain/asset/shapeEdits';
import { openGraphic, shapeWithOpenGraphic } from '../../helpers/assetShapes';
import { expectOk } from '../../helpers/domain';

/**
 * What an OPEN graphic may and may not be asked, now that AD11 can create one (AD04 §3, C02).
 *
 * **The split this file pins is between a POINT-WISE transform and an edit that needs a ring.**
 * Translation, rotation and scaling are arithmetic on vertices, so they go through
 * `mapPartOutline` and keep a graphic's kind; a vertex index and a bulge index are questions
 * about a closed outline's topology — `indexIn` counts POINTS, and a path's bulge array is one
 * per SEGMENT — so those stay behind `outlineOf` and answer `part-not-found`.
 *
 * `shapeWithOpenGraphic` is `detail-3`, a path running (-300,-200) → (0,-200) → (0,100): box
 * 300 × 300 centred on (-150,-50), with a closed `detail-1` and `detail-2` beside it, so every
 * case here also says what happened to the graphics it did NOT name.
 */
const OPEN: OutlinePart = { kind: 'detail', id: 'detail-3' };
const CLOSED: OutlinePart = { kind: 'detail', id: 'detail-1' };
const RUN = [{ x: -300, y: -200 }, { x: 0, y: -200 }, { x: 0, y: 100 }];

const shape = (): AssetShape => shapeWithOpenGraphic();
const detail = (design: AssetShape, id: string) => design.details.find((found) => found.id === id);
const points = (design: AssetShape, id: string) => detail(design, id)?.outline.points;

describe('creating an open graphic', () => {
	/**
	 * `addDetail` is the ONE door into a shape's graphics, and until AD11 its input type was the
	 * closed arm written out — so nothing in the product could add a path even though the model,
	 * the schema and the sidecar all carried one. This is the case for that widening.
	 */
	it('adds one through the same door a closed graphic takes, and it stays open', () => {
		const outline = expectOk(createCurvedPath({ points: RUN }));
		const added = expectOk(addDetail(shape(), { kind: 'open', name: 'line', outline, line: 'solid', pending: false }));

		expect(detail(added, 'detail-4')).toMatchObject({ kind: 'open', name: 'line', line: 'solid' });
		expect(points(added, 'detail-4')).toEqual(RUN);
	});

	/**
	 * A two-point line with no width is the shape C02 names explicitly: *"Do not require both axis
	 * extents to be positive for a horizontal or vertical line."* A closed graphic with the same
	 * two points could not exist at all.
	 */
	it('accepts a flat two-point line, which no closed-area rule would', () => {
		const flat = expectOk(createCurvedPath({ points: [{ x: -500, y: 0 }, { x: 500, y: 0 }] }));
		const added = expectOk(addDetail(shape(), { kind: 'open', name: 'seam', outline: flat, line: 'solid', pending: false }));

		const box = expectOk(detailBox(expectOk(validateAssetShape(added)).details[3]));
		expect([box.max.x - box.min.x, box.max.y - box.min.y]).toEqual([1000, 0]);
	});

	it('refuses a run of one point rather than padding it into something drawable', () => {
		expect(createCurvedPath({ points: [{ x: 0, y: 0 }] }).ok).toBe(false);
	});
});

describe('the transforms that keep a graphic kind', () => {
	it('moves an open graphic and leaves every other graphic alone', () => {
		const moved = expectOk(moveOutline(shape(), OPEN, { dx: 100, dy: -50 }));

		expect(detail(moved, 'detail-3')?.kind).toBe('open');
		expect(points(moved, 'detail-3')).toEqual([{ x: -200, y: -250 }, { x: 100, y: -250 }, { x: 100, y: 50 }]);
		expect(points(moved, 'detail-1')).toEqual(points(shape(), 'detail-1'));
	});

	it('rotates one about a given origin', () => {
		const turned = expectOk(rotateOutline(shape(), OPEN, Math.PI / 2, { x: 0, y: 0 }));

		const turnedPoints = points(turned, 'detail-3') ?? [];
		expect(turnedPoints).toHaveLength(3);
		expect(turnedPoints[0].x).toBeCloseTo(200, 9);
		expect(turnedPoints[0].y).toBeCloseTo(-300, 9);
	});

	it('scales one per axis about a given origin', () => {
		const scaled = expectOk(resizeBox(shape(), OPEN, { sx: 2, sy: 1 }, { x: 0, y: 0 }));

		expect(points(scaled, 'detail-3')).toEqual([{ x: -600, y: -200 }, { x: 0, y: -200 }, { x: 0, y: 100 }]);
	});

	/**
	 * A CURVED path is the reading AD10 found broken one layer down: its bulge array is one per
	 * SEGMENT, so a transform that treated it as a closed one would hand `validateBulges` a list
	 * the wrong length and refuse. The array must ride along unchanged and still be one short.
	 */
	it('carries a curved path’s per-segment bulges through a transform unchanged', () => {
		const curved = expectOk(validateAssetShape({
			...shape(),
			details: [openGraphic('detail-9', RUN, [0.5, -0.25])],
		}));

		const moved = expectOk(moveOutline(curved, { kind: 'detail', id: 'detail-9' }, { dx: 10, dy: 10 }));

		expect(detail(moved, 'detail-9')?.outline.bulges).toEqual([0.5, -0.25]);
	});

	it('moves the footprint and the clearance through the same one path', () => {
		const moved = expectOk(moveOutline(shape(), { kind: 'footprint' }, { dx: 5, dy: 0 }));

		expect(moved.footprint.points[0].x).toBe(shape().footprint.points[0].x + 5);
		expect(expectOk(moveOutline(shape(), { kind: 'clearance' }, { dx: 5, dy: 0 })).clearance?.points[0].x)
			.toBe((shape().clearance?.points[0].x ?? 0) + 5);
	});

	it('refuses a graphic and a clearance the shape has not got, and a non-positive scale factor', () => {
		const bare = expectOk(validateAssetShape({ ...shape(), clearance: null, clearancePending: false }));

		expect(moveOutline(shape(), { kind: 'detail', id: 'nope' }, { dx: 1, dy: 1 })).toMatchObject({ error: { code: 'asset.part-not-found' } });
		expect(moveOutline(bare, { kind: 'clearance' }, { dx: 1, dy: 1 })).toMatchObject({ error: { code: 'asset.part-not-found' } });
		expect(resizeBox(shape(), OPEN, { sx: 0, sy: 1 }, { x: 0, y: 0 })).toMatchObject({ error: { code: 'asset.invalid-scale' } });
		// The negative arm by name, sharing a branch with zero and asserted anyway: a negative
		// factor is a MIRROR, and `arrangeDetails.test.ts`'s sibling line carries the argument.
		expect(resizeBox(shape(), OPEN, { sx: -1, sy: 1 }, { x: 0, y: 0 })).toMatchObject({ error: { code: 'asset.invalid-scale' } });
	});
});

describe('the edits that still need a closed ring', () => {
	/**
	 * `outlineOf` did NOT widen, and this is the case that says so. Everything downstream of it —
	 * the vertex handles, the canvas box resize, the bend — is closed-only by construction rather
	 * than by a guard each of them repeats.
	 */
	it('answers null for an open graphic and the ring for a closed one', () => {
		expect(outlineOf(shape(), OPEN)).toBeNull();
		expect(outlineOf(shape(), CLOSED)?.points).toEqual(points(shape(), 'detail-1'));
	});

	it('refuses a vertex move and a bend on an open graphic', () => {
		expect(moveVertex(shape(), OPEN, 0, { x: 0, y: 0 })).toMatchObject({ error: { code: 'asset.part-not-found' } });
		expect(setBulge(shape(), OPEN, 0, 0.5)).toMatchObject({ error: { code: 'asset.part-not-found' } });
	});

	it('still moves a vertex and bends an edge on a closed one', () => {
		expect(expectOk(moveVertex(shape(), CLOSED, 0, { x: 5, y: 5 })).details[0].outline.points[0]).toEqual({ x: 5, y: 5 });
		expect(expectOk(setBulge(shape(), CLOSED, 0, 0.5)).details[0].outline.bulges?.[0]).toBe(0.5);
	});

	/**
	 * The footprint and the clearance still reach `withOutline` through this path, and the CLEARANCE
	 * arm is here because AD11 is what left it needing a case of its own: the whole-part transforms
	 * that used to exercise it go through `mapPartOutline` now, so `moveVertex` and `setBulge` are
	 * the only callers left and neither had ever been asked of a clearance.
	 */
	it('moves a vertex of the footprint and of the clearance, which nothing else reaches any more', () => {
		expect(expectOk(moveVertex(shape(), { kind: 'footprint' }, 0, { x: -900, y: -900 })).footprint.points[0])
			.toEqual({ x: -900, y: -900 });
		expect(expectOk(moveVertex(shape(), { kind: 'clearance' }, 0, { x: -1200, y: -1200 })).clearance?.points[0])
			.toEqual({ x: -1200, y: -1200 });
	});
});

describe('reading a part’s vertices whatever its kind', () => {
	it('answers for both kinds and for the footprint, and null for a part that is not there', () => {
		expect(partPoints(shape(), OPEN)).toEqual(RUN);
		expect(partPoints(shape(), CLOSED)).toEqual(points(shape(), 'detail-1'));
		expect(partPoints(shape(), { kind: 'footprint' })).toEqual(shape().footprint.points);
		expect(partPoints(shape(), { kind: 'clearance' })).toEqual(shape().clearance?.points);
		expect(partPoints(shape(), { kind: 'detail', id: 'nope' })).toBeNull();
		const bare = expectOk(validateAssetShape({ ...shape(), clearance: null, clearancePending: false }));
		expect(partPoints(bare, { kind: 'clearance' })).toBeNull();
	});
});

/**
 * Acceptance criterion 1's domain half: *an open polyline remains open after save, reopen,
 * duplication, grouping and export.* Save and reopen are the sidecar's (`assetGeometrySidecar`
 * cases); grouping carries no coordinates at all (`groupEdits`); what is asked here is that the
 * list edits never launder one into a ring.
 */
describe('an open graphic through the list edits', () => {
	it('duplicates as an open graphic, offset, with a fresh id', () => {
		const copied = expectOk(duplicateDetail(shape(), 'detail-3', { dx: 100, dy: 100 }));

		expect(detail(copied, 'detail-4')).toMatchObject({ kind: 'open', name: 'detail-3' });
		expect(points(copied, 'detail-4')).toEqual(RUN.map((point) => ({ x: point.x + 100, y: point.y + 100 })));
	});

	/**
	 * Criterion 1's grouping half. Group membership is editing METADATA (AD04 §4, C06): it carries no
	 * coordinates and no z-order, so grouping a line cannot change its geometry and ungrouping cannot
	 * restore what was never altered. Asserted rather than reasoned, because "this operation does not
	 * touch geometry" is exactly the claim a later widening would break silently.
	 */
	it('groups and ungroups as a member like any other, geometry untouched', () => {
		const grouped = expectOk(groupDetails(shape(), ['detail-1', 'detail-3']));

		expect(grouped.groups).toEqual([{ id: 'group-1', members: ['detail-1', 'detail-3'] }]);
		expect(detail(grouped, 'detail-3')?.kind).toBe('open');
		expect(points(grouped, 'detail-3')).toEqual(RUN);

		const ungrouped = expectOk(ungroupDetails(grouped, 'group-1'));
		expect(ungrouped.groups).toEqual([]);
		expect(points(ungrouped, 'detail-3')).toEqual(RUN);
	});

	it('deletes without touching the graphics beside it', () => {
		const left = expectOk(deleteDetail(shape(), 'detail-3'));

		expect(left.details.map((found) => found.id)).toEqual(['detail-1', 'detail-2']);
	});
});
