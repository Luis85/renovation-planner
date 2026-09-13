/**
 * Asset shapes the part-edit, selection and drag suites act on, built through the domain's own
 * validation so a fixture cannot stand in for a shape the domain would refuse.
 */
import { validateAssetShape, type AssetShape } from '../../src/domain/asset/AssetShape';
import { circle, rect } from '../../src/domain/asset/presets/presetGeometry';
import { expectOk } from './domain';

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
