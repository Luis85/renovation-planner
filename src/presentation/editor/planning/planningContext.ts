import { createDraftRetry } from '../forms/createDraftRetry';
import type { RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import { computed, inject, markRaw, onBeforeUnmount, provide, ref, type InjectionKey } from 'vue';
import { sameRenovation } from '../../../domain/renovation/sameRenovation';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { undoSuperseded } from '../../../application/editor/WriteLedger';
import { err } from '../../../core/result/Result';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { notifyOperationFailure } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import PlanningForm from './PlanningForm.vue';
import { planningDraft, type PlanningKind } from './planningDraft';

const KEY: InjectionKey<ReturnType<typeof providePlanningContext>> = Symbol('planning-depth');
export function providePlanningContext(context: PlanEditorContext, runtime: EditorRuntime) {
	const { baseline, loading, failed, findings, evidenceRevision, slow } = runtime.planning;
	const project = useProjectStore(), dialogs = useDialogStore(), session = useRenovationSession();
	let alive = true;
	onBeforeUnmount(() => { alive = false; });
	const refresh = createDraftRetry(runtime.refreshProjection, () => alive, context.commands.logger);
	const blocked = computed(() => loading.value || runtime.writesBlocked.value || runtime.renovation.blocked.value);
	function matches(read: PlanningBaseline): boolean {
		return sameRenovation(project.plan?.renovation, read.plan.entity.renovation) && sameGeometryDocument(
			{ calibration: project.plan?.calibration ?? null, groups: project.groups, structure: project.structure, intended: project.intended, objects: [...project.zones.values()].map(item => ({ id: item.id, points: item.points, bulges: item.bulges })) },
			{ ...read.geometry.document, structure: read.geometry.document.structure ?? EMPTY_STRUCTURE });
	}
	async function edit(kind: PlanningKind, id = ''): Promise<void> {
		const services = context.commands.planning;
		if (blocked.value || dialogs.current || !baseline.value || !services) return;
		const shown = baseline.value;
		if (!matches(shown)) { notifyOperationFailure(undoSuperseded(context.planId as PlanId)); await refresh(); return; }
		const draft = planningDraft(kind, shown, session.roomId, id, { focusedId: session.focusedId, targetId: session.targetId || session.roomId });
        if (kind === 'evidence' && !id) draft.type = session.mode === 'photos' ? 'photo' : session.mode === 'notes' ? 'note' : 'document';
		const busy = ref(false);
		await dialogs.openDialog({ kind: 'form', title: tr(`planning.edit.${kind}`), component: markRaw(PlanningForm), busy,
			props: { draft, baseline: shown, busy, paused: runtime.writesBlocked, retry: refresh, openSource: runtime.openPlanNote, files: context.commands.evidenceFiles,
				dispatch: (input: Parameters<NonNullable<typeof context.commands.planning>['material']>[1] | RenovationInput) => {
					if (!alive) return Promise.resolve(err(undoSuperseded(context.planId as PlanId)));
					const command = 'renovation' in input ? context.commands.renovation?.command(shown, input, runtime.structureTask.ledger) : services.material(shown, input, runtime.structureTask.ledger);
					return command ? runtime.dispatcher.run(command) : Promise.resolve(err(undoSuperseded(context.planId as PlanId)));
				} } });

	}
	const value = { baseline, loading, failed, findings, evidenceRevision, slow, blocked, refresh, edit, files: context.commands.evidenceFiles, context, runtime };
	provide(KEY, value);
	return value;
}

export function usePlanningContext(): ReturnType<typeof providePlanningContext> { const value = inject(KEY); if (!value) throw new Error('Planning context is missing.'); return value; }
