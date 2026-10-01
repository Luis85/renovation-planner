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

/**
 * Is the selected part an OPEN graphic — a line rather than a ring?
 *
 * The question two surfaces ask for the same reason: a path has no interior, so `selectionHandles`
 * answers `[]` for one and every control whose subject is a HANDLE has nothing to act on. The
 * selection-mode group drops Edit points and Bend edges on this answer, and the status row drops the
 * Shift hint, whose text promises to keep proportions and snap a rotation — both of them handle
 * behaviours a path cannot offer.
 *
 * **One function because it was briefly two.** AD11 computed it inside `DesignerSelectionModes.vue`,
 * and the identical question was then needed in `AssetDesignerRoot.vue`'s status hint — found by
 * that card's own fix round, in a file it was not allowed to edit. A second copy is a second answer
 * to "can this part be transformed", and the two would disagree the first time only one of them
 * learned about a new open kind.
 *
 * Only a `detail` selection has anything to ask: the footprint and the clearance are `CurvedPolygon`
 * by type and can never be the open case, and the anchor and the facing are not outlines at all.
 */
export function isOpenGraphicSelection(shape: AssetShape | null | undefined, selection: DesignerSelection | null): boolean {
	if (shape === undefined || shape === null || selection === null || selection.kind !== 'detail') return false;
	return shape.details.some((detail) => detail.id === selection.id && detail.kind === 'open');
}
