import { nextTick, onBeforeUnmount, watch } from 'vue';
import type { EntityId } from '../../../core/identity/EntityId';
import type { ProjectOrigin } from '../../../application/navigation/ProjectDestination';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { notifyWarning } from '../../notices/notify';
import { tr } from '../../i18n/strings';
/** Explicit Project return navigation reuses a live editor and its existing focus action. */
export function useEditorArrival(context: PlanEditorContext, runtime: EditorRuntime) {
 const project = useProjectStore(), selection = useSelectionStore(), dialogs = useDialogStore(), save = useSaveStateStore();
 let alive = true, pending = context.initialNavigation, processing = false;
 onBeforeUnmount(() => { alive = false; });
 const isSaving = (): boolean => save.state === 'saving';
 async function confirmDraft(): Promise<boolean> {
  if (!runtime.toolManager.activeToolHasDraft()) return true;
  const answer = await dialogs.openDialog({ kind: 'confirm', title: tr('renovation.navigation.title'), message: tr('renovation.navigation.message') });
  return alive && answer === 'confirm' && !isSaving();
 }
 function canNavigate(origin: ProjectOrigin): boolean { return alive && origin.planId === context.planId && !dialogs.current && !isSaving(); }
 async function navigateToRecord(origin: ProjectOrigin): Promise<boolean> {
  if (!canNavigate(origin)) return false;
  if (project.status !== 'ready' || runtime.writesBlocked.value) { pending = origin; return true; }
  if (!(await confirmDraft()) || !canNavigate(origin)) { if (pending === origin) pending = undefined; return false; }
  if (runtime.writesBlocked.value) { pending = origin; return true; }
  if (pending === origin) pending = undefined;
  return reveal(origin);
 }
 function recordFor(origin: ProjectOrigin) {
  const renovation = project.plan?.renovation;
  return origin.costId ? renovation?.depth?.costs.find(item => item.id === origin.costId) : renovation?.work.find(item => item.id === origin.workId);
 }
 function reveal(origin: ProjectOrigin): boolean {
  const record = recordFor(origin);
  const roomId = origin.roomId ?? record?.roomId;
  if (!roomId || project.zones.get(roomId)?.zoneType !== 'Room' || ((origin.costId || origin.workId) && !record)) {
   notifyWarning(tr('schedule.return-missing')); return false;
  }
  runtime.returnToSelect();
  selection.select([roomId as EntityId<string>]);
  runtime.renovation.focus(roomId, origin.costId ? 'costs' : origin.workId ? 'work' : 'overview', record?.id ?? '');
  return true;
 }
 watch([() => project.status, runtime.writesBlocked, () => dialogs.current, () => save.state], async () => {
  if (!pending || processing || project.status !== 'ready' || runtime.writesBlocked.value || dialogs.current || save.state === 'saving') return;
  const origin = pending; processing = true;
  try { await nextTick(); if (alive) await navigateToRecord(origin); }
  finally { processing = false; }
 }, { immediate: true });
 return navigateToRecord;
}
