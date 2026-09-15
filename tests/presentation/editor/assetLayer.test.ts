// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settle, settleUntil } from '../../helpers/editor';
import { useAssetShapeStore } from '../../../src/presentation/stores/AssetShapeStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { ObsidianAssetGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { toiletShape } from '../../helpers/assetShapes';
import { expectOk } from '../../helpers/domain';

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

it('hides and shows a placed asset’s label from the View menu', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	await rig.place((await rig.saveAsset('Radiator')).id, { x: 1000, y: 1000 });
	await settleUntil(() => useAssetShapeStore(rig.pinia).answers.size === 1, 'asset shapes'); await settle();
	const labels = () => rig.stage.findOne<Konva.Group>('.element-asset')?.find('Text').length;
	expect(labels()).toBe(1);
	await rig.wrapper.get('[data-rp-view="labels"]').setValue(false);
	expect(labels()).toBe(0);
	await rig.wrapper.get('[data-rp-view="labels"]').setValue(true);
	expect(labels()).toBe(1);
});

it('restrokes a placed symbol’s outline after its details, so a solid detail cannot hide the edge', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const asset = await rig.saveAsset('Toilet', false);
	expectOk(await new ObsidianAssetGeometrySidecar(rig.stack.assetGeometry).write(asset.id, { calibration: null, shape: toiletShape() }));
	await rig.place(asset.id, { x: 1000, y: 1000 });
	await settleUntil(() => useAssetShapeStore(rig.pinia).answers.size === 1, 'asset shapes'); await settle();

	const names = rig.stage.findOne<Konva.Group>('.element-asset')?.getChildren().map((node) => node.name()) ?? [];
	expect(names.filter((name) => name === 'asset-footprint-edge')).toHaveLength(1);
	expect(names.lastIndexOf('asset-detail')).toBeGreaterThan(-1);
	expect(names.indexOf('asset-footprint-edge')).toBeGreaterThan(names.lastIndexOf('asset-detail'));
});
