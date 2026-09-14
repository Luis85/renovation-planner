import { describe, expect, it } from 'vitest';
import { shapeFromDimensions } from '../../../src/domain/asset/AssetShape';
import { expectOk } from '../../helpers/domain';
import { drawn, seeded, SQUARE } from '../../helpers/assetDesignHarness';

describe('the reversible whole-shape edit', () => {
	it('restores the traced shape a whole-shape write replaced', async () => {
		const { reversible, assetId, seed, document } = await seeded();
		await seed(drawn());

		const edit = reversible.setShape({ assetId, shape: expectOk(shapeFromDimensions(1200, 800)) });
		expect(expectOk(await edit.execute())).toBe('wrote');
		expect((await document()).shape?.footprintOrigin).toBe('typed');

		expect(expectOk(await edit.undo())).toBe('wrote');
		expect((await document()).shape?.footprint.points).toEqual(SQUARE);
	});
});
