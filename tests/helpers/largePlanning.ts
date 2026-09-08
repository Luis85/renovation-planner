import { prepareMaterial, type PlanningBaseline } from '../../src/application/commands/renovation/PlanningServices';
import { withPlanRenovation } from '../../src/domain/plan/Plan';
import { EMPTY_RENOVATION } from '../../src/domain/renovation/Renovation';
import { EMPTY_DEPTH } from '../../src/domain/renovation/PlanningDepth';
import { createZoneId } from '../../src/domain/zone/ZoneId';
import { createRequirementId } from '../../src/domain/requirement/RequirementId';
import { makeAsset } from './entities';
import { expectOk } from './domain';

/** Reusable measured floor: 80 rooms, 240 calculated materials, 24 catalogue assets, 40 photos. */
export function largePlanningBaseline(template: PlanningBaseline): PlanningBaseline {
 const objects = Array.from({ length: 80 }, (_, index) => {
  const x = (index % 10) * 5000, y = Math.floor(index / 10) * 4000;
  return { id: createZoneId(), points: [{ x, y }, { x: x + 4000, y }, { x: x + 4000, y: y + 3000 }, { x, y: y + 3000 }] };
 });
 const catalogue = Array.from({ length: 24 }, (_, index) => { const asset = makeAsset({ name: 'Finish ' + (index + 1) }); return { asset, price: asset.unitCost }; });
 const evidence = Array.from({ length: 40 }, (_, index) => ({
  id: 'photo-' + index, roomId: objects[0].id, targetId: objects[0].id, workId: '', recordId: '', path: 'Evidence/photo-' + index + '.png', subpath: '',
  description: 'Inspection photo ' + (index + 1), type: 'photo' as const, phase: 'before' as const, pin: null
 }));
 const plan = { ...template.plan, entity: expectOk(withPlanRenovation(template.plan.entity, { ...EMPTY_RENOVATION, depth: { ...EMPTY_DEPTH, evidence } })) };
 const baseline: PlanningBaseline = { ...template, plan, geometry: { ...template.geometry, document: { calibration: null, structure: { walls: [], openings: [], boundaries: [] }, objects } }, materials: [], catalogue };
 const materials = objects.flatMap((room, index) => Array.from({ length: 3 }, (_, material) => {
  const entity = expectOk(prepareMaterial(baseline, { id: createRequirementId(), roomId: room.id, assetId: catalogue[(index * 3 + material) % catalogue.length].asset.id,
   waste: '0.1', override: '', source: { planId: plan.entity.id, targetId: room.id, workId: '', outcomeId: '', state: 'current', rule: 'room-area', manual: '0', coverage: '1', lot: '', minimum: '' } }));
  return { entity, version: template.plan.version };
 }));
 return { ...baseline, materials };
}
