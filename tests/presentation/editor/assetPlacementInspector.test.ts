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
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';

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
	expect(inspector.findAll('.rp-inspector-subline').length).toBeGreaterThan(0);
	expect(inspector.element.lastElementChild?.matches('.rp-inspector-danger')).toBe(true);
	expect(inspector.get('.rp-inspector-danger [data-rp-action="delete-element"]').find('.rp-host-icon').exists()).toBe(true);
	// Delete is the foot of the whole Inspector region, not only of this body (side panels spec §3).
	const regionButtons = expectDefined(inspector.element.closest('[data-rp-region="inspector"]'), 'inspector region').querySelectorAll('button');
	expect(regionButtons[regionButtons.length - 1]?.getAttribute('data-rp-action')).toBe('delete-element');
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

it('notifies the fault once, logs it and leaves the placement when replace throws', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place('asset-gone', { x: 1000, y: 1000 }, 0, 'Old boiler');
	const inspector = await selectPlaced(rig, id, 1);
	const cause = new Error('Vault write failed');
	const fault = vi.spyOn(notices, 'notifyFault');
	vi.spyOn(rig.runtime.dispatcher, 'run').mockRejectedValueOnce(cause);
	await inspector.get('[data-rp-action="replace-asset"]').trigger('click'); await settle();
	rig.dialogs.resolve({ id: radiator.id });
	await settleUntil(() => fault.mock.calls.length > 0, 'replace fault');
	expect(fault).toHaveBeenCalledExactlyOnceWith(cause, rig.deps.commands.logger, 'editor.asset.write-failed');
	expect(rig.project.structure.elements?.[0]?.assetId).toBe('asset-gone');
	const draft = rig.runtime.elementTask.assets.draft;
	expect(draft.busy).toBe(false);
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

it('sizes a placement from the Inspector about its centre and resets it to the library size', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const inspector = await selectPlaced(rig, id, 1);
	expect(inspector.find('[data-rp-action="reset-asset-size"]').exists()).toBe(false);
	expect(inspector.get<HTMLInputElement>('input[name="asset-width"]').element.value).toBe(formatMetres(800));
	await inspector.get('input[name="asset-width"]').setValue(formatMetres(1200));
	await inspector.get('input[name="asset-width"]').trigger('change');
	await settleUntil(() => rig.project.structure.elements?.[0]?.size !== undefined, 'sized placement');
	expect(rig.project.structure.elements?.[0]?.size).toEqual({ width: 1200, depth: 600 });
	expect(rig.project.structure.elements?.[0]?.points[0]).toEqual({ x: 1000, y: 1000 });
	const sized = rig.wrapper.get('.rp-element-inspector');
	expect(sized.text()).toContain(tr('editor.asset.dimensions', { width: formatMetres(1200), depth: formatMetres(600) }));
	for (const [field, text] of [['asset-depth', 'not a length'], ['asset-width', 'not a length'], ['asset-depth', '0.0004']] as const) {
		await sized.get(`input[name="${field}"]`).setValue(text); await sized.get(`input[name="${field}"]`).trigger('change'); await settle();
		expect(rig.project.structure.elements?.[0]?.size).toEqual({ width: 1200, depth: 600 });
	}
	expect(sized.get<HTMLInputElement>('input[name="asset-depth"]').element.value).toBe(formatMetres(600));
	await sized.get('[data-rp-action="reset-asset-size"]').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.[0]?.size === undefined, 'reset placement');
	expect(rig.wrapper.get('.rp-element-inspector').find('[data-rp-action="reset-asset-size"]').exists()).toBe(false);
});

it('holds the size fields read-only while a save is in flight, and offers none outside Plan or for a missing asset', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	await selectPlaced(rig, id, 1);
	const save = useSaveStateStore(rig.pinia);
	save.beginSaving(); await settle();
	const width = rig.wrapper.get('.rp-element-inspector input[name="asset-width"]');
	expect(width.attributes('readonly')).toBeDefined(); expect(width.attributes('aria-disabled')).toBe('true');
	const command = vi.spyOn(rig.renovation, 'command');
	await width.setValue(formatMetres(1500)); await width.trigger('change'); await settle();
	expect(command).not.toHaveBeenCalled();
	save.resolveNeutral();
	rig.session.perspective = 'renovate'; await settle();
	expect(rig.wrapper.find('.rp-element-inspector input[name="asset-width"]').exists()).toBe(false);
	rig.session.perspective = 'plan';
	const gone = await rig.place('asset-gone', { x: 3000, y: 2000 }, 0, 'Old boiler');
	rig.selection.select([gone as never]); await settle();
	expect(rig.wrapper.find('.rp-element-inspector input[name="asset-width"]').exists()).toBe(false);
});
