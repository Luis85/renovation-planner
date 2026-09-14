import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue';
import type { PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { AppError } from '../../../core/errors/AppError';
import type { Result } from '../../../core/result/Result';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Structure } from '../../../domain/spatial/Structure';
import { MAX_WALL_THICKNESS, MIN_WALL_THICKNESS, WALL_THICKNESS_STEP, withWallThickness } from '../../../domain/spatial/wallThickness';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { formatMetres, parseMetres } from '../shell/formatLength';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import type { StructureServices } from './structureBulkEdit';
import { persistenceError } from '../../../application/errors';

/** One preview session, shared by context-menu and Details entry points. Apply owns one history step. */
export function createWallThicknessActions(context: PlanEditorContext, state: {
	readonly active: Ref<boolean>; readonly preview: Ref<Structure | null>; readonly blocked: Readonly<Ref<boolean>>;
	readonly unavailable: () => boolean;
	readonly prepareBaseline: (result: Result<PlanGeometrySnapshot, AppError>) => { snapshot: PlanGeometrySnapshot | null; recovery: Promise<void> | null };
	readonly reviewedWrite: (services: StructureServices, snapshot: PlanGeometrySnapshot) => { dispatch: (next: Structure, admit?: () => boolean) => Promise<DispatchResult> };
}) {
	const selection = useSelectionStore(), editor = useEditorStore(), session = useRenovationSession(), workspace = useWorkspaceStore();
	const target = ref<string | null>(null), mode = ref<'entry' | 'adjust'>('entry'), text = ref(''), busy = ref(false), loading = ref(false), failed = ref(false);
	const baseline = shallowRef<PlanGeometrySnapshot | null>(null), error = shallowRef<AppError | null>(null);
	const stepped = ref<number | null>(null);
	let alive = true, generation = 0;
	const original = computed(() => baseline.value?.document.structure?.walls.find(wall => wall.id === target.value));
	const value = computed(() => { const parsed = parseMetres(text.value); return stepped.value ?? (parsed.ok ? (text.value === formatMetres(original.value?.thickness ?? 0) ? original.value?.thickness ?? parsed.mm : parsed.mm) : null); });
	const paused = computed(() => loading.value || busy.value || state.blocked.value || failed.value);
	const proposal = computed(() => baseline.value?.document.structure && target.value && value.value !== null ? withWallThickness(baseline.value.document.structure, target.value, value.value) : null);
	const changed = computed(() => value.value !== original.value?.thickness);
	function close(): void { generation++; target.value = null; baseline.value = null; loading.value = false; state.preview.value = null; if (!busy.value) state.active.value = false; }
	watch([() => session.perspective, () => selection.selectedIds.join(), () => editor.activeToolId], () => { if (target.value) close(); }, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; close(); });
	function current(ticket: number): boolean { return alive && ticket === generation; }
	function mayBegin(id: string): boolean { return alive && !state.unavailable() && selection.selectedIds.length === 1 && selection.selectedIds[0] === id && editor.activeToolId === 'select'; }
	async function begin(id: string, kind: 'entry' | 'adjust' = 'entry'): Promise<void> {
		const services = context.commands.structure;
		if (!services || !mayBegin(id)) return;
		const ticket = ++generation;
		workspace.closeOverlay();
		target.value = id; mode.value = kind; state.active.value = true; loading.value = true; error.value = null; failed.value = false; stepped.value = null;
		try {
			const read = await services.read(context.planId as PlanId);
			if (!current(ticket) || state.blocked.value) { if (ticket === generation) close(); return; }
			const prepared = state.prepareBaseline(read);
			if (!prepared.snapshot?.document.structure?.walls.some(wall => wall.id === id)) { close(); await prepared.recovery; return; }
			baseline.value = prepared.snapshot; text.value = formatMetres(original.value?.thickness ?? 0);
		} catch (cause) { if (current(ticket)) { notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed'); close(); } }
		finally { if (ticket === generation) loading.value = false; }
	}
	function update(next: string): void {
		if (!alive || !target.value || paused.value) return;
		stepped.value = null; text.value = next; error.value = null; state.preview.value = proposal.value;
	}
	function increment(direction: -1 | 1): void {
		if (!alive || !target.value || paused.value || value.value === null) return;
		stepped.value = Math.max(MIN_WALL_THICKNESS, Math.min(MAX_WALL_THICKNESS, value.value + direction * WALL_THICKNESS_STEP));
		text.value = formatMetres(stepped.value); error.value = null; state.preview.value = proposal.value;
	}
	async function apply(): Promise<void> {
		const services = context.commands.structure, snapshot = baseline.value, next = proposal.value;
		if (!alive || !target.value || paused.value || !changed.value || !services || !snapshot || !next) return;
		const ticket = generation; busy.value = true;
		try {
			const result = await state.reviewedWrite(services, snapshot).dispatch(next, () => alive && ticket === generation && session.perspective === 'plan');
			if (!alive || ticket !== generation) return;
			if (result.ok) close();
			else { error.value = result.error; failed.value = WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code)) || result.error.code === 'undo.superseded'; notifyOperationFailure(result.error); }
		} catch (cause) { if (alive && ticket === generation) { error.value = persistenceError('spatial.write-failed', 'The spatial edit failed.', cause); notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed'); } }
		finally { busy.value = false; if (!target.value) state.active.value = false; }
	}
	return { target, mode, text, value, original, paused, loading, busy, error, proposal, changed, begin, update, increment, apply, close };
}
