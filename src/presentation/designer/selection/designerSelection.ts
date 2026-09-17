import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { OutlinePart } from '../../../domain/asset/shapeEdits';

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

/**
 * Does the part still exist on this shape? A null shape has no parts.
 *
 * **Asked of the shape's own parts rather than through `outlineOf`**, which is what this used to
 * do and is a different question. That function answers `null` for an OPEN graphic on purpose, so
 * no closed-only edit can reach one (AD04) — but the only caller here is `AssetDesignStore.hydrate`
 * pruning a selection after a read, and routing it through an edit's guard dropped a part that is
 * on the shape, drawn on the canvas and listed in the Parts panel. The selection emptied itself on
 * the next write with nothing anywhere saying why.
 */
export function selectionExists(shape: AssetShape | null, selection: DesignerSelection): boolean {
	if (shape === null) return false;
	if (selection.kind === 'detail') return shape.details.some((detail) => detail.id === selection.id);
	// The footprint, the anchor and the facing are required members of every shape; only the
	// clearance is optional, so it is the one kind with a question to ask.
	return selection.kind !== 'clearance' || shape.clearance !== null;
}
