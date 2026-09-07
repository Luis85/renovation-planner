import { computed, markRaw, onBeforeUnmount, ref } from 'vue';
import { err } from '../../../core/result/Result';
import type { RenovationProjectDeps } from '../RenovationProjectContext';
import type { ProjectWorkRow } from '../../../application/queries/schedule/ProjectWork';
import type { RenovationBaseline, RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import { SessionWriteLedger, undoSuperseded } from '../../../application/editor/WriteLedger';
import { CommandHistory } from '../../editor/tools/command-history';
import { withStateRefresh } from '../../editor/tools/with-state-refresh';
import { withSaveStateTracking } from '../../editor/save-state/with-save-state-tracking';
import { useSaveStateStore } from '../../editor/save-state/save-state-store';
import { useDialogStore } from '../../dialogs/dialog-store';
import { renovationDraft } from '../../editor/renovation/renovationDraft';
import RenovationForm from '../../editor/renovation/RenovationForm.vue';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import type { useProjectWorkRead } from './projectWorkRead';

export function useProjectWorkActions(context: RenovationProjectDeps, read: ReturnType<typeof useProjectWorkRead>) {
 const dialogs = useDialogStore(), save = useSaveStateStore(), history = new CommandHistory(), ledger = new SessionWriteLedger();
 const loading = ref(false), revision = ref(0);
 let alive = true;
 const dispatcher = withSaveStateTracking(withStateRefresh(history, read.refresh), save);
 const paused = computed(() => read.paused.value || save.unrecoveredWrite || !!context.readOnly);
 const blocked = computed(() => paused.value || loading.value || save.state === 'saving');
 const canUndo = computed(() => { void revision.value; return history.canUndo; });
 const canRedo = computed(() => { void revision.value; return history.canRedo; });
 function canLeave(): Promise<boolean> { return Promise.resolve(!loading.value && save.state !== 'saving' && dialogs.current === null); }
 if (context.session) context.session.canLeave = canLeave;
 onBeforeUnmount(() => { alive = false; if (context.session?.canLeave === canLeave) delete context.session.canLeave; });
 async function dispatch(baseline: RenovationBaseline, input: RenovationInput) {
  if (!alive || paused.value || !context.work) return err(undoSuperseded(baseline.plan.entity.id));
  const result = await dispatcher.run(context.work.renovation.command(baseline, input, ledger));
  if (alive) revision.value++;
  return result;
 }
 async function edit(row: ProjectWorkRow): Promise<void> {
  if (blocked.value || dialogs.current || !context.work) return;
  loading.value = true;
  try {
   const baseline = await context.work.renovation.read(row.planId);
   if (!alive) return;
   if (!baseline.ok) { notifyOperationFailure(baseline.error); return; }
   const current = baseline.value.plan.entity.renovation?.work.find(item => item.id === row.work.id);
   if (JSON.stringify(current) !== JSON.stringify(row.work)) { notifyOperationFailure(undoSuperseded(row.planId)); await read.refresh(); return; }
   const busy = ref(false);
   await dialogs.openDialog({ kind: 'form', title: tr('renovation.edit.work'), component: markRaw(RenovationForm), busy,
    props: { baseline: baseline.value, draft: renovationDraft('work', row.work.roomId, row.work.id, baseline.value.plan.entity.renovation),
     busy, paused, retry: read.refresh, openSource: () => context.openRecord?.(row.planId).then(() => undefined) ?? Promise.resolve(),
     dispatch: (input: RenovationInput) => dispatch(baseline.value, input) } });
  } catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'project.work-edit-failed'); }
  finally { loading.value = false; }
 }
 async function step(direction: 'undo' | 'redo'): Promise<void> {
  if (blocked.value || dialogs.current) return;
  loading.value = true;
  try { const result = await dispatcher[direction](); if (alive) { revision.value++; if (!result.ok) notifyOperationFailure(result.error); } }
  catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'project.work-history-failed'); }
  finally { loading.value = false; }
 }
 async function open(row: ProjectWorkRow): Promise<void> {
  if (!alive || !(await canLeave()) || !alive) return;
  await context.openPlan(row.planId, { planId: row.planId, roomId: row.work.roomId, workId: row.work.id });
 }
 return { edit, step, open, blocked, canUndo, canRedo, save };
}
