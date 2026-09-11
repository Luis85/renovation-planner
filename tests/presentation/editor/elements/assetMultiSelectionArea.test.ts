// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { assetPlacementRig } from '../../../helpers/assetPlacement';
import { settle, settleUntil } from '../../../helpers/editor';
import { formatArea } from '../../../../src/presentation/editor/shell/formatArea';
import { useAssetShapeStore } from '../../../../src/presentation/stores/AssetShapeStore';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

/**
 * F1 (fix round 2): `EntityInspector.vue`'s `structureRecords` call read no asset shapes, so a
 * placed asset's `areaMm2` fell back to the 500 mm placeholder square (250 000 mm²) inside the
 * multi-selection Inspector's area sum instead of the asset's real 800 x 600 footprint
 * (480 000 mm²). The room here is `WALL_LOOP` (4000 x 3000 mm = 12 m²).
 */
it('sums a room and a placed asset in a mixed selection by the asset\'s real footprint area', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const shapes = useAssetShapeStore(rig.pinia);
	await settleUntil(() => shapes.answerFor(radiator.id)?.kind === 'placeable', 'asset shape loaded');
	rig.selection.select([rig.room.id, id as never]); await settle();
	const fields = rig.wrapper.get('.rp-multi-selection .rp-editor-inspector-fields').text();
	expect(fields).toContain(formatArea(12_000_000 + 480_000));
});
