// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { editorWith, KITCHEN_BEAM, POST_A, type EditorRig } from '../../helpers/structural';
import { postOutline, postSection } from '../../../src/domain/spatial/structuralElement';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import * as notices from '../../../src/presentation/notices/notify';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { pointerAt } from '../../helpers/tool-context';

const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('summarises a beam, switches load-bearing through undoable history, and edits its width', async () => {
	const rig = await editorWith(mounted, KITCHEN_BEAM);
	rig.selection.select([KITCHEN_BEAM.id as never]); await settle();
	const text = rig.wrapper.get('.rp-element-inspector').text();
	expect(text).toContain('Beam'); expect(text).toContain('3 m · 0.16 m wide');
	const toggle = rig.wrapper.get<HTMLInputElement>('input[name="load-bearing"]');
	expect(toggle.element.checked).toBe(true);
	toggle.element.click();
	await settleUntil(() => rig.project.structure.elements?.[0].loadBearing === false, 'switched off');
	expect(rig.wrapper.get<HTMLInputElement>('input[name="load-bearing"]').element.checked).toBe(false);
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.elements?.[0].loadBearing).toBe(true);
	const editing = rig.runtime.elementActions.edit(KITCHEN_BEAM.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="structural-edit"]');
	expect(form.find('input[name="structural-depth"]').exists()).toBe(false);
	await form.get('input[name="structural-width"]').setValue('0,2');
	await form.trigger('submit'); await editing; await settle();
	expect(rig.project.structure.elements?.[0]).toMatchObject({ width: 200, points: KITCHEN_BEAM.points, loadBearing: true });
});

it('summarises a post and resizes it about its centre from the dimensions form', async () => {
	const rig = await editorWith(mounted, POST_A);
	rig.selection.select([POST_A.id as never]); await settle();
	expect(rig.wrapper.get('.rp-element-inspector').text()).toContain('0.14 × 0.14 m');
	const editing = rig.runtime.elementActions.edit(POST_A.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="structural-edit"]');
	expect(form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
	await form.get('input[name="structural-width"]').setValue('0,2');
	await form.get('input[name="structural-depth"]').setValue('0,1');
	await form.trigger('submit'); await editing; await settle();
	const saved = expectDefined(rig.project.structure.elements?.[0], 'resized post');
	expect(saved.points).toEqual(postOutline({ x: 1000, y: 1000 }, 200, 100));
	expect(postSection(saved.points)).toEqual({ width: 200, depth: 100 });
});

const SIDE_BEAM: NamedSpatialElement = { ...KITCHEN_BEAM, points: [{ x: 500, y: 2000 }, { x: 3500, y: 2000 }] };
async function draggingPost(): Promise<{ rig: EditorRig; dragged: NamedSpatialElement['points'] }> {
	const rig = await editorWith(mounted, POST_A, SIDE_BEAM);
	rig.selection.select([POST_A.id as never]); await settle();
	rig.runtime.toolManager.pointerDown(pointerAt(1000, 1000)); rig.runtime.toolManager.pointerMove(pointerAt(1200, 1200));
	return { rig, dragged: expectDefined(rig.runtime.elementActions.preview.value, 'drag preview').points };
}

it('keeps a dragged post where the pointer has it while another element write settles, and starts no drag during one', async () => {
	const { rig, dragged } = await draggingPost(), actions = rig.runtime.elementActions, tools = rig.runtime.toolManager;
	await actions.setLoadBearing(SIDE_BEAM.id, false);
	expect(actions.preview.value?.points).toEqual(dragged);
	tools.pointerUp(pointerAt(1200, 1200));
	await settleUntil(() => rig.project.structure.elements?.find(item => item.id === POST_A.id)?.points[0].x === dragged[0].x, 'dropped post saved');
	const writing = actions.setLoadBearing(SIDE_BEAM.id, true);
	tools.pointerDown(pointerAt(1200, 1200)); tools.pointerMove(pointerAt(1500, 1500));
	expect(actions.preview.value).toBeNull();
	tools.pointerUp(pointerAt(1500, 1500)); await writing; await settle();
	expect(rig.project.structure.elements?.find(item => item.id === POST_A.id)?.points).toEqual(dragged);
});

it('holds a dropped post at its drop while its write runs, even when the selection moves on meanwhile', async () => {
	const { rig, dragged } = await draggingPost(), command = rig.renovation.command.bind(rig.renovation), shown: (string | undefined)[] = [];
	vi.spyOn(rig.renovation, 'command').mockImplementationOnce((baseline, input, ledger) => {
		const real = command(baseline, input, ledger);
		return { execute: () => { rig.selection.select([SIDE_BEAM.id as never]); shown.push(rig.runtime.elementActions.preview.value?.id); return real.execute(); }, undo: () => real.undo() };
	});
	rig.runtime.toolManager.pointerUp(pointerAt(1200, 1200));
	await settleUntil(() => !rig.runtime.elementActions.active.value, 'drop saved'); await settle();
	expect(shown).toEqual([POST_A.id]);
	expect(rig.project.structure.elements?.find(item => item.id === POST_A.id)?.points).toEqual(dragged);
});

it('refuses the load-bearing switch when a peer changes the beam behind the editor first', async () => {
	const rig = await editorWith(mounted, KITCHEN_BEAM);
	rig.selection.select([KITCHEN_BEAM.id as never]); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const peer = { ...KITCHEN_BEAM, width: 220 };
	expectOk(await rig.renovation.command(baseline, elementInput(baseline, peer), new SessionWriteLedger()).execute());
	const bytes = [...rig.stack.vault.entries];
	const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
	const toggle = rig.wrapper.get<HTMLInputElement>('input[name="load-bearing"]');
	expect(toggle.element.checked).toBe(true);
	toggle.element.click();
	await settleUntil(() => !rig.runtime.elementActions.active.value, 'refused stale load-bearing switch');
	expect(notify).toHaveBeenCalledOnce();
	expect(rig.wrapper.get<HTMLInputElement>('input[name="load-bearing"]').element.checked).toBe(true);
	expect(expectDefined(rig.project.structure.elements?.[0], 'refreshed beam').loadBearing).toBe(true);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});
