// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { click } from '../../helpers/planEditorRig';
import { expectOk } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import { of } from '../../../src/core/money/Money';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import type { EditorNavigation } from '../../../src/presentation/editor/PlanEditorContext';
import * as notices from '../../../src/presentation/notices/notify';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup(available = true) {
 const downstream = vi.fn<NonNullable<EditorNavigation['downstream']>>().mockResolvedValue(undefined);
 const navigation: EditorNavigation = { project: vi.fn<EditorNavigation['project']>().mockResolvedValue(undefined), library: vi.fn<EditorNavigation['library']>(), ...(available ? { downstream } : {}) };
 const rig = await renovationEditor(true, navigation); mounted.push(rig);
 const work = { id: 'work-navigation', roomId: rig.room.id, targetId: rig.room.id, title: 'Finish Room', description: '', order: 0, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] };
 const cost = { id: 'cost-navigation', roomId: rig.room.id, targetId: rig.room.id, workId: work.id, title: 'Finish cost', category: 'labor' as const, requirementId: '', planned: of('42', 'EUR'), facts: [], cancelled: false };
 const baseline = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [work], decisions: [], depth: { ...EMPTY_DEPTH, costs: [cost] } }, intended: undefined }, rig.runtime.structureTask.ledger)));
 rig.runtime.renovation.focus(rig.room.id, 'work', work.id); await settle();
 return { ...rig, navigation, downstream, work, cost };
}
it('carries the focused Work and Cost identities without changing the retained canvas or persisted plan', async () => {
 const rig = await setup(), editor = useEditorStore(rig.pinia), viewport = { ...editor.viewport }, bytes = [...rig.stack.vault.entries];
 await rig.wrapper.get('[data-rp-downstream="schedule"]').trigger('click'); await settle();
 expect(rig.downstream).toHaveBeenLastCalledWith(rig.plan.projectId, { section: 'schedule', origin: { planId: rig.plan.id, roomId: rig.room.id, workId: rig.work.id } });
 rig.runtime.renovation.focus(rig.room.id, 'costs', rig.cost.id); await settle();
 await rig.wrapper.get('[data-rp-downstream="quotes"]').trigger('click'); await settle();
 expect(rig.downstream).toHaveBeenLastCalledWith(rig.plan.projectId, { section: 'quotes', origin: { planId: rig.plan.id, roomId: rig.room.id, workId: rig.work.id, costId: rig.cost.id } });
 expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect(editor.viewport).toEqual(viewport); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('refuses unavailable navigation, active saving and a second activation while the host is opening', async () => {
 const unavailable = await setup(false), button = unavailable.wrapper.get('[data-rp-downstream="schedule"]');
 expect(button.attributes('aria-disabled')).toBe('true'); await button.trigger('click'); expect(unavailable.downstream).not.toHaveBeenCalled();
 const rig = await setup(), saving = useSaveStateStore(rig.pinia), action = rig.wrapper.get('[data-rp-downstream="schedule"]');
 saving.beginSaving(); await settle(); await action.trigger('click'); expect(rig.downstream).not.toHaveBeenCalled(); saving.resolveOk(); await settle();
 const pending = defer<void>(); rig.downstream.mockReturnValueOnce(pending.promise);
 await action.trigger('click'); await settle(); await action.trigger('click'); expect(rig.downstream).toHaveBeenCalledOnce();
 pending.resolve(); await settle(); expect(action.attributes('aria-disabled')).toBe('false');
});
it('keeps a real canvas draft after Cancel and discards it only after confirming departure', async () => {
 const rig = await setup(), action = rig.wrapper.get('[data-rp-downstream="schedule"]'), bytes = [...rig.stack.vault.entries];
 rig.runtime.setTool('draw-area'); await settle(); click(rig.canvasEl, 100, 200); await settle();
 expect(rig.runtime.toolManager.activeToolHasDraft()).toBe(true);
 await action.trigger('click'); await settle(); expect(rig.dialogs.current?.kind).toBe('confirm');
 rig.dialogs.resolve('cancel'); await settle(); expect(rig.downstream).not.toHaveBeenCalled(); expect(rig.runtime.toolManager.activeToolHasDraft()).toBe(true);
 await action.trigger('click'); await settle(); rig.dialogs.resolve('confirm'); await settle();
 expect(rig.downstream).toHaveBeenCalledOnce(); expect(rig.runtime.toolManager.activeToolHasDraft()).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('reports a host opening failure once and suppresses a late failure after disposal', async () => {
 const rig = await setup(), report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined), fault = new Error('Host reveal failed');
 rig.downstream.mockRejectedValueOnce(fault); await rig.wrapper.get('[data-rp-downstream="schedule"]').trigger('click'); await settle();
 expect(report).toHaveBeenCalledExactlyOnceWith(fault, rig.deps.commands.logger, 'editor.navigation.failed');
 const pending = defer<void>(); rig.downstream.mockReturnValueOnce(pending.promise.then(() => { throw new Error('Late host failure'); })); await rig.wrapper.get('[data-rp-downstream="schedule"]').trigger('click'); await settle();
 mounted.splice(mounted.indexOf(rig), 1); rig.unmount(); pending.resolve(); await settle(); expect(report).toHaveBeenCalledOnce();
});
it('does not leave over another dialog or when saving starts during a draft confirmation', async () => {
 const rig = await setup(), action = rig.wrapper.get('[data-rp-downstream="schedule"]');
 const other = rig.dialogs.openDialog({ kind: 'confirm', title: 'Another operation', message: 'Retain this dialog' });
 await settle(); await action.trigger('click'); expect(rig.downstream).not.toHaveBeenCalled();
 rig.dialogs.resolve('cancel'); await other; await settle();
 rig.runtime.setTool('draw-area'); await settle(); click(rig.canvasEl, 120, 220); await settle();
 await action.trigger('click'); await settle();
 const saving = useSaveStateStore(rig.pinia); saving.beginSaving(); rig.dialogs.resolve('confirm'); await settle();
 expect(rig.downstream).not.toHaveBeenCalled(); expect(rig.runtime.toolManager.activeToolHasDraft()).toBe(true); saving.resolveOk();
});
it('retires a pending departure confirmation when the editor closes', async () => {
 const rig = await setup(), action = rig.wrapper.get('[data-rp-downstream="schedule"]');
 rig.runtime.setTool('draw-area'); await settle(); click(rig.canvasEl, 130, 230); await settle();
 await action.trigger('click'); await settle(); expect(rig.dialogs.current?.kind).toBe('confirm');
 mounted.splice(mounted.indexOf(rig), 1); rig.unmount(); rig.dialogs.resolve('confirm'); await settle(); expect(rig.downstream).not.toHaveBeenCalled();
});
