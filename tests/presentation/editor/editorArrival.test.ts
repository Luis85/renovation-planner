// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import type { ProjectOrigin } from '../../../src/application/navigation/ProjectDestination';
import { err } from '../../../src/core/result/Result';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import * as notices from '../../../src/presentation/notices/notify';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
 const rig = await renovationEditor(true); mounted.push(rig);
 const work = { id: 'work-a', roomId: rig.room.id, targetId: rig.room.id, title: 'Prepare floor', description: '', order: 0, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] };
 const baseline = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [work], decisions: [] }, intended: baseline.geometry.document.intended }, rig.runtime.structureTask.ledger))); await settle();
 const navigate = (rig.wrapper.vm as unknown as { navigateToRecord(origin: ProjectOrigin): Promise<boolean> }).navigateToRecord;
 return { ...rig, navigate, origin: { planId: rig.plan.id, roomId: rig.room.id, workId: work.id } };
}
it('reveals the original Work identity in the same mounted editor and canvas', async () => {
 const rig = await setup(), canvas = rig.stage, element = rig.wrapper.element, bytes = [...rig.stack.vault.entries];
 rig.selection.clear(); await settle();
 expect(await rig.navigate(rig.origin)).toBe(true); await settle();
 expect(rig.wrapper.element).toBe(element); expect(rig.stage).toBe(canvas);
 expect(rig.session).toMatchObject({ mode: 'work', perspective: 'renovate', focusedId: 'work-a', roomId: rig.room.id });
 expect(rig.wrapper.get('[data-rp-record="work-a"]').text()).toContain('Prepare floor'); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('keeps a pending return through a failed planning read and an unrelated dialog until both recover', async () => {
 const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning');
 const read = vi.spyOn(services, 'read').mockResolvedValue(err({ category: 'Persistence', code: 'test.offline', message: 'Offline' }));
 rig.changeCatalogue(); await settle(); expect(rig.runtime.writesBlocked.value).toBe(true);
 expect(await rig.navigate(rig.origin)).toBe(true);
 const dialog = rig.dialogs.openDialog({ kind: 'confirm', title: 'Other action', message: 'Keep this dialog open.' });
 read.mockRestore(); await rig.runtime.refreshProjection(); await settle(); expect(rig.session.focusedId).not.toBe('work-a');
 rig.dialogs.resolve('cancel'); await dialog; await settle(); expect(rig.session.focusedId).toBe('work-a');
});
it('refuses missing records, foreign floors and returns while a save is pending', async () => {
 const rig = await setup(), warn = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined), save = useSaveStateStore(rig.pinia);
 expect(await rig.navigate({ ...rig.origin, workId: 'deleted' })).toBe(false); expect(warn).toHaveBeenCalledOnce();
 expect(await rig.navigate({ ...rig.origin, planId: 'other' })).toBe(false);
 save.beginSaving(); expect(await rig.navigate(rig.origin)).toBe(false); save.resolveNeutral();
 expect(rig.session.focusedId).not.toBe('work-a');
});
it('retains a native geometry draft when the return confirmation is cancelled', async () => {
 const rig = await setup(); rig.runtime.setTool('draw-path'); await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'path draft');
 rig.runtime.elementTask.draft.text.x = '3,75'; await settle();
 expect(rig.runtime.toolManager.activeToolHasDraft()).toBe(true);
 const arrival = rig.navigate(rig.origin); await settle(); expect(rig.dialogs.current?.kind).toBe('confirm');
 rig.dialogs.resolve('cancel'); expect(await arrival).toBe(false);
 expect(rig.runtime.activeToolId.value).toBe('draw-path'); expect(rig.runtime.elementTask.draft.text.x).toBe('3,75');
});
it('rechecks the save boundary after confirmation and ignores captured arrivals after disposal', async () => {
 const rig = await setup(); rig.runtime.setTool('draw-path'); await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'path draft'); rig.runtime.elementTask.draft.text.x = '3,75';
 const arrival = rig.navigate(rig.origin); await settle(); const save = useSaveStateStore(rig.pinia); save.beginSaving();
 rig.dialogs.resolve('confirm'); expect(await arrival).toBe(false); expect(rig.runtime.activeToolId.value).toBe('draw-path'); save.resolveNeutral();
 const bytes = [...rig.stack.vault.entries]; rig.unmount();
 expect(await rig.navigate(rig.origin)).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
