/**
 * Asset shapes the part-edit, selection and drag suites act on, built through the domain's own
 * validation so a fixture cannot stand in for a shape the domain would refuse.
 */
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
