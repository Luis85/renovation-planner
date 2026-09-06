import { expect, it } from 'vitest';
import { planningStack } from '../../helpers/planning';
import { expectOk } from '../../helpers/domain';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import { inRenovationScope, renovationSummary } from '../../../src/presentation/editor/renovation/renovationSummary';
import { renovationCostSummary } from '../../../src/presentation/editor/renovation/renovationCostSummary';
import { renovationTargetDraft } from '../../../src/presentation/editor/renovation/renovationDraft';
import { batchRenovationInput, type BatchTarget } from '../../../src/presentation/editor/renovation/renovationBatch';
import type { Opening } from '../../../src/domain/spatial/Structure';
import { EMPTY_RENOVATION, validateRenovation } from '../../../src/domain/renovation/Renovation';
import { of } from '../../../src/core/money/Money';

it('keeps a shared wall global while Room summaries remain scoped to their owners', async () => {
	const rig = await planningStack(), baseline = expectOk(await rig.read());
	const subject = { ...rig.value.subjects[0], targetId: 'wall-a' };
	const value = { ...rig.value, subjects: [subject], work: [{ ...rig.value.work[0], targetId: 'wall-a', progress: 'complete' as const }],
		depth: { ...EMPTY_DEPTH, costs: [{ ...rig.cost, targetId: 'wall-a', requirementId: '', planned: rig.cost.facts[0].amount }] } };
	const read = { ...baseline, plan: { ...baseline.plan, entity: expectOk(withPlanRenovation(baseline.plan.entity, value)) } };
	expect(inRenovationScope(subject, 'adjacent-room', 'wall-a')).toBe(true);
	expect(inRenovationScope(subject, 'adjacent-room')).toBe(false);
	expect(inRenovationScope(subject, rig.roomId, rig.roomId)).toBe(true);
	expect(renovationSummary(value, 'adjacent-room', 'wall-a')).toMatchObject({ complete: 1, changes: 1, next: { recordId: 'decision-finish' } });
	expect(renovationSummary(value, 'adjacent-room').work).toHaveLength(0);
	expect(renovationCostSummary(read, 'adjacent-room', 'wall-a')).toMatchObject({ count: 1, totals: { planned: { amount: '500' } } });
	expect(renovationCostSummary(read, 'adjacent-room').count).toBe(0);
	const draft = renovationTargetDraft('work', 'adjacent-room', '', read, 'wall-a');
	expect(draft.work).toMatchObject({ roomId: rig.roomId, targetId: 'wall-a', outcomes: [subject.id] });
	expectOk(validateRenovation({ ...value, work: [...value.work, { ...draft.work, title: 'Repair the shared wall' }] }));
});

it.each(['door', 'window', 'opening'] as const)('captures a selected %s without silently changing its target', async kind => {
	const rig = await planningStack(), baseline = expectOk(await rig.read());
	const opening: Opening = { id: 'opening-test', kind, hostId: 'wall-a', offset: 500, width: 900, height: 2000, sill: 0 };
	const read = { ...baseline, geometry: { ...baseline.geometry, document: { ...baseline.geometry.document, structure: { walls: [], boundaries: [], openings: [opening] } } } };
	const planned = renovationTargetDraft('planned', rig.roomId, '', read, opening.id);
	expect(planned.subject).toMatchObject({ targetId: opening.id, kind: kind === 'opening' ? 'other' : kind, planned: { change: 'modify' } });
	expect(planned.subject.existing?.description).not.toBe('');
	expect(renovationTargetDraft('work', rig.roomId, '', read, opening.id).work.targetId).toBe(opening.id);
});

it('restores an explicitly selected removed opening and keeps repeated intended changes stable', async () => {
	const rig = await planningStack(), baseline = expectOk(await rig.read());
	const opening: Opening = { id: 'opening-test', kind: 'window', hostId: 'wall-a', offset: 500, width: 900, height: 1000, sill: 500 };
	const structure = { ...baseline.geometry.document.structure, walls: baseline.geometry.document.structure?.walls ?? [], boundaries: baseline.geometry.document.structure?.boundaries ?? [], openings: [opening] };
	const read = { ...baseline, geometry: { ...baseline.geometry, document: { ...baseline.geometry.document, structure } } };
	const targets: BatchTarget[] = [{ roomId: rig.roomId, targetId: opening.id, kind: 'window', name: 'Window' }, { roomId: rig.roomId, targetId: 'wall-b', kind: 'wall', name: 'Wall' }];
	const draft = { kind: 'remove' as const, id: '', title: '', path: '', type: 'note' as const };
	const removed = expectOk(batchRenovationInput(read, targets, draft));
	expect(removed.intended?.openings).toHaveLength(0);
	const next = { ...read, plan: { ...read.plan, entity: expectOk(withPlanRenovation(read.plan.entity, removed.renovation)) }, geometry: { ...read.geometry, document: { ...read.geometry.document, intended: removed.intended } } };
	const modified = expectOk(batchRenovationInput(next, targets, { ...draft, kind: 'modify', title: 'Refinish' }));
	expect(modified.intended?.openings).toEqual([opening]);
	expect(modified.intended?.boundaries).toEqual(structure.boundaries);
	const repeated = expectOk(batchRenovationInput({ ...next, geometry: { ...next.geometry, document: { ...next.geometry.document, intended: modified.intended } } }, targets, { ...draft, kind: 'modify', title: 'Refinish' }));
	expect(repeated.intended).toEqual(modified.intended);
});
it('continues at the first missing planning step and excludes unchanged outcomes from change counts', async () => {
	const rig = await planningStack(), baseline = expectOk(await rig.read());
	expect(renovationSummary(EMPTY_RENOVATION, rig.roomId).nextMode).toBe('existing');
	const existing = { ...rig.value.subjects[0], planned: null };
	expect(renovationSummary({ subjects: [existing], work: [], decisions: [] }, rig.roomId).nextMode).toBe('planned');
	const unchanged = { ...existing, planned: { change: 'unchanged' as const, description: existing.existing?.description ?? '' } };
	expect(renovationSummary({ subjects: [unchanged], work: [], decisions: [] }, rig.roomId)).toMatchObject({ changes: 0, nextMode: 'work' });
	expect(renovationSummary({ ...rig.value, decisions: [], work: [{ ...rig.value.work[0], outcomes: [] }] }, rig.roomId)).toMatchObject({ nextMode: 'work', next: { kind: 'missing-outcome' } });
	expect(renovationTargetDraft('work', rig.roomId, 'work-sand', baseline, 'wall-a').work.targetId).toBe(rig.roomId);
	expect(renovationTargetDraft('existing', rig.roomId, '', baseline, '').subject.targetId).toBe(rig.roomId);
});
it('excludes cancelled obligations and refuses a misleading mixed-currency floor estimate', async () => {
	const rig = await planningStack(), baseline = expectOk(await rig.read());
	const record = { ...rig.cost, requirementId: '', planned: of('100', 'EUR'), cancelled: true };
	const read = { ...baseline, plan: { ...baseline.plan, entity: expectOk(withPlanRenovation(baseline.plan.entity, { ...rig.value, depth: { ...EMPTY_DEPTH, costs: [record] } })) } };
	expect(renovationCostSummary(read)).toMatchObject({ count: 0, totals: { planned: { amount: '0' } } });
	const mismatched = { ...read, plan: { ...read.plan, entity: expectOk(withPlanRenovation(read.plan.entity, { ...rig.value, depth: { ...EMPTY_DEPTH, costs: [{ ...record, cancelled: false, facts: [], planned: of('100', 'USD') }] } })) } };
	expect(renovationCostSummary(mismatched).totals).toBeNull();
});
