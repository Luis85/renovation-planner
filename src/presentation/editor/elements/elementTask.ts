import { computed } from 'vue';
import { createElementBaseline } from './elementBaseline';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import type { RenovationBaseline, RenovationServices } from '../../../application/commands/renovation/RenovationCommand';
import type { Point } from '../../../core/geometry/Point';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import { spatialError } from '../../../domain/spatial/structureGeometry';
import { createEntityId } from '../../../core/identity/generateId';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { notifyFault } from '../../notices/notify';
import { roomSnapCandidates } from '../snapping/roomSnapCandidates';
import { recordDraftFailure } from '../tools/with-stale-gate';
import { ElementTool } from './ElementTool';
import { createElementDraft, draftElement, ELEMENT_TOOLS, type ElementToolId } from './elementDraft';
import { elementInput } from './elementInput';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';

export function createElementTask(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'toolManager' | 'returnToSelect' | 'dispatcher' | 'writesBlocked' | 'refreshProjection'> & { ledger: WriteLedger }) {
	const project = useProjectStore(), selection = useSelectionStore(), save = useSaveStateStore();
	const draft = createElementDraft(), reads = createElementBaseline(context, runtime, draft);
	const { baseline, needsRead, retry } = reads;
	let draftId = '';
	let attempt: { content: string; command: ReturnType<RenovationServices['command']> } | null = null;
	const blocked = computed(() => draft.busy || draft.loading || draft.conflict || runtime.writesBlocked.value || save.state === 'saving');
	const canFinish = computed(() => !blocked.value && baseline.value !== null && !draft.text.x && !draft.text.y && !draft.pendingInput && draftElement(draft) !== null);
	const candidates = computed(() => roomSnapCandidates(project.zones.values(), project.structure));
	function stop(): void { reads.stop(); draftId = ''; attempt = null; }
	function start(id: ElementToolId): void { draftId = ''; attempt = null; reads.start(id); }

	function commandFor(element: NamedSpatialElement, read: RenovationBaseline, services: RenovationServices) {
		const content = JSON.stringify(element);
		if (attempt?.content !== content) attempt = { content, command: services.command(read, elementInput(read, element), runtime.ledger) };
		return attempt.command;
	}
	function setPoints(points: readonly Point[]): boolean {
		if (blocked.value) return false;
		draft.points = points.map(point => ({ ...point })); draft.error = null; return true;
	}
	function addPoint(point: Point): boolean {
		if (blocked.value || draft.pendingInput || ((draft.kind === 'measurement' || draft.kind === 'stair') && draft.points.length === 2)) return false;
		const previous = draft.points[draft.points.length - 1];
		if (previous && previous.x === point.x && previous.y === point.y) return false;
		const added = setPoints([...draft.points, point]);
		if (added) draft.text = { x: '', y: '' };
		return added;
	}
	function undoPoint(): void { if (!blocked.value && !draft.pendingInput && !draft.text.x && !draft.text.y) setPoints(draft.points.slice(0, -1)); }
	async function finish(): Promise<void> {
		if (blocked.value || !baseline.value || !context.commands.renovation) return;
		if (draft.text.x || draft.text.y || draft.pendingInput) { draft.error = spatialError('numeric'); return; }
		const element = draftElement(draft, draftId ||= createEntityId('element'));
		if (!element) { draft.error = spatialError('element-invalid'); return; }
		const read = baseline.value, ticket = reads.ticket(); draft.busy = true;
		try {
			const result = await runtime.dispatcher.run(commandFor(element, read, context.commands.renovation));
			if (!reads.current(ticket)) return;
			if (!result.ok) {
				await recordDraftFailure(draft, result.error, () => runtime.refreshProjection()); return;
			}
			selection.select([element.id as ReturnType<typeof createEntityId>]); draft.busy = false; runtime.returnToSelect();
		} catch (cause) { if (reads.current(ticket)) notifyFault(cause, context.commands.logger, 'editor.element.write-failed'); }
		finally { if (reads.current(ticket)) draft.busy = false; }
	}
	for (const id of Object.keys(ELEMENT_TOOLS) as ElementToolId[]) runtime.toolManager.register(new ElementTool(id, {
		draft, start, stop, blocked: () => blocked.value || draft.pendingInput || !!draft.text.x || !!draft.text.y, addPoint, finish: () => { void finish(); }, candidates: () => candidates.value,
	}));
	return { draft, blocked, canFinish, needsRead, retry, setPoints, addPoint, undoPoint, finish, available: context.commands.renovation !== undefined };
}
