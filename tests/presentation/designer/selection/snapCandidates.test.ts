import { describe, expect, it } from 'vitest';
import { partKey } from '../../../../src/presentation/designer/selection/designerSelection';
import { designerSnapCandidates } from '../../../../src/presentation/designer/selection/snapCandidates';
import { toiletShape } from '../../../helpers/assetShapes';

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
});
