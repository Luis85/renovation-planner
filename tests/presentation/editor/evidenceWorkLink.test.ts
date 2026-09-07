// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
it.each(['none', 'same', 'different'] as const)('shows the native Work relationship independently from a %s related record and navigates without changing evidence', async related => {
 const rig = await renovationEditor(true); mounted.push(rig); const roomId = rig.room.id;
 const work = { id: 'work-evidence-owner', roomId, targetId: roomId, title: 'Inspect north wall', description: '', order: 0, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] };
 const other = { ...work, id: 'work-evidence-related', title: 'Prepare documentation', order: 1 };
 const baseline = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [work, other], decisions: [] }, intended: undefined }, rig.runtime.structureTask.ledger)));
 rig.runtime.renovation.focus(roomId, 'photos'); await settle(); await rig.wrapper.get('[data-rp-new-evidence]').trigger('click'); await settle();
 await rig.wrapper.get('input[name="title"]').setValue('Before wall inspection'); await rig.wrapper.get('input[name="path"]').setValue('scan.png');
 await rig.wrapper.get('input[name="evidence-date"]').setValue('2026-08-28'); await rig.wrapper.get('select[name="work"]').setValue(work.id);
 const recordId = related === 'none' ? '' : related === 'same' ? work.id : other.id;
 await rig.wrapper.get('select[name="record"]').setValue(recordId); await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit'); await settle();
 const item = expectDefined(rig.project.plan?.renovation?.depth?.evidence[0], 'saved work evidence');
 expect(item).toMatchObject({ workId: work.id, recordId, date: '2026-08-28' });
 rig.runtime.renovation.focus(roomId, 'photos', item.id); await settle();
 const row = rig.wrapper.get('[data-rp-record="'+item.id+'"]'), links = row.findAll('button').filter(button => button.text().includes(work.title));
 expect(links).toHaveLength(1);
 expect(row.findAll('button').filter(button => button.text().includes(other.title))).toHaveLength(related === 'different' ? 1 : 0);
 const bytes = [...rig.stack.vault.entries]; await expectDefined(links[0], 'linked Work control').trigger('click'); await settle();
 expect(rig.session).toMatchObject({ mode: 'work', focusedId: work.id, roomId, targetId: roomId }); expect(rig.selection.selectedIds).toEqual([roomId]);
 expect(rig.wrapper.get('[data-rp-record="'+work.id+'"]').element.contains(document.activeElement)).toBe(true);
 expect([...rig.stack.vault.entries]).toEqual(bytes);
});
