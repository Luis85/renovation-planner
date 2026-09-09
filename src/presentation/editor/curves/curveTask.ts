import { computed, nextTick, onBeforeUnmount, reactive, shallowRef, watch } from 'vue';
import type { PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { AppError } from '../../../core/errors/AppError';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { notifyFault } from '../../notices/notify';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { CurveTool } from './CurveTool';
import { curveDocument, curveEdges, curveError, curveSource, curveText, typedBulge, withCurve, type CurveTarget } from './curveDraft';

export type CurveTaskRuntime = Pick<EditorRuntime, 'toolManager' | 'activeToolId' | 'setTool' | 'returnToSelect' | 'dispatcher' | 'writesBlocked' | 'refreshProjection'> & { readonly ledger: WriteLedger };
/** One immutable versioned baseline owns an explicit, cancellable curve task. */
export function createCurveTask(context: PlanEditorContext, runtime: CurveTaskRuntime) {
	const project = useProjectStore(), selection = useSelectionStore(), saves = useSaveStateStore(), session = useRenovationSession();
	const target = shallowRef<CurveTarget | null>(null), baseline = shallowRef<PlanGeometrySnapshot | null>(null);
	const state = reactive({ edge: 0, loading: false, busy: false, conflict: false, invalidField: null as 'depth' | 'radius' | null, error: null as AppError | null, text: { depth: '', radius: '' } });
	let alive = true, epoch = 0, source = '';
	function current(id: string): CurveTarget | null {
		const zone = project.zones.get(id);
		if (zone?.zoneType === 'Room') return { id, kind: 'room', name: zone.name, geometry: { points: zone.points, bulges: zone.bulges } };
		const wall = project.structure.walls.find(item => item.id === id);
		return wall ? { id, kind: 'wall', name: '', geometry: { points: [wall.start, wall.end], bulges: [wall.bulge ?? 0, 0] } } : null;
	}
	const available = computed(() => context.commands.groups !== undefined && selection.selectedIds.length === 1 && current(selection.selectedIds[0]) !== null);
	const permitted = computed(() => alive && !runtime.writesBlocked.value && session.perspective !== 'review');
	const blocked = computed(() => !permitted.value || (target.value !== null && !ownsSelection(target.value.id)) || state.loading || state.busy || state.conflict || saves.state === 'saving');
	const edges = computed(() => target.value ? curveEdges(target.value) : []);
	const preview = computed(() => target.value && baseline.value && !state.conflict ? curveDocument(baseline.value.document, target.value) : null);
	const validation = computed(() => target.value && baseline.value ? curveError(baseline.value.document, target.value) : null);
	function stop(): void { epoch++; target.value = null; baseline.value = null; Object.assign(state, { loading: false, busy: false, conflict: false, invalidField: null, error: null }); }
	function cancel(): void {
		if (state.busy || runtime.activeToolId.value !== 'edit-curves') return;
		stop(); const ticket = epoch;
		// ToolManager may be cancelling an outgoing pointer gesture. Let that switch finish first.
		void nextTick(() => { if (alive && ticket === epoch && runtime.activeToolId.value === 'edit-curves') runtime.returnToSelect(); });
	}
	function ownsSelection(id: string): boolean { return permitted.value && runtime.activeToolId.value === 'edit-curves' && selection.selectedIds.length === 1 && selection.selectedIds[0] === id; }
	function choose(index: number): void {
		const edge = edges.value[index]; if (!edge || blocked.value) return;
		state.edge = index; state.text = curveText(edge); state.invalidField = null;
	}
	function set(index: number, bulge: number): void {
		if (blocked.value || !target.value || !Number.isFinite(bulge) || Math.abs(bulge) > 1) return;
		target.value = withCurve(target.value, index, bulge); choose(index); state.error = null;
	}
	function input(field: 'depth' | 'radius', text: string): void {
		if (blocked.value) return;
		const edge = edges.value[state.edge]; if (!edge) return;
		state.text[field] = text;
		const bulge = typedBulge(edge, field, text);
		if (bulge === null) { state.invalidField = field; return; }
		set(state.edge, bulge); state.text[field] = text;
	}
	function accept(snapshot: PlanGeometrySnapshot, displayed: CurveTarget): boolean {
		const geometry = curveSource(snapshot.document, displayed);
		if (!geometry || JSON.stringify(geometry) !== source || JSON.stringify(current(displayed.id)?.geometry) !== source) return false;
		baseline.value = snapshot; target.value = { ...displayed, geometry }; state.loading = false; choose(0);
		return true;
	}
	async function load(displayed: CurveTarget, ticket: number, service: NonNullable<typeof context.commands.groups>): Promise<void> {
		try {
			const result = await service.read(context.planId as PlanId);
			if (!alive || ticket !== epoch) return;
			if (!ownsSelection(displayed.id)) { cancel(); return; }
			if (!result.ok) { state.error = result.error; return; }
			if (!accept(result.value, displayed)) { state.conflict = true; state.error = staleWriteRefusal(); await runtime.refreshProjection(); }
		} catch (cause) { if (alive && ticket === epoch) notifyFault(cause, context.commands.logger, 'editor.curves.read-failed'); }
		finally { if (ticket === epoch) state.loading = false; }
	}
	async function open(id: string): Promise<void> {
		const displayed = current(id), service = context.commands.groups;
		if (!permitted.value || !displayed || !service || state.busy || runtime.activeToolId.value !== 'select' || !available.value || selection.selectedIds[0] !== id) return;
		runtime.setTool('edit-curves'); if (runtime.toolManager.activeToolId !== 'edit-curves') return;
		const ticket = ++epoch; state.loading = true; state.error = null; source = JSON.stringify(displayed.geometry);
		await load(displayed, ticket, service);
	}
	async function finish(): Promise<void> {
		const snapshot = baseline.value, document = preview.value, service = context.commands.groups;
		if (blocked.value || state.invalidField || !snapshot || !document || !service) return;
		if (validation.value) { state.error = validation.value; return; }
		const ticket = epoch; state.busy = true;
		try {
			const result = await runtime.dispatcher.run(service.command({ planId: context.planId as PlanId, baseline: snapshot, document, ledger: runtime.ledger }));
			if (!alive || ticket !== epoch) return;
			if (!result.ok) { state.error = result.error; state.conflict = true; await runtime.refreshProjection(); return; }
			state.busy = false; runtime.returnToSelect();
		} catch (cause) { if (alive && ticket === epoch) notifyFault(cause, context.commands.logger, 'editor.curves.write-failed'); }
		finally { if (ticket === epoch) state.busy = false; }
	}
	watch(() => target.value ? JSON.stringify(current(target.value.id)?.geometry) : null, value => { if (target.value && !state.busy && value !== source) state.conflict = true; }, { flush: 'sync' });
	watch(() => selection.selectedIds.join('|'), () => { if (target.value || state.loading) cancel(); }, { flush: 'sync' });
	// Failed read-back pauses this draft; its typed values survive until retry or explicit exit.
	watch(() => session.perspective, value => { if (value === 'review' && (target.value || state.loading)) cancel(); }, { flush: 'sync' });
	runtime.toolManager.register(new CurveTool({ target: () => target.value, blocked: () => blocked.value, busy: () => state.busy, set, choose, stop, cancel, finish: () => { void finish(); } }));
	onBeforeUnmount(() => { alive = false; stop(); });
	return { target, state, available, blocked, edges, preview, validation, open, choose, set, input, finish, cancel };
}
