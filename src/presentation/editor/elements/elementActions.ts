import { createDraftRetry } from '../forms/createDraftRetry';
import { createSpatialRemoval } from './spatialRemoval';
import { computed, markRaw, onBeforeUnmount, ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { NamedSpatialElement, SpatialElement } from '../../../domain/spatial/SpatialElement';
import { validSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useSelectionStore } from '../selection/selection-store';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { renovationReferents } from '../../../domain/renovation/renovationTargets';
import { removalSources } from '../planning/removalSources';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import { elementInput } from './elementInput';
import { areaOutline } from '../add/areaOutline';
import OutlinePointsForm from '../resize/OutlinePointsForm.vue';
import { err } from '../../../core/result/Result';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import type { RenovationBaseline } from '../../../application/commands/renovation/RenovationCommand';

function elementFrom(baseline: RenovationBaseline, id: string): NamedSpatialElement | null {
 const geometry = baseline.geometry.document.structure?.elements?.find(item => item.id === id);
 const label = baseline.plan.entity.spatialElements?.find(item => item.id === id);
 return geometry && label ? { ...geometry, name: label.name } : null;
}
export function createElementActions(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'activeToolId' | 'dispatcher' | 'writesBlocked' | 'refreshProjection' | 'structureTask' | 'openPlanNote'>) {
	const project = useProjectStore(), dialogs = useDialogStore(), save = useSaveStateStore(), session = useRenovationSession(), selection = useSelectionStore();
	const removal = createSpatialRemoval(context, runtime);
	const active = ref(false), preview = ref<NamedSpatialElement | null>(null);
	const blocked = computed(() => runtime.writesBlocked.value || save.state === 'saving' || session.perspective !== 'plan' || runtime.activeToolId.value !== 'select');
	let alive = true;
	const retry = createDraftRetry(runtime.refreshProjection, () => alive, context.commands.logger);
	onBeforeUnmount(() => { alive = false; preview.value = null; });
	async function read(id: string): Promise<{ baseline: RenovationBaseline; element: NamedSpatialElement } | null> {
		const result = await context.commands.renovation?.read(context.planId as PlanId);
		if (!alive) return null;
		if (!result?.ok) { if (result) notifyOperationFailure(result.error); return null; }
		const element = elementFrom(result.value, id);
		if (!element) return null;
		const { name, ...geometry } = element;
		const shown = project.structure.elements?.find(item => item.id === id), shownName = project.plan?.spatialElements?.find(item => item.id === id)?.name;
		if (JSON.stringify(shown) !== JSON.stringify(geometry) || shownName !== name) { notifyOperationFailure(staleWriteRefusal()); await runtime.refreshProjection(); return null; }
		return { baseline: result.value, element };
	}
	async function operate(id: string, action: (value: NonNullable<Awaited<ReturnType<typeof read>>>) => Promise<void>): Promise<void> {
		if (!alive || active.value || blocked.value || dialogs.current || !context.commands.renovation) return;
		active.value = true;
		try { const value = await read(id); if (value && alive && !blocked.value) await action(value); }
		catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.element.operation-failed'); }
		finally { active.value = false; preview.value = null; }
	}
	function edit(id: string): Promise<void> {
		const selected = selection.selectedIds.join('|');
		return operate(id, async ({ baseline, element }) => {
			if (selection.selectedIds.join('|') !== selected) return;
			const busy = ref(false), latest = ref<string | null>(null);
			await dialogs.openDialog({ kind: 'form', title: tr('editor.element.edit', { name: element.name }), component: markRaw(OutlinePointsForm), busy, props: {
				points: element.points, name: element.name, hint: 'editor.element.edit-hint', busy, blocked, latest, inputBlocked: computed(() => save.state === 'saving' || project.stale || latest.value !== null), retry, openSource: runtime.openPlanNote, logger: context.commands.logger,
				accepts: (points: readonly Point[]) => validSpatialElement({ ...element, points }) && (element.kind !== 'object' || areaOutline(points).ok),
				preview: (polygon: { points: readonly Point[] } | null) => { preview.value = polygon ? { ...element, points: polygon.points } : null; },
				dispatch: async (polygon: { points: readonly Point[] }, name: string) => {
					if (!alive || blocked.value || latest.value || !context.commands.renovation) return err(staleWriteRefusal());
					const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, { ...element, name, points: polygon.points }), runtime.structureTask.ledger));
					if (alive && !result.ok && (result.error.code.includes('conflict') || result.error.code === 'undo.superseded')) { latest.value = tr('editor.element.changed'); await runtime.refreshProjection(); }
					return result;
				},
			} });
		});
	}
	function remove(id: string): Promise<void> {
		return operate(id, async ({ baseline, element }) => {
			const materials = await removalSources(context, [id]); if (!alive) return;
			if (!materials.ok) { notifyOperationFailure(materials.error); return; }
			const references = [...materials.value, ...renovationReferents(baseline.plan.entity.renovation ?? EMPTY_RENOVATION, id)];
			if (references.length) { await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), message: tr('renovation.links', { names: references.join(', ') }) }); return; }
			const answer = await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), danger: true, message: tr('editor.element.delete-impact', { name: element.name }) });
			if (!alive || answer !== 'confirm' || !context.commands.renovation) return;
			const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, element, true), runtime.structureTask.ledger));
			if (alive && !result.ok) notifyOperationFailure(result.error);
		});
	}
	function move(id: string, points: readonly Point[], original: SpatialElement): Promise<void> {
		return operate(id, async ({ baseline, element }) => {
			if (element.kind !== original.kind || JSON.stringify(element.points) !== JSON.stringify(original.points)) { notifyOperationFailure(staleWriteRefusal()); return; }
			if (!context.commands.renovation) return;
			const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, { ...element, points }), runtime.structureTask.ledger));
			if (alive && !result.ok) notifyOperationFailure(result.error);
		});
	}
	function previewElement(id: string | null, points?: readonly Point[]): void {
		const element = project.structure.elements?.find(item => item.id === id), name = project.plan?.spatialElements?.find(item => item.id === id)?.name;
		preview.value = alive && !blocked.value && element && name && points ? { ...element, name, points } : null;
	}
	return { edit, remove, removeMany: removal.remove, removeManyActive: removal.active, move, active, blocked, preview, previewElement };
}
