// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import type { Opening } from '../../../src/domain/spatial/Structure';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { err } from '../../../src/core/result/Result';
import { defer } from '../../helpers/async';
import { seedOpeningDirectWorkspace } from '../../harness/openingDirectWorkspace';
import { pointerAt } from '../../helpers/tool-context';
import { createOpeningDirectDraft } from '../../../src/presentation/editor/structure/openingDirectDraft';
import { openingDirectLayout } from '../../../src/presentation/editor/structure/openingDirectLayout';
import { resizeTo } from '../../helpers/layout';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
const door: Opening = { id: 'opening-direct-door', kind: 'door', hostId: 'wall-a', offset: 800, width: 900, height: 2100, sill: 0, swing: { hinge: 'end', side: 'right', angle: 45 } };
async function setup(openings: readonly Opening[] = [door]) {
	const rig = await structureEditor(); mounted.push(rig);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...WALL_LOOP, openings } }, baseline.version));
	await rig.runtime.refreshProjection(); rig.selection.select([(openings[0] ?? door).id as never]); await settle();
	return rig;
}
afterEach(() => mounted.splice(0).forEach(rig => rig.unmount()));

it('uses one selected-opening panel from Inspector and context actions, centre-anchors width, and reverses exactly', async () => {
	const rig = await setup();
	await rig.wrapper.get('[data-rp-action="opening-size-swing"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('.rp-opening-direct-panel').exists(), 'direct opening panel');
	expect(rig.wrapper.get('.rp-opening-direct-panel').text()).toContain('Door size and swing');
	const width = rig.wrapper.get<HTMLInputElement>('.rp-opening-direct-panel input[name="width"]');
	await width.setValue('1.1'); await settle();
	expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...door, width: 1100, offset: 700 }]);
	expect(rig.wrapper.get<HTMLInputElement>('.rp-opening-direct-panel input[name="offset"]').element.value).toBe('0.7');
	await rig.wrapper.get('[aria-label="Move toward wall end by 10 mm"]').trigger('click');
	expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...door, width: 1100, offset: 710 }]);
	await rig.wrapper.get<HTMLInputElement>('.rp-opening-direct-panel input[name="offset"]').setValue('0.7');
	expect(rig.wrapper.get('[aria-label="Decrease width by 10 mm"]').attributes('type')).toBe('button');
	const write = vi.spyOn(rig.geometry, 'write');
	await rig.wrapper.get('.rp-opening-direct-panel').trigger('submit');
	await settleUntil(() => !rig.runtime.structureActions.openingDirect.target.value, 'direct opening write');
	expect(write).toHaveBeenCalledTimes(1); expect(rig.project.structure.openings).toEqual([{ ...door, width: 1100, offset: 700 }]);
	await rig.runtime.undo(); expect(rig.project.structure.openings).toEqual([door]);
	await rig.runtime.redo(); expect(rig.project.structure.openings).toEqual([{ ...door, width: 1100, offset: 700 }]);
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ContextMenu' })); await settle();
	expect(rig.wrapper.find('[data-rp-context-action="opening-width"]').exists()).toBe(true);
	expect(rig.wrapper.find('[data-rp-context-action="opening-offset"]').exists()).toBe(true);
	expect(rig.wrapper.find('[data-rp-context-action="opening-swing"]').exists()).toBe(true);
});

it('refuses invalid containment and overlap without resizing or adding history', async () => {
	const other = { ...door, id: 'opening-direct-other', offset: 2200 };
	const rig = await setup([door, other]); await rig.runtime.structureActions.openingDirect.begin(door.id);
	await settleUntil(() => rig.wrapper.find('.rp-opening-direct-panel').exists(), 'direct opening panel');
	await rig.wrapper.get<HTMLInputElement>('.rp-opening-direct-panel input[name="width"]').setValue('4.5'); await settle();
	expect(rig.wrapper.find('.rp-opening-direct-panel [role="alert"]').text()).toContain('fit within');
	expect(rig.runtime.structureActions.preview.value).toBeNull();
	await rig.wrapper.get('.rp-opening-direct-panel').trigger('submit');
	expect(rig.project.structure.openings).toEqual([door, other]); expect(rig.runtime.canUndo.value).toBe(false);
});

it('retires a pending panel read on a perspective departure and refuses the old Renovate move action', async () => {
	const rig = await setup(), session = useRenovationSession(rig.pinia);
	const response = await rig.services.read(rig.plan.id); let release!: () => void;
	vi.spyOn(rig.services, 'read').mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(response); }));
	const pending = rig.runtime.structureActions.openingDirect.begin(door.id); session.perspective = 'renovate'; release(); await pending;
	expect(rig.runtime.structureActions.openingDirect.target.value).toBeNull(); expect(rig.project.structure.openings).toEqual([door]);
	expect(rig.runtime.openingMove.start(door.id)).toBe(false);
});

it('steps exact raw millimetres, preserves the current centre, and leaves an untouched default swing absent', async () => {
	const fractional: Opening = { id: 'opening-fractional', kind: 'door', hostId: 'wall-a', offset: 1200.2, width: 900.4, height: 2100, sill: 0 };
	const rig = await setup([fractional]); await rig.runtime.structureActions.openingDirect.begin(fractional.id);
	await settleUntil(() => rig.runtime.structureActions.openingDirect.target.value === fractional.id, 'fractional direct panel');
	const control = rig.runtime.structureActions.openingDirect;
	expect(control.changed.value).toBe(false); control.step('width', 1);
	expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...fractional, width: 910.4, offset: 1195.2 }]);
	control.step('offset', 1); expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...fractional, width: 910.4, offset: 1205.2 }]);
	control.step('width', 1); expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...fractional, width: 920.4, offset: 1200.2 }]);
	control.close(); await rig.runtime.structureActions.openingDirect.begin(fractional.id);
	await settleUntil(() => control.target.value === fractional.id, 'fresh fractional panel');
	const write = vi.spyOn(rig.geometry, 'write'); await control.apply(); expect(write).not.toHaveBeenCalled();
	control.step('offset', 1); control.step('width', 1);
	expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...fractional, width: 910.4, offset: 1205.2 }]);
	control.update('width', ''); control.update('width', '0,9204');
	expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...fractional, width: 920.4, offset: 1200.2 }]);
});

it.each(['cancel', 'selection', 'perspective', 'tool', 'host', 'unmount'] as const)('retires an initial read after %s, including away and back', async reason => {
	const rig = await setup(), control = rig.runtime.structureActions.openingDirect;
	const response = await rig.services.read(rig.plan.id), gate = defer<typeof response>();
	vi.spyOn(rig.services, 'read').mockReturnValueOnce(gate.promise);
	const pending = control.begin(door.id), write = vi.spyOn(rig.geometry, 'write');
	retire(rig, reason); gate.resolve(response); await pending; await control.apply();
	expect(control.target.value).toBeNull(); expect(rig.runtime.structureActions.preview.value).toBeNull(); expect(write).not.toHaveBeenCalled();
});

function retire(rig: Awaited<ReturnType<typeof setup>>, reason: string): void {
	const session = useRenovationSession(rig.pinia);
	if (reason === 'selection') { rig.selection.select([]); rig.selection.select([door.id as never]); }
	else if (reason === 'perspective') { session.perspective = 'renovate'; session.perspective = 'plan'; }
	else if (reason === 'tool') { rig.runtime.setTool('pan'); rig.runtime.setTool('select'); }
	else if (reason === 'host') { const before = rig.project.structure; rig.project.structure = { ...before, walls: [] }; rig.project.structure = before; }
	else if (reason === 'unmount') rig.unmount();
	else rig.runtime.structureActions.openingDirect.close();
}

it.each(['cancel', 'selection', 'perspective', 'tool', 'host', 'unmount'] as const)('guards the initial write around its asynchronous version read after %s', async reason => {
	const rig = await setup(), control = rig.runtime.structureActions.openingDirect;
	await control.begin(door.id); control.step('width', 1);
	const response = await rig.geometry.read(rig.plan.id), gate = defer<typeof response>();
	vi.spyOn(rig.geometry, 'read').mockReturnValueOnce(gate.promise);
	const write = vi.spyOn(rig.geometry, 'write'), pending = control.apply();
	await settle(); retire(rig, reason); gate.resolve(response); await pending;
	expect(write).not.toHaveBeenCalled(); expect(rig.runtime.canUndo.value).toBe(false);
	expect(rig.runtime.structureActions.active.value).toBe(false);
});

it('refuses action admission for hidden architecture, a gesture and non-Plan modes', async () => {
	const rig = await setup(), control = rig.runtime.structureActions.openingDirect, session = useRenovationSession(rig.pinia), workspace = useWorkspaceStore(rig.pinia);
	const read = vi.spyOn(rig.services, 'read');
	for (const perspective of ['renovate', 'review'] as const) { session.perspective = perspective; await control.begin(door.id); expect(rig.runtime.openingMove.start(door.id)).toBe(false); }
	session.perspective = 'plan'; workspace.toggleLayer('architecture'); await control.begin(door.id);
	workspace.toggleLayer('architecture'); rig.runtime.toolManager.pointerDown(pointerAt(0, 0)); await control.begin(door.id);
	expect(read).not.toHaveBeenCalled();
});

it('refuses zero, malformed, out-of-host and overlapping proposals without silent correction', async () => {
	const rig = await setup([door, { ...door, id: 'opening-other', offset: 2200 }]), control = rig.runtime.structureActions.openingDirect;
	await control.begin(door.id); const write = vi.spyOn(rig.geometry, 'write');
	for (const value of ['0', 'bad', '1,2,3', '5']) { control.update('width', value); await control.apply(); expect(control.invalid.value).toBe(true); }
	control.close(); await control.begin(door.id); control.update('offset', '2.1');
	expect(control.error.value?.code).toBe('spatial.opening-overlap'); await control.apply();
	control.update('offset', '3.9'); expect(control.error.value?.code).toBe('spatial.opening-containment'); await control.apply();
	expect(write).not.toHaveBeenCalled(); expect(rig.project.structure.openings[0]).toEqual(door);
});

it('preserves curved asymmetric hosts and unrelated current/intended geometry through a window edit and exact history', async () => {
	const rig = await setup(); await seedOpeningDirectWorkspace(rig.geometry, rig.plan.id);
	const seed = expectOk(await rig.geometry.read(rig.plan.id));
	const colored = { id: 'element-r01-color', kind: 'object' as const, points: [{ x: 0, y: 500 }, { x: 500, y: 500 }, { x: 500, y: 1000 }], color: 'blue' as const };
	expectOk(await rig.geometry.write(rig.plan.id, { ...seed.document, structure: { ...expectDefined(seed.document.structure, 'seeded structure'), elements: [colored] }, intended: seed.document.structure }, seed.version));
	await rig.runtime.refreshProjection(); rig.selection.select(['opening-r01-window' as never]);
	const before = expectOk(await rig.geometry.read(rig.plan.id)).document, control = rig.runtime.structureActions.openingDirect;
	await control.begin('opening-r01-window'); control.step('width', 1); control.updateSwing({ hinge: 'end', side: 'right', angle: '30' }); await control.apply();
	const after = expectOk(await rig.geometry.read(rig.plan.id)).document;
	expect(after.structure?.walls).toEqual(before.structure?.walls); expect(after.structure?.elements).toEqual(before.structure?.elements); expect(after.intended).toEqual(before.intended);
	expect(after.structure?.openings[1]).toMatchObject({ width: 1210, offset: 1795, height: 1200, sill: 900, swing: { hinge: 'end', side: 'right', angle: 30 } });
	await rig.runtime.undo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
	await rig.runtime.redo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(after);
});

it('refuses an externally changed baseline and retains a retryable ordinary write refusal', async () => {
	const rig = await setup(), control = rig.runtime.structureActions.openingDirect;
	await control.begin(door.id); control.step('width', 1);
	const write = vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	await control.apply(); expect(control.error.value).not.toBeNull(); expect(control.target.value).toBe(door.id);
	await control.apply(); expect(write).toHaveBeenCalledTimes(2);
	await control.begin(door.id); control.step('width', 1);
	const before = expectOk(await rig.geometry.read(rig.plan.id)); expectOk(await rig.geometry.write(rig.plan.id, before.document, before.version));
	await control.apply(); expect(control.paused.value).toBe(true);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
});

it('closes after a successful save with failed read-back; retry refreshes without a second dispatch', async () => {
	const rig = await setup(), control = rig.runtime.structureActions.openingDirect;
	await control.begin(door.id); control.step('width', 1);
	const write = vi.spyOn(rig.geometry, 'write'), readback = vi.spyOn(rig.deps.queries, 'findZonesByPlan').mockResolvedValue(err(injectedPersistenceError()));
	await control.apply(); expect(control.target.value).toBeNull(); expect(rig.project.stale).toBe(true);
	await control.apply(); await rig.runtime.refreshProjection(); expect(write).toHaveBeenCalledTimes(1);
	readback.mockRestore(); await rig.runtime.refreshProjection(); expect(rig.project.structure.openings[0]).toMatchObject({ width: 910, offset: 795 });
	await rig.runtime.undo(); expect(rig.project.structure.openings).toEqual([door]);
});

it('does not let an inactive overlay steal Escape and returns focus after keyboard panel cancellation', async () => {
	const rig = await setup(); rig.canvasEl.focus();
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await settle();
	expect(rig.selection.selectedIds).toEqual([]); rig.selection.select([door.id as never]); await settle();
	const opener = rig.wrapper.get<HTMLElement>('[data-rp-action="opening-size-swing"]'); opener.element.focus(); await opener.trigger('click'); await settle();
	const field = rig.wrapper.get<HTMLElement>('.rp-opening-direct-panel input[name="width"]');
	expect(field.element.ownerDocument.activeElement).toBe(field.element);
	await field.trigger('keydown', { key: 'Escape', ctrlKey: true }); expect(rig.runtime.structureActions.openingDirect.target.value).toBe(door.id);
	await field.trigger('keydown', { key: 'Escape' }); await settle(); expect(rig.selection.selectedIds).toEqual([door.id]);
	expect(rig.runtime.structureActions.openingDirect.target.value).toBeNull();
});

it.each(['width', 'offset', 'swing'] as const)('opens the %s task and compact menu with the same keyboard panel', async field => {
	const rig = await setup();
	for (const menu of [false, true]) {
		if (menu) rig.wrapper.get<HTMLDetailsElement>('.rp-opening-direct-action details').element.open = true;
		const button = menu ? rig.wrapper.get(`.rp-opening-direct-menu button:nth-child(${['width', 'offset', 'swing'].indexOf(field) + 1})`) : rig.wrapper.get(`[data-rp-action="opening-${field}"]`);
		button.element.dispatchEvent(new MouseEvent('click', { bubbles: true })); await settle();
		expect(rig.runtime.structureActions.openingDirect.focusField.value).toBe(field);
		await rig.wrapper.get('.rp-opening-direct-panel [name="width"]').setValue('0.95');
		await rig.wrapper.get('.rp-opening-direct-panel [name="offset"]').setValue('0.85');
		await rig.wrapper.get('[aria-label="Decrease width by 10 mm"]').trigger('click');
		await rig.wrapper.get('[aria-label="Move toward wall start by 10 mm"]').trigger('click');
		await rig.wrapper.get('[name="opening-hinge"]').setValue('start');
		await rig.wrapper.get('[name="opening-side"]').setValue('left');
		await rig.wrapper.get('[name="opening-angle"]').setValue('60');
		await rig.wrapper.get('.rp-opening-direct-footer button').trigger('click'); await settle();
		expect(rig.project.structure.openings).toEqual([door]); expect(rig.runtime.canUndo.value).toBe(false);
	}
});

it('keeps modified/composing Enter inside fields and closes a compact disclosure before the selection', async () => {
	const rig = await setup(), menu = rig.wrapper.get<HTMLDetailsElement>('.rp-opening-direct-action details');
	menu.element.open = true; await menu.trigger('keydown', { key: 'Escape' }); expect(menu.element.open).toBe(false); expect(rig.selection.selectedIds).toEqual([door.id]);
	await rig.runtime.structureActions.openingDirect.begin(door.id); await settle();
	const input = rig.wrapper.get('[name="width"]');
	for (const flags of [{repeat:true},{isComposing:true},{ctrlKey:true},{shiftKey:true},{altKey:true},{metaKey:true}]) {
		const event = new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true, ...flags}); input.element.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
	}
	rig.rootEl.dispatchEvent(new Event('pointerdown', {bubbles:true})); await settle(); expect(rig.runtime.structureActions.openingDirect.target.value).toBeNull();
});

it.each(['refused', 'throw', 'stale', 'deleted'] as const)('handles a %s baseline without opening a writable draft', async outcome => {
	const rig = await setup(), control = rig.runtime.structureActions.openingDirect;
	const read = vi.spyOn(rig.services, 'read'), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	if (outcome === 'refused') read.mockResolvedValueOnce(err(injectedPersistenceError()));
	else if (outcome === 'throw') read.mockRejectedValueOnce(new Error('read failed'));
	else read.mockResolvedValueOnce({ ok:true, value:{ ...baseline, document:{...baseline.document, structure:{...rig.project.structure, openings:outcome === 'deleted' ? [] : [{...door,width:800}]}}}});
	await control.begin(door.id); expect(control.target.value).toBeNull(); expect(rig.runtime.canUndo.value).toBe(false);
});

it('retires an uncertain dispatcher throw and rejects invalid swing before any write', async () => {
	const rig = await setup(), control = rig.runtime.structureActions.openingDirect;
	await control.begin(door.id); control.updateSwing({hinge:'start',side:'left',angle:'bad'});
	expect(control.invalid.value).toBe(true); await control.apply();
	control.updateSwing({hinge:'start',side:'left',angle:'30'});
	const run=vi.spyOn(rig.runtime.dispatcher,'run').mockRejectedValueOnce(new Error('uncertain dispatch'));
	await control.apply(); await control.apply(); expect(run).toHaveBeenCalledTimes(1); expect(control.paused.value).toBe(true);
});

it('keeps negative offset and broken drafts explicit, and lays controls outside each side of an opening', () => {
	const draft = createOpeningDirectDraft();
	draft.reset({...door,kind:'opening'}); draft.update('offset','bad'); draft.step('offset',1); expect(draft.propose(WALL_LOOP,door)).toBeNull();
	draft.update('offset','-0.02'); expect(draft.propose({...WALL_LOOP,openings:[door]},door)?.openings[0].offset).toBe(-20);
	draft.update('width','0'); expect(draft.propose(WALL_LOOP,door)).toBeNull();
	for (const pan of [{x:0,y:0},{x:1000,y:-1000},{x:-1000,y:1000},{x:1000,y:1000}]) {
		const layout=openingDirectLayout(door,WALL_LOOP.walls[0],{zoom:0.1,pan},800,600); expect(Number.parseFloat(layout.width)).toBeGreaterThan(0);
	}
	expect(openingDirectLayout(door,WALL_LOOP.walls[0],{zoom:2,pan:{x:900,y:-100}},100,10).maxHeight).toBe('44px');
});

it.each([320, 399])('keeps a selected opening editable at %s px without enabling the canvas', async width => {
	const rig = await setup(), control = rig.runtime.structureActions.openingDirect;
	await control.begin(door.id); control.step('width',1);
	const editor = useEditorStore(rig.pinia), viewport = {...editor.viewport}; resizeTo(rig.rootEl,width,900); await settle();
	expect(control.target.value).toBeNull(); expect(rig.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
	expect(rig.selection.selectedIds).toEqual([door.id]); expect(editor.viewport).toEqual(viewport);
	await rig.wrapper.get('.rp-opening-direct-narrow [data-rp-action="opening-width"]').trigger('click'); await settle();
	await rig.wrapper.get('.rp-opening-direct-panel input[name="width"]').setValue('1.1');
	await rig.wrapper.get('.rp-opening-direct-panel').trigger('submit'); await settle();
	expect(rig.project.structure.openings).toEqual([{...door,width:1100,offset:700}]);
	await rig.runtime.undo(); expect(rig.project.structure.openings).toEqual([door]);
	resizeTo(rig.rootEl,1200,900); await settle(); expect(rig.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
	rig.selection.select([]); resizeTo(rig.rootEl,width,900); await settle();
	expect(rig.wrapper.find('.rp-opening-direct-narrow').exists()).toBe(false); expect(rig.wrapper.find('.rp-unsupported-width__action').exists()).toBe(true);
});
