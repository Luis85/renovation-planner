// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined } from '../../helpers/domain';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
async function open(r: Awaited<ReturnType<typeof renovationEditor>>) {
 await r.wrapper.get('[data-rp-action="add"]').trigger('click'); await settle();
 return r.wrapper.get('[data-rp-entry="note"]');
}
describe('Add Note uses canonical Room evidence', () => {
 it('requires one selected Room and explains the unavailable action without changing data', async () => {
  const r = await renovationEditor(true); r.changePlan(); await settle();
  try {
   useSelectionStore(r.pinia).clear(); await settle();
   const bytes = [...r.stack.vault.entries]; const note = await open(r);
   expect(note.attributes('aria-disabled')).toBe('true');
   expect(r.wrapper.get('#'+note.attributes('aria-describedby')).text()).toContain('Select one room');
   await note.trigger('click'); expect(r.wrapper.find('[data-rp-form="planning"]').exists()).toBe(false);
   expect([...r.stack.vault.entries]).toEqual(bytes);
  } finally { r.unmount(); }
 });
 it('creates an ordinary contextual note and undoes only its evidence link', async () => {
  const r = await renovationEditor(true); r.changePlan(); await settle();
  try {
   useSelectionStore(r.pinia).select([r.room.id]); await settle();
   const note = await open(r); expect(note.attributes('aria-disabled')).toBe('false');
   await note.trigger('click'); await settle(); expect(r.session.mode).toBe('notes');
   expect(r.wrapper.find('.rp-add-menu').exists()).toBe(false);
   expect(r.wrapper.get('select[name="type"]').element).toHaveProperty('value', 'note');
   await r.wrapper.get('input[name="title"]').setValue('Pipe inspection');
   const create = r.wrapper.findAll('.rp-dialog button').find(button => button.text() === 'Create contextual note');
   await expectDefined(create, 'note file action').trigger('click'); await settle();
   const path = (r.wrapper.get('input[name="path"]').element as HTMLInputElement).value;
   expect(path).toContain('Evidence/Note-'); expect(r.stack.vault.entries.has(path)).toBe(true);
   await r.wrapper.get('[data-rp-form="planning"]').trigger('submit'); await settle();
   const record = expectDefined(r.project.plan?.renovation?.depth?.evidence[0], 'saved evidence');
   expect(record).toMatchObject({ roomId: r.room.id, targetId: r.room.id, type: 'note', description: 'Pipe inspection', path });
   await r.runtime.undo(); await settle(); expect(r.project.plan?.renovation?.depth?.evidence ?? []).toHaveLength(0);
   expect(r.stack.vault.entries.has(path)).toBe(true);
   await r.runtime.redo(); await settle(); expect(r.project.plan?.renovation?.depth?.evidence[0]).toEqual(record);
  } finally { r.unmount(); }
 });
 it('cancels the form without creating a note or evidence record', async () => {
  const r = await renovationEditor(true); r.changePlan(); await settle();
  try {
   useSelectionStore(r.pinia).select([r.room.id]); await settle(); const bytes = [...r.stack.vault.entries];
   await (await open(r)).trigger('click'); await settle();
   await r.wrapper.get('input[name="title"]').setValue('Draft note'); r.dialogs.resolve('cancel'); await settle();
   expect([...r.stack.vault.entries]).toEqual(bytes); expect(r.runtime.activeToolId.value).toBe('select');
  } finally { r.unmount(); }
 });
});
