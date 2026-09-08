import { renovationStack } from './renovation';
import { expectOk } from './domain';
import { makeAsset } from './entities';
import { InMemoryAssetPriceOverrideRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import { planningServices, type MaterialInput, type PlanningDeps } from '../../src/application/commands/renovation/PlanningServices';
import { renovationServices } from '../../src/application/commands/renovation/RenovationCommand';
import { validateDepthLinks } from '../../src/application/commands/renovation/planningLinks';
import { EMPTY_RENOVATION } from '../../src/domain/renovation/Renovation';
import { createRequirementId } from '../../src/domain/requirement/RequirementId';
import { EMPTY_DEPTH, type CostRecord, type Evidence } from '../../src/domain/renovation/PlanningDepth';
import { of } from '../../src/core/money/Money';

export async function planningStack() {
 const rig = await renovationStack();
 expectOk(await rig.renovation.command(expectOk(await rig.read()), { renovation: rig.value, intended: undefined }, rig.ledger).execute());
 const asset = makeAsset(); expectOk(await rig.stack.assets.save(asset, 'absent'));
 const deps: PlanningDeps = { ...rig.stack, geometry: rig.geometry, overrides: new InMemoryAssetPriceOverrideRepository(), locks: new ReferenceLocks() };
 const services = planningServices(deps);
 const renovation = renovationServices(deps.plans, deps.geometry, deps.events, async (plan, document) => {
 const read = await services.read(plan.id); return read.ok ? validateDepthLinks(plan.renovation ?? EMPTY_RENOVATION, { ...read.value, geometry: { ...read.value.geometry, document } }) : read;
 });
 const input: MaterialInput = { id: createRequirementId(), roomId: rig.roomId, assetId: asset.id, waste: '0.1', override: '',
 source: { planId: rig.plan.id, targetId: rig.roomId, workId: 'work-sand', outcomeId: 'detail-floor', state: 'current', rule: 'room-area', manual: '0', coverage: '1', lot: '', minimum: '' } };
 const cost: CostRecord = { id: 'cost-floor', roomId: rig.roomId, targetId: rig.roomId, workId: 'work-sand', title: 'Floor finish', category: 'material', requirementId: input.id, planned: null, cancelled: false,
 facts: [{ id: 'order', stage: 'committed', amount: of('500', 'EUR'), description: 'Order', commitmentId: '', cancelled: false }, { id: 'paid', stage: 'actual', amount: of('200', 'EUR'), description: 'Deposit', commitmentId: 'order', cancelled: false }] };
 const evidence: Evidence = { id: 'evidence-invoice', roomId: rig.roomId, targetId: rig.roomId, workId: 'work-sand', recordId: cost.id, path: 'Evidence/invoice.pdf', subpath: '', description: 'Floor invoice', type: 'document', phase: 'during', pin: null };
 const depth = { ...EMPTY_DEPTH, costs: [cost], evidence: [evidence] };
 return { ...rig, deps, asset, input, cost, evidence, depth, planning: services, renovation, read: () => services.read(rig.plan.id) };
}
