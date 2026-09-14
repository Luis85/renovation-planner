import { emptyObjectRectangle, type ObjectRectangleText } from './objectRectangleInput';
import { reactive } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { AppError } from '../../../core/errors/AppError';
import type { SpatialElement, SpatialElementKind, NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { outlineKind, validSpatialElement } from '../../../domain/spatial/SpatialElement';
import { areaOutline } from '../add/areaOutline';
import type { ToolId } from '../tools/editor-tool';
import { DEFAULT_STAIR, type StairOptions } from '../../../domain/spatial/stairGeometry';
import type { ObjectShapeMode } from './objectShape';
import { DEFAULT_BEAM_WIDTH, DEFAULT_POST_SECTION } from '../../../domain/spatial/structuralElement';
import { dimensionOffsetAt } from '../../../domain/spatial/dimensionChain';

export type ElementToolId = 'place-object' | 'draw-path' | 'draw-fence' | 'measure' | 'place-stair' | 'draw-arrow' | 'place-post' | 'draw-beam'
	| 'draw-dimension' | 'draw-section' | 'place-view' | 'draw-hatch' | 'place-text' | 'draw-boundary' | 'place-grid';
/** No tool here produces `'asset'` yet — placement lands through its own flow (plan editor asset placement design §2). */
export const ELEMENT_TOOLS: Readonly<Record<ElementToolId, Exclude<SpatialElementKind, 'asset'>>> = {
	'place-object': 'object', 'draw-path': 'path', 'draw-fence': 'fence', measure: 'measurement',
	'place-stair': 'stair', 'draw-arrow': 'arrow', 'place-post': 'post', 'draw-beam': 'beam',
	'draw-dimension': 'dimension', 'draw-section': 'section', 'place-view': 'view', 'draw-hatch': 'hatch',
	'place-text': 'text', 'draw-boundary': 'boundary', 'place-grid': 'grid',
};
export function isElementTool(id: ToolId | null): id is ElementToolId { return id !== null && id in ELEMENT_TOOLS; }
/** The kinds drawn as one rectangle drag or corner by corner (2026-09-13 item modes spec §A): an item, and a hatched area, the way a room is drawn. */
export function shapedKind(kind: string): boolean { return kind === 'object' || kind === 'hatch'; }
export function isShapedTool(id: ToolId | null): boolean { return isElementTool(id) && shapedKind(ELEMENT_TOOLS[id]); }
export interface ElementDraft {
	kind: Exclude<SpatialElementKind, 'asset'>; name: string; points: Point[]; cursor: Point | null;
	text: { x: string; y: string };
	rectangle: ObjectRectangleText;
	/** Only an item reads it (2026-09-13 item modes spec §A); every other kind is drawn corner by corner. */
	shape: ObjectShapeMode;
	stair: StairOptions;
	/** The section the next post is placed with, world mm. */
	post: { width: number; depth: number };
	/** The width the next beam is saved with, world mm. */
	beamWidth: number;
	/** The next dimension chain's offset, world mm: set by the click that places its line, or typed. */
	offset: number;
	/** Whether a dimension chain is still taking points or is placing its line (plan drafting tools design §5). */
	dimensionPhase: 'points' | 'offset';
	pendingInput: boolean;
	loading: boolean; busy: boolean; conflict: boolean; error: AppError | null;
}
export function createElementDraft(): ElementDraft {
	return reactive({ kind: 'object', name: '', shape: 'rectangle', points: [], cursor: null, text: { x: '', y: '' }, rectangle: emptyObjectRectangle(), stair: { ...DEFAULT_STAIR },
		post: { ...DEFAULT_POST_SECTION }, beamWidth: DEFAULT_BEAM_WIDTH, offset: 0, dimensionPhase: 'points', pendingInput: false, loading: false, busy: false, conflict: false, error: null });
}
export function discardElementGeometry(draft: ElementDraft): void {
	const { kind, name, shape, loading, busy, conflict } = draft, error = conflict ? draft.error : null;
	Object.assign(draft, createElementDraft(), { kind, name, shape, loading, busy, conflict, error });
}
/** Every proposal of an element's points passes here: a valid element, and an object or post outline that does not cross itself. */
export function acceptsElementPoints(element: SpatialElement, points: readonly Point[]): boolean {
	return validSpatialElement({ ...element, points }) && (!outlineKind(element.kind) || areaOutline(points).ok);
}
/** A new post or beam starts load-bearing (structural posts and beams design §3); a beam also carries the typed width. */
function structuralFields(draft: ElementDraft): Pick<SpatialElement, 'width' | 'loadBearing'> {
	if (draft.kind === 'beam') return { width: draft.beamWidth, loadBearing: true };
	return draft.kind === 'post' ? { loadBearing: true } : {};
}
/** How many points a kind's draft holds at most: one for a text or grid point, two for the two-point kinds, unbounded otherwise. */
export function maxDraftPoints(kind: ElementDraft['kind']): number | null {
	if (kind === 'text' || kind === 'grid') return 1;
	return ['measurement', 'stair', 'beam', 'view'].includes(kind) ? 2 : null;
}
/**
 * A new dimension chain carries the offset its preview draws — the pointer's, in whole millimetres, while its line is being
 * placed, else the one clicked or typed (typing clears the pointer) — and a new section line looks the default way (design §3).
 */
function draftingFields(draft: ElementDraft): Pick<SpatialElement, 'offset' | 'flipped'> {
	if (draft.kind === 'dimension') return { offset: draft.dimensionPhase === 'offset' && draft.cursor ? Math.round(dimensionOffsetAt(draft.points, draft.cursor)) : draft.offset };
	return draft.kind === 'section' ? { flipped: false } : {};
}
/** The kind-specific facts a preview draws with; a chain's offset is the one `draftElement` saves, so Finish saves what is drawn. */
export function draftPreviewFields(draft: ElementDraft): Pick<SpatialElement, 'stair' | 'width' | 'loadBearing' | 'offset' | 'flipped'> {
	if (draft.kind === 'stair') return { stair: draft.stair };
	if (draft.kind === 'beam') return { width: draft.beamWidth, loadBearing: true };
	return draftingFields(draft);
}
export function draftElement(draft: ElementDraft, id = 'element-draft'): NamedSpatialElement | null {
	const element = { id, kind: draft.kind, name: draft.name.trim(), points: draft.points.map(point => ({ ...point })), ...(draft.kind === 'stair' ? { stair: { ...draft.stair } } : {}), ...structuralFields(draft), ...draftingFields(draft) };
	return element.name && acceptsElementPoints(element, element.points) ? element : null;
}
/**
 * The points left after "undo the last point" — canvas Backspace and `elementTask.undoPoint()`
 * both resolve to this (PR #182 follow-up F-B). An item's rectangle drag names one shape from a
 * single gesture; its four corners are not four placed points, so undoing it drops the whole
 * outline rather than one corner. Every other kind, and a free-form item, still steps back one
 * point — the same rule `ElementTool.editCorner(-1, null)` reaches for `place-object`, so the
 * mode check lives here once rather than in both doors.
 */
export function pointsAfterUndo(draft: ElementDraft): Point[] {
	return shapedKind(draft.kind) && draft.shape === 'rectangle' ? [] : draft.points.slice(0, -1);
}
/**
 * The canvas preview's vertex list (StructureLayer.vue's `elementDraft`): every other draft
 * trails the cursor as the next corner to place, but a rectangle-mode item's cursor already IS
 * one of the four corners `ElementTool` writes into `draft.points` on every move — appending it
 * again drew an extra vertex, a diagonal from a corner to the pointer instead of the closed
 * rectangle (vault defect, caught by no gate). Same mode check as `pointsAfterUndo` above.
 */
export function elementPreviewPoints(draft: ElementDraft): readonly Point[] {
	if (shapedKind(draft.kind) && draft.shape === 'rectangle') return draft.points;
	// No cursor once the kind holds all its points, nor while a dimension chain's line is being placed (plan drafting tools design §5).
	const full = draft.points.length >= (maxDraftPoints(draft.kind) ?? Number.POSITIVE_INFINITY) || (draft.kind === 'dimension' && draft.dimensionPhase === 'offset');
	return draft.cursor && !full ? [...draft.points, draft.cursor] : draft.points;
}
