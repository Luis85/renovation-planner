import { contains, distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import { outlineKind } from '../../../domain/spatial/SpatialElement';
import type { SpatialObjectCandidate } from '../tools/select-tool';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { rotationControlContains } from '../elements/rotationControl';
import { hasPointHandles } from '../elements/ElementMove';
import { arcProjection } from '../../../core/geometry/circularArc';
import type { LabelHit } from '../labels/labelLayout';
import type { OpeningGrip, OpeningHandle } from '../structure/openingHandles';

export type SelectionTarget =
	| { readonly kind: 'handle'; readonly id: string; readonly vertexIndex: number }
	| { readonly kind: 'rotation'; readonly id: string }
	| { readonly kind: 'resize'; readonly id: string; readonly handleIndex: number }
	| { readonly kind: 'opening-handle'; readonly id: string; readonly grip: OpeningGrip }
	| { readonly kind: 'label'; readonly id: string }
	| { readonly kind: 'body'; readonly id: string }
	| null;

/** A hatch is drawn under walls and every other mark over its area (plan drafting tools design §6), so it ranks just above a room or area. */
function priority(candidate: SpatialObjectCandidate): number {
	if (candidate.kind === 'hatch') return 0.5;
	if (outlineKind(candidate.kind) || candidate.kind === 'stair' || candidate.kind === 'asset') return 4;
	if (candidate.kind === 'opening') return 3;
	if (candidate.kind === 'wall') return 2;
	if (candidate.kind) return 1;
	return 0;
}

function nearLine(candidate: SpatialObjectCandidate, point: Point, tolerance: number): boolean {
	return candidate.points.slice(1).some((b, index) => {
		if (candidate.bulges?.[index]) return arcProjection({ start: candidate.points[index], end: b, bulge: candidate.bulges[index] }, point).distance <= Math.max(tolerance, (candidate.width ?? 0) / 2);
		const a = candidate.points[index], dx = b.x - a.x, dy = b.y - a.y, squared = dx * dx + dy * dy;
		const ratio = squared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared));
		return Math.hypot(point.x - a.x - ratio * dx, point.y - a.y - ratio * dy) <= Math.max(tolerance, (candidate.width ?? 0) / 2);
	});
}

function containsCandidate(candidate: SpatialObjectCandidate, point: Point, tolerance: number): boolean {
	if (candidate.hitRegions) return candidate.hitRegions.some(points => {
		const inside = contains({ points }, point);
		return inside.ok && inside.value || points.length > 0 && nearLine({ ...candidate, points: [...points, points[0]], bulges: undefined, width: 0 }, point, tolerance);
	});
	if (candidate.hitPoints) { const inside = contains({ points: candidate.hitPoints }, point); return inside.ok && inside.value; }
	if (candidate.kind && !outlineKind(candidate.kind)) return nearLine(candidate, point, tolerance);
	const inside = contains(candidate, point);
	return inside.ok && inside.value;
}

function handleAt(input: {
	readonly candidates: readonly SpatialObjectCandidate[];
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly handleToleranceWorld: number;
}): SelectionTarget {
	if (input.selectedIds.length !== 1) return null;
	const id = input.selectedIds[0];
	const selected = input.candidates.find((candidate) => candidate.id === id);
	if (selected === undefined || (selected.kind !== undefined && selected.kind !== 'wall' && !hasPointHandles(selected.kind))) return null;
	const vertexIndex = selected.points.findIndex((point) => distance(point, input.worldPoint) <= input.handleToleranceWorld);
	return vertexIndex < 0 ? null : { kind: 'handle', id, vertexIndex };
}

/** A transform box handle of the one selected element (plan editor transform box design, Interaction). */
function resizeAt(input: {
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly handleToleranceWorld: number;
	readonly resizeHandles?: { readonly id: string; readonly points: readonly Point[] };
}): SelectionTarget {
	const handles = input.resizeHandles;
	if (!handles || input.selectedIds.length !== 1 || input.selectedIds[0] !== handles.id) return null;
	const handleIndex = handles.points.findIndex(point => distance(point, input.worldPoint) <= input.handleToleranceWorld);
	return handleIndex < 0 ? null : { kind: 'resize', id: handles.id, handleIndex };
}

/**
 * A handle of the one selected opening — its width grips, its move grip, its step arrows and its
 * side chevrons.
 *
 * Exported because `SelectTool.targetAt` has to ask the SAME question before it decides whether a
 * Shift press is a multi-select or a coarse step, and a second predicate spelled beside this one is
 * a second place for "what would a press here grab" to disagree with itself.
 */
export function openingHandleAt(input: {
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly handleToleranceWorld: number;
	readonly openingHandles?: { readonly id: string; readonly handles: readonly OpeningHandle[] };
}): SelectionTarget {
	const set = input.openingHandles;
	if (!set || input.selectedIds.length !== 1 || input.selectedIds[0] !== set.id) return null;
	const hit = set.handles.find(handle => distance(handle.point, input.worldPoint) <= input.handleToleranceWorld);
	return hit ? { kind: 'opening-handle', id: set.id, grip: hit.grip } : null;
}

function labelAt(input: {
	readonly candidates: readonly SpatialObjectCandidate[];
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly labels?: readonly LabelHit[];
	readonly labelToleranceWorld?: number;
}): SelectionTarget {
	const labels = input.labels ?? [], pad = input.labelToleranceWorld ?? 0, { x, y } = input.worldPoint;
	// `labels` arrive in selection order, so where selected captions overlap the most recently selected
	// item's caption wins. A caption whose item is not a candidate (locked, or on a hidden layer) is not
	// drawn to be grabbed.
	for (let index = labels.length - 1; index >= 0; index -= 1) {
		const { id, bounds } = labels[index];
		if (!input.selectedIds.includes(id) || !input.candidates.some(candidate => candidate.id === id)) continue;
		if (x >= bounds.min.x - pad && x <= bounds.max.x + pad && y >= bounds.min.y - pad && y <= bounds.max.y + pad) return { kind: 'label', id };
	}
	return null;
}

function badgeAt(input: {
	readonly candidates: readonly SpatialObjectCandidate[];
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly badgeToleranceWorld?: number;
}): SelectionTarget {
	// Later members are painted last, so overlapping badges follow the visible stacking.
	for (let index = input.selectedIds.length - 1; index >= 0; index -= 1) {
		const id = input.selectedIds[index];
		const anchor = input.candidates.find((candidate) => candidate.id === id)?.points[0];
		if (anchor !== undefined && distance(anchor, input.worldPoint) <= (input.badgeToleranceWorld ?? 0)) {
			return { kind: 'body', id };
		}
	}
	return null;
}

/**
 * The ONE answer to "what would a click here select" (design spec §6.1). Hover asks it to
 * predict, the click asks it to act, so the two cannot disagree. Priority: a single selection's
 * vertex handle, then its opening handle, then its transform box handle, or a multi-selection
 * badge, then a selected item's caption, then the topmost containing body, then nothing.
 * Bodies rank Object → Opening → Wall → other elements → Hatch → Room/Area. Candidates arrive
 * bottom-first; stable sorting preserves paint order within a kind, scanned top-first.
 * Alt bypasses handles and cycles bodies from the current selection, wrapping.
 */
export function resolveSelectionTarget(input: {
	readonly candidates: readonly SpatialObjectCandidate[];
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly handleToleranceWorld: number;
	readonly rotationHandle?: { readonly id: string; readonly bounds: BoundingBox };
	/** The selected element's padded transform box handles, world points in handle order. */
	readonly resizeHandles?: { readonly id: string; readonly points: readonly Point[] };
	/** The selected opening's own handles, world points with the grip each one means. */
	readonly openingHandles?: { readonly id: string; readonly handles: readonly OpeningHandle[] };
	/** Alt selects the next overlapping body, bypassing handles. */
	readonly cycle?: boolean;
	readonly badgeToleranceWorld?: number;
	/** Selected items' drawn captions (ADR-0029); a press on one drags the caption, not the item. */
	readonly labels?: readonly LabelHit[];
	readonly labelToleranceWorld?: number;
}): SelectionTarget {
	if (!input.cycle) {
		// The facade supplies only a visible, permitted hover handle; pressing it owns selection.
		if (input.rotationHandle && rotationControlContains(input.rotationHandle.bounds, input.worldPoint)) return { kind: 'rotation', id: input.rotationHandle.id };
		const decoration = input.selectedIds.length > 1 ? badgeAt(input) : handleAt(input) ?? openingHandleAt(input) ?? resizeAt(input);
		if (decoration !== null) return decoration;
		const label = labelAt(input);
		if (label !== null) return label;
	}
	return bodyAt(input);
}

function bodyAt(input: Parameters<typeof resolveSelectionTarget>[0]): SelectionTarget {
	const hits: string[] = [];
	const candidates = input.candidates.toSorted((a, b) => priority(a) - priority(b));
	for (let index = candidates.length - 1; index >= 0; index -= 1) {
		const candidate = candidates[index];
		if (containsCandidate(candidate, input.worldPoint, input.handleToleranceWorld)) {
			if (!input.cycle) return { kind: 'body', id: candidate.id };
			hits.push(candidate.id);
		}
	}
	if (hits.length === 0) return null;
	const current = hits.findIndex((id) => input.selectedIds.includes(id));
	return { kind: 'body', id: hits[(current + 1) % hits.length] };
}
