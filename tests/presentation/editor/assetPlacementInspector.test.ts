// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { err } from '../../../src/core/result/Result';
import * as notices from '../../../src/presentation/notices/notify';
import { tr } from '../../../src/presentation/i18n/strings';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';
import { useAssetShapeStore } from '../../../src/presentation/stores/AssetShapeStore';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const rig of mounted.splice(0)) rig.unmount(); });

async function selectPlaced(rig: Awaited<ReturnType<typeof assetPlacementRig>>, id: string, count: number) {
	await settleUntil(() => useAssetShapeStore(rig.pinia).answers.size === count, 'asset shapes');
	rig.selection.select([id as never]); await settle();
	return rig.wrapper.get('.rp-element-inspector');
}

it('shows dimensions, opens the designer and hides the outline editor', async () => {
	const asset = vi.fn<(assetId: string) => Promise<void>>(async () => {});
	const rig = await assetPlacementRig({ project: async () => {}, library: () => {}, asset }); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const inspector = await selectPlaced(rig, id, 1);
	expect(inspector.text()).toContain(tr('editor.asset.dimensions', { width: formatMetres(800), depth: formatMetres(600) }));
	expect(inspector.find('[data-rp-action="edit-element"]').exists()).toBe(false);
	await inspector.get('[data-rp-action="open-asset-designer"]').trigger('click');
	expect(asset).toHaveBeenCalledWith(radiator.id);
});

it('explains a missing asset and replaces it in one undoable step', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place('asset-gone', { x: 1000, y: 1000 }, 0, 'Old boiler');
	const inspector = await selectPlaced(rig, id, 1);
	expect(inspector.text()).toContain(tr('editor.asset.missing'));
	await inspector.get('[data-rp-action="replace-asset"]').trigger('click'); await settle();
	rig.dialogs.resolve({ id: radiator.id });
	await settleUntil(() => rig.project.structure.elements?.[0]?.assetId === radiator.id, 'replaced asset');
	expect(rig.project.plan?.spatialElements?.find(item => item.id === id)?.name).toBe('Old boiler');
	expectOk(await rig.runtime.dispatcher.undo()); await settle();
	expect(rig.project.structure.elements?.[0]?.assetId).toBe('asset-gone');
});

it('reports a refused replace through the mapped notice and leaves the placement as it was', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place('asset-gone', { x: 1000, y: 1000 }, 0, 'Old boiler');
	const inspector = await selectPlaced(rig, id, 1);
	const failure = { category: 'Persistence' as const, code: 'test.failed', message: 'Unavailable' };
	const refusal = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
	vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err(failure));
	await inspector.get('[data-rp-action="replace-asset"]').trigger('click'); await settle();
	rig.dialogs.resolve({ id: radiator.id });
	await settleUntil(() => refusal.mock.calls.length > 0, 'replace refusal');
	expect(refusal).toHaveBeenCalledWith(failure);
	expect(rig.project.structure.elements?.[0]?.assetId).toBe('asset-gone');
});

it('adds a placement-count material for the room pre-filled, counting the placement', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	await rig.runtime.refreshProjection();
	const inspector = await selectPlaced(rig, id, 1);
	await inspector.get('[data-rp-action="add-asset-material"]').trigger('click'); await settle();
	expect(rig.wrapper.get<HTMLSelectElement>('select[name="asset"]').element.value).toBe(radiator.id);
	expect(rig.wrapper.get<HTMLSelectElement>('select[name="rule"]').element.value).toBe('placement-count');
	await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit');
	await settleUntil(() => !rig.wrapper.find('[data-rp-form="planning"]').exists(), 'material save');
	const saved = expectDefined(expectOk(await rig.stack.requirements.listByZone(rig.room.id)).find(item => item.entity.assetId === radiator.id), 'placement material').entity;
	expect(saved.source?.rule).toBe('placement-count');
	expect(saved.calculatedFrom.zoneArea.value.toString()).toBe('1');
	expect(saved.quantity.calculated.value.toString()).toBe('1');
});

it('rotates a placement about its anchor and keeps its asset', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	await selectPlaced(rig, id, 1);
	await rig.runtime.rotationActions.rotate(id, 90); await settle();
	const rotated = expectDefined(rig.project.structure.elements?.[0], 'rotated placement');
	expect(rotated.assetId).toBe(radiator.id);
	expect(rotated.points[0]).toEqual({ x: 1000, y: 1000 });
	expect(Math.round(rotated.points[1].y)).toBe(2000);
});
