import type { PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import type { Point } from '../../src/core/geometry/Point';
import type { Asset } from '../../src/domain/asset/Asset';
import { shapeFromDimensions } from '../../src/domain/asset/AssetShape';
import { placementPoints } from '../../src/domain/spatial/assetPlacement';
import { createEntityId } from '../../src/core/identity/generateId';
import { ObsidianAssetGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { elementInput } from '../../src/presentation/editor/elements/elementInput';
import { renovationEditor } from './renovationEditor';
import { makeAsset } from './entities';
import { expectOk } from './domain';
import { settle } from './editor';

/** A Studio room inside `WALL_LOOP` (0..4000 × 0..3000), real repositories, and doors to save assets and place them. */
export async function assetPlacementRig(navigation?: PlanEditorContext['navigation']) {
	const rig = await renovationEditor(true, navigation);
	const sidecar = new ObsidianAssetGeometrySidecar(rig.stack.assetGeometry);
	async function saveAsset(name: string, designed = true): Promise<Asset> {
		const asset = makeAsset({ name, unit: 'piece' });
		expectOk(await rig.stack.assets.save(asset, 'absent'));
		if (designed) expectOk(await sidecar.write(asset.id, { calibration: null, shape: expectOk(shapeFromDimensions(800, 600)) }));
		return asset;
	}
	async function place(assetId: string, anchor: Point, heading = 0, name = 'Radiator'): Promise<string> {
		const baseline = expectOk(await rig.renovation.read(rig.plan.id)), id = createEntityId('element');
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, { id, kind: 'asset', assetId, points: placementPoints(anchor, heading), name }), rig.runtime.structureTask.ledger)));
		await settle();
		return id;
	}
	return { ...rig, saveAsset, place };
}
