/**
 * @vitest-environment jsdom
 *
 * The asset placement Inspector branch, scanned under the same ceiling `accessibility.test.ts`'s
 * header states; `runOptions` is shared through `./axeOptions`.
 */
import axe from 'axe-core';
import { afterEach, expect, it } from 'vitest';
import { runOptions } from './axeOptions';
import { assetPlacementRig } from '../helpers/assetPlacement';
import { settle, settleUntil } from '../helpers/editor';
import { useAssetShapeStore } from '../../src/presentation/stores/AssetShapeStore';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

// Two selections, each a full-wrapper scan: 3.5 s alone and unloaded, so the default 5 s is no budget. Same figure as `accessibility.test.ts`'s HARNESS_SCAN_MS.
it('reports no violations for a placed asset and for a missing one', { timeout: 30_000 }, async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const placed = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const missing = await rig.place('asset-gone', { x: 3000, y: 2000 }, 0, 'Old boiler');
	await settleUntil(() => useAssetShapeStore(rig.pinia).answers.size === 2, 'asset shapes');
	for (const id of [placed, missing]) {
		rig.selection.select([id as never]); await settle();
		expect(rig.wrapper.find('[data-rp-action="replace-asset"]').exists()).toBe(true);
		const results = await axe.run(rig.wrapper.element as HTMLElement, runOptions);
		expect(results.violations).toEqual([]);
	}
});
