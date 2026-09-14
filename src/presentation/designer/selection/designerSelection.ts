import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf, type OutlinePart } from '../../../domain/asset/shapeEdits';

/** What the designer can select, one at a time (symbols spec, Decision 10): an outline, the anchor, or the facing. */
export type DesignerSelection = OutlinePart | { readonly kind: 'anchor' } | { readonly kind: 'facing' };

/** How a selected outline is handled: its box, its vertices, or its edges' bulges. */
export type SelectionMode = 'transform' | 'points' | 'bend';

export function isOutlineSelection(selection: DesignerSelection | null): selection is OutlinePart {
	return selection !== null && selection.kind !== 'anchor' && selection.kind !== 'facing';
}

/** 'footprint' | 'clearance' | 'detail:<id>' | 'anchor' | 'facing' — the exclusion key snap candidates take. */
export function partKey(selection: DesignerSelection): string {
	return selection.kind === 'detail' ? `detail:${selection.id}` : selection.kind;
}

/** The same PART, compared by key: two detail selections are the same when their ids are. */
export function sameSelection(a: DesignerSelection | null, b: DesignerSelection | null): boolean {
	return a === null || b === null ? a === b : partKey(a) === partKey(b);
}

/** Does the part still exist on this shape? A null shape has no parts. */
export function selectionExists(shape: AssetShape | null, selection: DesignerSelection): boolean {
	if (shape === null) return false;
	return isOutlineSelection(selection) ? outlineOf(shape, selection) !== null : true;
}
