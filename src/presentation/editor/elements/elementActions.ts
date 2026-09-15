import { createDraftRetry } from '../forms/createDraftRetry';
import { createSpatialRemoval } from './spatialRemoval';
import { createElementReshape } from './elementReshape';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { isItemColor, itemColorKind, type ItemColor } from '../../../domain/spatial/ItemColor';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useSelectionStore } from '../selection/selection-store';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { renovationReferents } from '../../../domain/renovation/renovationTargets';
import { removalSources } from '../planning/removalSources';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import { elementInput } from './elementInput';
import { loadBearingWarning } from './loadBearingWarning';
import { elementEditPresentation } from './elementEditPresentation';
import { err } from '../../../core/result/Result';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import type { RenovationBaseline } from '../../../application/commands/renovation/RenovationCommand';
import { assetTransformBox, itemTransformBox, type TransformBox } from './transformBox';

function elementFrom(baseline: RenovationBaseline, id: string): NamedSpatialElement | null {
 const geometry = baseline.geometry.document.structure?.elements?.find(item => item.id === id);
 const label = baseline.plan.entity.spatialElements?.find(item => item.id === id);
 return geometry && label ? { ...geometry, name: label.name } : null;
}
/** Preserve every placement fact and physically remove the override on reset. */
function recolored(element: NamedSpatialElement, color: ItemColor | undefined): NamedSpatialElement | null {
	if (!itemColorKind(element.kind) || element.color === color) return null;
	const { color: previous, ...plain } = element;
	void previous;
	return color === undefined ? plain : { ...plain, color };
}
export function createElementActions(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'activeToolId' | 'dispatcher' | 'writesBlocked' | 'refreshProjection' | 'structureTask' | 'openPlanNote'>) {
	const project = useProjectStore(), dialogs = useDialogStore(), save = useSaveStateStore(), session = useRenovationSession(), selection = useSelectionStore();
	const removal = createSpatialRemoval(context, runtime);
	const active = ref(false), preview = ref<NamedSpatialElement | null>(null);
	const blocked = computed(() => runtime.writesBlocked.value || save.state === 'saving' || session.perspective !== 'plan' || runtime.activeToolId.value !== 'select');
	const shapes = useAssetShapeStore(), workspace = useWorkspaceStore();
	/** The one selected item's or placeable placement's transform box, while a geometry write could start (plan editor transform box design, Interaction). */
	const transformBox = computed<TransformBox | null>(() => {
		const element = selection.selectedIds.length === 1 && !blocked.value && !active.value ? project.structure.elements?.find(item => item.id === String(selection.selectedIds[0])) : undefined;
		if (element?.kind === 'object') return workspace.layerVisibility.architecture ? itemTransformBox(element) : null;
		const shape = element?.kind === 'asset' && element.assetId && workspace.layerVisibility.asset ? shapes.shapeOf(element.assetId) : null;
		return shape && element ? assetTransformBox(element, shape) : null;
	});
	let alive = true, rotationEpoch = 0;
	// An operation in flight owns its preview and clears it when its write has been read back; clearing it here drew the saved geometry meanwhile, so the element jumped back and forward.
	watch(() => [runtime.activeToolId.value, session.perspective, selection.selectedIds.join('|')], () => { rotationEpoch += 1; if (!active.value) preview.value = null; }, { flush: 'sync' });
	const retry = createDraftRetry(runtime.refreshProjection, () => alive, context.commands.logger);
	onBeforeUnmount(() => { alive = false; preview.value = null; });
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
	async function operate(id: string, action: (value: NonNullable<Awaited<ReturnType<typeof read>>>) => Promise<void>): Promise<void> {
		if (!alive || active.value || blocked.value || dialogs.current || !context.commands.renovation) return;
		active.value = true;
		try { const value = await read(id); if (value && alive && !blocked.value) await action(value); }
		catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.element.operation-failed'); }
		finally { active.value = false; if (preview.value?.id === id) preview.value = null; }
	}
	function edit(id: string): Promise<void> {
		const selected = selection.selectedIds.join('|');
		return operate(id, async ({ baseline, element }) => {
			if (selection.selectedIds.join('|') !== selected) return;
			const busy = ref(false), latest = ref<string | null>(null);
			const presentation = elementEditPresentation(element, async value => {
					if (!alive || blocked.value || latest.value || !context.commands.renovation) return err(staleWriteRefusal());
					const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, { ...element, ...value }), runtime.structureTask.ledger));
					if (alive && !result.ok && (result.error.code.includes('conflict') || result.error.code === 'undo.superseded')) { latest.value = tr('editor.element.changed'); await runtime.refreshProjection(); }
					return result;
				}, value => { preview.value = value; });
			await dialogs.openDialog({ kind: 'form', title: tr('editor.element.edit', { name: element.name }), component: presentation.component, busy, props: {
				points: element.points, name: element.name, busy, blocked, latest, inputBlocked: computed(() => save.state === 'saving' || save.unrecoveredWrite || latest.value !== null), retry, openSource: runtime.openPlanNote, logger: context.commands.logger,
				...presentation.props,
			} });
		});
	}
	/** One owned fact changed in place — load-bearing, a section's look side — through the same guarded, undoable write as a move. */
	function rewrite(id: string, change: (element: NamedSpatialElement) => NamedSpatialElement | null): Promise<void> {
		return operate(id, async ({ baseline, element }) => {
			const next = change(element);
			if (!next || !context.commands.renovation) return;
			const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, next), runtime.structureTask.ledger));
			if (alive && !result.ok) notifyOperationFailure(result.error);
		});
	}
	function setLoadBearing(id: string, loadBearing: boolean): Promise<void> {
		return rewrite(id, element => (element.kind === 'post' || element.kind === 'beam') && element.loadBearing !== loadBearing ? { ...element, loadBearing } : null);
	}
	/** A single selected placement only. Recheck the selection epoch after the baseline read, including away-and-back changes. */
	function setColor(id: string, color: ItemColor | undefined): Promise<void> {
		const epoch = rotationEpoch;
		if (selection.selectedIds.length !== 1 || selection.selectedIds[0] !== id || (color !== undefined && !isItemColor(color))) return Promise.resolve();
		return rewrite(id, element => epoch === rotationEpoch ? recolored(element, color) : null);
	}
	/** Turns a section line to look at its other side (plan drafting tools design §7). */
	function flip(id: string): Promise<void> {
		return rewrite(id, element => element.kind === 'section' ? { ...element, flipped: element.flipped !== true } : null);
	}
	function remove(id: string): Promise<void> {
		return operate(id, async ({ baseline, element }) => {
			const materials = await removalSources(context, [id]); if (!alive) return;
			if (!materials.ok) { notifyOperationFailure(materials.error); return; }
			const references = [...materials.value, ...renovationReferents(baseline.plan.entity.renovation ?? EMPTY_RENOVATION, id)];
			if (references.length) { await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), message: tr('renovation.links', { names: references.join(', ') }) }); return; }
			const answer = await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), danger: true,
				message: tr('editor.element.delete-impact', { name: element.name }) + loadBearingWarning([id], baseline.geometry.document.structure?.elements, baseline.plan.entity.spatialElements) });
			if (!alive || answer !== 'confirm' || !context.commands.renovation) return;
			const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, element, true), runtime.structureTask.ledger));
			if (alive && !result.ok) notifyOperationFailure(result.error);
		});
	}
	const { move, resize, previewElement, previewResize } = createElementReshape(context, runtime, { operate, preview, blocked, alive: () => alive, rotationEpoch: () => rotationEpoch });
	return { edit, remove, setLoadBearing, setColor, flip, removeMany: removal.remove, removeManyActive: removal.active, move, resize, active, blocked, preview, previewElement, previewResize, transformBox };
}
