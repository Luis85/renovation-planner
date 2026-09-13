// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { ObsidianAssetGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { placedOutline } from '../../../src/domain/spatial/assetPlacement';
import { err } from '../../../src/core/result/Result';
import * as notices from '../../../src/presentation/notices/notify';
import { tr } from '../../../src/presentation/i18n/strings';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';

const CABINET = [{ x: 1000, y: 1000 }, { x: 2200, y: 1000 }, { x: 2200, y: 1600 }, { x: 1000, y: 1600 }];
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const rig of mounted.splice(0)) rig.unmount(); });

/** One reversible write of an item through the leaf's own dispatcher, from a fresh baseline: how an item is added, changed or removed here. */
async function saveItem(rig: Awaited<ReturnType<typeof renovationEditor>>, item: NamedSpatialElement, remove = false) {
	const read = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(read, elementInput(read, item, remove), rig.runtime.structureTask.ledger)));
	await settle();
}
async function withItem(kind: 'object' | 'path' = 'object') {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	const item = kind === 'object'
		? { id: 'element-cabinet', kind, name: 'Cabinet', points: CABINET }
		: { id: 'element-path', kind, name: 'Garden path', points: CABINET.slice(0, 2) };
	await saveItem(rig, item);
	rig.selection.select([item.id as never]); await settle();
	return { rig, item };
}
type Rig = Awaited<ReturnType<typeof withItem>>['rig'];
const assetNames = async (rig: Rig) => expectOk(await rig.stack.assets.listAll()).loaded.map(asset => asset.entity.name);
async function openMenu(rig: Rig) { rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); }
const closeMenu = (rig: Rig) => rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });
const promoteAction = (rig: Rig) => rig.wrapper.find('[data-rp-context-action="add-to-library"]');
async function promoteFromMenu(rig: Rig) { await openMenu(rig); await promoteAction(rig).trigger('click'); await settle(); }
async function submitDialog(rig: Rig) {
	const form = rig.wrapper.get('.rp-dialog-form');
	await form.get('[data-field="unitCostAmount"]').setValue('450.00');
	await form.trigger('submit');
}

it('turns an item into a placement of a new asset with the same id, name and outline, undone in one step', async () => {
	const { rig, item } = await withItem();
	await promoteFromMenu(rig);
	const form = rig.wrapper.get('.rp-dialog-form');
	expect(form.get<HTMLInputElement>('[data-field="name"]').element.value).toBe('Cabinet');
	expect(form.get('.rp-new-asset__outline').text()).toContain('1200 × 600');
	await submitDialog(rig);
	await settleUntil(() => rig.project.structure.elements?.[0]?.kind === 'asset', 'promoted item');

	const placed = expectDefined(rig.project.structure.elements?.[0], 'placement');
	expect(placed.id).toBe(item.id);
	expect(rig.project.plan?.spatialElements).toEqual([{ id: item.id, name: 'Cabinet' }]);
	const assetId = expectDefined(placed.assetId, 'asset id');
	expect(expectDefined(expectOk(await rig.stack.assets.getById(assetId as never)), 'asset').entity.name).toBe('Cabinet');
	const shape = expectDefined(expectOk(await new ObsidianAssetGeometrySidecar(rig.stack.assetGeometry).read(assetId as never)).document.shape, 'shape');
	expect(shape).toMatchObject({ footprintOrigin: 'typed', footprintPending: false });
	expect(placedOutline(placed, shape).footprint).toEqual(CABINET);
	expect(rig.wrapper.find('.rp-dialog-form').exists()).toBe(false);

	expectOk(await rig.runtime.dispatcher.undo()); await settle();
	expect(rig.project.structure.elements?.[0]).toMatchObject({ id: item.id, kind: 'object', points: CABINET });
});

it('changes nothing when the dialog is cancelled, and opens one dialog for two quick requests', async () => {
	const { rig, item } = await withItem();
	const promotion = rig.runtime.elementTask.promotion;
	const first = promotion.promote(item.id);
	await promotion.promote(item.id); await settle();
	expect(rig.wrapper.findAll('.rp-dialog-form')).toHaveLength(1);
	rig.dialogs.resolve('cancel'); await first; await settle();
	expect(rig.project.structure.elements?.[0]).toMatchObject({ id: item.id, kind: 'object' });
});

it('opens no dialog for an item with no label', async () => {
	const { rig, item } = await withItem();
	const names = await assetNames(rig);
	rig.project.plan = { ...expectDefined(rig.project.plan, 'plan'), spatialElements: [] };
	const pending = rig.runtime.elementTask.promotion.promote(item.id); await settle();
	expect(rig.wrapper.find('.rp-dialog-form').exists()).toBe(false);
	await pending;
	expect(await assetNames(rig)).toEqual(names);
});

it('warns once and leaves the item as it became when it is removed, moved or renamed while the dialog is open', async () => {
	const moved = CABINET.map(point => ({ x: point.x + 500, y: point.y }));
	for (const [change, remove] of [[{ points: moved }, false], [{ name: 'Tall cabinet' }, false], [{}, true]] as const) {
		const { rig, item } = await withItem();
		const warning = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined);
		const pending = rig.runtime.elementTask.promotion.promote(item.id); await settle();
		const changed = { ...item, ...change };
		await saveItem(rig, changed, remove);
		const became = { elements: rig.project.structure.elements, labels: rig.project.plan?.spatialElements };
		await submitDialog(rig); await pending; await settle();
		expect(warning).toHaveBeenCalledTimes(1);
		expect(warning).toHaveBeenCalledWith(tr('editor.asset.promote-unplaced'));
		expect(rig.project.structure.elements?.find(element => element.id === item.id)).toEqual(remove ? undefined : { id: item.id, kind: 'object', points: changed.points });
		expect({ elements: rig.project.structure.elements, labels: rig.project.plan?.spatialElements }).toEqual(became);
		vi.restoreAllMocks();
	}
});

it('is offered only for a plain item, outside Review, in a leaf that can create an asset', async () => {
	const path = await withItem('path');
	await openMenu(path.rig); expect(promoteAction(path.rig).exists()).toBe(false);
	await path.rig.runtime.elementTask.promotion.promote(path.item.id); await settle();
	expect(path.rig.wrapper.find('.rp-dialog-form').exists()).toBe(false);

	const { rig, item } = await withItem();
	await openMenu(rig); expect(promoteAction(rig).exists()).toBe(true);
	await closeMenu(rig);
	await rig.runtime.renovation.perspective('review'); await settle();
	await openMenu(rig); expect(promoteAction(rig).exists()).toBe(false);
	await closeMenu(rig);
	await rig.runtime.renovation.perspective('plan'); await settle();

	Reflect.deleteProperty(rig.deps.commands, 'assetCreation');
	await openMenu(rig); expect(promoteAction(rig).exists()).toBe(false);
	await rig.runtime.elementTask.promotion.promote(item.id); await settle();
	expect(rig.wrapper.find('.rp-dialog-form').exists()).toBe(false);
});

it('is not offered when the item is one of several selected', async () => {
	const { rig, item } = await withItem();
	rig.selection.select([item.id as never, rig.room.id]); await openMenu(rig);
	expect(promoteAction(rig).exists()).toBe(false);
});

it('is greyed and opens nothing while writes are blocked or an element action runs', async () => {
	const { rig } = await withItem();
	const expectRefused = async () => {
		await openMenu(rig);
		expect(promoteAction(rig).attributes('aria-disabled')).toBe('true');
		await promoteAction(rig).trigger('click'); await settle();
		expect(rig.wrapper.find('.rp-dialog-form').exists()).toBe(false);
		await closeMenu(rig);
	};
	rig.project.stale = true; await expectRefused(); rig.project.stale = false;
	rig.runtime.elementActions.active.value = true; await expectRefused(); rig.runtime.elementActions.active.value = false;
});

it('warns and leaves the item when the asset is created but the item cannot be replaced', async () => {
	const { rig, item } = await withItem();
	const warning = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined);
	await promoteFromMenu(rig);
	const run = vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.failed', message: 'Unavailable' }));
	await submitDialog(rig);
	await settleUntil(() => warning.mock.calls.length > 0, 'promotion warning'); await settle();
	expect(run).toHaveBeenCalled();
	expect(await assetNames(rig)).toContain('Cabinet');
	expect(warning).toHaveBeenCalledTimes(1);
	expect(warning).toHaveBeenCalledWith(tr('editor.asset.promote-unplaced'));
	expect(rig.project.structure.elements?.[0]).toMatchObject({ id: item.id, kind: 'object' });
});
