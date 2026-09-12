import { computed, onBeforeUnmount, shallowRef } from 'vue';
import type { EntityId } from '../../../core/identity/EntityId';
import { recordDraftFailure } from '../tools/with-stale-gate';
import type { PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import { undoSuperseded, type WriteLedger } from '../../../application/editor/WriteLedger';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import type { Point } from '../../../core/geometry/Point';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { roomInsideWalls } from '../../../domain/spatial/encloseRoom';
import { ok } from '../../../core/result/Result';
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
import { resolveWallJoin } from '../../../domain/spatial/wallJoin';
import { addWallPoint, createStructureDraft, endOnWall, validateDraftStructure, mintStructure, numericWallPoint, pickHost, startFromWall, type StructureToolId } from './structureDraft';

/**
 * `ledger` is the EDITOR's ledger, the one `buildRuntime` hands every other adapter — never a
 * private one: the optional Room's create command records the Room's versions in it, and a
 * rename, resize or nudge of that Room records in the editor's, so a private ledger answered
 * the loop's undo with the Room's ORIGINAL version and the delete was refused (a Codex P2 on
 * pull request #86).
 */
export function createStructureTask(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'toolManager' | 'activeToolId' | 'setTool' | 'returnToSelect' | 'dispatcher' | 'writesBlocked' | 'refreshProjection'> & { readonly ledger: WriteLedger }) {
	const project = useProjectStore(), selection = useSelectionStore(), save = useSaveStateStore();
	const draft = createStructureDraft(), ledger = runtime.ledger, baseline = shallowRef<PlanGeometrySnapshot | null>(null);
	let alive = true, generation = 0, started: Promise<void> = Promise.resolve();
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
		if (kind === 'place-window') { draft.text.openingHeight = '1.2'; draft.text.sill = '0.9'; draft.swing.angle = '0'; }
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
	/** A typed point that lies on a wall body — within one millimetre, since typed geometry is whole-millimetre — joins it exactly as a click there. */
	function addNumeric(): boolean {
		if (blocked.value) return false;
		const point = numericWallPoint(draft);
		if (!point) { draft.error = spatialError('numeric'); return false; }
		const structure = project.structure, join = resolveWallJoin({ walls: structure.walls, point, tolerance: 1 });
		const added = !join ? addWallPoint(draft, point, structure)
			: !draft.points.length ? startFromWall(draft, structure, join.wallId, join.point, 1)
			: endOnWall(draft, structure, join);
		if (!added) return false;
		draft.text.length = '';
		if (draft.joins.end) void finish();
		return true;
	}
	function undoPoint(): void {
		if (blocked.value) return;
		draft.points.pop(); draft.room = false; draft.error = null; draft.joins.end = null;
		if (!draft.points.length) draft.joins.start = null;
	}
	function closeLoop(): void { if (!blocked.value && draft.points.length >= 3) addWallPoint(draft, draft.points[0], project.structure); }
	function roomCommand(points: readonly Point[]) {
		const command = createZoneHistory(context, ledger, { planId: context.planId as PlanId, name: draft.roomName, zoneType: 'Room', geometry: { points } });
		return { execute: () => command.execute(), undo: () => command.undo(), get createdZoneId() { return command.createdZoneId; }, points };
	}
	/** The validated draft and its optional Room. The loop is appended after the floor's existing walls; the Room sits on their inner faces. */
	function prepareDraft(objectIds: readonly string[]) {
		const valid = validateDraftStructure(draft, project.structure, objectIds);
		if (!valid.ok) return valid;
		if (!draft.room) return ok({ structure: valid.value, room: null });
		// By draft id rather than by position: a wall started in the middle of a wall adds that wall's cut half too.
		const inside = roomInsideWalls(valid.value.walls.filter(wall => wall.id.startsWith('wall-draft-')));
		return inside.ok ? ok({ structure: valid.value, room: roomCommand(inside.value.points) }) : inside;
	}
	async function finish(): Promise<void> {
		if (blocked.value || !baseline.value || !context.commands.structure) return;
		// The SIDECAR's object ids, which is what `StructureCommand.write` validates against —
		// not `project.zones`, which holds only the notes this build could read: a Room whose
		// note refused still has its polygon and its boundary in the sidecar, and validating
		// against the readable notes reported `spatial.room-missing` for a boundary the
		// repository accepts, blocking every unrelated wall (a Codex P2 on pull request #86).
		const prepared = prepareDraft(baseline.value.document.objects.map(object => object.id));
		if (!prepared.ok) { draft.error = prepared.error; return; }
		const structure = mintStructure(prepared.value.structure), ticket = generation, room = prepared.value.room;
		const command = context.commands.structure.command({ planId: context.planId as PlanId, baseline: baseline.value, structure, ledger, ...(room ? { room } : {}) });
		draft.busy = true;
		try {
			const result = await runtime.dispatcher.run(command);
			if (!alive || ticket !== generation) return;
			if (!result.ok) { await recordDraftFailure(draft, result.error, () => runtime.refreshProjection()); return; }
			const id = draft.kind === 'draw-wall' ? structure.walls[structure.walls.length - 1].id : structure.openings[structure.openings.length - 1].id;
			selection.select([id as EntityId<string>]); draft.busy = false; runtime.returnToSelect();
		} catch (cause) { if (alive && ticket === generation) notifyFault(cause, context.commands.logger, 'editor.structure.write-failed'); }
		finally { if (ticket === generation) draft.busy = false; }
	}
	/** Starts `kind` from outside its pointer — the canvas context menu — and runs `then` once its baseline is read, unless the tool changed meanwhile. */
	async function startWith(kind: StructureToolId, then: () => void): Promise<void> {
		runtime.setTool(kind);
		if (runtime.activeToolId.value !== kind) return;
		const ticket = generation;
		await started;
		if (ticket === generation) then();
	}
	/** An opening centred on `point` on that wall, saved at once as a click with its tool would. */
	const placeAt = (kind: Exclude<StructureToolId, 'draw-wall'>, wallId: string, point: Point) => startWith(kind, () => {
		pickHost(draft, point, project.structure.walls.filter(wall => wall.id === wallId), Infinity);
		if (draft.snapped) void finish();
	});
	/** A wall chain starting on that wall at `point`, cutting it there when the chain is saved. */
	const drawFrom = (wallId: string, point: Point, tolerance: number) => startWith('draw-wall', () => { startFromWall(draft, project.structure, wallId, point, tolerance); });
	for (const kind of ['draw-wall', 'place-door', 'place-window', 'place-opening'] as const) runtime.toolManager.register(new StructureTool(kind, {
		draft, structure: () => project.structure, start: id => { started = start(id); }, stop, finish: () => { void finish(); }, blocked: () => blocked.value,
	}));
	onBeforeUnmount(() => { alive = false; stop(); });
	return { draft, blocked, ledger, finish, addNumeric, undoPoint, closeLoop, placeAt, drawFrom, available: context.commands.structure !== undefined };
}
