// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { registerEditorIcons } from '../../../src/plugin/editorIconRegistration';
import { pointerAt } from '../../helpers/tool-context';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { boundsOfZones } from '../../../src/presentation/editor/viewport/zoneExtent';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
let unregister: () => void;
beforeEach(() => { unregister = registerEditorIcons(); });
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); unregister(); });
async function setup(kind: 'stair' | 'arrow') {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	await rig.wrapper.get('[data-rp-action="add"]').trigger('click');
	expect(rig.wrapper.findAll('[data-rp-entry]')).toHaveLength(13);
	expect(rig.wrapper.find('[data-icon-missing]').exists()).toBe(false);
	await rig.wrapper.get(`[data-rp-entry="${kind}"]`).trigger('click');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'element baseline');
	return rig;
}
async function finish(rig: Awaited<ReturnType<typeof setup>>) {
	await rig.wrapper.get('[data-rp-action="finish-element"]').trigger('click');
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'element saved');
	return expectDefined(rig.project.structure.elements?.[0], 'saved element');
}

it('creates, renders, edits and rotates a stair with one geometry/metadata history and a full-width hit target', async () => {
	const rig = await setup('stair');
	await rig.wrapper.get('[data-rp-form="stair-parameters"]').trigger('submit');
	const saved = await finish(rig);
	expect(saved).toMatchObject({ kind: 'stair', points: [{ x: 0, y: 0 }, { x: 0, y: -3000 }], stair: { width: 900, treads: 12, direction: 'up' } });
	expect(rig.stage.find('.stair-tread')).toHaveLength(11);
	expect(rig.stage.findOne('.stair-direction')?.getClassName()).toBe('Arrow');
	const candidates = structureCandidates(rig.project.structure), candidate = expectDefined(candidates.find(value => value.id === saved.id), 'stair candidate');
	expect(candidate.points).toHaveLength(2); expect(candidate.hitPoints).toHaveLength(4);
	expect(boundsOfZones([candidate])).toEqual({ min: { x: -450, y: -3000 }, max: { x: 450, y: 0 } });
	expect(resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: { x: 400, y: -1500 }, handleToleranceWorld: 8 })).toEqual({ kind: 'body', id: saved.id });
	const editing = rig.runtime.elementActions.edit(saved.id); await settle();
	await rig.wrapper.get('[data-rp-form="stair-edit"] input[name="name"]').setValue('Back stairs');
	await rig.wrapper.get('[data-rp-form="stair-edit"] input[name="stair-width"]').setValue('1,2');
	await rig.wrapper.get('[data-rp-form="stair-edit"] input[name="stair-run"]').setValue('4');
	await rig.wrapper.get('[data-rp-form="stair-edit"] input[name="stair-treads"]').setValue('8');
	await rig.wrapper.get('[data-rp-form="stair-edit"] select[name="stair-direction"]').setValue('down');
	const preview = rig.runtime.elementActions.preview.value;
	await rig.wrapper.get('[data-rp-form="stair-edit"]').trigger('submit'); await editing; await settle();
	expect(rig.project.structure.elements?.[0]).toMatchObject({ points: preview?.points, stair: { width: 1200, treads: 8, direction: 'down' } });
	expect(rig.project.plan?.spatialElements?.[0].name).toBe('Back stairs'); expect(rig.stage.find('.stair-tread')).toHaveLength(7);
	await rig.runtime.undo(); await settle(); expect(rig.project.structure.elements?.[0]).toEqual(saved);
	await rig.runtime.redo(); await settle();
	const before = expectDefined(rig.project.structure.elements?.[0], 'edited stair'), pivot = expectDefined(rotationPivot(before), 'centreline pivot');
	await rig.runtime.rotationActions.rotate(saved.id, 90); await settle();
	expect(rig.project.structure.elements?.[0]).toEqual({ ...before, points: rotationPoints(before, 90, pivot) });
	const fresh = expectOk(await rig.renovation.read(rig.plan.id)); expect(fresh.geometry.document.structure?.elements?.[0]).not.toHaveProperty('name');
	expect(fresh.plan.entity.spatialElements?.[0].name).toBe('Back stairs');
});

it('keeps invalid stair dimensions in the draft and cancels without changing the vault', async () => {
	const rig = await setup('stair'), before = [...rig.stack.vault.entries];
	await rig.wrapper.get('input[name="stair-treads"]').setValue('1.5');
	await rig.wrapper.get('[data-rp-form="stair-parameters"]').trigger('submit');
	await rig.runtime.elementTask.finish(); await settle();
	expect(rig.runtime.elementTask.draft.pendingInput).toBe(true);
	expect(rig.wrapper.get('input[name="stair-treads"]').attributes('aria-invalid')).toBe('true');
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	await rig.runtime.cancelActiveTask(); await settle(); expect([...rig.stack.vault.entries]).toEqual(before);
});

it('draws an independent arrowhead, edits a selected endpoint and restores it through Undo', async () => {
	const rig = await setup('arrow'), tools = rig.runtime.toolManager;
	for (const point of [{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 1500 }]) { tools.pointerDown(pointerAt(point.x, point.y)); tools.pointerUp(pointerAt(point.x, point.y)); }
	const saved = await finish(rig);
	expect(saved.kind).toBe('arrow'); expect(saved.points).toHaveLength(3);
	const arrow = expectDefined(rig.stage.findOne<Konva.Arrow>('.direction-arrow'), 'native arrow');
	expect(arrow.getClassName()).toBe('Arrow'); expect(arrow.points()).toEqual(saved.points.flatMap(point => [point.x, point.y]));
	expect(rig.stage.find('.arrow-endpoint')).toHaveLength(3);
	tools.pointerDown(pointerAt(2500, 1500)); tools.pointerMove(pointerAt(3500, 1500)); tools.pointerUp(pointerAt(3500, 1500)); await settle();
	expect(rig.project.structure.elements?.[0].points).toEqual([saved.points[0], saved.points[1], { x: 3500, y: 1500 }]);
	await rig.runtime.undo(); await settle(); expect(rig.project.structure.elements?.[0]).toEqual(saved);
	const before = [...rig.stack.vault.entries];
	tools.pointerDown(pointerAt(2500, 1500)); tools.pointerMove(pointerAt(2500, 500)); tools.pointerUp(pointerAt(2500, 500)); await settle();
	expect(rig.project.structure.elements?.[0]).toEqual(saved); expect([...rig.stack.vault.entries]).toEqual(before);
	tools.pointerDown(pointerAt(2500, 1500)); tools.pointerMove(pointerAt(3500, 1500)); tools.cancelGesture(); tools.pointerUp(pointerAt(3500, 1500)); await settle();
	expect(rig.project.structure.elements?.[0]).toEqual(saved); expect(rig.runtime.elementActions.preview.value).toBeNull();
	await rig.runtime.renovation.perspective('review'); await settle(); expect(rig.stage.find('.arrow-endpoint')).toHaveLength(0);
});

it('refuses pointer proposals captured before a stair parameter-only peer edit', async () => {
	const rig = await setup('stair');
	await rig.wrapper.get('[data-rp-form="stair-parameters"]').trigger('submit');
	const original = await finish(rig), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const options = expectDefined(original.stair, 'stair options');
	const peer = { ...original, name: 'Peer stair', stair: { ...options, width: 1400 } };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, peer), rig.runtime.structureTask.ledger)));
	const before = [...rig.stack.vault.entries], moved = original.points.map(point => ({ x: point.x + 400, y: point.y }));
	await rig.runtime.elementActions.move(original.id, moved, original);
	const pivot = expectDefined(rotationPivot(original), 'pivot');
	await rig.runtime.rotationActions.move(original.id, expectDefined(rotationPoints(original, 90, pivot), 'rotation'), original);
	expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.project.structure.elements?.[0]).toMatchObject({ points: original.points, stair: { width: 1400 } });
	expect(rig.project.plan?.spatialElements?.[0].name).toBe('Peer stair');
});
