/**
 * `ListAssetOutlines` carrying the asset's DETAILS beside its footprint (AD18-R39), so a Grid tile
 * draws a vanity's basin and tap hole rather than a bare rectangle. Driven through the real sidecar
 * port over the in-memory vault, as `listAssetOutlines.test.ts` is, with the shipped presets' own
 * shapes rather than hand-made details: what the batch has to carry is what a preset writes.
 */
import { describe, expect, it } from 'vitest';
import { ListAssetOutlines, outlineOf } from '../../../src/application/queries/ListAssetOutlines';
import { ObsidianAssetGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { createRepositoryStack } from '../../helpers/vault';
import { expectDefined, expectOk } from '../../helpers/domain';
import { shapeWithOpenGraphic } from '../../helpers/assetShapes';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';

const preset = (id: string): AssetShape => {
	const found = expectDefined(ASSET_PRESETS.find((each) => each.id === id), id);
	return expectOk(found.build(defaultValues(found)));
};

/** Each shape written under its own id, then all of them read in ONE batch. */
async function readBatch(shapes: Readonly<Record<string, AssetShape>>) {
	const stack = createRepositoryStack();
	const geometry = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	for (const [id, shape] of Object.entries(shapes)) expectOk(await geometry.write(id as AssetId, { calibration: null, shape }));
	const answered = await new ListAssetOutlines(geometry).execute({ assetIds: Object.keys(shapes) as AssetId[] });
	return (id: string) => expectDefined(answered.get(id as AssetId), id);
}

describe('ListAssetOutlines carries each asset\'s details (AD18-R39)', () => {
	it('answers a vanity\'s three details in its own millimetres, the carcass dashed, and a table\'s none', async () => {
		const read = await readBatch({ vanity: preset('vanity'), table: preset('rect-table') });

		const vanity = read('vanity');
		expect(vanity.kind).toBe('measured');
		const details = vanity.kind === 'measured' ? vanity.details : undefined;
		// cabinet (dashed, under the top), basin, tap hole — `sanitary.ts`'s own order.
		expect(details?.map((detail) => [detail.closed, detail.dashed])).toEqual([[true, true], [true, false], [true, false]]);
		// The cabinet is the 800 × 450 top less its 20 mm overhang: x ±380, y -225..205 — millimetres, not a fitted box.
		const xs = details?.[0]?.points.map((point) => point.x) ?? [];
		const ys = details?.[0]?.points.map((point) => point.y) ?? [];
		expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([-380, 380, -225, 205]);

		expect(read('table')).toMatchObject({ kind: 'measured', details: [] });
	});

	it('carries the details of an unscaled footprint too, so the dashed tile is still the object', async () => {
		const read = await readBatch({ traced: { ...preset('toilet'), footprintOrigin: 'traced', footprintPending: true } });

		expect(read('traced')).toMatchObject({ kind: 'unscaled', details: [{ closed: true }, { closed: true }] });
	});

	it('marks an open graphic open, so the mark emits no closing Z for it', () => {
		const shape = shapeWithOpenGraphic();

		const outline = outlineOf(shape, { width: 1000, depth: 600 });

		expect(outline.kind === 'measured' && outline.details?.map((detail) => detail.closed)).toEqual([true, true, false]);
	});
});
