import { computed } from 'vue';
import { createElementBaseline } from './elementBaseline';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import type { RenovationBaseline, RenovationServices } from '../../../application/commands/renovation/RenovationCommand';
import type { Point } from '../../../core/geometry/Point';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import { spatialError } from '../../../domain/spatial/structureGeometry';
import { postOutline } from '../../../domain/spatial/structuralElement';
import { createEntityId } from '../../../core/identity/generateId';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { notifyFault } from '../../notices/notify';
import { recordDraftFailure } from '../tools/with-stale-gate';
import { ElementTool } from './ElementTool';
import { createElementDraft, draftElement, pointsAfterUndo, ELEMENT_TOOLS, type ElementToolId } from './elementDraft';
import { elementInput } from './elementInput';
import { boundingRectangle, type ObjectShapeMode } from './objectShape';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';

export function createElementTask(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'toolManager' | 'activeToolId' | 'setTool' | 'returnToSelect' | 'dispatcher' | 'writesBlocked' | 'refreshProjection'> & { ledger: WriteLedger }) {
	const selection = useSelectionStore(), save = useSaveStateStore();
	const draft = createElementDraft(), reads = createElementBaseline(context, runtime, draft);
	const { baseline, needsRead, retry } = reads;
	let draftId = '';
	let attempt: { content: string; command: ReturnType<RenovationServices['command']> } | null = null;
	const blocked = computed(() => draft.busy || draft.loading || draft.conflict || runtime.writesBlocked.value || save.state === 'saving');
	const canFinish = computed(() => !blocked.value && baseline.value !== null && !draft.text.x && !draft.text.y && !draft.pendingInput && draftElement(draft) !== null);
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
		if (draft.kind === 'post') return placePost(point);
		if (blocked.value || draft.pendingInput || ((draft.kind === 'measurement' || draft.kind === 'stair' || draft.kind === 'beam') && draft.points.length === 2)) return false;
		const previous = draft.points[draft.points.length - 1];
		if (previous && previous.x === point.x && previous.y === point.y) return false;
		const added = setPoints([...draft.points, point]);
		if (added) draft.text = { x: '', y: '' };
		// A beam is exactly its two ends, so the second one saves it (structural posts and beams design §5).
		if (added && draft.kind === 'beam' && draft.points.length === 2) void finish();
		return added;
	}
	/** One click is one whole post: its section centred on the point, saved at once. */
	function placePost(point: Point): boolean {
		if (blocked.value || draft.pendingInput || !setPoints(postOutline(point, draft.post.width, draft.post.depth))) return false;
		draft.text = { x: '', y: '' };
		void finish();
		return true;
	}
	function undoPoint(): void { if (!blocked.value && !draft.pendingInput && !draft.text.x && !draft.text.y) setPoints(pointsAfterUndo(draft)); }
	/** Pending typed input belongs to the mode it was typed in, so it has to be applied or discarded before the mode changes. */
	const shapeLocked = computed(() => blocked.value || draft.pendingInput || !!draft.text.x || !!draft.text.y);
	/**
	 * Rectangle drag or free-form corners for an item (2026-09-13 item modes spec §A). The outline carries across:
	 * free-form keeps the corners as editable points, rectangle takes their bounding box — or nothing, when that
	 * box has no area.
	 */
	function setShape(shape: ObjectShapeMode): boolean {
		if (shapeLocked.value || draft.shape === shape) return false;
		draft.shape = shape;
		if (shape === 'rectangle') draft.points = boundingRectangle(draft.points) ?? [];
		return true;
	}
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
			selection.select([element.id as ReturnType<typeof createEntityId>]);
			// The post tool stays on for the next post along a wall, with the section last typed. `start` reads a
			// fresh baseline; the dispatcher has already refreshed the projection it is compared against.
			if (element.kind === 'post') { const post = { ...draft.post }; start('place-post'); draft.post = post; return; }
			draft.busy = false; runtime.returnToSelect();
		} catch (cause) { if (reads.current(ticket)) notifyFault(cause, context.commands.logger, 'editor.element.write-failed'); }
		finally { if (reads.current(ticket)) draft.busy = false; }
	}
	/** Starts a measurement at `point` from outside its pointer — the canvas context menu — once its baseline is read, unless the tool changed meanwhile. */
	async function measureFrom(point: Point): Promise<void> {
		runtime.setTool('measure');
		if (runtime.activeToolId.value !== 'measure') return;
		const ticket = reads.ticket();
		await reads.ready();
		if (reads.current(ticket)) addPoint(point);
	}
	for (const id of Object.keys(ELEMENT_TOOLS) as ElementToolId[]) runtime.toolManager.register(new ElementTool(id, {
		draft, start, stop, blocked: () => blocked.value || draft.pendingInput || !!draft.text.x || !!draft.text.y, addPoint, setPoints, finish: () => { void finish(); },
	}));
	return { draft, blocked, canFinish, needsRead, retry, setPoints, addPoint, undoPoint, setShape, shapeLocked, finish, measureFrom, available: context.commands.renovation !== undefined };
}
