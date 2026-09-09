import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Structure } from '../../../domain/spatial/Structure';
import { openingOffsetAt } from '../../../domain/spatial/openingGeometry';
import { openingValidationError, validSpatialPoint } from '../../../domain/spatial/structureGeometry';
import type { PlanGeometryDocument, PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useDialogStore } from '../../dialogs/dialog-store';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { spatialMessage } from './spatialMessage';
import { OpeningMoveTool } from './OpeningMoveTool';

/** Temporary direct manipulation over the existing guarded StructureCommand boundary. */
export function createOpeningMove(context: PlanEditorContext,
	runtime: Pick<EditorRuntime, 'toolManager' | 'activeToolId' | 'setTool' | 'returnToSelect' | 'dispatcher' | 'writesBlocked' | 'refreshProjection'>,
	ledger: WriteLedger, state: { active: Ref<boolean>; preview: Ref<Structure | null> }) {
	const project = useProjectStore(), selection = useSelectionStore(), workspace = useWorkspaceStore();
	const save = useSaveStateStore(), session = useRenovationSession(), dialogs = useDialogStore();
	const loading = ref(false), saving = ref(false), message = ref(''), hostId = ref<string | null>(null);
	const baseline = shallowRef<PlanGeometrySnapshot | null>(null);
	let target = '', generation = 0, alive = true;
	let armed: PlanGeometryDocument | null = null;
	let pending: { point: Point; write: boolean } | null = null;
	const permitted = computed(() => !runtime.writesBlocked.value && session.perspective !== 'review' && workspace.layerVisibility.architecture && !dialogs.current);
	const available = computed(() => !!context.commands.structure && permitted.value && !state.active.value && save.state !== 'saving' && runtime.activeToolId.value === 'select' && !runtime.toolManager.gestureInFlight);
	function clear(): void { pending = null; state.preview.value = null; message.value = ''; }
	function stop(): void { generation++; clear(); baseline.value = null; armed = null; loading.value = false; hostId.value = null; target = ''; state.active.value = false; }
	function selected(): boolean { return selection.selectedIds.length === 1 && selection.selectedIds[0] === target; }
	function matches(snapshot: PlanGeometrySnapshot): boolean {
		return sameGeometryDocument({ ...snapshot.document, structure: project.structure, calibration: project.plan?.calibration ?? null }, snapshot.document);
	}
	function current(ticket: number): boolean { return alive && generation === ticket && selected() && permitted.value; }
	async function commit(next: Structure, snapshot: PlanGeometrySnapshot): Promise<void> {
		const services = context.commands.structure, ticket = generation;
		if (!services || !current(ticket) || !matches(snapshot) || saving.value) return;
		saving.value = true;
		try {
			const result = await runtime.dispatcher.run(services.command({ planId: context.planId as PlanId, baseline: snapshot, structure: next, ledger }));
			if (!alive || ticket !== generation) return;
			if (!result.ok) notifyOperationFailure(result.error);
			saving.value = false; runtime.returnToSelect();
		} catch (cause) {
			if (alive && ticket === generation) { notifyFault(cause, context.commands.logger, 'editor.structure.write-failed'); saving.value = false; runtime.returnToSelect(); }
		}
		finally { if (ticket === generation) saving.value = false; }
	}
	function proposal(point: Point): Structure | null {
		const structure = baseline.value?.document.structure;
		const opening = structure?.openings.find(item => item.id === target), host = structure?.walls.find(item => item.id === hostId.value);
		if (!structure || !opening || !host) return null;
		const offset = openingOffsetAt(host, point, opening.width);
		if (offset === null) return null;
		const moved = { ...opening, offset };
		const next = { ...structure, openings: structure.openings.map(item => item.id === target ? moved : item) };
		const error = openingValidationError(moved, next);
		message.value = error ? spatialMessage(error) : '';
		return error ? null : next;
	}
	function move(point: Point, write: boolean): void {
		if (!current(generation) || saving.value || save.state === 'saving' || !validSpatialPoint(point)) return;
		// Keep the latest hover until the first click; later input must not replace that click.
		if (loading.value) { if (!pending?.write) pending = { point: { ...point }, write }; return; }
		const snapshot = baseline.value;
		if (!snapshot || !matches(snapshot)) { runtime.returnToSelect(); return; }
		const next = proposal(point); state.preview.value = next;
		if (!write || !next) return;
		if (sameGeometryDocument({ ...snapshot.document, structure: next }, snapshot.document)) { runtime.returnToSelect(); return; }
		void commit(next, snapshot);
	}
	async function read(ticket: number): Promise<void> {
		try {
			const result = await context.commands.structure?.read(context.planId as PlanId);
			if (!current(ticket)) return;
			if (!result?.ok) { if (result) notifyOperationFailure(result.error); runtime.returnToSelect(); return; }
			if (!matches(result.value) || !armed || !sameGeometryDocument(armed, { objects: [], structure: result.value.document.structure, calibration: result.value.document.calibration })) { notifyOperationFailure(staleWriteRefusal()); runtime.returnToSelect(); await runtime.refreshProjection(); return; }
			baseline.value = result.value; loading.value = false;
			const input = pending; pending = null;
			if (input) move(input.point, input.write);
		} catch (cause) { if (current(ticket)) { notifyFault(cause, context.commands.logger, 'editor.structure.read-failed'); runtime.returnToSelect(); } }
		finally { if (ticket === generation) loading.value = false; }
	}
	function start(id: string): boolean {
		const opening = project.structure.openings.find(item => item.id === id);
		if (!alive || !available.value || runtime.toolManager.gestureInFlight || !opening || selection.selectedIds.length !== 1 || selection.selectedIds[0] !== id) return false;
		armed = { objects: [], structure: project.structure, calibration: project.plan?.calibration ?? null };
		target = id; hostId.value = opening.hostId; state.active.value = true; loading.value = true;
		runtime.setTool('move-opening');
		if (runtime.activeToolId.value !== 'move-opening') { stop(); return false; }
		void read(++generation); return true;
	}
	runtime.toolManager.register(new OpeningMoveTool({ move, stop, clear, saving: () => saving.value }));
	watch(() => [selection.selectedIds.join('|'), permitted.value, project.structure, project.plan?.calibration], () => {
		if (target && !saving.value && (!selected() || !permitted.value || (armed && !sameGeometryDocument(armed, { objects: [], structure: project.structure, calibration: project.plan?.calibration ?? null })))) runtime.returnToSelect();
	}, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; stop(); });
	return { start, available, loading, saving, message, hostId };
}
