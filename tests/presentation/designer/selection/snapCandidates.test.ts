import { describe, expect, it } from 'vitest';
import { partKey } from '../../../../src/presentation/designer/selection/designerSelection';
import { designerSnapCandidates } from '../../../../src/presentation/designer/selection/snapCandidates';
import { OPEN_POINTS, QUARTER, editableShape, shapeWithOpenGraphic, toiletShape } from '../../../helpers/assetShapes';

/** Spec 2026-09-13 Decision 10: Edit points snaps onto footprint and detail vertices and the anchor. */
describe('designerSnapCandidates', () => {
	it('offers nothing before a shape exists', () => {
		expect(designerSnapCandidates(null, [])).toEqual({});
	});

	it('offers the footprint’s and every detail’s vertices and the anchor, and never the clearance’s', () => {
		const shape = toiletShape();
		expect(designerSnapCandidates(shape, []).vertices).toEqual([
			...shape.footprint.points,
			...shape.details[0].outline.points,
			...shape.details[1].outline.points,
			shape.anchor,
		]);
	});

	it('leaves out the parts being dragged, named by their part keys', () => {
		const shape = toiletShape();
		const exclude = new Set(['footprint', partKey({ kind: 'detail', id: 'detail-2' }), 'anchor']);
		expect(designerSnapCandidates(shape, exclude).vertices).toEqual(shape.details[0].outline.points);
	});

	it('offers every outline’s edges with their bulges, so a curved detail is snapped along its arc', () => {
		const { edges } = designerSnapCandidates(editableShape(), []);

		expect(edges).toHaveLength(12);
		expect(edges?.[0]).toEqual({ start: { x: -500, y: -300 }, end: { x: 500, y: -300 }, bulge: 0 });
		expect(edges?.slice(-4).map((edge) => edge.bulge)).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
	});

	it('offers each outline’s vertices and curve-aware box centre, and the anchor, as alignments', () => {
		const shape = editableShape();

		expect(designerSnapCandidates(shape, []).alignments).toEqual([
			...shape.footprint.points, { x: 0, y: 0 },
			...shape.details[0].outline.points, { x: -200, y: 0 },
			...shape.details[1].outline.points, { x: 250, y: 0 },
			shape.anchor,
		]);
	});

	it('leaves the dragged parts out of the edges and the alignments too', () => {
		const shape = editableShape();
		const found = designerSnapCandidates(shape, new Set(['footprint', partKey({ kind: 'detail', id: 'detail-2' }), 'anchor']));

		expect(found.edges).toHaveLength(4);
		expect(found.alignments).toEqual([...shape.details[0].outline.points, { x: -200, y: 0 }]);
	});
});

/**
 * AD05: an open graphic contributes its vertices and its SEGMENTS, and no closing edge. The wrap
 * `edgesOf` adds for a ring is a line the object has not got, and snapping a drag onto it would
 * pull the gesture towards geometry nobody drew.
 */
describe('an open graphic among the snap candidates', () => {
	/**
	 * Measured as a DIFFERENCE against the same shape without the open graphic, rather than by
	 * filtering on coordinates: the fixture's open run ends at (0, 100), which is also a corner of
	 * `editableShape`'s first graphic, so a coordinate filter counted that graphic's edge as well
	 * and reported three where two were offered. A coincidence between two parts' vertices is
	 * exactly what a snapping fixture WILL contain.
	 */
	it('offers one edge fewer than it has points, where a closed graphic offers one per point', () => {
		const withOpen = (designerSnapCandidates(shapeWithOpenGraphic(), []).edges ?? []).length;
		const without = (designerSnapCandidates(editableShape(), []).edges ?? []).length;
		expect(withOpen - without).toBe(OPEN_POINTS.length - 1);
	});

	/** The closing edge a ring would have — last point back to first — must not be among them. */
	it('offers no closing edge for it', () => {
		const edges = designerSnapCandidates(shapeWithOpenGraphic(), []).edges ?? [];
		const last = OPEN_POINTS[OPEN_POINTS.length - 1], first = OPEN_POINTS[0];
		expect(edges.some((edge) => edge.start.x === last.x && edge.start.y === last.y && edge.end.x === first.x && edge.end.y === first.y)).toBe(false);
	});

	it('offers its vertices and its box centre, exactly as a closed graphic does', () => {
		const candidates = designerSnapCandidates(shapeWithOpenGraphic(), []);
		for (const point of OPEN_POINTS) expect(candidates.vertices).toContainEqual(point);
		// The box of (-300,-200)…(0,100) — a centre needs no interior.
		expect(candidates.alignments).toContainEqual({ x: -150, y: -50 });
	});

	/** Again as a difference, and for the same coincidence: (0, 100) belongs to another graphic too. */
	it('drops it from the candidates when the gesture is on it', () => {
		const shape = shapeWithOpenGraphic();
		const all = designerSnapCandidates(shape, []).vertices ?? [];
		const excluded = designerSnapCandidates(shape, [partKey({ kind: 'detail', id: 'detail-3' })]).vertices ?? [];
		expect(all.length - excluded.length).toBe(OPEN_POINTS.length);
	});
});
