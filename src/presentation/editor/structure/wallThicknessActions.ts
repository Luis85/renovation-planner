import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { AppError } from '../../../core/errors/AppError';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { WallSide } from '../../../domain/spatial/Structure';
import { wallSideExtents, withWallSideExtents } from '../../../domain/spatial/wallSides';
import { wallSideGeometryIssue } from '../../../domain/spatial/wallSideNetwork';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useDialogStore } from '../../dialogs/dialog-store';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import type { StructureReviewState } from './structureBulkEdit';
import { persistenceError } from '../../../application/errors';
import { createWallSideDraft } from './wallSideDraft';

/** Two independent face values over one reviewed StructureCommand transaction. */
export function createWallThicknessActions(context: PlanEditorContext, state: StructureReviewState, highlight: (id: string | null, side: WallSide | null) => void) {
	const selection = useSelectionStore(), editor = useEditorStore(), session = useRenovationSession(), workspace = useWorkspaceStore(), dialogs = useDialogStore();
	const target = ref<string | null>(null), mode = ref<'entry' | 'adjust'>('entry'), initialFace = ref<WallSide>('a'), busy = ref(false), loading = ref(false), failed = ref(false);
	const baseline = shallowRef<PlanGeometrySnapshot | null>(null), error = shallowRef<AppError | null>(null);
	const focused = ref<WallSide | null>(null), hovered = ref<WallSide | null>(null), lastHint = ref<'focus' | 'hover'>('focus');
	let alive = true, generation = 0;
	const original = computed(() => baseline.value?.document.structure?.walls.find(wall => wall.id === target.value)), draft = createWallSideDraft(original);
	const paused = computed(() => loading.value || busy.value || state.blocked.value || failed.value);
	const proposed = computed(() => baseline.value?.document.structure && target.value && draft.valid.value && draft.values.value ? withWallSideExtents(baseline.value.document.structure, target.value, draft.values.value) : null);
	const geometryIssue = computed(() => proposed.value ? wallSideGeometryIssue(proposed.value.walls) : null);
	const proposal = computed(() => geometryIssue.value ? null : proposed.value);
	const changed = computed(() => { const wall = original.value, next = draft.values.value; if (!wall || !next) return false; const before = wallSideExtents(wall); return next.a !== before.a || next.b !== before.b; });
	function close(): void { generation++; highlight(target.value, null); focused.value = null; hovered.value = null; target.value = null; baseline.value = null; loading.value = false; state.preview.value = null; if (!busy.value) state.active.value = false; }
	watch([() => session.perspective, () => selection.selectedIds.join(), () => editor.activeToolId, () => dialogs.current], () => { if (target.value) close(); }, { flush: 'sync' });
	watch([focused, hovered, lastHint], () => highlight(target.value, lastHint.value === 'hover' ? hovered.value ?? focused.value : focused.value ?? hovered.value), { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; close(); });
	function current(ticket: number): boolean { return alive && ticket === generation; }
	function mayBegin(id: string): boolean { return alive && !state.unavailable() && selection.selectedIds.length === 1 && selection.selectedIds[0] === id && editor.activeToolId === 'select'; }
	async function begin(id: string, kind: 'entry' | 'adjust' = 'entry', face: WallSide = 'a'): Promise<void> {
		const services = context.commands.structure;
		if (!services || !mayBegin(id)) return;
		const ticket = ++generation; workspace.closeOverlay(); draft.reset();
		target.value = id; mode.value = kind; initialFace.value = face; state.active.value = true; loading.value = true; error.value = null; failed.value = false;
		try {
			const read = await services.read(context.planId as PlanId);
			if (!current(ticket) || state.blocked.value) { if (ticket === generation) close(); return; }
			const prepared = state.prepareBaseline(read), wall = prepared.snapshot?.document.structure?.walls.find(item => item.id === id);
			if (!prepared.snapshot || !wall) { close(); await prepared.recovery; return; }
			baseline.value = prepared.snapshot; draft.reset(wall);
		} catch (cause) { if (current(ticket)) { notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed'); close(); } }
		finally { if (ticket === generation) loading.value = false; }
	}
	function refreshPreview(): void { error.value = null; state.preview.value = proposal.value; }
	function update(side: WallSide, next: string): void { if (alive && target.value && !paused.value) { draft.edit(side, next); refreshPreview(); } }
	function increment(side: WallSide, direction: -1 | 1): void { if (alive && target.value && !paused.value && draft.step(side, direction)) refreshPreview(); }
	function canIncrement(side: WallSide, direction: -1 | 1): boolean { return !paused.value && draft.canStep(side, direction); }
	function focus(side: WallSide | null): void { if (alive && target.value) { focused.value = side; if (side) lastHint.value = 'focus'; } }
	function hover(side: WallSide | null): void { if (alive && target.value) { hovered.value = side; if (side) lastHint.value = 'hover'; } }
	async function apply(): Promise<void> {
		const services = context.commands.structure, snapshot = baseline.value, next = proposal.value;
		if (!alive || !target.value || paused.value || !changed.value || !services || !snapshot || !next) return;
		const ticket = generation; busy.value = true;
		try {
			const result = await state.reviewedWrite(services, snapshot).dispatch(next, () => alive && ticket === generation && session.perspective === 'plan');
			if (!current(ticket)) return;
			if (result.ok) close();
			else { error.value = result.error; failed.value = WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code)) || result.error.code === 'undo.superseded'; notifyOperationFailure(result.error); }
		} catch (cause) { if (current(ticket)) { error.value = persistenceError('spatial.write-failed', 'The spatial edit failed.', cause); notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed'); } }
		finally { busy.value = false; if (!target.value) state.active.value = false; }
	}
	return { target, mode, initialFace, text: draft.text, values: draft.values, total: draft.total, numericValid: draft.valid, original, paused, loading, busy, error, proposal, geometryIssue, changed, begin, update, increment, canIncrement, focus, hover, apply, close };
}
