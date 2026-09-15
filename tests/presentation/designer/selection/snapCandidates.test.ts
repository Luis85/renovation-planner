import { describe, expect, it } from 'vitest';
import { partKey } from '../../../../src/presentation/designer/selection/designerSelection';
import { designerSnapCandidates } from '../../../../src/presentation/designer/selection/snapCandidates';
import { QUARTER, editableShape, toiletShape } from '../../../helpers/assetShapes';

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
