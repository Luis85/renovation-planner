import { expect, it } from 'vitest';
import { dimensionsOf, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import { resizeBox, rotateOutline, scaleDesignToDimensions } from '../../../src/domain/asset/shapeEdits';
import { expectDefined, expectOk } from '../../helpers/domain';

/**
 * AD18-R24: keeping a tree round — Set dimensions with Width equal to Depth — stretches its four-arc
 * footprint a few parts per million out of round on the way, where the adjacent arcs' shared corner used
 * to come back as a second contact and refuse the outline. Measured through the shipped preset and edits.
 */
const TOLERANCE_MM = 1e-6;
const tree = (): AssetShape => {
	const preset = expectDefined(ASSET_PRESETS.find((each) => each.id === 'tree'), 'tree');
	return expectOk(preset.build(defaultValues(preset)));
};
const size = (shape: AssetShape) => expectOk(dimensionsOf(shape.footprint));

it.each([2987, 4500])('lands the default tree typed %i across and deep exactly', (typed) => {
	const landed = size(expectOk(scaleDesignToDimensions(tree(), typed, typed)));
	expect(Math.abs(landed.width - typed)).toBeLessThanOrEqual(TOLERANCE_MM);
	expect(Math.abs(landed.depth - typed)).toBeLessThanOrEqual(TOLERANCE_MM);
});

it('rotates a stored 4500 x 4500 tree footprint by 4 degrees', () => {
	const stored = expectOk(scaleDesignToDimensions(tree(), 4500, 4500));
	expect(rotateOutline(stored, { kind: 'footprint' }, 4 * Math.PI / 180, stored.anchor).ok).toBe(true);
});

it('widens the shrub\'s detail-1 by every factor from 1.5 to 5 after flattening it to a hundred-thousandth of its depth', () => {
	// Its lobes then meet as 0.004 mm arcs beside ones of about 550 to 1840 mm, where a phantom contact refused about
	// one width in seven, in a speckle.
	const preset = expectDefined(ASSET_PRESETS.find((each) => each.id === 'shrub'), 'shrub');
	const shrub = expectOk(preset.build(defaultValues(preset)));
	const part = { kind: 'detail', id: 'detail-1' } as const;
	const flat = expectOk(resizeBox(shrub, part, { sx: 1, sy: 1e-5 }, { x: 0, y: 0 }));
	const refused: number[] = [];
	for (let step = 300; step <= 1000; step += 1) if (!resizeBox(flat, part, { sx: step / 200, sy: 1 }, { x: 0, y: 0 }).ok) refused.push(step / 200);
	expect(refused).toEqual([]);
});
