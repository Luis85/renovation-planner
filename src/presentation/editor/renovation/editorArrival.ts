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
 /**
  * Two arms answering two different questions, and the asset one must not fall through to the
  * other. An origin carrying an `assetId` is the designer's "Use in plan" hand-off: it names no
  * room, work item or cost, so `revealRecord`'s `recordFor` would answer `undefined`, its
  * `target` would stay unset, and it would warn about a return record nobody asked for.
  * `assetId` wins over a record id in the same origin: nothing in `src/` builds an origin
  * carrying both, and one stated rule is cheaper than a combination nobody can produce.
  *
  * `runtime.elementTask.assets.arm` rather than a new member on `EditorRuntime`: that path is
  * already how this task is reached from outside itself — `grep -rn "elementTask\.assets" src/`
  * printed nine lines across four components and this file before the count was written — so the
  * hand-off arms the placement tool through the same door the Add menu's picker arms it through,
  * and there is no second arming path to keep in step (CLAUDE.md, "one action, every input").
  *
  * The return type is a UNION rather than `Promise<boolean>` because only the asset arm is
  * asynchronous: marking the whole function `async` would put the record arms behind a microtask
  * they never needed, and `require-await` refuses an `async` with nothing to await anyway.
  * `navigateToRecord` above is `async` and awaits whichever it gets.
  *
  * The record arm is a function of its own rather than the rest of this body, and that is the
  * COMPLEXITY BUDGET rather than taste: `revealRecord` was already at 16 of the 16 `complexity`
  * allows, so one more `if` here made the merged function 17 and failed `npm run lint`. Measured,
  * not predicted — that is the error the gate printed.
  */
 function reveal(origin: ProjectOrigin): boolean | Promise<boolean> {
  return origin.assetId === undefined ? revealRecord(origin) : runtime.elementTask.assets.arm(origin.assetId);
 }
 /** Unchanged by the hand-off: select the Room, Work item or cost the origin names, or warn that it is gone. */
 function revealRecord(origin: ProjectOrigin): boolean {
  const record = recordFor(origin);
  const roomId = origin.roomId ?? record?.roomId, target = roomId ?? record?.targetId;
  if (!target || (roomId !== undefined && !project.zones.has(roomId)) || ((origin.costId || origin.workId) && !record)) {
   notifyWarning(tr('schedule.return-missing')); return false;
  }
  runtime.returnToSelect();
  selection.select([target as EntityId<string>]);
  runtime.renovation.focus(roomId ?? '', origin.costId ? 'costs' : origin.workId ? 'work' : 'overview', record?.id ?? '');
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
