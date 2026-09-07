// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import * as notices from '../../../src/presentation/notices/notify';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup(kind: 'existing' | 'creation') {
 const rig = await renovationEditor(true); mounted.push(rig);
 const baseline = expectOk(await rig.renovation.read(rig.plan.id));
 const element = { id: 'element-retry-path', name: 'Garden path', kind: 'path' as const, points: [{ x: 500, y: 500 }, { x: 2500, y: 500 }] };
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
 if (kind === 'existing') {
  rig.selection.select([element.id as never]); await settle(); void rig.runtime.elementActions.edit(element.id); await settle();
 } else {
  rig.runtime.setTool('draw-path'); await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'creation baseline');
 }
 const field = rig.wrapper.get<HTMLInputElement>(kind === 'existing' ? 'input[name="1.x"]' : 'input[name="element-name"]');
 await field.setValue(kind === 'existing' ? '3,75' : 'Retained path');
 const services = expectDefined(rig.deps.commands.planning, 'planning');
 const read = vi.spyOn(services, 'read').mockResolvedValue(err(injectedPersistenceError()));
 rig.changeCatalogue(); await settle();
 const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
 return { ...rig, field, read, report };
}
it.each(['existing', 'creation'] as const)('reports a failed %s path retry without replaying a write or losing draft text', async kind => {
 const rig = await setup(kind), bytes = [...rig.stack.vault.entries], text = rig.field.element.value, fault = new Error('Inspector retry failed');
 vi.spyOn(rig.deps.commands.zoneInspector, 'execute').mockRejectedValueOnce(fault);
 await rig.wrapper.get('.rp-draft-recovery button').trigger('click'); await settle();
 expect(rig.report).toHaveBeenCalledExactlyOnceWith(fault, rig.deps.commands.logger, 'editor.refresh.failed');
 expect(rig.field.element.value).toBe(text); expect([...rig.stack.vault.entries]).toEqual(bytes);
 expect(rig.wrapper.get('.rp-draft-recovery button').attributes('aria-disabled')).toBe('false');
 rig.read.mockRestore(); await rig.wrapper.get('.rp-draft-recovery button').trigger('click'); await settle();
 expect(rig.wrapper.find('.rp-draft-recovery').exists()).toBe(false); expect(rig.field.element.value).toBe(text);
 expect(rig.report).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it.each(['existing', 'creation'] as const)('does not report a late %s path retry failure after leaf disposal', async kind => {
 const rig = await setup(kind), pending = defer<void>();
 const query = vi.spyOn(rig.deps.commands.zoneInspector, 'execute').mockReturnValueOnce(pending.promise.then(() => { throw new Error('Retired retry'); }));
 await rig.wrapper.get('.rp-draft-recovery button').trigger('click'); await settle(); expect(query).toHaveBeenCalledOnce();
 mounted.splice(mounted.indexOf(rig), 1); rig.unmount(); pending.resolve(); await settle();
 expect(rig.report).not.toHaveBeenCalled();
});
