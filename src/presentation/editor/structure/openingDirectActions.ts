import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { AppError } from '../../../core/errors/AppError';
import type { PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { PlanId } from '../../../domain/plan/PlanId';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import { persistenceError } from '../../../application/errors';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import type { StructureReviewState } from './structureBulkEdit';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useEditorStore } from '../../stores/EditorStore';
import { useProjectStore } from '../../stores/ProjectStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useSelectionStore } from '../selection/selection-store';
import { notifyFault } from '../../notices/notify';
import { createOpeningDirectDraft } from './openingDirectDraft';
import type { OpeningSwingDraft } from './openingSwingDraft';

/** One leaf-local lifetime for all direct opening entry points and the initial command admission. */
export function createOpeningDirectActions(context: PlanEditorContext, state: StructureReviewState, gesture: () => boolean) {
	const editor = useEditorStore(), selection = useSelectionStore(), session = useRenovationSession();
	const project = useProjectStore(), workspace = useWorkspaceStore(), dialogs = useDialogStore(), draft = createOpeningDirectDraft();
	const target = ref<string | null>(null), baseline = shallowRef<PlanGeometrySnapshot | null>(null);
	const opener = shallowRef<HTMLElement | null>(null), focusField = ref<'width' | 'offset' | 'swing'>('width');
	const loading = ref(false), busy = ref(false), error = shallowRef<AppError | null>(null), failed = ref(false);
	let alive = true, generation = 0, armed = '';
	const projection = () => JSON.stringify([project.structure, project.plan?.calibration]);
	const original = computed(() => baseline.value?.document.structure?.openings.find(item => item.id === target.value));
	const paused = computed(() => loading.value || busy.value || state.blocked.value || failed.value);
	function clear(): void {
		generation++; target.value = null; baseline.value = null; loading.value = false; error.value = null; failed.value = false;
		state.preview.value = null; if (!busy.value) state.active.value = false;
	}
	function current(ticket: number): boolean {
		return alive && ticket === generation && target.value !== null && session.perspective === 'plan' && workspace.layerVisibility.architecture && !dialogs.current;
	}
	const proposal = computed(() => {
		const structure = baseline.value?.document.structure, opening = original.value;
		return structure && opening ? draft.propose(structure, opening) : null;
	});
	const changed = computed(() => !!baseline.value && !!proposal.value && !sameGeometryDocument(baseline.value.document, { ...baseline.value.document, structure: proposal.value }));
	const issue = computed(() => proposal.value ? validateStructure(proposal.value, baseline.value?.document.objects.map(item => item.id) ?? []) : null);
	const invalid = computed(() => proposal.value === null || issue.value?.ok === false);
	function refreshPreview(): void {
		error.value = issue.value && !issue.value.ok ? issue.value.error : null;
		state.preview.value = !invalid.value ? proposal.value : null;
	}
	function update(field: 'width' | 'offset', value: string): void { if (current(generation) && !paused.value) { draft.update(field, value); refreshPreview(); } }
	function step(field: 'width' | 'offset', direction: -1 | 1): void { if (current(generation) && !paused.value) { draft.step(field, direction); refreshPreview(); } }
	function updateSwing(value: OpeningSwingDraft): void { if (current(generation) && !paused.value) { draft.updateSwing(value); refreshPreview(); } }
	function mayBegin(id: string): boolean {
		const opening = project.structure.openings.find(item => item.id === id);
		return alive && !busy.value && !state.unavailable() && !gesture() && workspace.layerVisibility.architecture && editor.activeToolId === 'select'
			&& session.perspective === 'plan' && selection.selectedIds.length === 1 && selection.selectedIds[0] === id && !!opening && opening.kind !== 'opening';
	}
	async function begin(id: string, source?: HTMLElement | null, focus: 'width' | 'offset' | 'swing' = 'width'): Promise<void> {
		const services = context.commands.structure;
		if (!services || !mayBegin(id)) return;
		const ticket = ++generation; armed = projection(); opener.value = source ?? null; focusField.value = focus; workspace.closeOverlay();
		target.value = id; state.active.value = true; loading.value = true; error.value = null; failed.value = false;
		try {
			const read = await services.read(context.planId as PlanId);
			if (!current(ticket) || state.blocked.value) { if (ticket === generation) clear(); return; }
			const prepared = state.prepareBaseline(read), opening = prepared.snapshot?.document.structure?.openings.find(item => item.id === id);
			if (!prepared.snapshot || !opening) { clear(); await prepared.recovery; return; }
			baseline.value = prepared.snapshot; draft.reset(opening); refreshPreview();
		} catch (cause) { if (current(ticket)) { notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed'); clear(); } }
		finally { if (ticket === generation) loading.value = false; }
	}
	async function apply(): Promise<void> {
		const services = context.commands.structure, snapshot = baseline.value, next = proposal.value, ticket = generation;
		if (!services || !snapshot || !next || !changed.value || invalid.value || paused.value || !current(ticket)) return;
		busy.value = true;
		try {
			const result = await state.reviewedWrite(services, snapshot).dispatch(next, () => current(ticket) && projection() === armed);
			if (!current(ticket)) return;
			if (result.ok) clear();
			else { error.value = result.error; failed.value = WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code)) || result.error.code === 'undo.superseded'; }
		} catch (cause) { if (current(ticket)) { error.value = persistenceError('spatial.write-failed', 'The spatial edit failed.', cause); failed.value = true; } }
		finally { busy.value = false; if (!target.value) state.active.value = false; }
	}
	watch([() => session.perspective, () => selection.selectedIds.join(), () => editor.activeToolId, () => workspace.layerVisibility.architecture, () => dialogs.current, projection],
		() => { if (target.value) clear(); }, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; clear(); });
	return { target, opener, focusField, width: draft.width, offset: draft.offset, swing: draft.swing, loading, busy, error, paused, invalid, changed, begin, update, step, updateSwing, apply, close: clear };
}
