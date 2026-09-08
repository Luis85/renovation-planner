import { computed, onBeforeUnmount, ref } from 'vue';
import type { PlanId } from '../../../domain/plan/PlanId';
import { sameElementMetadata } from '../../../domain/spatial/SpatialElement';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { renovationReferents } from '../../../domain/renovation/renovationTargets';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { removalSources } from '../planning/removalSources';
import { structureRecords } from '../structure/structureRecords';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { tr } from '../../i18n/strings';
import { spatialRemovalInput } from './spatialRemovalInput';
import type { RenovationBaseline } from '../../../application/commands/renovation/RenovationCommand';

export function createSpatialRemoval(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'activeToolId' | 'dispatcher' | 'writesBlocked' | 'refreshProjection' | 'structureTask'>) {
 const project = useProjectStore(), dialogs = useDialogStore(), selection = useSelectionStore(), save = useSaveStateStore(), session = useRenovationSession();
 const active = ref(false), blocked = computed(() => runtime.writesBlocked.value || save.state === 'saving' || session.perspective === 'review' || runtime.activeToolId.value !== 'select');
 let alive = true; onBeforeUnmount(() => { alive = false; });
 function matches(baseline: RenovationBaseline): boolean {
  const document = baseline.geometry.document;
  return sameElementMetadata(project.plan?.spatialElements, baseline.plan.entity.spatialElements)
   && sameGeometryDocument({ objects: [], groups: project.groups, structure: project.structure, intended: project.intended, calibration: project.plan?.calibration ?? null },
    { ...document, objects: [], structure: document.structure ?? EMPTY_STRUCTURE });
 }
 async function approve(baseline: RenovationBaseline, selected: readonly string[], proposal: ReturnType<typeof spatialRemovalInput>): Promise<boolean> {
  const materials = await removalSources(context, proposal.ids);
  if (!alive) return false;
  if (!materials.ok) { notifyOperationFailure(materials.error); return false; }
  const references = [...materials.value, ...proposal.ids.flatMap(id => renovationReferents(baseline.plan.entity.renovation ?? EMPTY_RENOVATION, id))];
  if (references.length) {
   await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), message: tr('renovation.links', { names: references.join(', ') }) }); return false;
  }
  const names = structureRecords(baseline.geometry.document.structure ?? EMPTY_STRUCTURE, context.planId, baseline.plan.entity.spatialElements).filter(item => selected.includes(item.id)).map(item => item.name);
  return await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), danger: true,
   message: tr('renovation.batch.scope', { count: String(selected.length) }) + ' ' + names.join(', ') + '. ' + tr('editor.structure.delete-impact', { openings: String(proposal.openings), rooms: String(proposal.rooms) }) }) === 'confirm';
 }
 function unavailable(): boolean { return !alive || active.value || blocked.value || !!dialogs.current; }
 function stillCurrent(selected: string): boolean { return alive && !blocked.value && selection.selectedIds.join('|') === selected; }
 async function remove(ids: readonly string[]): Promise<void> {
  const services = context.commands.renovation, selected = [...new Set(ids)], selectionAtStart = selection.selectedIds.join('|');
  if (unavailable() || !services || selected.length < 2) return;
  active.value = true;
  try {
   const read = await services.read(context.planId as PlanId);
   if (!stillCurrent(selectionAtStart)) return;
   if (!read.ok) { notifyOperationFailure(read.error); return; }
   if (!matches(read.value)) { notifyOperationFailure(staleWriteRefusal()); await runtime.refreshProjection(); return; }
   const records = structureRecords(read.value.geometry.document.structure ?? EMPTY_STRUCTURE, context.planId);
   if (!selected.every(id => records.some(item => item.id === id))) return;
   const proposal = spatialRemovalInput(read.value, selected);
   const approved = await approve(read.value, selected, proposal);
   if (!stillCurrent(selectionAtStart) || !approved) return;
   const result = await runtime.dispatcher.run(services.command(read.value, proposal.input, runtime.structureTask.ledger));
   if (alive && !result.ok) notifyOperationFailure(result.error);
  } catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.element.remove-failed'); }
  finally { active.value = false; }
 }
 return { remove, active };
}
