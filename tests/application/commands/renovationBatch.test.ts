import { describe, expect, it } from 'vitest';
import { planningStack } from '../../helpers/planning';
import { expectDefined, expectOk } from '../../helpers/domain';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import { batchRenovationInput, type BatchDraft } from '../../../src/presentation/editor/renovation/renovationBatch';
import { renovationReferents, validateRenovationTargets } from '../../../src/domain/renovation/renovationTargets';
import { sameRenovation } from '../../../src/domain/renovation/sameRenovation';
import { validSharedLinks } from '../../../src/domain/renovation/SharedLinks';
import { validateRenovation } from '../../../src/domain/renovation/Renovation';
import { inRenovationScope, renovationSummary } from '../../../src/presentation/editor/renovation/renovationSummary';
import { renovationCostSummary } from '../../../src/presentation/editor/renovation/renovationCostSummary';
import { removeRenovationRecord } from '../../../src/presentation/editor/renovation/renovationRemoval';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { planToPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { PlanFrontmatterSchemaV4 } from '../../../src/infrastructure/persistence/dto/planFrontmatter';
import { createMigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/entities/plan/plan.migrations';

const draft: BatchDraft = { kind: 'work', id: '', title: 'Repair shared walls', path: 'Evidence/walls.md', type: 'note' };
const targets = (roomId: string) => ['wall-a', 'wall-b'].map((targetId, index) => ({ roomId, targetId, name: `Wall ${index + 1}`, kind: 'wall' as const }));

describe('shared editor records through repository history', () => {
	it('preserves financial and evidence records when deleting an unrelated decision', async () => {
		const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
		expectOk(await rig.renovation.command(expectOk(await rig.read()), { renovation: { ...rig.value, depth: rig.depth }, intended: undefined }, rig.ledger).execute());
		const baseline = expectOk(await rig.read()), input = removeRenovationRecord(baseline, 'decision-finish', false);
		expect(input.renovation.depth).toEqual(rig.depth);
		const command = rig.renovation.command(baseline, input, rig.ledger); expectOk(await command.execute());
		expect(expectOk(await rig.read()).plan.entity.renovation?.depth).toEqual(rig.depth);
		expectOk(await command.undo()); expect(expectOk(await rig.read()).plan.entity.renovation?.decisions).toHaveLength(1);
	});
	it.each(['work', 'evidence'] as const)('persists one %s identity, protects every linked target, and undoes the entire batch', async kind => {
		const rig = await planningStack(), baseline = expectOk(await rig.read());
		const input = expectOk(batchRenovationInput(baseline, targets(rig.roomId), { ...draft, kind }));
		const command = rig.renovation.command(baseline, input, rig.ledger);
		expectOk(await command.execute());
		const saved = expectDefined(expectOk(await rig.read()).plan.entity.renovation, 'saved renovation');
		const raw = planToPersistence(expectOk(await rig.read()).plan.entity, 1);
		expect(raw['schema-version']).toBe(5); expect(PlanFrontmatterSchemaV4.safeParse(raw).success).toBe(false);
		expect(() => createMigrationRunner({ plan: PLAN_MIGRATIONS.filter(step => step.toVersion <= 4) }).migrateToLatest('plan', raw, 5)).toThrow(/newer than this build supports/);
		const depth = saved.depth ?? EMPTY_DEPTH;
		const item = expectDefined(kind === 'work' ? saved.work.find(record => record.title === draft.title) : depth.evidence[0], 'shared record');
		expect(item.links).toEqual([{ roomId: rig.roomId, targetId: 'wall-b' }]);
		expect(inRenovationScope(item, rig.roomId, 'wall-b')).toBe(true);
		expect(inRenovationScope(item, rig.roomId, 'wall-c')).toBe(false);
		expect(renovationReferents(saved, 'wall-b')).toContain(draft.title);
		expect(sameRenovation(saved, { ...saved, ...(kind === 'work' ? { work: saved.work.map(work => ({ ...work, links: [] })) } : { depth: { ...depth, evidence: depth.evidence.map(evidence => ({ ...evidence, links: [] })) } }) })).toBe(false);
		expectOk(await command.undo()); expect(sameRenovation(expectOk(await rig.read()).plan.entity.renovation, baseline.plan.entity.renovation)).toBe(true);
		expectOk(await command.execute());
		const repeated = expectOk(batchRenovationInput(expectOk(await rig.read()), targets(rig.roomId), { ...draft, kind, id: item.id }));
		const records = kind === 'work' ? repeated.renovation.work : repeated.renovation.depth?.evidence ?? [];
		expect(records.filter(record => record.id === item.id)).toHaveLength(1); expect(records.find(record => record.id === item.id)?.links).toHaveLength(1);
	});
	it.each(['door', 'window', 'opening'] as const)('marks walls and a hosted %s in one intended-state command, preserving current geometry', async kind => {
		const rig = await planningStack(), initial = expectOk(await rig.read());
		const structure = expectDefined(initial.geometry.document.structure, 'current structure');
		expectOk(await rig.geometry.write(rig.plan.id, { ...initial.geometry.document, structure: { ...structure, openings: [{ id: 'opening-shared', hostId: 'wall-a', kind, offset: 500, width: 900, height: 2100, sill: 0 }] } }, initial.geometry.version));
		const baseline = expectOk(await rig.read());
		const proposed = expectOk(batchRenovationInput(baseline, targets(rig.roomId), { ...draft, kind: 'remove' }));
		expect(proposed.intended?.walls.map(item => item.id)).not.toContain('wall-a');
		expect(proposed.renovation.subjects.filter(item => item.planned?.change === 'remove').length).toBeGreaterThanOrEqual(2);
		expect(proposed.renovation.subjects.find(item => item.targetId === 'opening-shared')).toMatchObject({ kind: kind === 'opening' ? 'other' : kind, existing: { description: `${kind.charAt(0).toUpperCase() + kind.slice(1)} · Wall 1` } });
		expect(proposed.intended?.openings).toEqual([]);
		const command = rig.renovation.command(baseline, proposed, rig.ledger); expectOk(await command.execute());
		expect(expectOk(await rig.read()).geometry.document.structure).toEqual(baseline.geometry.document.structure);
		const modified = expectOk(batchRenovationInput(expectOk(await rig.read()), targets(rig.roomId), { ...draft, kind: 'modify' }));
		expect(modified.intended?.walls).toHaveLength(expectDefined(baseline.geometry.document.structure, 'current structure').walls.length);
		expectOk(await command.undo()); expect(expectOk(await rig.read()).geometry.document.intended).toBeUndefined();
	});
	it('reuses an existing wall subject when modifying and rejects invalid additions or absent targets', async () => {
		const rig = await planningStack(), baseline = expectOk(await rig.read());
		const modified = expectOk(batchRenovationInput(baseline, targets(rig.roomId), { ...draft, kind: 'modify' }));
		const second = expectOk(batchRenovationInput({ ...baseline, plan: { ...baseline.plan, entity: expectOk(withPlanRenovation(baseline.plan.entity, modified.renovation)) } }, targets(rig.roomId), { ...draft, kind: 'modify', title: 'Paint' }));
		expect(second.renovation.subjects.map(item => item.id)).toEqual(modified.renovation.subjects.map(item => item.id));
		expect(batchRenovationInput(baseline, targets(rig.roomId), { ...draft, title: '' }).ok).toBe(false);
		expect(batchRenovationInput(baseline, targets('missing-room'), draft).ok).toBe(false);
		expect(batchRenovationInput(baseline, [], draft).ok).toBe(true);
	});
	it('changes a Room finish without manufacturing wall geometry in a Room-first plan', async () => {
		const rig = await planningStack(), initial = expectOk(await rig.read());
		expectOk(await rig.geometry.write(rig.plan.id, { ...initial.geometry.document, structure: undefined }, initial.geometry.version));
		const baseline = expectOk(await rig.read());
		const input = expectOk(batchRenovationInput(baseline, [{ roomId: rig.roomId, targetId: rig.roomId, name: 'Floor', kind: 'floor' }], { ...draft, kind: 'modify', title: 'Retain and oil boards' }));
		expect(input.intended).toBeUndefined(); expect(input.renovation.subjects).toHaveLength(1);
		expectOk(await rig.renovation.command(baseline, input, rig.ledger).execute());
		expect(expectOk(await rig.read()).plan.entity.renovation?.subjects[0].planned?.description).toBe('Retain and oil boards');
	});
	it('rejects duplicate, empty and dangling additional contexts and counts only scoped findings', async () => {
		const rig = await planningStack(), baseline = expectOk(await rig.read());
		const item = rig.value.work[0];
		expect(validSharedLinks({ ...item, links: [{ roomId: item.roomId, targetId: item.targetId }] })).toBe(false);
		expect(validSharedLinks({ ...item, links: [{ roomId: '', targetId: 'wall-b' }] })).toBe(false);
		expect(validateRenovation({ ...rig.value, work: [{ ...item, links: [{ roomId: '', targetId: 'wall-b' }] }] }).ok).toBe(false);
		expect(validateRenovation({ ...rig.value, depth: { ...EMPTY_DEPTH, evidence: [{ ...rig.evidence, recordId: '', links: [{ roomId: rig.evidence.roomId, targetId: rig.evidence.targetId }] }] } }).ok).toBe(false);
		expect(validateRenovationTargets({ ...rig.value, work: [{ ...item, links: [{ roomId: rig.roomId, targetId: 'gone' }] }] }, { ...baseline.geometry.document, roomIds: [rig.roomId] }).ok).toBe(false);
		expect(renovationSummary(rig.value, rig.roomId).next?.kind).toBe('decision');
		expect(renovationSummary(rig.value, rig.roomId, 'wall-b').nextMode).toBe('existing');
		expect(renovationSummary(rig.value, rig.roomId).changes).toBe(1);
	});
	it('uses the same reconciled material estimate for room, element and whole-floor summaries', async () => {
		const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
		const baseline = expectOk(await rig.read());
		expect(renovationCostSummary(baseline).totals?.planned.amount).toBe('594');
		expect(renovationCostSummary(baseline, rig.roomId).count).toBe(1);
		expect(renovationCostSummary(baseline, rig.roomId, 'wall-b').totals?.planned.amount).toBe('0');
	});
});
