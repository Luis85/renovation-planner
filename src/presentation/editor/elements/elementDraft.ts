import { reactive } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { AppError } from '../../../core/errors/AppError';
import type { SpatialElementKind, NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { validSpatialElement } from '../../../domain/spatial/SpatialElement';
import { areaOutline } from '../add/areaOutline';
import type { ToolId } from '../tools/editor-tool';

export type ElementToolId = 'place-object' | 'draw-path' | 'draw-fence' | 'measure';
export const ELEMENT_TOOLS: Readonly<Record<ElementToolId, SpatialElementKind>> = {
	'place-object': 'object', 'draw-path': 'path', 'draw-fence': 'fence', measure: 'measurement',
};
export function isElementTool(id: ToolId | null): id is ElementToolId { return id !== null && id in ELEMENT_TOOLS; }
export interface ElementDraft {
	kind: SpatialElementKind; name: string; points: Point[]; cursor: Point | null;
	text: { x: string; y: string };
	pendingInput: boolean;
	loading: boolean; busy: boolean; conflict: boolean; error: AppError | null;
}
export function createElementDraft(): ElementDraft {
	return reactive({ kind: 'object', name: '', points: [], cursor: null, text: { x: '', y: '' }, pendingInput: false, loading: false, busy: false, conflict: false, error: null });
}
export function discardElementGeometry(draft: ElementDraft): void {
	const { kind, name, loading, busy, conflict } = draft, error = conflict ? draft.error : null;
	Object.assign(draft, createElementDraft(), { kind, name, loading, busy, conflict, error });
}
export function draftElement(draft: ElementDraft, id = 'element-draft'): NamedSpatialElement | null {
	const element = { id, kind: draft.kind, name: draft.name.trim(), points: draft.points.map(point => ({ ...point })) };
	if (!element.name || !validSpatialElement(element)) return null;
	return draft.kind === 'object' && !areaOutline(element.points).ok ? null : element;
}
