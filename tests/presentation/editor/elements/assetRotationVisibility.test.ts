// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { assetPlacementRig } from '../../../helpers/assetPlacement';
import { settle, settleUntil } from '../../../helpers/editor';
import { useWorkspaceStore } from '../../../../src/presentation/stores/WorkspaceStore';
import { useAssetShapeStore } from '../../../../src/presentation/stores/AssetShapeStore';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

/**
 * F3: `rotationActions.ts`'s `sourceVisible` gained `if (shape.kind === 'asset') return
 * layers.asset;` and nothing failed without it. `handle` is the smallest signal that arm
 * gates — `handleGeometry` reads only the selected `target` and `sourceVisible`, with no
 * hover precondition, unlike `displayControls`/`displayTarget`.
 */
it('offers a rotation handle for a selected placement while the Assets layer is visible, and none once it is hidden', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const shapes = useAssetShapeStore(rig.pinia);
	await settleUntil(() => shapes.answerFor(radiator.id)?.kind === 'placeable', 'asset shape loaded');
	rig.selection.select([id as never]); await settle();
	expect(rig.runtime.rotationActions.target.value?.id).toBe(id);
	expect(rig.runtime.rotationActions.handle.value).not.toBeNull();
	useWorkspaceStore(rig.pinia).toggleLayer('asset'); await settle();
	expect(rig.runtime.rotationActions.target.value?.id).toBe(id);
	expect(rig.runtime.rotationActions.handle.value).toBeNull();
});
