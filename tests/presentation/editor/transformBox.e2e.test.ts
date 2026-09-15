// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { CABINET, selectedItemRig } from '../../helpers/transformBox';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { resizeTransformBox, sizedTransformBox } from '../../../src/presentation/editor/elements/transformBox';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import * as notices from '../../../src/presentation/notices/notify';

type Rig = Awaited<ReturnType<typeof assetPlacementRig>>;
const mounted: Rig[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const rig of mounted.splice(0)) rig.unmount(); });
const shown = (rig: Rig, id: string) => rig.project.structure.elements?.find(element => element.id === id);

it('resizes a selected item through its transform box in one undoable write', async () => {
	const rig = await selectedItemRig(); mounted.push(rig);
	const frame = expectDefined(rig.runtime.elementActions.transformBox.value, 'item box');
	await rig.runtime.elementActions.resize(CABINET.id, expectDefined(resizeTransformBox(frame, 4, { x: 2500, y: 1500 }, false), 'resize'), frame.element); await settle();
	expect(shown(rig, CABINET.id)?.points).toEqual([{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 1500 }, { x: 500, y: 1500 }]);
	expect(shown(rig, CABINET.id)).not.toHaveProperty('size');
	await rig.runtime.undo(); await settle(); expect(shown(rig, CABINET.id)?.points).toEqual(CABINET.points);
	await rig.runtime.redo(); await settle(); expect(shown(rig, CABINET.id)?.points[2]).toEqual({ x: 2500, y: 1500 });
});

it('previews the resized geometry and refuses a resize whose element changed since the gesture captured it', async () => {
	const rig = await selectedItemRig(); mounted.push(rig);
	const frame = expectDefined(rig.runtime.elementActions.transformBox.value, 'item box');
	const next = expectDefined(resizeTransformBox(frame, 4, { x: 2500, y: 1500 }, false), 'resize');
	rig.runtime.elementActions.previewResize(CABINET.id, next);
	expect(rig.runtime.elementActions.preview.value?.points).toEqual(next.points);
	rig.runtime.elementActions.previewResize(null);
	expect(rig.runtime.elementActions.preview.value).toBeNull();
	const refusal = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
	await rig.runtime.elementActions.resize(CABINET.id, next, { ...frame.element, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] });
	expect(refusal).toHaveBeenCalledOnce();
	expect(shown(rig, CABINET.id)?.points).toEqual(CABINET.points);
});

it('gives one placement its own size at schema 15 and resets it, leaving the asset and another placement alone', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig); rig.changePlan(); await settle();
	const sofa = await rig.saveAsset('Sofa'), first = await rig.place(sofa.id, { x: 1000, y: 1000 }), second = await rig.place(sofa.id, { x: 2500, y: 1000 });
	const library = await rig.stack.assets.getById(sofa.id);
	rig.selection.select([first as never]);
	await settleUntil(() => rig.runtime.elementActions.transformBox.value !== null, 'placement box');
	useWorkspaceStore(rig.pinia).toggleLayer('asset'); await settle();
	expect(rig.runtime.elementActions.transformBox.value).toBeNull();
	useWorkspaceStore(rig.pinia).toggleLayer('asset'); await settle();
	const frame = expectDefined(rig.runtime.elementActions.transformBox.value, 'placement box');
	await rig.runtime.elementActions.resize(first, expectDefined(sizedTransformBox(frame, { width: 1600, depth: 900 }), 'sized'), frame.element); await settle();
	expect(shown(rig, first)?.size).toEqual({ width: 1600, depth: 900 });
	expect(shown(rig, second)).not.toHaveProperty('size');
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(15);
	expect(await rig.stack.assets.getById(sofa.id)).toEqual(library);
	const refusal = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
	// The pre-resize frame no longer matches: same points, different size.
	await rig.runtime.elementActions.resize(first, expectDefined(sizedTransformBox(frame, { width: 1000, depth: 600 }), 'stale'), frame.element);
	expect(refusal).toHaveBeenCalledOnce(); expect(shown(rig, first)?.size).toEqual({ width: 1600, depth: 900 });
	refusal.mockRestore();
	const sized = expectDefined(rig.runtime.elementActions.transformBox.value, 'sized box');
	await rig.runtime.elementActions.resize(first, expectDefined(sizedTransformBox(sized, { width: 800, depth: 600 }), 'reset'), sized.element); await settle();
	expect(shown(rig, first)).not.toHaveProperty('size');
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBeLessThan(15);
});

it('offers a box only for one selected item or placeable placement in Plan, with its layer shown', async () => {
	const rig = await selectedItemRig(); mounted.push(rig);
	const box = () => rig.runtime.elementActions.transformBox.value, workspace = useWorkspaceStore(rig.pinia);
	expect(box()?.element.id).toBe(CABINET.id);
	rig.session.perspective = 'renovate'; await settle(); expect(box()).toBeNull();
	rig.session.perspective = 'plan'; await settle(); expect(box()).not.toBeNull();
	workspace.toggleLayer('architecture'); await settle(); expect(box()).toBeNull();
	workspace.toggleLayer('architecture'); await settle();
	rig.selection.select([CABINET.id, rig.room.id] as never); await settle(); expect(box()).toBeNull();
	rig.selection.select([rig.room.id as never]); await settle(); expect(box()).toBeNull();
	const missing = await rig.place('asset-gone', { x: 3000, y: 2000 }, 0, 'Old boiler');
	rig.selection.select([missing as never]); await settle(); expect(box()).toBeNull();
});

it('drops a placement’s own size when it is replaced by another asset', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig); rig.changePlan(); await settle();
	const sofa = await rig.saveAsset('Sofa'), chair = await rig.saveAsset('Chair'), id = await rig.place(sofa.id, { x: 1000, y: 1000 });
	rig.selection.select([id as never]);
	await settleUntil(() => rig.runtime.elementActions.transformBox.value !== null, 'placement box');
	const frame = expectDefined(rig.runtime.elementActions.transformBox.value, 'placement box');
	await rig.runtime.elementActions.resize(id, expectDefined(sizedTransformBox(frame, { width: 1600, depth: 900 }), 'sized'), frame.element); await settle();
	void rig.runtime.elementTask.assets.replace(id, [{ id: chair.id, name: 'Chair' }]); await settle();
	rig.dialogs.resolve({ id: chair.id });
	await settleUntil(() => shown(rig, id)?.assetId === chair.id, 'replaced asset');
	expect(shown(rig, id)).not.toHaveProperty('size');
});
