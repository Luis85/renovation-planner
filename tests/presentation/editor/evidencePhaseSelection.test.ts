// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { EMPTY_DEPTH, type Evidence } from '../../../src/domain/renovation/PlanningDepth';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
 const rig = await renovationEditor(true); mounted.push(rig);
 const base = { roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: '', path: 'scan.png', subpath: '', type: 'photo' as const };
 const evidence: Evidence[] = [
  { ...base, id: 'before', description: 'Before work', phase: 'before', date: '2026-08-26', pin: { x: .1, y: .1 } },
  { ...base, id: 'during-first', description: 'First work photo', phase: 'during', date: '2026-08-28', pin: { x: .3, y: .3 } },
  { ...base, id: 'during-last', description: 'Second work photo', phase: 'during', date: '2026-08-29', pin: { x: .7, y: .7 } },
 ];
 const baseline = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, evidence } }, intended: undefined }, rig.runtime.structureTask.ledger)));
 rig.runtime.renovation.focus(rig.room.id, 'photos', 'during-first'); await settle();
 await rig.wrapper.get('[data-rp-evidence-phase="during"]').trigger('click'); await settle();
 return rig;
}
it.each(['gallery', 'pin', 'row'] as const)('retains the phase, filtered numbering and spatial selection after a native %s selection', async route => {
 const rig = await setup(), bytes = [...rig.stack.vault.entries];
 if (route === 'gallery') await rig.wrapper.get('[data-rp-evidence-photo="during-last"]').trigger('click');
 else if (route === 'pin') expectDefined(expectDefined(rig.stage, 'stage').find<Konva.Group>('.evidence-pin')[1], 'second filtered pin').fire('click');
 else await rig.wrapper.get('[data-rp-record="during-first"] .rp-record-title').trigger('click');
 await settle();
 expect(rig.session.evidencePhase).toBe('during');
 expect(rig.wrapper.get('[data-rp-evidence-phase="during"]').attributes('aria-pressed')).toBe('true');
 expect(rig.wrapper.findAll('[data-rp-evidence-photo]').map(item => item.attributes('data-rp-evidence-photo'))).toEqual(['during-first', 'during-last']);
 expect(expectDefined(rig.stage, 'stage').find<Konva.Group>('.evidence-pin').map(pin => pin.findOne('Text')?.getAttr('text'))).toEqual(['1', '2']);
 expect(rig.session.focusedId).toBe(route === 'row' ? 'during-first' : 'during-last');
 expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('reveals an explicitly requested evidence record outside the active phase without changing vault facts', async () => {
 const rig = await setup(), bytes = [...rig.stack.vault.entries];
 rig.runtime.renovation.focus(rig.room.id, 'photos', 'before'); await settle();
 expect(rig.session).toMatchObject({ evidencePhase: '', focusedId: 'before' });
 expect(rig.wrapper.get('[data-rp-record="before"]').classes()).toContain('is-selected');
 expect(rig.wrapper.findAll('[data-rp-evidence-photo]')).toHaveLength(3);
 expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
