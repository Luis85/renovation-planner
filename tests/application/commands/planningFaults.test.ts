import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { describe, expect, it, vi } from 'vitest';
import { planningStack } from '../../helpers/planning';
import { expectErr, expectOk } from '../../helpers/domain';
import { GetRequirementsForZone } from '../../../src/application/queries/GetRequirementsForZone';
import { readPlanning, prepareMaterial } from '../../../src/application/commands/renovation/PlanningServices';
import { contextualFigures } from '../../../src/application/commands/requirement/contextualFigures';
import { materialReferents, validateDepthLinks, validateMaterialLinks } from '../../../src/application/commands/renovation/planningLinks';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import { Requirement } from '../../../src/domain/requirement/Requirement';
import { registerOnPlanningChanged } from '../../../src/application/event-handlers/requirement/onPlanningChanged';
import { leftWritesBehind } from '../../../src/application/commands/DispatchOutcome';
import { err, ok } from '../../../src/core/result/Result';
import { of } from '../../../src/core/money/Money';
const failure = { category: 'Persistence' as const, code: 'test.failed', message: 'Unavailable' };
describe('planning safety under unavailable dependencies', () => {
 it('refuses partial reads at every repository boundary', async () => {
 const rig = await planningStack();
 const failRead = async () => expect(await readPlanning(rig.deps, rig.plan.id)).toEqual(err(failure));
 vi.spyOn(rig.deps.plans, 'getById').mockResolvedValueOnce(err(failure)); await failRead();
 vi.spyOn(rig.deps.projects, 'getById').mockResolvedValueOnce(err(failure)); await failRead();
 vi.spyOn(rig.deps.projects, 'getById').mockResolvedValueOnce(ok(null)); expect((await rig.read()).ok).toBe(false);
 vi.spyOn(rig.deps.assets, 'listAll').mockResolvedValueOnce(err(failure)); await failRead();
 vi.spyOn(rig.deps.requirements, 'listByZone').mockResolvedValueOnce(err(failure)); await failRead();
 vi.spyOn(rig.deps.overrides, 'getForPair').mockResolvedValueOnce(err(failure)); await failRead();
 expectOk(await rig.read());
 });
 it('publishes lifecycle and cost changes only after conditional writes and retries rejected locks', async () => {
 const rig = await planningStack(), events = vi.spyOn(rig.deps.events, 'publish'), baseline = expectOk(await rig.read()), command = rig.planning.material(baseline, rig.input, rig.ledger);
 vi.spyOn(rig.deps.locks, 'acquire').mockRejectedValueOnce(new Error('lock')); expect((await command.execute()).ok).toBe(false); expect(events).not.toHaveBeenCalled(); expectOk(await command.execute()); expect(events).toHaveBeenCalledWith(expect.objectContaining({ type: 'RequirementCreated' }));
 const edit = rig.planning.material(expectOk(await rig.read()), { ...rig.input, override: '20' }, rig.ledger); expectOk(await edit.execute()); expect(events).toHaveBeenCalledWith(expect.objectContaining({ type: 'CostEstimateChanged', payload: expect.objectContaining({ previous: of('594', 'EUR'), current: expect.objectContaining({ amount: '900.00', currency: 'EUR' }) }) }));
 expectOk(await edit.undo()); expect(events).toHaveBeenCalledWith(expect.objectContaining({ type: 'RequirementRestored' }));
 const remove = rig.planning.material(expectOk(await rig.read()), { deleteId: rig.input.id }, rig.ledger); expectOk(await remove.execute()); expect(events).toHaveBeenCalledWith(expect.objectContaining({ type: 'RequirementDeleted' })); expectOk(await remove.undo());
 });
 it('refuses reads and missing links without consuming undo or overwriting peer bytes', async () => {
 const rig = await planningStack(), baseline = expectOk(await rig.read()), command = rig.planning.material(baseline, rig.input, rig.ledger);
 vi.spyOn(rig.deps.plans, 'getById').mockResolvedValueOnce(err(failure)); expect(await command.execute()).toEqual(err(failure));
 vi.spyOn(rig.deps.requirements, 'getById').mockResolvedValueOnce(err(failure)); expect(await command.execute()).toEqual(err(failure)); expectOk(await command.execute());
 const live = expectOk(await rig.read()).materials[0]; expectOk(await rig.deps.requirements.delete(live.entity.id, live.version)); expect((await command.undo()).ok).toBe(false);
 const invalid = rig.planning.material(expectOk(await rig.read()), { ...rig.input, source: { ...rig.input.source, workId: 'absent' } }, rig.ledger); expect((await invalid.execute()).ok).toBe(false); expect(expectOk(await rig.read()).materials).toHaveLength(0);
 });
 it('validates procurement, cost currency, record ownership and contextual recalculation inputs', async () => {
 const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute()); const baseline = expectOk(await rig.read()), material = baseline.materials[0].entity;
 const validate = (depth: typeof EMPTY_DEPTH) => validateDepthLinks({ ...rig.value, depth }, baseline);
 expect(validate({ ...EMPTY_DEPTH, procurement: [{ id: 'allocation', requirementId: material.id, roomId: rig.roomId, targetId: rig.roomId, workId: '', unit: 'piece', purchased: '1', reserved: '0' }] }).ok).toBe(false);
 expect(validate({ ...rig.depth, costs: [{ ...rig.cost, roomId: 'elsewhere' }] }).ok).toBe(false);
 expect(validate({ ...rig.depth, costs: [{ ...rig.cost, requirementId: 'missing' }] }).ok).toBe(false);
 expect(validate({ ...rig.depth, costs: [{ ...rig.cost, planned: of('10', 'USD') }] }).ok).toBe(false);
 expect(validate({ ...rig.depth, evidence: [{ ...rig.evidence, recordId: 'missing' }] }).ok).toBe(false);
 const legacy = expectOk(Requirement.create({ ...material, source: undefined })); expect(validateMaterialLinks(legacy, baseline).ok).toBe(true); expect((await contextualFigures(rig.deps, legacy, rig.asset, rig.asset.unitCost, baseline.currency)).ok).toBe(false);
 vi.spyOn(rig.geometry, 'read').mockResolvedValueOnce(err(failure)); expect((await contextualFigures(rig.deps, material, rig.asset, rig.asset.unitCost, baseline.currency)).ok).toBe(false);
 const invalid = expectOk(Requirement.create({ ...material, source: { ...rig.input.source, targetId: 'missing', rule: 'wall-net' } })); expect((await contextualFigures(rig.deps, invalid, rig.asset, rig.asset.unitCost, baseline.currency)).ok).toBe(false);
 expect(prepareMaterial({ ...baseline, catalogue: [{ asset: rig.asset, price: of('1', 'USD') }] }, rig.input).ok).toBe(false);
 });
 it('routes sidecar, calibration and rebuild events through the existing stale-first cascade with failure notices', async () => {
 const rig = await planningStack(), notify = { cascadeAborted: vi.fn<(id: string) => void>(), staleMarkerFailed: vi.fn<() => void>() }, recalculate = vi.fn<() => Promise<ReturnType<typeof ok<void>>>>().mockResolvedValue(ok(undefined));
 const subscription = registerOnPlanningChanged(rig.deps.events, { ...rig.deps, logger: rig.stack.logger, notify, recalculate, index: rig.stack.index });
 await rig.deps.events.publish({ type: 'GeometrySidecarChanged', payload: { entityType: 'renovation-asset', entityId: rig.asset.id } }); await rig.deps.events.publish({ type: 'PlanCalibrated' }); expect(recalculate).not.toHaveBeenCalled();
 vi.spyOn(rig.deps.plans, 'getById').mockResolvedValueOnce(ok(null)); await rig.deps.events.publish({ type: 'ProjectIndexRebuilt' }); expect(notify.cascadeAborted).toHaveBeenCalledWith(rig.plan.id);
 vi.spyOn(rig.deps.requirements, 'listByProject').mockResolvedValueOnce(err(failure)); await rig.deps.events.publish({ type: 'PlanCalibrated', payload: { planId: rig.plan.id } }); expect(notify.cascadeAborted).toHaveBeenCalledTimes(2);
 await rig.deps.events.publish({ type: 'GeometrySidecarChanged', payload: { entityType: 'renovation-plan', entityId: rig.plan.id } }); subscription.dispose();
 });
 it('keeps legacy Inspector status honest for contextual sources and missing geometry', async () => {
 const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const deps = { ...rig.deps, zones: rig.stack.zones, logger: rig.stack.logger }, query = new GetRequirementsForZone(deps);
 expect(expectOk(await query.execute(rig.roomId))[0].recalculationStatus).toBe('current');
 vi.spyOn(rig.geometry, 'read').mockResolvedValueOnce(err(failure)); expect(expectOk(await query.execute(rig.roomId))[0].recalculationStatus).toBe('stale');
 expect(expectOk(await new GetRequirementsForZone({ ...deps, geometry: undefined }).execute(rig.roomId))[0].recalculationStatus).toBe('stale');
 });
 it('protects a manual quantity spatial link from source deletion', async () => {
 const rig = await planningStack(), input = { ...rig.input, source: { ...rig.input.source, rule: 'manual' as const, targetId: 'wall-a', manual: '5' } };
 expectOk(await rig.planning.material(expectOk(await rig.read()), input, rig.ledger).execute());
 const before = expectOk(await rig.geometry.read(rig.plan.id)), structure = before.document.structure;
 const after = { ...before.document, structure: { ...structure, walls: structure?.walls.filter(wall => wall.id !== 'wall-a') ?? [], openings: [], boundaries: [] } };
 expect((await rig.geometry.write(rig.plan.id, after, before.version)).ok).toBe(false);
 expect(prepareMaterial(expectOk(await rig.read()), { ...input, source: { ...input.source, targetId: 'missing' } }).ok).toBe(false);
 });

 it('treats absent deletion as a no-op and preserves history after a failed delete', async () => {
 const rig = await planningStack(), events = vi.spyOn(rig.deps.events, 'publish');
 expect(await rig.planning.material(expectOk(await rig.read()), { deleteId: rig.input.id }, rig.ledger).execute()).toEqual(ok('no-write')); expect(events).not.toHaveBeenCalled();
 expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const command = rig.planning.material(expectOk(await rig.read()), { deleteId: rig.input.id }, rig.ledger);
 vi.spyOn(rig.deps.requirements, 'delete').mockResolvedValueOnce(err(failure)); expect(await command.execute()).toEqual(err(failure)); expect(expectOk(await rig.read()).materials).toHaveLength(1);
 expectOk(await command.execute()); expectOk(await command.undo()); expect(expectOk(await rig.read()).materials).toHaveLength(1);
 });

 it.each(['create', 'edit', 'delete'] as const)('compensates a %s when its geometry confirmation fails, then supports retry', async kind => {
 const rig = await planningStack();
 if (kind !== 'create') expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const baseline = expectOk(await rig.read()), command = rig.planning.material(baseline, kind === 'delete' ? { deleteId: rig.input.id } : { ...rig.input, override: '7' }, rig.ledger);
 vi.spyOn(rig.geometry, 'write').mockRejectedValueOnce(new Error('sidecar'));
 expect((await command.execute()).ok).toBe(false); expect(expectOk(await rig.read()).materials.map(item => item.entity)).toEqual(baseline.materials.map(item => item.entity));
 expectOk(await command.execute()); expectOk(await command.undo());
 });
 it.each(['create', 'edit'] as const)('retires %s when source confirmation and conditional restoration both fail', async kind => {
 const rig = await planningStack();
 if (kind === 'edit') expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const command = rig.planning.material(expectOk(await rig.read()), { ...rig.input, override: '7' }, rig.ledger);
 vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(failure));
 if (kind === 'create') vi.spyOn(rig.deps.requirements, 'delete').mockResolvedValueOnce(err(failure));
 else { const save = rig.deps.requirements.save.bind(rig.deps.requirements); vi.spyOn(rig.deps.requirements, 'save').mockImplementationOnce(save).mockResolvedValueOnce(err(failure)); }
 const result = await command.execute(); expect(leftWritesBehind(expectErr(result))).toBe(true);
 expect((await command.execute()).ok).toBe(false); expect((await command.undo()).ok).toBe(false);
 });
 it('compensates a material whose wall was deleted after its baseline read', async () => {
 const rig = await planningStack(), baseline = expectOk(await rig.read()), save = rig.deps.requirements.save.bind(rig.deps.requirements);
 vi.spyOn(rig.deps.requirements, 'save').mockImplementationOnce(async (entity, expected) => {
 expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.geometry.document, structure: { walls: [], openings: [], boundaries: [] } }, baseline.geometry.version)); return save(entity, expected);
 });
 const input = { ...rig.input, source: { ...rig.input.source, targetId: 'wall-a', rule: 'wall-net' as const } };
 expect((await rig.planning.material(baseline, input, rig.ledger).execute()).ok).toBe(false); expect(expectOk(await rig.read()).materials).toHaveLength(0);
 });

 it('refuses invalid drafts and stale initial Requirement versions before writing', async () => {
 const rig = await planningStack(), baseline = expectOk(await rig.read());
 expect((await rig.planning.material(baseline, { ...rig.input, waste: '-1' }, rig.ledger).execute()).ok).toBe(false);
 expectOk(await rig.planning.material(baseline, rig.input, rig.ledger).execute());
 const shown = expectOk(await rig.read()), edit = rig.planning.material(shown, { ...rig.input, override: '7' }, rig.ledger), live = shown.materials[0];
 expectOk(await rig.deps.requirements.save(live.entity, live.version)); expect((await edit.execute()).ok).toBe(false);
 });
 it('preserves independent money overrides and refuses a semantic peer edit even when the ledger knows its version', async () => {
 const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const first = expectOk(await rig.read()).materials[0]; expectOk(await rig.deps.requirements.save(expectOk(first.entity.withCostOverride(of('123', 'EUR'))), first.version));
 const command = rig.planning.material(expectOk(await rig.read()), { ...rig.input, source: { ...rig.input.source, lot: '2' } }, rig.ledger); expectOk(await command.execute());
 const live = expectOk(await rig.read()).materials[0]; expect(live.entity.estimatedCost.override).toEqual(of('123', 'EUR'));
 expect((await contextualFigures(rig.deps, live.entity, rig.asset, rig.asset.unitCost, rig.asset.unitCost.currency)).ok).toBe(true);
 const withMinimum = expectOk(Requirement.create({ ...live.entity, source: { ...rig.input.source, lot: '2', minimum: '4' } })); expect((await contextualFigures(rig.deps, withMinimum, rig.asset, rig.asset.unitCost, rig.asset.unitCost.currency)).ok).toBe(true);
 const peer = expectOk(await rig.deps.requirements.save(expectOk(live.entity.withCostOverride(of('321', 'EUR'))), live.version)); rig.ledger.record(peer.entity.id, peer.version);
 expect((await command.undo()).ok).toBe(false); expect(expectOk(await rig.read()).materials[0].entity.estimatedCost.override).toEqual(of('321', 'EUR'));
 });
 it('refuses unit reassignment with existing allocations and reports direct material evidence', async () => {
 const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const allocation = { id: 'allocation', roomId: rig.roomId, targetId: rig.roomId, workId: '', requirementId: rig.input.id, purchased: '1', reserved: '0', unit: 'piece' as const };
 const read = expectOk(await rig.read()), baseline = { ...read, plan: { ...read.plan, entity: expectOk(withPlanRenovation(read.plan.entity, { ...rig.value, depth: { ...EMPTY_DEPTH, procurement: [allocation] } })) } };
 vi.spyOn(rig.deps.plans, 'getById').mockResolvedValueOnce(ok(baseline.plan));
 expect((await rig.planning.material(baseline, rig.input, rig.ledger).execute()).ok).toBe(false);
 expect(materialReferents({ ...EMPTY_DEPTH, evidence: [{ ...rig.evidence, recordId: rig.input.id }] }, rig.input.id)).toEqual(['Floor invoice']);
 });

 it('refuses legacy Room reassignment of contextual material and marks a missing source stale through the event cascade', async () => {
 const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute()); const material = expectOk(await rig.read()).materials[0].entity;
 expect(material.repointedTo({ kind: 'zone', zoneId: 'other-room' as typeof rig.roomId }, rig.asset.id).ok).toBe(false); expect(material.repointedTo(material.origin, rig.asset.id).ok).toBe(true);
 expect(Requirement.create({ ...material, source: { ...rig.input.source, coverage: '0' } }).ok).toBe(false);
 const notify = { cascadeAborted: vi.fn<(id: string) => void>(), staleMarkerFailed: vi.fn<() => void>() }, recalculate = vi.fn<() => Promise<ReturnType<typeof ok<void>>>>().mockResolvedValue(ok(undefined));
 const subscription = registerOnPlanningChanged(rig.deps.events, { ...rig.deps, logger: rig.stack.logger, notify, recalculate });
 const geometry = expectOk(await rig.geometry.read(rig.plan.id)); vi.spyOn(rig.geometry, 'read').mockResolvedValueOnce(ok({ ...geometry, document: { ...geometry.document, objects: [] } }));
 await rig.deps.events.publish({ type: 'PlanStructureChanged', payload: { planId: rig.plan.id } }); expect(recalculate).toHaveBeenCalledOnce();
 await rig.deps.events.publish({ type: 'GeometrySidecarChanged', payload: { entityType: 'renovation-plan' } }); subscription.dispose();
 });

});
