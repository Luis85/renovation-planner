/**
 * `partMeasure` — the both-kinds read AD11 put under every inspector geometry field.
 *
 * Its own file rather than more cases in `partExtent.test.ts`, which is about what a TYPED extent
 * lands and is the older of the two subjects. What is asked here is the narrower question that
 * function exists to answer: which parts it can measure, and what it says about one that is not
 * there — the arm `withPartBox` turns into `part-not-found` and every field above it depends on.
 */
import { describe, expect, it } from 'vitest';
import { validateAssetShape } from '../../../../src/domain/asset/AssetShape';
import type { OutlinePart } from '../../../../src/domain/asset/shapeEdits';
import { partMeasure } from '../../../../src/presentation/designer/selection/partExtent';
import { openGraphic, shapeWithOpenGraphic } from '../../../helpers/assetShapes';
import { expectOk } from '../../../helpers/domain';

const SHAPE = shapeWithOpenGraphic();
const OPEN: OutlinePart = { kind: 'detail', id: 'detail-3' };

describe('partMeasure', () => {
	/**
	 * The open graphic runs (-300,-200) → (0,-200) → (0,100): a 300 x 300 box on (-150,-50). Measured
	 * through the domain's own `detailBox`, so the inspector and an alignment cannot disagree about
	 * where a line is.
	 */
	it('measures an open graphic, a closed one, the footprint and the clearance', () => {
		expect(partMeasure(SHAPE, OPEN)).toEqual({ centre: { x: -150, y: -50 }, width: 300, depth: 300 });
		expect(partMeasure(SHAPE, { kind: 'detail', id: 'detail-1' })?.width).toBeGreaterThan(0);
		expect(partMeasure(SHAPE, { kind: 'footprint' })?.width).toBeGreaterThan(0);
		expect(partMeasure(SHAPE, { kind: 'clearance' })?.width).toBeGreaterThan(0);
	});

	/**
	 * **A CURVED open graphic, which is the reading that would break if this measured the path
	 * itself.** A path's bulge array is one per SEGMENT where a ring's is one per POINT, so handing
	 * one to `boundingBoxOf` unchanged answers `curve-edge-count` and refuses every curved line.
	 * `detailBox` pads the absent wrap edge, which is why this goes through it — and a semicircular
	 * bulge on a 200 mm chord bows 100 mm clear of both endpoints (in -y, which is the sign convention), so the depth is the instrument:
	 * a measurement that ignored the arc would answer zero for this line.
	 */
	it('reaches where a curved line’s arc goes, not only its endpoints', () => {
		const curved = expectOk(validateAssetShape({
			...SHAPE,
			details: [openGraphic('detail-1', [{ x: -100, y: 0 }, { x: 100, y: 0 }], [1])],
		}));

		expect(partMeasure(curved, { kind: 'detail', id: 'detail-1' })).toEqual({ centre: { x: 0, y: -50 }, width: 200, depth: 100 });
	});

	/**
	 * **Both of its "not there" arms, because they are reached differently.** A missing DETAIL is a
	 * lookup that found nothing; a missing CLEARANCE is `outlineOf` answering `null` for a part the
	 * shape is allowed not to have. `withPartBox` turns either into `part-not-found`, which is what
	 * keeps a stale selection from measuring something that is gone.
	 */
	it('answers null for a graphic the shape has not got and for a clearance it has not got', () => {
		const bare = expectOk(validateAssetShape({ ...SHAPE, clearance: null, clearancePending: false }));

		expect(partMeasure(SHAPE, { kind: 'detail', id: 'detail-9' })).toBeNull();
		expect(partMeasure(bare, { kind: 'clearance' })).toBeNull();
	});
});
