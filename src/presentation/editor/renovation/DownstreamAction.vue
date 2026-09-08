<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useRenovationSession } from './renovationSession';
import { tr } from '../../i18n/strings';
import { notifyFault } from '../../notices/notify';
const props = defineProps<{ section: 'schedule' | 'quotes'; workId?: string; costId?: string }>();
const context = usePlanEditorContext(), runtime = useEditorRuntime(), project = useProjectStore(), session = useRenovationSession(), save = useSaveStateStore(), dialogs = useDialogStore();
const opening = ref(false);
const disabled = computed(() => opening.value || save.state === 'saving' || !context.navigation?.downstream || !project.plan);
let alive = true;
onBeforeUnmount(() => { alive = false; });
function destination(plan: NonNullable<typeof project.plan>) {
  const cost = plan.renovation?.depth?.costs.find(item => item.id === (props.costId ?? session.focusedId));
  const workId = props.workId ?? cost?.workId ?? plan.renovation?.work.find(item => item.id === session.focusedId)?.id;
  return { projectId: plan.projectId, route: { section: props.section, origin: { planId: context.planId,
   roomId: session.roomId, ...(workId ? { workId } : {}), ...(cost ? { costId: cost.id } : {}) } } };
}
async function open(): Promise<void> {
 if (disabled.value || dialogs.current) return;
 opening.value = true;
 try {
  if (runtime.toolManager.activeToolHasDraft()) {
   const result = await dialogs.openDialog({ kind: 'confirm', title: tr('renovation.navigation.title'), message: tr('renovation.navigation.message') });
   if (!alive || result !== 'confirm' || save.state === 'saving') return;
   runtime.returnToSelect();
  }
  const plan = project.plan;
  if (!alive || !plan || !context.navigation?.downstream) return;
  const target = destination(plan);
  await context.navigation.downstream(target.projectId, target.route);
 } catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.navigation.failed'); } finally { opening.value = false; }
}
</script>
<template>
	<button
		type="button"
		:aria-disabled="disabled"
		:data-rp-downstream="section"
		@click="open"
	>
		{{ tr(section === 'schedule' ? 'schedule.open' : 'quote.comparison') }}
	</button>
	<p
		v-if="!context.navigation?.downstream"
		role="status"
	>
		{{ tr('schedule.navigation-unavailable') }}
	</p>
</template>
