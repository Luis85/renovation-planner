import { describe, expect, it } from 'vitest';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import { presetPreview } from '../../../src/presentation/designer/presets/presetPreview';
import { expectOk } from '../../helpers/domain';
import { OPEN_POINTS, shapeWithOpenGraphic } from '../../helpers/assetShapes';

const built = (id: string) => {
	const preset = ASSET_PRESETS.find((item) => item.id === id);
	if (preset === undefined) throw new Error(`no preset ${id}`);
	return expectOk(preset.build(defaultValues(preset)));
};

describe('presetPreview', () => {
	it('frames the footprint with a margin', () => {
		// rect-table defaults to 1600 × 900: extent ±800 / ±450, margin 5% of the longer side = 80.
		const [x, y, width, height] = presetPreview(built('rect-table')).viewBox.split(' ').map(Number);
		expect([x, y, width, height]).toEqual([-880, -530, 1760, 1060]);
	});

	it('draws one closed path per detail and says which are dashed', () => {
		const preview = presetPreview(built('toilet'));
		expect(preview.footprint.startsWith('M')).toBe(true);
		expect(preview.footprint.endsWith('Z')).toBe(true);
		expect(preview.details.map((detail) => detail.dashed)).toEqual([false, false]);
	});
});

/**
 * AD05: `Z` is what closes an SVG path, so an open graphic is emitted without one. A preview that
 * closed it would draw an edge the object has not got — in the one place a user decides whether a
 * preset is the thing they meant.
 */
describe('an open graphic in the preview', () => {
	it('emits no closing Z for it, and still emits one for a closed graphic', () => {
		const preview = presetPreview(shapeWithOpenGraphic());
		expect(preview.details[2].d.endsWith(' Z')).toBe(false);
		expect(preview.details[0].d.endsWith(' Z')).toBe(true);
		expect(preview.footprint.endsWith(' Z')).toBe(true);
	});

	it('draws every one of its points', () => {
		const preview = presetPreview(shapeWithOpenGraphic());
		for (const point of OPEN_POINTS) expect(preview.details[2].d).toContain(`${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
	});
});
