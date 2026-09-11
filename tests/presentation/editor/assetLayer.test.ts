// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settle, settleUntil } from '../../helpers/editor';
import { useAssetShapeStore } from '../../../src/presentation/stores/AssetShapeStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('draws a placed asset and a placeholder on the asset layer, and hides both with the Assets row', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const placed = await rig.place(radiator.id, { x: 1000, y: 1000 });
	await rig.place('asset-gone', { x: 3000, y: 2000 }, 0, 'Old boiler');
	await settleUntil(() => useAssetShapeStore(rig.pinia).answers.size === 2, 'asset shapes'); await settle();
	const layer = rig.stage.findOne<Konva.Layer>('.asset');
	expect(layer?.find('.element-asset')).toHaveLength(2);
	expect(layer?.find('.asset-footprint')).toHaveLength(1);
	expect(layer?.find('.asset-placeholder')).toHaveLength(1);
	expect(rig.stage.findOne<Konva.Layer>('.architecture')?.find('.element-asset')).toHaveLength(0);
	const resting = layer?.find('.asset-footprint')[0]?.getAttr('strokeWidth') as number;
	rig.selection.select([placed as never]); await settle();
	expect(layer?.find('.asset-footprint')[0]?.getAttr('strokeWidth')).toBeGreaterThan(resting);
	useWorkspaceStore(rig.pinia).toggleLayer('asset'); await settle();
	expect(layer?.visible()).toBe(false);
});
