import { expect, it } from 'vitest';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import { resizeBox } from '../../../src/domain/asset/shapeEdits';
import { expectDefined, expectOk } from '../../helpers/domain';

/**
 * AD18-R24: a lobed detail flattened almost to a line and then widened. Its lobes meet as very short arcs beside
 * long ones, where `arcArc` reported a contact about 1e-7 mm beside their shared corner and refused the outline.
 * Measured through the shipped preset and `resizeBox`.
 */
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
