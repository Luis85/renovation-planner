import { computed, type ComputedRef } from 'vue';
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
import { createElementDraft, draftElement, pointsAfterUndo, ELEMENT_TOOLS, maxDraftPoints, type ElementDraft, type ElementToolId } from './elementDraft';
import { elementInput } from './elementInput';
import { boundingRectangle, type ObjectShapeMode } from './objectShape';
import type { NamedSpatialElement, SpatialElementKind } from '../../../domain/spatial/SpatialElement';
import { dimensionOffsetAt } from '../../../domain/spatial/dimensionChain';

/**
 * Rectangle drag or free-form corners for an item (2026-09-13 item modes spec §A). The outline carries across:
 * free-form keeps the corners as editable points, rectangle takes their bounding box — or nothing, when that
 * box has no area. Outside `createElementTask` only for that function's 100-line budget.
 */
function itemShape(draft: ElementDraft, blocked: ComputedRef<boolean>) {
	/** Pending typed input belongs to the mode it was typed in, so it has to be applied or discarded before the mode changes. */
	const shapeLocked = computed(() => blocked.value || draft.pendingInput || !!draft.text.x || !!draft.text.y);
	function setShape(shape: ObjectShapeMode): boolean {
		if (shapeLocked.value || draft.shape === shape) return false;
		draft.shape = shape;
		if (shape === 'rectangle') draft.points = boundingRectangle(draft.points) ?? [];
		return true;
	}
	return { shapeLocked, setShape };
}
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
	/** A beam, a section line and a view marker are exactly their two points, so the second one saves them. */
	function finishIfComplete(): void {
		if (['beam', 'section', 'view'].includes(draft.kind) && draft.points.length === 2) void finish();
	}
	function addPoint(point: Point): boolean {
		if (draft.kind === 'post') return placePost(point);
		if (draft.kind === 'dimension' && draft.dimensionPhase === 'offset') return placeDimensionLine(point);
		if (blocked.value || draft.pendingInput) return false;
		if (draft.kind === 'text' || draft.kind === 'grid') return placeSinglePoint(point);
		const limit = maxDraftPoints(draft.kind);
		if (limit !== null && draft.points.length >= limit) return false;
		const previous = draft.points[draft.points.length - 1];
		if (previous && previous.x === point.x && previous.y === point.y) return false;
		const added = setPoints([...draft.points, point]);
		if (added) { draft.text = { x: '', y: '' }; finishIfComplete(); }
		return added;
	}
	/** One click is one whole post: its section centred on the point, saved at once. */
	function placePost(point: Point): boolean {
		if (blocked.value || draft.pendingInput || !setPoints(postOutline(point, draft.post.width, draft.post.depth))) return false;
		draft.text = { x: '', y: '' };
		void finish();
		return true;
	}
	/** A text or grid point is one point: a click places it, a further click moves it, and a grid point saves at once. */
	function placeSinglePoint(point: Point): boolean {
		if (!setPoints([point])) return false;
		draft.text = { x: '', y: '' };
		if (draft.kind === 'grid') void finish();
		return true;
	}
	/** A chain's line is placed by one click: its distance from the chain's line, in whole millimetres, is the offset, and the click saves it. */
	function placeDimensionLine(point: Point): boolean {
		if (blocked.value || draft.pendingInput) return false;
		draft.offset = Math.round(dimensionOffsetAt(draft.points, point));
		void finish();
		return true;
	}
	function undoPoint(): void {
		if (blocked.value || draft.pendingInput || draft.text.x || draft.text.y) return;
		// Placing a chain's line is a step of its own; undoing it keeps every point.
		if (draft.kind === 'dimension' && draft.dimensionPhase === 'offset') { draft.dimensionPhase = 'points'; return; }
		setPoints(pointsAfterUndo(draft));
	}
	const { shapeLocked, setShape } = itemShape(draft, blocked);
	/** A chain's first Finish ends its points and starts placing its line; true when that is what this Finish did. */
	function advanceDimension(): boolean {
		if (draft.kind !== 'dimension' || draft.dimensionPhase !== 'points') return false;
		if (draftElement(draft)) draft.dimensionPhase = 'offset'; else draft.error = spatialError('element-invalid');
		return true;
	}
	/**
	 * Posts and grid points are set one after another, so the tool stays on: a post with the section last typed, a grid point with
	 * the next free name. `start` reads a fresh baseline; the dispatcher has already refreshed the projection it is compared against.
	 */
	function stayOn(kind: SpatialElementKind): boolean {
		if (kind !== 'post' && kind !== 'grid') return false;
		const post = { ...draft.post }; start(kind === 'post' ? 'place-post' : 'place-grid'); draft.post = post;
		return true;
	}
	async function finish(): Promise<void> {
		if (blocked.value || !baseline.value || !context.commands.renovation) return;
		if (draft.text.x || draft.text.y || draft.pendingInput) { draft.error = spatialError('numeric'); return; }
		if (advanceDimension()) return;
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
			if (stayOn(element.kind)) return;
			draft.busy = false; runtime.returnToSelect();
		} catch (cause) { if (reads.current(ticket)) notifyFault(cause, context.commands.logger, 'editor.element.write-failed'); }
		finally { if (reads.current(ticket)) draft.busy = false; }
	}
	/** Starts `tool` at `point` from outside its pointer — the canvas context menu — once its baseline is read, unless the tool changed meanwhile. */
	async function startAt(tool: ElementToolId, point: Point): Promise<void> {
		runtime.setTool(tool);
		if (runtime.activeToolId.value !== tool) return;
		const ticket = reads.ticket();
		await reads.ready();
		if (reads.current(ticket)) addPoint(point);
	}
	for (const id of Object.keys(ELEMENT_TOOLS) as ElementToolId[]) runtime.toolManager.register(new ElementTool(id, {
		draft, start, stop, blocked: () => blocked.value || draft.pendingInput || !!draft.text.x || !!draft.text.y, addPoint, setPoints, finish: () => { void finish(); },
	}));
	return { draft, blocked, canFinish, needsRead, retry, setPoints, addPoint, undoPoint, setShape, shapeLocked, finish, startAt, available: context.commands.renovation !== undefined };
}
