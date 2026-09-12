// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type Konva from 'konva';
import { Notice } from '../../helpers/obsidian-mock';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settle, settleUntil } from '../../helpers/editor';
import { pointerAt } from '../../helpers/tool-context';
import { expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { ok } from '../../../src/core/result/Result';
import { tr } from '../../../src/presentation/i18n/strings';
import { trError } from '../../../src/presentation/i18n/toUserMessage';
import { activateNotices, disposeNotices } from '../../../src/presentation/notices/notify';

type Rig = Awaited<ReturnType<typeof assetPlacementRig>>;
const mounted: Rig[] = [];
// A notice is inert until the plugin activates the queue, so the refusal case stands where the plugin stands.
beforeEach(() => { installObsidianDom(); activateNotices(); });
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); disposeNotices(); vi.restoreAllMocks(); });
const round = (n: number) => Math.round(n * 1e6) / 1e6 + 0;
const previews = (rig: Rig) => rig.stage.findOne<Konva.Layer>('.asset')?.find('.element-preview');

async function choose(rig: Rig, id: string, name: string) {
	const choosing = rig.runtime.elementTask.assets.choose([{ id, name }]); await settle();
	rig.dialogs.resolve({ id }); await choosing; await settle();
}

async function typePlacement(rig: Rig, x: string, y: string) {
	await rig.wrapper.get('input[name="asset-x"]').setValue(x);
	await rig.wrapper.get('input[name="asset-y"]').setValue(y);
	await rig.wrapper.get('[data-rp-form="asset-place"] form').trigger('submit');
}

it('places repeated copies, snapped to a wall face, each its own undo step, and Escape leaves the tool', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	await choose(rig, radiator.id, radiator.name);
	expect(rig.runtime.activeToolId.value).toBe('place-asset');
	rig.runtime.toolManager.pointerMove(pointerAt(1500, 1500)); await settle();
	expect(previews(rig)).toHaveLength(1);
	rig.runtime.toolManager.pointerDown(pointerAt(1500, 1500, 'secondary')); await settle();
	rig.runtime.toolManager.cancelInterruptedGesture(); await settle();
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	expect(previews(rig)).toHaveLength(0);
	rig.runtime.toolManager.pointerDown(pointerAt(2000, 100));
	rig.runtime.toolManager.pointerUp(pointerAt(2000, 100));
	await settleUntil(() => (rig.project.structure.elements ?? []).length === 1, 'first placement');
	const first = rig.project.structure.elements?.[0];
	expect(first).toMatchObject({ kind: 'asset', assetId: radiator.id });
	expect(first?.points.map(p => ({ x: round(p.x), y: round(p.y) }))).toEqual([{ x: 2000, y: 475 }, { x: 2000, y: 1475 }]);
	expect(rig.project.plan?.spatialElements?.find(item => item.id === first?.id)?.name).toBe('Radiator');
	rig.runtime.toolManager.pointerDown(pointerAt(1500, 1500));
	await settleUntil(() => (rig.project.structure.elements ?? []).length === 2, 'second placement');
	expect(rig.runtime.activeToolId.value).toBe('place-asset');
	expectOk(await rig.runtime.dispatcher.undo()); await settle();
	expect(rig.project.structure.elements).toHaveLength(1);
	await rig.wrapper.get('.rp-plan-canvas').trigger('keydown', { key: 'Escape' }); await settle();
	expect(rig.runtime.activeToolId.value).toBe('select');
	expect(previews(rig)).toHaveLength(0);
});

it('places at typed coordinates with the asset\'s own facing, and Done leaves the tool', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	await choose(rig, radiator.id, radiator.name);
	await typePlacement(rig, '', ''); await settle();
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	await typePlacement(rig, '1', '1,5');
	await settleUntil(() => (rig.project.structure.elements ?? []).length === 1, 'typed placement');
	expect(rig.project.structure.elements?.[0].points).toEqual([{ x: 1000, y: 1500 }, { x: 2000, y: 1500 }]);
	await rig.wrapper.get('[data-rp-action="done-placing"]').trigger('click'); await settle();
	expect(rig.runtime.activeToolId.value).toBe('select');
});

it('reports a placement written from a stale baseline through the mapped error, and writes nothing', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	await choose(rig, radiator.id, radiator.name);
	const stale = expectOk(await rig.renovation.read(rig.plan.id));
	await typePlacement(rig, '1', '1');
	await settleUntil(() => (rig.project.structure.elements ?? []).length === 1, 'first placement');
	vi.spyOn(rig.renovation, 'read').mockResolvedValueOnce(ok(stale));
	await typePlacement(rig, '2', '2');
	const draft = rig.runtime.elementTask.assets.draft;
	await settleUntil(() => draft.error !== null && !draft.busy, 'the conflict');
	expect(draft.error?.code).toMatch(/revision-conflict$/);
	expect(draft.conflict).toBe(true);
	const alert = rig.wrapper.get('[data-rp-form="asset-place"] [role="alert"]').text();
	expect(alert).toBe(trError(draft.error as NonNullable<typeof draft.error>));
	expect(alert).not.toBe(draft.error?.message);
	expect(rig.project.structure.elements).toHaveLength(1);
	expect(rig.runtime.activeToolId.value).toBe('place-asset');
});

it('refuses an asset with no footprint before the tool starts', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const sketch = await rig.saveAsset('Sketch', false);
	Notice.shown.length = 0;
	await choose(rig, sketch.id, sketch.name);
	expect(rig.runtime.activeToolId.value).toBe('select');
	expect(Notice.shown).toContain(tr('editor.asset.no-shape'));
});
