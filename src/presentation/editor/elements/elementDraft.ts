import { emptyObjectRectangle, type ObjectRectangleText } from './objectRectangleInput';
import { reactive } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { AppError } from '../../../core/errors/AppError';
import type { SpatialElement, SpatialElementKind, NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { outlineKind, validSpatialElement } from '../../../domain/spatial/SpatialElement';
import { areaOutline } from '../add/areaOutline';
import type { ToolId } from '../tools/editor-tool';
import { DEFAULT_STAIR, type StairOptions } from '../../../domain/spatial/stairGeometry';
import { DEFAULT_BEAM_WIDTH, DEFAULT_POST_SECTION } from '../../../domain/spatial/structuralElement';

export type ElementToolId = 'place-object' | 'draw-path' | 'draw-fence' | 'measure' | 'place-stair' | 'draw-arrow' | 'place-post' | 'draw-beam';
/** No tool here produces `'asset'` yet — placement lands through its own flow (plan editor asset placement design §2). */
/** The kinds this draft flow can hold. Not `'asset'` (its own flow, above) and not a drafting mark — those seven kinds get their own tools and draft handling (plan drafting tools design), not yet wired into this file. */
type DraftableKind = Exclude<SpatialElementKind, 'asset' | 'dimension' | 'section' | 'view' | 'hatch' | 'text' | 'boundary' | 'grid'>;
export const ELEMENT_TOOLS: Readonly<Record<ElementToolId, DraftableKind>> = {
	'place-object': 'object', 'draw-path': 'path', 'draw-fence': 'fence', measure: 'measurement',
	'place-stair': 'stair', 'draw-arrow': 'arrow', 'place-post': 'post', 'draw-beam': 'beam',
};
export function isElementTool(id: ToolId | null): id is ElementToolId { return id !== null && id in ELEMENT_TOOLS; }
export interface ElementDraft {
	kind: DraftableKind; name: string; points: Point[]; cursor: Point | null;
	text: { x: string; y: string };
	rectangle: ObjectRectangleText;
	stair: StairOptions;
	/** The section the next post is placed with, world mm. */
	post: { width: number; depth: number };
	/** The width the next beam is saved with, world mm. */
	beamWidth: number;
	pendingInput: boolean;
	loading: boolean; busy: boolean; conflict: boolean; error: AppError | null;
}
export function createElementDraft(): ElementDraft {
	return reactive({ kind: 'object', name: '', points: [], cursor: null, text: { x: '', y: '' }, rectangle: emptyObjectRectangle(), stair: { ...DEFAULT_STAIR },
		post: { ...DEFAULT_POST_SECTION }, beamWidth: DEFAULT_BEAM_WIDTH, pendingInput: false, loading: false, busy: false, conflict: false, error: null });
}
export function discardElementGeometry(draft: ElementDraft): void {
	const { kind, name, loading, busy, conflict } = draft, error = conflict ? draft.error : null;
	Object.assign(draft, createElementDraft(), { kind, name, loading, busy, conflict, error });
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
export function draftElement(draft: ElementDraft, id = 'element-draft'): NamedSpatialElement | null {
	const element = { id, kind: draft.kind, name: draft.name.trim(), points: draft.points.map(point => ({ ...point })), ...(draft.kind === 'stair' ? { stair: { ...draft.stair } } : {}), ...structuralFields(draft) };
	return element.name && acceptsElementPoints(element, element.points) ? element : null;
}
