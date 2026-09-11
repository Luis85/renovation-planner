// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settleUntil } from '../../helpers/editor';
import { useAssetShapeStore } from '../../../src/presentation/stores/AssetShapeStore';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('loads the shape of every placed asset and answers missing for a deleted one', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	await rig.place(radiator.id, { x: 1000, y: 1000 });
	await rig.place('asset-gone', { x: 2000, y: 1000 }, 0, 'Old boiler');
	const shapes = useAssetShapeStore(rig.pinia);
	await settleUntil(() => shapes.answers.size === 2, 'asset shapes');
	expect(shapes.answerFor(radiator.id)?.kind).toBe('placeable');
	expect(shapes.shapeOf(radiator.id)?.footprint.points).toHaveLength(4);
	expect(shapes.answerFor('asset-gone')).toEqual({ kind: 'missing' });
});
