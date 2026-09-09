import { createDraftRetry } from '../forms/createDraftRetry';
import { createSpatialRemoval } from './spatialRemoval';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { NamedSpatialElement, SpatialElement } from '../../../domain/spatial/SpatialElement';
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
import { elementEditPresentation } from './elementEditPresentation';
import { err } from '../../../core/result/Result';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import type { RenovationBaseline, RenovationServices } from '../../../application/commands/renovation/RenovationCommand';

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
	const rotationEpoch = ref(0);
	watch(() => JSON.stringify([runtime.activeToolId.value, session.perspective, selection.selectedIds, project.structure.elements, project.plan?.spatialElements]), () => { rotationEpoch.value++; preview.value = null; }, { flush: 'sync' });
	const retry = createDraftRetry(runtime.refreshProjection, () => alive, context.commands.logger);
	onBeforeUnmount(() => { alive = false; rotationEpoch.value++; preview.value = null; });
	function matchesProjection(baseline: RenovationBaseline, id: string): boolean {
		const geometry = baseline.geometry.document.structure?.elements?.find(item => item.id === id);
		const name = baseline.plan.entity.spatialElements?.find(item => item.id === id)?.name;
		const shown = project.structure.elements?.find(item => item.id === id), shownName = project.plan?.spatialElements?.find(item => item.id === id)?.name;
		return JSON.stringify(shown) === JSON.stringify(geometry) && shownName === name;
	}
	async function read(id: string): Promise<{ baseline: RenovationBaseline; element: NamedSpatialElement } | null> {
		const result = await context.commands.renovation?.read(context.planId as PlanId);
		if (!alive) return null;
		if (!result?.ok) { if (result) notifyOperationFailure(result.error); return null; }
		if (!matchesProjection(result.value, id)) { notifyOperationFailure(staleWriteRefusal()); await runtime.refreshProjection(); return null; }
		const element = elementFrom(result.value, id);
		return element ? { baseline: result.value, element } : null;
	}
	async function operate(id: string, action: (value: NonNullable<Awaited<ReturnType<typeof read>>>, current: () => boolean) => Promise<void>): Promise<void> {
		if (!alive || active.value || blocked.value || dialogs.current || !context.commands.renovation) return;
		active.value = true;
		const epoch = rotationEpoch.value, current = () => alive && epoch === rotationEpoch.value && !blocked.value;
		try { const value = await read(id); if (value && current()) await action(value, current); }
		catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.element.operation-failed'); }
		finally { rotationEpoch.value++; active.value = false; preview.value = null; }
	}
	function edit(id: string): Promise<void> {
		return operate(id, async ({ baseline, element }, current) => {
			const captured = rotationEpoch.value, busy = ref(false), latest = ref<string | null>(null), formBlocked = computed(() => !current());
			let attempt: { content: string; command: ReturnType<RenovationServices['command']> } | null = null;
			const presentation = elementEditPresentation(element, async value => {
					if (!current() || latest.value || !context.commands.renovation) return err(staleWriteRefusal());
					const content = JSON.stringify(value);
					// A compensated attempt owns its advanced revisions; retry that command.
					if (attempt?.content !== content) attempt = { content, command: context.commands.renovation.command(baseline, elementInput(baseline, { ...element, ...value }), runtime.structureTask.ledger) };
					const result = await runtime.dispatcher.run(attempt.command);
					if (alive && !result.ok && (WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code)) || result.error.code === 'undo.superseded')) { latest.value = tr('editor.element.changed'); await runtime.refreshProjection(); }
					return result;
				}, value => { if (captured === rotationEpoch.value) preview.value = current() ? value : null; });
			await dialogs.openDialog({ kind: 'form', title: tr('editor.element.edit', { name: element.name }), component: presentation.component, busy, props: {
				points: element.points, name: element.name, busy, blocked: formBlocked, latest, inputBlocked: computed(() => formBlocked.value || save.state === 'saving' || save.unrecoveredWrite || latest.value !== null), retry, openSource: runtime.openPlanNote, logger: context.commands.logger,
				...presentation.props,
			} });
		});
	}
	function remove(id: string): Promise<void> {
		return operate(id, async ({ baseline, element }, current) => {
			const materials = await removalSources(context, [id]); if (!current()) return;
			if (!materials.ok) { notifyOperationFailure(materials.error); return; }
			const references = [...materials.value, ...renovationReferents(baseline.plan.entity.renovation ?? EMPTY_RENOVATION, id)];
			if (references.length) { await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), message: tr('renovation.links', { names: references.join(', ') }) }); return; }
			const answer = await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), danger: true, message: tr('editor.element.delete-impact', { name: element.name }) });
			if (!current() || answer !== 'confirm' || !context.commands.renovation) return;
			const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, element, true), runtime.structureTask.ledger));
			if (alive && !result.ok) notifyOperationFailure(result.error);
		});
	}
	function move(id: string, points: readonly Point[], original: SpatialElement): Promise<void> {
		if (JSON.stringify(points) === JSON.stringify(original.points)) return Promise.resolve();
		const epoch = rotationEpoch.value;
		return operate(id, async ({ baseline, element }) => {
			if (epoch !== rotationEpoch.value) return;
			if (element.kind !== original.kind || JSON.stringify(element.points) !== JSON.stringify(original.points) || JSON.stringify(element.stair) !== JSON.stringify(original.stair)) { notifyOperationFailure(staleWriteRefusal()); return; }
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
