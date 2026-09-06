import { describe, expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import { planningStack } from '../../helpers/planning';
import { expectDefined, expectOk } from '../../helpers/domain';
import { prepareMaterial } from '../../../src/application/commands/renovation/PlanningServices';
import { validateDepthLinks, validateMaterialLinks, materialReferents } from '../../../src/application/commands/renovation/planningLinks';
import { Requirement } from '../../../src/domain/requirement/Requirement';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { of } from '../../../src/core/money/Money';
import { err } from '../../../src/core/result/Result';
import { RecalculateRequirementCommand } from '../../../src/application/commands/requirement/RecalculateRequirement';
import { registerOnPlanningChanged } from '../../../src/application/event-handlers/requirement/onPlanningChanged';
import { contextualFigures } from '../../../src/application/commands/requirement/contextualFigures';
import { materialRows, costRows, aggregateCosts, shoppingBody, planningFindings } from '../../../src/presentation/editor/planning/planningProjection';
import { planningDraft, planningInput, materialInput } from '../../../src/presentation/editor/planning/planningDraft';

const failure = { category: 'Persistence' as const, code: 'test.failed', message: 'Unavailable' };
describe('Materials → Costs → Evidence through real repository history', () => {
 it('persists linked records, refuses dangling deletion, then undoes and redoes in order', async () => {
 const rig = await planningStack(), baseline = expectOk(await rig.read());
 const command = rig.planning.material(baseline, rig.input, rig.ledger);
 expectOk(await command.execute()); expect(await command.execute()).toEqual({ ok: true, value: 'no-write' });
 let read = expectOk(await rig.read()); const material = read.materials[0].entity;
 expect(material.quantity.calculated.value.toString()).toBe('13.2'); expect(material.estimatedCost.calculated.amount).toBe('594'); expect(material.source).toEqual(rig.input.source);
 const relation = rig.renovation.command(read, { renovation: { ...rig.value, depth: rig.depth }, intended: undefined }, rig.ledger); expectOk(await relation.execute());
 read = expectOk(await rig.read()); expect(read.plan.entity.renovation?.depth).toEqual(rig.depth);
 const rows = costRows(read, rig.roomId); expect(rows).toHaveLength(1); expect(aggregateCosts(rows, 'EUR')?.remaining.amount).toBe('94'); expect(materialReferents(rig.depth, rig.input.id)).toEqual(['Floor finish']);
 expect((await command.undo()).ok).toBe(false); expect((await rig.deps.requirements.delete(material.id, read.materials[0].version)).ok).toBe(false);
 expect((await rig.geometry.write(rig.plan.id, { ...read.geometry.document, objects: [] }, read.geometry.version)).ok).toBe(false);
 expectOk(await relation.undo()); expectOk(await command.undo()); expect(expectOk(await rig.read()).materials).toHaveLength(0);
 expectOk(await command.execute()); expectOk(await relation.execute());
 const materialPath = expectDefined(rig.stack.index.getPath(material.id), 'material note'); expect(rig.stack.vault.entries.get(materialPath)).toContain('schema-version: 2');
 const planPath = expectDefined(rig.stack.index.getPath(rig.plan.id), 'plan note'); expect(rig.stack.vault.entries.get(planPath)).toContain('schema-version: 4');
 });
 it('preserves manual overrides while wall geometry recalculates the calculated bases', async () => {
 const rig = await planningStack();
 const input = { ...rig.input, override: '20', source: { ...rig.input.source, rule: 'wall-net' as const, targetId: 'wall-a', lot: '2', minimum: '4' } };
 expectOk(await rig.planning.material(expectOk(await rig.read()), input, rig.ledger).execute());
 let loaded = expectOk(await rig.read()).materials[0]; expectOk(await rig.deps.requirements.save(expectOk(loaded.entity.withCostOverride(of('999', 'EUR'))), loaded.version));
 const recalculate = new RecalculateRequirementCommand({ ...rig.deps, zones: rig.stack.zones }); const notify = { cascadeAborted: vi.fn<() => void>(), staleMarkerFailed: vi.fn<() => void>() };
 const subscription = registerOnPlanningChanged(rig.deps.events, { ...rig.deps, logger: rig.stack.logger, notify, recalculate: request => recalculate.execute({ requirementId: request.requirementId as RequirementId }) });
 const before = expectOk(await rig.geometry.read(rig.plan.id)), structure = expectDefined(before.document.structure, 'structure');
 expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: { ...structure, walls: structure.walls.map(wall => ({ ...wall, height: 3000 })) } }, before.version));
 await rig.deps.events.publish({ type: 'PlanStructureChanged', payload: { planId: rig.plan.id } }); loaded = expectOk(await rig.read()).materials[0];
 expect(loaded.entity.quantity.override?.value.toString()).toBe('20'); expect(loaded.entity.quantity.calculated.value.toString()).toBe('14'); expect(loaded.entity.estimatedCost.override?.amount).toBe('999'); expect(loaded.entity.estimatedCost.calculated.amount).toBe('900'); expect(loaded.entity.recalculationStatus).toBe('current');
 const stable = loaded.version; await rig.deps.events.publish({ type: 'PlanRenovationChanged', payload: { planId: rig.plan.id } }); expect(expectOk(await rig.read()).materials[0].version).toEqual(stable); subscription.dispose();
 expect((await contextualFigures({}, loaded.entity, rig.asset, rig.asset.unitCost, expectOk(await rig.read()).currency)).ok).toBe(false);
 });
 it('refuses stale dialogs and peer edits without overwriting the peer', async () => {
 const rig = await planningStack(), baseline = expectOk(await rig.read()), command = rig.planning.material(baseline, rig.input, rig.ledger);
 expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(baseline.plan.entity, { ...rig.value, decisions: [] })), baseline.plan.version));
 expect((await command.execute()).ok).toBe(false); expect(expectOk(await rig.read()).materials).toHaveLength(0);
 const create = rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger); expectOk(await create.execute());
 const saved = expectOk(await rig.read()).materials[0]; expectOk(await rig.stack.requirements.save(expectOk(saved.entity.withQuantityOverride({ value: new Decimal('21'), unit: 'm2' })), saved.version));
 expect((await create.undo()).ok).toBe(false); expect(expectOk(await rig.read()).materials[0].entity.quantity.override?.value.toString()).toBe('21');
 });
 it('preserves human YAML and body through material edits', async () => {
 const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 let read = expectOk(await rig.read()); const path = expectDefined(rig.stack.index.getPath(read.materials[0].entity.id), 'path');
 rig.stack.vault.entries.set(path, expectDefined(rig.stack.vault.entries.get(path), 'bytes').replace('---', '---\nuserLabel: retained') + '\nHuman details\n');
 read = expectOk(await rig.read()); const edit = rig.planning.material(read, { ...rig.input, waste: '0.2' }, rig.ledger); expectOk(await edit.execute());
 expect(rig.stack.vault.entries.get(path)).toContain('userLabel: "retained"'); expect(rig.stack.vault.entries.get(path)).toContain('Human details'); expectOk(await edit.undo()); expectOk(await edit.execute());
 });
 it('refuses invalid sources and links; a failed write leaves the command retryable', async () => {
 const rig = await planningStack(), read = expectOk(await rig.read());
 for (const patch of [{ waste: '-1' }, { override: 'NaN' }, { assetId: 'missing' }, { source: { ...rig.input.source, planId: 'wrong' } }, { source: { ...rig.input.source, targetId: 'missing' } }]) expect(prepareMaterial(read, { ...rig.input, ...patch }).ok).toBe(false);
 const good = expectOk(prepareMaterial(read, rig.input)); for (const source of [{ ...rig.input.source, workId: 'missing' }, { ...rig.input.source, outcomeId: 'missing' }, { ...rig.input.source, planId: 'other' }, { ...rig.input.source, targetId: 'missing' }]) expect(validateMaterialLinks(expectOk(Requirement.create({ ...good, source })), read).ok).toBe(false);
 expect(validateDepthLinks({ ...rig.value, depth: rig.depth }, read).ok).toBe(false);
 const command = rig.planning.material(read, rig.input, rig.ledger); vi.spyOn(rig.deps.requirements, 'save').mockResolvedValueOnce(err(failure)); expect((await command.execute()).ok).toBe(false); expectOk(await command.execute());
 vi.spyOn(rig.deps.requirements, 'delete').mockRejectedValueOnce(new Error('disk')); expect((await command.undo()).ok).toBe(false); expectOk(await command.undo());
 });
 it('projects independent allocations and produces source-linked shopping only for fresh figures', async () => {
 const rig = await planningStack(), read = expectOk(await rig.read()), draft = planningDraft('material', read, rig.roomId, '', 'work-sand'); draft.assetId = rig.asset.id; draft.id = rig.input.id;
 expect(materialInput(draft).waste).toBe('0.1'); expectOk(await rig.planning.material(read, materialInput(draft), rig.ledger).execute());
 let baseline = expectOk(await rig.read()); const procurement = planningDraft('procurement', baseline, rig.roomId, rig.input.id); procurement.purchased = '3'; procurement.reserved = '1';
 expectOk(await rig.renovation.command(baseline, planningInput(procurement, baseline), rig.ledger).execute()); baseline = expectOk(await rig.read());
 expect(materialRows(baseline)[0].outstanding.toString()).toBe('9.2'); expect(shoppingBody(baseline)).toContain('9.2 m2'); expect(shoppingBody(baseline)).toContain(`[[rp-id:${rig.input.id}]]`);
 const stale = { ...baseline, materials: [{ ...baseline.materials[0], entity: expectOk(baseline.materials[0].entity.markedStale()) }] }; expect(shoppingBody(stale)).toBeNull(); expect(aggregateCosts(costRows(stale, rig.roomId), 'EUR')).toBeNull(); expect(planningFindings(stale)).toHaveLength(1);
 });
 it('reports a material stale when its recorded measurement drifted even though packaging kept the lot unchanged', async () => {
 const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), { ...rig.input, source: { ...rig.input.source, lot: '100' } }, rig.ledger).execute());
 const baseline = expectOk(await rig.read()), entity = baseline.materials[0].entity; expect(entity.quantity.calculated.value.toString()).toBe('100'); expect(materialRows(baseline)[0].stale).toBe(false);
 const drifted = { ...baseline, materials: [{ ...baseline.materials[0], entity: expectOk(Requirement.create({ ...entity, calculatedFrom: { ...entity.calculatedFrom, zoneArea: { ...entity.calculatedFrom.zoneArea, value: new Decimal('11') } } })) }] };
 expect(materialRows(drifted)[0].entity.quantity.calculated.value.toString()).toBe('100'); expect(materialRows(drifted)[0].stale).toBe(true); expect(shoppingBody(drifted)).toBeNull();
 });
 it('surfaces legacy, missing-source, negative Remaining and missing-photo/note projections without rewriting facts', async () => {
 const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute()); const baseline = expectOk(await rig.read());
 const legacy = { ...baseline, materials: [{ ...baseline.materials[0], entity: expectOk(Requirement.create({ ...baseline.materials[0].entity, source: undefined })) }] }; expect(materialRows(legacy)[0].source.rule).toBe('room-area'); expect(materialRows({ ...legacy, catalogue: [] })[0].name).toBe(rig.asset.id);
 const depth = { ...rig.depth, costs: [{ ...rig.cost, planned: of('10', 'EUR') }], evidence: [{ ...rig.evidence, id: 'photo', type: 'photo' as const }, { ...rig.evidence, id: 'note', type: 'note' as const }] };
 const read = { ...baseline, plan: { ...baseline.plan, entity: expectOk(withPlanRenovation(baseline.plan.entity, { ...rig.value, depth })) } };
 const files = { list: () => [], resolve: () => err(failure), open: () => Promise.resolve(err(failure)), createNote: () => Promise.resolve(err(failure)), importFile: () => Promise.resolve(err(failure)) };
 expect(planningFindings(read, files).map(item => item.mode)).toEqual(['notes', 'photos', 'costs']);
 const foreign = costRows({ ...read, currency: 'USD' as never }, rig.roomId); expect(aggregateCosts(foreign, 'EUR')).toBeNull(); expect(planningFindings({ ...read, currency: 'USD' as never }, files).some(item => item.kind === 'reconciliation')).toBe(true);
 expect(aggregateCosts(costRows(baseline, rig.roomId), 'USD')).toBeNull();
 });

});
