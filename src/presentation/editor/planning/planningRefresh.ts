import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { err } from '../../../core/result/Result';
import { persistenceError } from '../../../application/errors';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanEditorContext } from '../PlanEditorContext';
import { createLatestRead } from '../../composables/latest-read';
import { usePlanningReadState } from './planningReadState';
import { planningFindings, evidenceFindings } from './planningProjection';

export function createPlanningRefresh(context: PlanEditorContext) {
 const state = usePlanningReadState(), refs = storeToRefs(state), services = context.commands.planning;
 const slow = ref(false);
 watch(refs.loading, (loading, _previous, cleanup) => {
  slow.value = false;
  if (loading) { const timer = window.setTimeout(() => { slow.value = true; }, 300); cleanup(() => window.clearTimeout(timer)); }
 });
 let alive = true;
 const reader = services ? createLatestRead(async () => {
  try { return await services.read(context.planId as PlanId); }
  catch (cause) { return err(persistenceError('planning.read-failed', 'Planning data could not be refreshed.', cause)); }
 }, result => {
  state.loading = false;
  if (!result.ok) { if (state.failed) state.retriesFailed++; state.failed = true; return; }
  state.baseline = result.value; state.failed = false; state.retriesFailed = 0;
 }) : null;
 function refresh(): Promise<void> {
  if (!alive || !reader) return Promise.resolve();
  state.loading = true;
  return reader.refresh();
 }
 if (services) {
  for (const subscribe of [context.onCatalogueChanged.bind(context), context.onProjectPricesChanged.bind(context), context.onRequirementFiguresChanged.bind(context)]) {
   onBeforeUnmount(subscribe(() => { void refresh(); }));
  }
 onBeforeUnmount(context.onVaultFileChanged(path => {
   const paths = (state.baseline?.plan.entity.renovation?.depth?.evidence ?? []).flatMap(item => {
    const file = context.commands.evidenceFiles?.resolve(item.path + item.subpath, context.planId as PlanId);
    return file?.ok ? [item.path, file.value.path] : [item.path];
   });
   if (paths.some(linked => linked === path || linked.startsWith(path + '/'))) state.evidenceRevision++;
  }));
 }
 const financial = computed(() => state.baseline ? planningFindings(state.baseline) : []);
 const findings = computed(() => {
  void state.evidenceRevision;
  return [...financial.value, ...(state.baseline ? evidenceFindings(state.baseline, context.commands.evidenceFiles) : [])];
 });
 onBeforeUnmount(() => { alive = false; reader?.dispose(); state.loading = false; });
 return { ...refs, slow, refresh, findings };
}
