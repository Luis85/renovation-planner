// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { err, ok } from '../../../src/core/result/Result';
import { withPlanSpatialElements } from '../../../src/domain/plan/Plan';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { pointerAt } from '../../helpers/tool-context';
import { resizeTo } from '../../helpers/layout';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
const element: NamedSpatialElement = { id: 'element-path', kind: 'path', name: 'Garden path', points: [{ x: 500, y: 500 }, { x: 3000, y: 500 }] };
async function setup() {
 const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
 const baseline = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
 rig.selection.select([element.id as never]); await settle(); return rig;
}
it('previews a selected path drag through the real Select tool, clears preview, then saves one translation', async () => {
 const rig = await setup(), tool = rig.runtime.toolManager;
 tool.pointerDown(pointerAt(1500, 500)); tool.pointerMove(pointerAt(1700, 700)); await settle();
 expect(rig.runtime.elementActions.preview.value).toMatchObject({ id: element.id, name: element.name, points: [{ x: 700, y: 700 }, { x: 3200, y: 700 }] });
 expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
 tool.pointerUp(pointerAt(1700, 700)); await settleUntil(() => rig.project.structure.elements?.[0].points[0].x === 700, 'path drag save');
 expect(rig.runtime.elementActions.preview.value).toBeNull();
 await rig.runtime.undo(); await settle(); expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
 rig.project.stale = true; rig.runtime.elementActions.previewElement(element.id, element.points); expect(rig.runtime.elementActions.preview.value).toBeNull();
});
it.each(['refuse', 'throw'] as const)('leaves a path untouched when its edit baseline read will %s', async failure => {
 const rig = await setup(), read = vi.spyOn(rig.renovation, 'read'), before = [...rig.stack.vault.entries];
 if (failure === 'refuse') read.mockResolvedValueOnce(err(injectedPersistenceError())); else read.mockRejectedValueOnce(new Error('Offline baseline'));
 await rig.runtime.elementActions.edit(element.id); await settle();
 expect(rig.dialogs.current).toBeNull(); expect(rig.runtime.elementActions.active.value).toBe(false); expect([...rig.stack.vault.entries]).toEqual(before);
});
it('abandons a delayed edit after selection changes and after the leaf is disposed', async () => {
 const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
 const pending = defer<Awaited<ReturnType<typeof rig.renovation.read>>>();
 vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(pending.promise);
 const edit = rig.runtime.elementActions.edit(element.id); rig.selection.select([rig.room.id]);
 pending.resolve(ok(baseline)); await edit; expect(rig.dialogs.current).toBeNull();
 const late = defer<Awaited<ReturnType<typeof rig.renovation.read>>>();
 vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(late.promise);
 const disposed = rig.runtime.elementActions.edit(element.id); mounted.splice(mounted.indexOf(rig), 1); rig.unmount();
 late.resolve(ok(baseline)); await disposed; expect(rig.dialogs.current).toBeNull();
});
it('refreshes a changed or missing element before opening an edit dialog', async () => {
 const rig = await setup(), before = expectOk(await rig.renovation.read(rig.plan.id));
 const peer = { ...element, name: 'Peer path', points: [{ x: 500, y: 500 }, { x: 3500, y: 500 }] };
 const geometry = { id: peer.id, kind: peer.kind, points: peer.points };
 expectOk(await rig.geometry.write(rig.plan.id, { ...before.geometry.document, structure: { ...expectDefined(before.geometry.document.structure, 'structure'), elements: [geometry] } }, before.geometry.version));
 expectOk(await rig.stack.plans.save(expectOk(withPlanSpatialElements(before.plan.entity, [{ id: peer.id, name: peer.name }])), before.plan.version));
 await rig.runtime.elementActions.edit(element.id); await settle();
 expect(rig.dialogs.current).toBeNull(); expect(rig.project.plan?.spatialElements?.[0].name).toBe(peer.name);
 const latest = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.geometry.write(rig.plan.id, { ...latest.geometry.document, structure: { ...expectDefined(latest.geometry.document.structure, 'structure'), elements: [] } }, latest.geometry.version));
 expectOk(await rig.stack.plans.save(expectOk(withPlanSpatialElements(latest.plan.entity, [])), latest.plan.version));
 await rig.runtime.elementActions.edit(element.id); expect(rig.dialogs.current).toBeNull();
});
it.each(['edit', 'remove'] as const)('refreshes a peer-deleted element before %s without writing', async action => {
 const rig = await setup(), latest = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.geometry.write(rig.plan.id, { ...latest.geometry.document, structure: { ...expectDefined(latest.geometry.document.structure, 'structure'), elements: [] } }, latest.geometry.version));
 expectOk(await rig.stack.plans.save(expectOk(withPlanSpatialElements(latest.plan.entity, [])), latest.plan.version));
 const writes = vi.spyOn(rig.stack.plans, 'save'), geometryWrites = vi.spyOn(rig.geometry, 'write');
 await rig.runtime.elementActions[action](element.id); await settle();
 expect(rig.project.structure.elements ?? []).toEqual([]); expect(rig.project.plan?.spatialElements ?? []).toEqual([]);
 expect(rig.selection.selectedIds).not.toContain(element.id); expect(rig.wrapper.find('[data-rp-action="edit-element"]').exists()).toBe(false);
 expect(rig.dialogs.current).toBeNull(); expect(writes).not.toHaveBeenCalled(); expect(geometryWrites).not.toHaveBeenCalled();
});
it('keeps draft text when a peer edit wins during the open element dialog', async () => {
 const rig = await setup(); await rig.wrapper.get('[data-rp-action="edit-element"]').trigger('click'); await settle();
 const form = rig.wrapper.get('[data-rp-form="outline-points"]');
 await form.get('input[name="name"]').setValue('My path'); await form.get('input[name="1.x"]').setValue('3,5');
 const composing = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true });
 form.get('input[name="name"]').element.dispatchEvent(composing); expect(composing.defaultPrevented).toBe(true); expect(rig.dialogs.current?.kind).toBe('form');
 const before = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.renovation.command(before, elementInput(before, { ...element, name: 'Peer path' }), rig.runtime.structureTask.ledger).execute());
 await form.trigger('submit'); await settle();
 expect(form.get<HTMLInputElement>('input[name="name"]').element.value).toBe('My path'); expect(form.text()).toContain('changed');
 expect(rig.project.plan?.spatialElements?.[0].name).toBe('Peer path');
 await form.trigger('submit'); await settle(); expect(rig.project.plan?.spatialElements?.[0].name).toBe('Peer path');
});
it('cancels deletion and refuses it when its fresh material references cannot be read', async () => {
 const rig = await setup(), before = [...rig.stack.vault.entries];
 const cancelled = rig.runtime.elementActions.remove(element.id); await settle(); rig.dialogs.resolve('cancel'); await cancelled;
 const planning = expectDefined(rig.deps.commands.planning, 'planning');
 vi.spyOn(planning, 'read').mockResolvedValueOnce(err(injectedPersistenceError()));
 await rig.runtime.elementActions.remove(element.id); await settle();
 expect(rig.dialogs.current).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(before);
});
it('conditionally compensates a refused drag write without changing the displayed path', async () => {
 const rig = await setup(), before = expectOk(await rig.renovation.read(rig.plan.id)), original = expectDefined(rig.project.structure.elements?.[0], 'path');
 vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
 await rig.runtime.elementActions.move(element.id, original.points.map(point => ({ ...point, x: point.x + 100 })), original); await settle();
 const after = expectOk(await rig.renovation.read(rig.plan.id));
 expect(after.geometry.document).toEqual(before.geometry.document); expect(after.plan.entity).toEqual(before.plan.entity);
 expect(rig.runtime.elementActions.active.value).toBe(false); expect(rig.runtime.elementActions.preview.value).toBeNull();
});

it('refuses single-element deletion when shared Work still refers to that target', async () => {
 const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
 const value = expectDefined(baseline.plan.entity.renovation, 'renovation');
 const work = { id: 'work-shared-path', roomId: rig.room.id, targetId: rig.room.id, links: [{ roomId: rig.room.id, targetId: element.id }], title: 'Prepare shared surfaces', description: '', order: 0, progress: 'pending' as const, responsibility: 'unassigned' as const, outcomes: [], dependencies: [] };
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { ...value, work: [work] }, intended: baseline.geometry.document.intended }, rig.runtime.structureTask.ledger)));
 const bytes = [...rig.stack.vault.entries], command = vi.spyOn(rig.renovation, 'command');
 const removal = rig.runtime.elementActions.remove(element.id); await settle();
 expect(rig.wrapper.get('.rp-dialog').text()).toContain(work.title); rig.dialogs.resolve('confirm'); await removal;
 expect(command).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
});
it('retains an empty element name and focuses its native validation without writing', async () => {
 const rig = await setup(), before = [...rig.stack.vault.entries];
 await rig.wrapper.get('[data-rp-action="edit-element"]').trigger('click'); await settle();
 const form = rig.wrapper.get('[data-rp-form="outline-points"]'), name = form.get<HTMLInputElement>('input[name="name"]');
 await name.setValue(' '); await form.trigger('submit'); await settle();
 expect(name.element.value).toBe(' '); expect(name.attributes('aria-invalid')).toBe('true'); expect(document.activeElement).toBe(name.element);
 expect([...rig.stack.vault.entries]).toEqual(before);
 rig.dialogs.resolve('cancel'); await settle(); expect(rig.project.plan?.spatialElements?.[0].name).toBe(element.name);
});

it('keeps current element drag edits gated while inspecting Renovate', async () => {
 const rig = await setup(), before = [...rig.stack.vault.entries];
 await rig.runtime.renovation.perspective('renovate'); await settle();
 rig.runtime.toolManager.pointerDown(pointerAt(1500, 500)); rig.runtime.toolManager.pointerMove(pointerAt(1700, 700));
 expect(rig.runtime.elementActions.preview.value).toBeNull();
 rig.runtime.toolManager.pointerUp(pointerAt(1700, 700)); await settle();
 expect([...rig.stack.vault.entries]).toEqual(before); expect(rig.selection.selectedIds).toEqual([element.id]);
});

it.each([1100, 460])('keeps a keyboard successor when returning an element to Plan at %ipx', async width => {
 const rig = await setup(), editor = useEditorStore(rig.pinia);
 resizeTo(rig.rootEl, width, 800); await settle();
 await rig.runtime.renovation.perspective('renovate'); await settle();
 const details = rig.wrapper.find<HTMLButtonElement>('[data-rp-rail="details"]');
 if (details.exists()) { details.element.click(); await settle(); }
 const bytes = [...rig.stack.vault.entries], viewport = { ...editor.viewport };
 const action = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="element-plan-geometry"]');
 action.element.focus(); expect(document.activeElement).toBe(action.element); action.element.click(); await settle();
 expect(rig.session.perspective).toBe('plan'); expect(rig.selection.selectedIds).toEqual([element.id]);
 expect(editor.viewport).toEqual(viewport); expect([...rig.stack.vault.entries]).toEqual(bytes);
 const successor = rig.wrapper.find<HTMLButtonElement>('[data-rp-rail="details"]');
 const edit = rig.wrapper.find<HTMLButtonElement>('[data-rp-action="edit-element"]');
 const targets = [successor, edit].filter(button => button.exists() && button.isVisible()).map(button => button.element);
 expect(targets).toContain(document.activeElement);
 if (!edit.exists() || !edit.isVisible()) { successor.element.click(); await settle(); }
 rig.wrapper.get<HTMLButtonElement>('[data-rp-action="edit-element"]').element.click(); await settle();
 expect(rig.wrapper.find('[data-rp-form="outline-points"]').exists()).toBe(true);
 rig.dialogs.resolve('cancel'); await settle();
 expect(rig.selection.selectedIds).toEqual([element.id]); expect(editor.viewport).toEqual(viewport);
 expect([...rig.stack.vault.entries]).toEqual(bytes);
});
