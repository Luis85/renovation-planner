import { computed, onBeforeUnmount, shallowRef } from 'vue';
import type { AppError } from '../../../core/errors/AppError';
import type { EntityId } from '../../../core/identity/EntityId';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import type { PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import { SessionWriteLedger, undoSuperseded, type WriteLedger } from '../../../application/editor/WriteLedger';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { createZoneHistory } from '../add/createZoneHistory';
import type { PlanId } from '../../../domain/plan/PlanId';
import { spatialError } from '../../../domain/spatial/structureGeometry';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { tr } from '../../i18n/strings';
import { notifyFault } from '../../notices/notify';
import { StructureTool } from './StructureTool';
import { addWallPoint, createStructureDraft, validateDraftStructure, mintStructure, numericWallPoint, type StructureToolId } from './structureDraft';

export function createStructureTask(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'toolManager' | 'activeToolId' | 'returnToSelect' | 'dispatcher' | 'writesBlocked' | 'refreshProjection'>, ledger: WriteLedger = new SessionWriteLedger()) {
	const project = useProjectStore(), selection = useSelectionStore(), save = useSaveStateStore();
	const draft = createStructureDraft(), baseline = shallowRef<PlanGeometrySnapshot | null>(null);
	let alive = true, generation = 0;
	const blocked = computed(() => draft.busy || draft.loading || draft.conflict || runtime.writesBlocked.value || save.state === 'saving');
	function stop(): void { generation++; Object.assign(draft, createStructureDraft()); baseline.value = null; }
	function matchesProjection(snapshot: PlanGeometrySnapshot): boolean {
		return sameGeometryDocument(
			{ objects: [], structure: project.structure, calibration: project.plan?.calibration ?? null },
			{ objects: [], structure: snapshot.document.structure ?? EMPTY_STRUCTURE, calibration: snapshot.document.calibration },
		);
	}
	async function start(kind: StructureToolId): Promise<void> {
		const ticket = ++generation;
		Object.assign(draft, createStructureDraft()); draft.kind = kind; draft.loading = true;
		draft.roomName = tr('editor.room.default-name', { n: String(project.zones.size + 1) });
		if (kind === 'place-window') { draft.text.openingHeight = '1.2'; draft.text.sill = '0.9'; }
		try {
			const read = await context.commands.structure?.read(context.planId as PlanId);
			if (!alive || ticket !== generation) return;
			if (!read?.ok) { draft.error = read ? read.error : spatialError('unavailable'); return; }
			if (!matchesProjection(read.value)) {
				draft.error = undoSuperseded(context.planId as PlanId); draft.conflict = true;
				await runtime.refreshProjection(); return;
			}
			baseline.value = read.value;
			draft.text.hostId = read.value.document.structure?.walls[0]?.id ?? '';
		} catch (cause) { if (alive && ticket === generation) notifyFault(cause, context.commands.logger, 'editor.structure.read-failed'); }
		finally { if (ticket === generation) draft.loading = false; }
	}
	function addNumeric(): boolean {
		if (blocked.value) return false;
		const point = numericWallPoint(draft);
		if (!point) { draft.error = spatialError('numeric'); return false; }
		const added = addWallPoint(draft, point, project.structure);
		if (added) draft.text.length = '';
		return added;
	}
	function undoPoint(): void { if (!blocked.value) { draft.points.pop(); draft.room = false; draft.error = null; } }
	function closeLoop(): void { if (!blocked.value && draft.points.length >= 3) addWallPoint(draft, draft.points[0], project.structure); }
	function roomCommand() {
		const points = draft.points.slice(0, -1);
		const command = createZoneHistory(context, ledger, { planId: context.planId as PlanId, name: draft.roomName, zoneType: 'Room', geometry: { points } });
		return { execute: () => command.execute(), undo: () => command.undo(), get createdZoneId() { return command.createdZoneId; }, points };
	}
	async function failed(error: AppError): Promise<void> {
		draft.error = error;
		draft.conflict = WRITE_BOUNDARY_CODES.some(code => error.code.endsWith(code)) || error.code === 'undo.superseded';
		if (draft.conflict) await runtime.refreshProjection();
	}
	async function finish(): Promise<void> {
		if (blocked.value || !baseline.value || !context.commands.structure) return;
		const valid = validateDraftStructure(draft, project.structure, baseline.value.document.objects.map(object => object.id));
		if (!valid.ok) { draft.error = valid.error; return; }
		const structure = mintStructure(valid.value), ticket = generation;
		const command = context.commands.structure.command({ planId: context.planId as PlanId, baseline: baseline.value, structure, ledger, ...(draft.room ? { room: roomCommand() } : {}) });
		draft.busy = true;
		try {
			const result = await runtime.dispatcher.run(command);
			if (!alive || ticket !== generation) return;
			if (!result.ok) { await failed(result.error); return; }
			const id = draft.kind === 'draw-wall' ? structure.walls[structure.walls.length - 1].id : structure.openings[structure.openings.length - 1].id;
			selection.select([id as EntityId<string>]); draft.busy = false; runtime.returnToSelect();
		} catch (cause) { if (alive && ticket === generation) notifyFault(cause, context.commands.logger, 'editor.structure.write-failed'); }
		finally { if (ticket === generation) draft.busy = false; }
	}
	for (const kind of ['draw-wall', 'place-door', 'place-window', 'place-opening'] as const) runtime.toolManager.register(new StructureTool(kind, {
		draft, structure: () => project.structure, start: id => { void start(id); }, stop, finish: () => { void finish(); }, blocked: () => blocked.value,
	}));
	onBeforeUnmount(() => { alive = false; stop(); });
	return { draft, blocked, ledger, finish, addNumeric, undoPoint, closeLoop, available: context.commands.structure !== undefined };
}
