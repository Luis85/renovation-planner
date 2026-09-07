// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import { planningDraft, materialInput } from '../../../src/presentation/editor/planning/planningDraft';
import { planningStack } from '../../helpers/planning';
import { recordNavigationContext } from '../../../src/presentation/editor/renovation/recordNavigationContext';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
 const rig = await renovationEditor(true); mounted.push(rig);
 const roomId = rig.room.id;
 const subject = { id: 'outcome-b', roomId, targetId: 'wall-b', kind: 'wall' as const,
  existing: { description: 'Original paint', condition: 'worn' as const }, planned: { description: 'Fresh paint', change: 'modify' as const } };
 const work = { id: 'work-a', roomId, targetId: 'wall-a', title: 'Paint both walls', description: '', order: 0, progress: 'pending' as const, responsibility: 'unassigned' as const, outcomes: [subject.id], dependencies: [], links: [{ roomId, targetId: 'wall-c' }] };
 const evidence = { id: 'evidence-b', roomId, targetId: 'wall-b', workId: '', recordId: subject.id, path: 'Notes/wall.md', subpath: '', description: 'Before survey', type: 'note' as const, phase: 'before' as const, pin: null };
 const input = { renovation: { subjects: [subject], work: [work], decisions: [], depth: { ...EMPTY_DEPTH, evidence: [evidence] } }, intended: undefined };
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), input, rig.runtime.structureTask.ledger)));
 return { ...rig, subject, work, evidence };
}
it('follows a Work outcome on another wall to its visible Planned record and native control', async () => {
 const rig = await setup(); rig.selection.select(['wall-a' as never]); await settle();
 rig.runtime.renovation.focus(rig.room.id, 'work', rig.work.id); await settle();
 const outcome = expectDefined(rig.wrapper.findAll('[data-rp-record="work-a"] button').find(item => item.text().includes('Fresh paint')), 'outcome link');
 await outcome.trigger('click'); await settle();
 expect(rig.session).toMatchObject({ targetId: 'wall-b', mode: 'planned', focusedId: rig.subject.id });
 expect(rig.selection.selectedIds).toEqual(['wall-b']);
 const destination = rig.wrapper.get('[data-rp-record="outcome-b"]');
 expect(destination.text()).toContain('Fresh paint'); expect(destination.element.contains(document.activeElement)).toBe(true);
});
it('clears an incompatible evidence phase when an explicit record is opened, then follows its source', async () => {
 const rig = await setup(); rig.selection.select(['wall-a' as never]); await settle(); rig.session.evidencePhase = 'after';
 rig.runtime.renovation.focus(rig.room.id, 'notes', rig.evidence.id); await settle();
 expect(rig.session.evidencePhase).toBe(''); expect(rig.session.targetId).toBe('wall-b');
 expect(rig.wrapper.get('[data-rp-record="evidence-b"]').text()).toContain('Before survey');
 await rig.wrapper.get('[data-rp-record="evidence-b"] > p > button').trigger('click'); await settle();
 expect(rig.session).toMatchObject({ mode: 'planned', targetId: 'wall-b', focusedId: rig.subject.id });
});
it('retains a shared secondary context and a deliberate Room aggregate while revealing the same Work identity', async () => {
 const rig = await setup(); rig.selection.select(['wall-c' as never]); await settle(); rig.session.roomId = rig.room.id;
 rig.runtime.renovation.focus(rig.room.id, 'work', rig.work.id); await settle();
 expect(rig.session.targetId).toBe('wall-c'); expect(rig.wrapper.get('[data-rp-record="work-a"]').text()).toContain(rig.work.title);
 rig.selection.select([rig.room.id]); await settle(); rig.runtime.renovation.focus(rig.room.id, 'work', rig.work.id); await settle();
 expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect(rig.session.targetId).toBe(rig.room.id);
 expect(rig.project.plan?.renovation?.work[0]).toEqual(rig.work);
});
it('resolves canonical material and Decision contexts and leaves an unknown record unresolved', async () => {
 const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const baseline = expectOk(await rig.read()), records = { renovation: rig.value, materials: baseline.materials };
 expect(recordNavigationContext(records, rig.input.id, rig.roomId, null)).toEqual({ roomId: rig.roomId, targetId: rig.input.source.targetId });
 expect(recordNavigationContext(records, 'estimate:' + rig.input.id, rig.roomId, null)).toEqual({ roomId: rig.roomId, targetId: rig.input.source.targetId });
 expect(recordNavigationContext(records, 'decision-finish', 'different-room', null)).toMatchObject({ roomId: rig.roomId });
 expect(recordNavigationContext(records, 'missing', rig.roomId, null)).toBeNull();
});

it('opens linked documents on another spatial target and reveals multiple targets through their Room', async () => {
 const rig = await renovationEditor(true); mounted.push(rig);
 const planning = expectDefined(rig.deps.commands.planning, 'planning');
 const baseline = expectOk(await planning.read(rig.plan.id)), draft = planningDraft('material', baseline, rig.room.id);
 draft.assetId = expectDefined(baseline.catalogue.find(item => item.asset.unit === 'm2'), 'area asset').asset.id;
 draft.targetId = 'wall-b'; draft.source = { ...draft.source, rule: 'manual', manual: '1' };
 expectOk(await rig.runtime.dispatcher.run(planning.material(baseline, materialInput(draft), rig.runtime.structureTask.ledger)));
 const evidence = { id: 'document-a', roomId: rig.room.id, targetId: 'wall-a', workId: '', recordId: draft.id, path: 'Documents/spec.md', subpath: '', description: 'Material specification', type: 'document' as const, phase: 'before' as const, pin: null };
 const read = expectOk(await rig.renovation.read(rig.plan.id));
 const input = { renovation: { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, evidence: [evidence] } }, intended: read.geometry.document.intended };
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(read, input, rig.runtime.structureTask.ledger)));
 rig.selection.select(['wall-b' as never]); await settle(); rig.session.roomId = rig.room.id;
 rig.runtime.renovation.focus(rig.room.id, 'materials', draft.id); await settle();
 const documents = expectDefined(rig.wrapper.findAll('[data-rp-record="' + draft.id + '"] button').find(item => item.text() === 'Documents'), 'Documents');
 await documents.trigger('click'); await settle();
 expect(rig.session.targetId).toBe('wall-a'); expect(rig.wrapper.get('[data-rp-record="document-a"]').text()).toContain(evidence.description);
 expect(rig.wrapper.get('[data-rp-record="document-a"]').element.contains(document.activeElement)).toBe(true);
 const latest = expectOk(await rig.renovation.read(rig.plan.id));
 const second = { ...evidence, id: 'document-c', targetId: 'wall-c', path: 'Documents/invoice.md', description: 'Material invoice' };
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(latest, { ...input, renovation: { ...input.renovation, depth: { ...EMPTY_DEPTH, evidence: [evidence, second] } } }, rig.runtime.structureTask.ledger)));
 rig.runtime.renovation.focus(rig.room.id, 'documents', draft.id); await settle();
 expect(rig.session.targetId).toBe(rig.room.id); expect(rig.wrapper.findAll('[data-rp-record="document-a"], [data-rp-record="document-c"]')).toHaveLength(2);
});
