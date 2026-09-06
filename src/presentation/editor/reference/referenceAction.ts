import { useSelectionStore } from '../selection/selection-store';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useProjectStore } from '../../stores/ProjectStore';
import { computed, markRaw, onBeforeUnmount, ref, watch } from 'vue';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ConfigureReferenceInput } from '../../../application/commands/plan/ConfigurePlanReference';
import { err } from '../../../core/result/Result';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useDialogStore } from '../../dialogs/dialog-store';
import { tr } from '../../i18n/strings';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import ReferenceSetupForm from './ReferenceSetupForm.vue';

export function createReferenceAction(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'dispatcher' | 'writesBlocked' | 'returnToSelect' | 'activeToolId'>) {
	const dialogs = useDialogStore(), active = ref(false), workspace = useWorkspaceStore(), project = useProjectStore();
	watch(() => JSON.stringify(project.plan?.background), () => { workspace.layerVisibility.background = project.plan?.background?.appearance?.visible ?? true; });
	const selection = useSelectionStore();
	let alive = true, generation = 0;
	watch([runtime.activeToolId, () => selection.selectedIds], () => { generation++; }, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; });
	async function openReference(): Promise<void> {
		if (!alive || active.value || runtime.writesBlocked.value || dialogs.current !== null) return;
		active.value = true;
		runtime.returnToSelect();
		const started = generation;
		try {
			const baseline = await context.commands.referencePlan.read(context.planId as PlanId);
			if (!alive || generation !== started || dialogs.current !== null || runtime.writesBlocked.value) return;
			if (!baseline.ok) { notifyOperationFailure(baseline.error); return; }
			const busy = ref(false);
			await dialogs.openDialog({ kind: 'form', title: tr('editor.reference.title'), component: markRaw(ReferenceSetupForm), busy,
				props: { baseline: baseline.value, vault: context.vault, fileChanges: (listener: (path: string) => void) => context.onVaultFileChanged(listener), busy,
					blocked: runtime.writesBlocked, logger: context.commands.logger,
					dispatch: (input: ConfigureReferenceInput) => {
						if (!alive || generation !== started || runtime.writesBlocked.value) return Promise.resolve(err(staleWriteRefusal()));
						return runtime.dispatcher.run(context.commands.referencePlan.command(baseline.value, input));
					},
				},
			});
		} catch (cause) { if (alive && generation === started) notifyFault(cause, context.commands.logger, 'editor.reference.failed'); }
		finally { active.value = false; }
	}
	return { openReference, referenceActive: active, referenceBlocked: computed(() => active.value || runtime.writesBlocked.value) };
}
