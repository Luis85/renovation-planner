import Konva from 'konva';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import { err } from '../../src/core/result/Result';
import { expectDefined, expectOk } from '../helpers/domain';
import { largePlanningBaseline } from '../helpers/largePlanning';
import { makeZone } from '../helpers/entities';
import type { referenceWorkspace } from './referenceWorkspace';
import type { PlanEditorView } from '../../src/presentation/views/PlanEditorView';

/** Deterministic browser-only failures around the production service/repository boundaries. */
export function planningRecoveryProbe(workspace: ReturnType<typeof referenceWorkspace>, view: PlanEditorView) {
 const { stack, deps, plan, geometry } = workspace, services = expectDefined(deps.commands.planning, 'planning');
 const counts = { reads: 0, planWrites: 0, materialWrites: 0, spatialReads: 0 };
 const urls = new Set<string>(), createUrl = URL.createObjectURL.bind(URL), revokeUrl = URL.revokeObjectURL.bind(URL);
 URL.createObjectURL = blob => { const url = createUrl(blob); urls.add(url); return url; };
 URL.revokeObjectURL = url => { urls.delete(url); revokeUrl(url); };
 let fail = false, arm = false;
 const read = services.read.bind(services), planSave = stack.plans.save.bind(stack.plans), materialSave = stack.requirements.save.bind(stack.requirements);
 services.read = id => { counts.reads++; return fail ? Promise.resolve(err({ category: 'Persistence', code: 'fixture.read', message: 'Injected read-back failure' })) : read(id); };
 stack.plans.save = async (...args) => { const result = await planSave(...args); if (result.ok) { counts.planWrites++; if (arm) { fail = true; arm = false; } } return result; };
 stack.requirements.save = async (...args) => { const result = await materialSave(...args); if (result.ok) { counts.materialWrites++; if (arm) { fail = true; arm = false; } } return result; };
 const getPlan = deps.queries.getPlan;
 deps.queries.getPlan = (...args) => { counts.spatialReads++; return getPlan(...args); };
 const changed = () => stack.events.publish({ type: 'PlanRenovationChanged', payload: { planId: plan.id, projectId: plan.projectId } });
 function snapshot() { return { ...counts, listeners: stack.vault.eventListenerCount, stages: Konva.stages.length, images: document.querySelectorAll('.rp-evidence-thumbnail').length, objectUrls: urls.size }; }
 function scene() {
  return Konva.stages.map(stage => {
   const layer = stage.findOne('.zone');
   return { materialMarkers: stage.find('.material-marker').length, camera: layer ? { x: layer.x(), y: layer.y(), zoom: layer.scaleX() } : null };
  });
 }
 return {
  snapshot, scene, armFailure: () => { arm = true; }, setFailure: (value: boolean) => { fail = value; },
  async events(count: number) { await Promise.all(Array.from({ length: count }, changed)); },
  files(paths: string[]) { for (const path of paths) { if (!stack.vault.entries.has(path)) stack.vault.entries.set(path, 'fixture'); stack.vault.trigger('modify', stack.vault.getAbstractFileByPath(path)); } },
  async geometryChange() {
   const before = expectOk(await geometry.read(plan.id));
   expectOk(await geometry.write(plan.id, { ...before.document, objects: before.document.objects.map(room => ({ ...room, points: room.points.map(point => ({ ...point, x: point.x * 1.01 })) })) }, before.version));
   await changed();
  },
  async seedLarge() {
   const fixture = largePlanningBaseline(expectOk(await read(plan.id)));
   for (const item of fixture.catalogue) expectOk(await stack.assets.save(item.asset, 'absent'));
   for (const [index, object] of fixture.geometry.document.objects.entries()) expectOk(await stack.zones.save(makeZone({ id: object.id as ZoneId, planId: plan.id, projectId: plan.projectId, name: 'Room ' + (index + 1), geometry: { points: object.points } }), 'absent'));
   const current = expectOk(await geometry.read(plan.id));
   expectOk(await geometry.write(plan.id, fixture.geometry.document, current.version));
   for (const item of fixture.materials) expectOk(await materialSave(item.entity, 'absent'));
   const currentPlan = expectDefined(expectOk(await stack.plans.getById(plan.id)), 'plan');
   expectOk(await planSave(fixture.plan.entity, currentPlan.version));
   const sources = new Map<string, string>();
   for (const [index, item] of (fixture.plan.entity.renovation?.depth?.evidence ?? []).entries()) {
    stack.vault.entries.set(item.path, '1600x1200 image fixture');
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1200;
    const context = expectDefined(canvas.getContext('2d'), 'canvas'); context.fillStyle = 'hsl(' + index * 9 + ' 45% 65%)'; context.fillRect(0, 0, 1600, 1200);
    context.fillStyle = '#252525'; context.font = '80px sans-serif'; context.fillText(item.description, 80, 160);
    sources.set(item.path, canvas.toDataURL('image/png')); canvas.width = 0; canvas.height = 0;
   }
   stack.deps.vault.getResourcePath = file => sources.get(file.path) ?? '';
   await changed();
   return { rooms: 80, materials: 240, catalogue: 24, photos: 40, imageDimensions: '1600 × 1200', firstRoom: fixture.geometry.document.objects[0].id };
  },
  async close() { await view.onClose(); return snapshot(); },
  async reopen() { await view.onOpen(); },
 };
}
