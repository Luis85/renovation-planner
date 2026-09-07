// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
const element: NamedSpatialElement = { id: 'element-fence', name: 'Garden fence', kind: 'fence', points: [{ x: 0.123456, y: 0 }, { x: 4000.123456, y: 0 }, { x: 4000.123456, y: 3000 }] };
async function setup() {
 const rig = await renovationEditor(true); mounted.push(rig);
 const baseline = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
 rig.selection.select([element.id as never]); await settle(); rig.session.roomId = rig.room.id;
 rig.runtime.renovation.focus(rig.room.id, 'planned'); await settle();
 await rig.wrapper.get('[data-rp-action="new-record"]').trigger('click');
 await settleUntil(() => rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'planned element form');
 return rig;
}
it('edits a planned fence through native fields while preserving current geometry and exact untouched axes', async () => {
 const rig = await setup(), form = rig.wrapper.get('[data-rp-form="renovation"]');
 expect(form.text()).toContain(element.name);
 await form.get('textarea[name="description"]').setValue('Extend the garden boundary');
 const field = form.get<HTMLInputElement>('input[name="planned-2-y"]');
 await field.setValue('-'); await form.trigger('submit'); await settle();
 expect(form.find('[role="alert"]').exists()).toBe(true); expect(field.element.value).toBe('-');
 expect(rig.project.intended?.elements ?? []).toEqual([]);
 await field.setValue('4,5'); await form.trigger('submit'); await settle();
 expect(form.get('[role="status"]').text()).toContain('Room outlines remain independent');
 await form.trigger('submit'); await settleUntil(() => !rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'planned fence save');
 expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
 expect(rig.project.intended?.elements?.[0].points).toEqual([element.points[0], element.points[1], { x: element.points[2].x, y: 4500 }]);
 const subject = expectDefined(rig.project.plan?.renovation?.subjects.find(item => item.targetId === element.id), 'planned fence');
 expect(subject.planned?.description).toBe('Extend the garden boundary');
 expectOk(await rig.runtime.dispatcher.undo()); await settle(); expect(rig.project.intended?.elements ?? []).toEqual([]);
 expectOk(await rig.runtime.dispatcher.redo()); await settle(); expect(rig.project.plan?.renovation?.subjects.find(item => item.id === subject.id)).toEqual(subject);
});
it('keeps raw coordinate text and native focus stable while the planned write is in flight', async () => {
 const rig = await setup(), form = rig.wrapper.get('[data-rp-form="renovation"]');
 await form.get('textarea[name="description"]').setValue('Shift the last fence corner');
 const edited = form.get<HTMLInputElement>('input[name="planned-2-y"]'), untouched = form.get<HTMLInputElement>('input[name="planned-0-x"]');
 await edited.setValue('4,50'); await form.trigger('submit'); await settle();
 const gate = defer<void>(), save = rig.stack.plans.save.bind(rig.stack.plans);
 vi.spyOn(rig.stack.plans, 'save').mockImplementationOnce(async (...args) => { await gate.promise; return save(...args); });
 edited.element.focus(); await form.trigger('submit'); await settle();
 expect(edited.attributes('readonly')).toBeDefined(); expect(document.activeElement).toBe(edited.element);
 await edited.setValue('9'); await untouched.setValue('8');
 expect(edited.element.value).toBe('4,50'); expect(untouched.element.value).toBe('0');
 gate.resolve(); await settleUntil(() => !rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'pending planned save');
 expect(rig.project.intended?.elements?.[0].points[0]).toEqual(element.points[0]);
 expect(rig.project.intended?.elements?.[0].points[2].y).toBe(4500);
});
