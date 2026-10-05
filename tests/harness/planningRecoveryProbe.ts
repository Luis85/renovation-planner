import Konva from 'konva';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import type { PlanId } from '../../src/domain/plan/PlanId';
import { err } from '../../src/core/result/Result';
import { createEntityId } from '../../src/core/identity/generateId';
import { referencePlanServices } from '../../src/application/commands/plan/ConfigurePlanReference';
import { SessionWriteLedger } from '../../src/application/editor/WriteLedger';
import { createVaultFileProbe } from '../../src/infrastructure/obsidian/vault/vaultFileProbe';
import { encloseRoom } from '../../src/domain/spatial/encloseRoom';
import { EMPTY_STRUCTURE, alongWall, wallLength, type Structure } from '../../src/domain/spatial/Structure';
import { PLACEHOLDER_WORLD_SCALE } from '../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { prepareValid, setupMeasurement } from '../../src/presentation/editor/reference/referenceSetup';
import { createStructureDraft, mintStructure, openingFromDraft, pickHost } from '../../src/presentation/editor/structure/structureDraft';
import { expectDefined, expectOk } from '../helpers/domain';
import { largePlanningBaseline } from '../helpers/largePlanning';
import { makeZone } from '../helpers/entities';
import type { referenceWorkspace } from './referenceWorkspace';
import type { PlanEditorView } from '../../src/presentation/views/PlanEditorView';

type Workspace = ReturnType<typeof referenceWorkspace>;
const REFERENCE = { path: 'Plans/large-floor-reference.png', width: 2400, height: 1800 };

/** A synthetic PNG: one fill and one caption, the way every image this probe seeds is drawn. */
function rasterUrl(width: number, height: number, fill: string, caption: string): string {
 const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
 const context = expectDefined(canvas.getContext('2d'), 'canvas'); context.fillStyle = fill; context.fillRect(0, 0, width, height);
 context.fillStyle = '#252525'; context.font = '80px sans-serif'; context.fillText(caption, 80, 160);
 const url = canvas.toDataURL('image/png'); canvas.width = 0; canvas.height = 0;
 return url;
}

/**
 * The reference through the product's own path on the still-empty floor: `referencePlanServices` over the
 * production file probe (the harness's own `referencePlan` answers only its two static fixtures), with the
 * measurement `ReferenceSetupForm` derives — 2400 source pixels as 50 m, so the sheet spans the whole floor.
 */
async function seedReference({ stack, deps, plan, geometry, ready }: Workspace) {
 await ready;
 stack.vault.entries.set(REFERENCE.path, '2400x1800 image fixture');
 const url = rasterUrl(REFERENCE.width, REFERENCE.height, 'hsl(40 30% 92%)', 'Large floor reference 2400 × 1800');
 const canvasPath = deps.vault.getResourcePath.bind(deps.vault);
 deps.vault.getResourcePath = file => file.path === REFERENCE.path ? url : canvasPath(file);
 // referenceWorkspace's own referencePlan probe is a `path in sources` closure over its private fixture map and does not see this path;
 // a later driver step that opened Configure reference plan here would refuse with plan.background-not-found.
 const references = referencePlanServices(stack.plans, geometry, stack.events, createVaultFileProbe(stack.vault as never));
 const baseline = expectOk(await references.read(plan.id));
 const appearance = { crop: { x: 0, y: 0, width: REFERENCE.width, height: REFERENCE.height }, rotation: 0, opacity: 0.65, visible: true, locked: true };
 if (!prepareValid(appearance, REFERENCE.width, REFERENCE.height)) throw new Error('reference appearance refused');
 const scale = expectDefined(setupMeasurement([{ x: 0, y: 0 }, { x: REFERENCE.width, y: 0 }], '50', appearance, PLACEHOLDER_WORLD_SCALE, baseline.geometry.document.calibration), 'reference scale');
 expectOk(await references.command(baseline, { background: { path: REFERENCE.path, kind: 'image', appearance }, measurement: scale.measurement }).execute());
}

/**
 * Every Room enclosed as the Enclose action does (`encloseRoom`, its dimensions and wall ids), then a
 * door on its bottom wall and a window on its top one placed as the door and window tools do, committed
 * through the product's `StructureCommand` in one write. Enclose would also group each Room with its
 * walls; no group is written, which is the document Enclose then Ungroup leaves.
 */
async function seedStructure({ deps, plan }: Workspace): Promise<Structure> {
 const services = expectDefined(deps.commands.structure, 'structure');
 const baseline = expectOk(await services.read(plan.id as PlanId)), rooms = baseline.document.objects;
 let structure: Structure = baseline.document.structure ?? EMPTY_STRUCTURE;
 const openings = [];
 for (const room of rooms) {
  const enclosed = expectOk(encloseRoom(room, structure, { height: 2400, thickness: 150 }, () => createEntityId('wall'), rooms.filter(other => other.id !== room.id)));
  structure = enclosed.structure;
  for (const [kind, index] of [['place-door', 2], ['place-window', 0]] as const) {
   const wall = expectDefined(structure.walls.find(item => item.id === enclosed.wallIds[index]), 'enclosing wall');
   const draft = createStructureDraft(); draft.kind = kind;
   // Copy of structureTask's start() window preset; drifts silently if the product's own defaults there change.
   if (kind === 'place-window') { draft.text.openingHeight = '1.2'; draft.text.sill = '0.9'; draft.swing.angle = '0'; }
   pickHost(draft, alongWall(wall, wallLength(wall) / 2), [wall], 1);
   openings.push(expectDefined(openingFromDraft(draft), 'opening'));
  }
 }
 structure = mintStructure({ ...structure, openings });
 expectOk(await services.command({ planId: plan.id as PlanId, baseline, structure, ledger: new SessionWriteLedger() }).execute());
 return structure;
}

function scene() {
 return Konva.stages.map(stage => {
  const layer = stage.findOne('.zone');
  return { materialMarkers: stage.find('.material-marker').length, camera: layer ? { x: layer.x(), y: layer.y(), zoom: layer.scaleX() } : null };
 });
}

/** Deterministic browser-only failures around the production service/repository boundaries. */
export function planningRecoveryProbe(workspace: ReturnType<typeof referenceWorkspace>, view: PlanEditorView) {
 const { stack, deps, plan, geometry } = workspace, services = expectDefined(deps.commands.planning, 'planning');
 const seeded = { walls: new Set<string>(), openings: new Set<string>() };
 // Separate from scene() so panFrames' sampled window never pays these three extra full-tree traversals;
 // only largeFloor()'s post-usableMs wait/assertion calls this.
 function structureOnStage() {
  return Konva.stages.map(stage => {
   const image: unknown = stage.findOne<Konva.Layer>('.background')?.findOne('Image')?.getAttr('image');
   return { walls: stage.find((node: Konva.Node) => seeded.walls.has(node.name())).length, openings: stage.find((node: Konva.Node) => seeded.openings.has(node.name())).length,
    reference: image instanceof HTMLImageElement ? { width: image.naturalWidth, height: image.naturalHeight } : null };
  });
 }
 const counts = { reads: 0, planWrites: 0, materialWrites: 0, zoneWrites: 0, spatialReads: 0 };
 const urls = new Set<string>(), createUrl = URL.createObjectURL.bind(URL), revokeUrl = URL.revokeObjectURL.bind(URL);
 URL.createObjectURL = blob => { const url = createUrl(blob); urls.add(url); return url; };
 URL.revokeObjectURL = url => { urls.delete(url); revokeUrl(url); };
 let fail = false, arm = false;
 let writeGate = Promise.resolve(), waitingWrites = 0;
 let releaseWrite: (() => void) | undefined;
 async function beforeWrite() { waitingWrites++; await writeGate; waitingWrites--; }
 const read = services.read.bind(services), planSave = stack.plans.save.bind(stack.plans), materialSave = stack.requirements.save.bind(stack.requirements);
 services.read = id => { counts.reads++; return fail ? Promise.resolve(err({ category: 'Persistence', code: 'fixture.read', message: 'Injected read-back failure' })) : read(id); };
 stack.plans.save = async (...args) => { await beforeWrite(); const result = await planSave(...args); if (result.ok) { counts.planWrites++; if (arm) { fail = true; arm = false; } } return result; };
 stack.requirements.save = async (...args) => { await beforeWrite(); const result = await materialSave(...args); if (result.ok) { counts.materialWrites++; if (arm) { fail = true; arm = false; } } return result; };
 const zoneSave = stack.zones.save.bind(stack.zones);
 stack.zones.save = async (...args) => { await beforeWrite(); const result = await zoneSave(...args); if (result.ok) counts.zoneWrites++; return result; };
 const getPlan = deps.queries.getPlan;
 deps.queries.getPlan = (...args) => { counts.spatialReads++; return getPlan(...args); };
 const changed = () => stack.events.publish({ type: 'PlanRenovationChanged', payload: { planId: plan.id, projectId: plan.projectId } });
 function snapshot() { return { ...counts, waitingWrites, listeners: stack.vault.eventListenerCount, stages: Konva.stages.length, images: document.querySelectorAll('.rp-evidence-thumbnail').length, objectUrls: urls.size }; }
 return {
  snapshot, scene, structure: structureOnStage, armFailure: () => { arm = true; }, setFailure: (value: boolean) => { fail = value; },
  pauseWrites() { writeGate = new Promise<void>(resolve => { releaseWrite = resolve; }); },
  resumeWrites() { releaseWrite?.(); },
  async events(count: number) { await Promise.all(Array.from({ length: count }, changed)); },
  files(paths: string[]) { for (const path of paths) { if (!stack.vault.entries.has(path)) stack.vault.entries.set(path, 'fixture'); stack.vault.trigger('modify', stack.vault.getAbstractFileByPath(path)); } },
  async geometryChange() {
   const before = expectOk(await geometry.read(plan.id));
   expectOk(await geometry.write(plan.id, { ...before.document, objects: before.document.objects.map(room => ({ ...room, points: room.points.map(point => ({ ...point, x: point.x * 1.01 })) })) }, before.version));
   await changed();
  },
  async seedLarge() {
   await seedReference(workspace);
   const fixture = largePlanningBaseline(expectOk(await read(plan.id)));
   for (const item of fixture.catalogue) expectOk(await stack.assets.save(item.asset, 'absent'));
   for (const [index, object] of fixture.geometry.document.objects.entries()) expectOk(await stack.zones.save(makeZone({ id: object.id as ZoneId, planId: plan.id, projectId: plan.projectId, name: 'Room ' + (index + 1), geometry: { points: object.points } }), 'absent'));
   const current = expectOk(await geometry.read(plan.id));
   // The baseline's document is uncalibrated by construction; the Rooms are drawn after the scale is set, so it stays.
   expectOk(await geometry.write(plan.id, { ...fixture.geometry.document, calibration: current.document.calibration }, current.version));
   const built = await seedStructure(workspace);
   for (const wall of built.walls) seeded.walls.add(wall.id);
   for (const opening of built.openings) seeded.openings.add(opening.id);
   for (const item of fixture.materials) expectOk(await materialSave(item.entity, 'absent'));
   const currentPlan = expectDefined(expectOk(await stack.plans.getById(plan.id)), 'plan');
   expectOk(await planSave(fixture.plan.entity, currentPlan.version));
   const sources = new Map<string, string>();
   for (const [index, item] of (fixture.plan.entity.renovation?.depth?.evidence ?? []).entries()) {
    stack.vault.entries.set(item.path, '1600x1200 image fixture');
    sources.set(item.path, rasterUrl(1600, 1200, 'hsl(' + index * 9 + ' 45% 65%)', item.description));
   }
   stack.deps.vault.getResourcePath = file => sources.get(file.path) ?? '';
   await changed();
   return { rooms: 80, materials: 240, catalogue: 24, photos: 40, imageDimensions: '1600 × 1200', walls: built.walls.length, openings: built.openings.length,
    reference: { width: REFERENCE.width, height: REFERENCE.height }, firstRoom: fixture.geometry.document.objects[0].id };
  },
  async close() { await view.onClose(); return snapshot(); },
  async reopen() { await view.onOpen(); },
 };
}
