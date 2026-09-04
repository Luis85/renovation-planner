import { contains, distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { SpatialObjectCandidate } from '../tools/select-tool';

export type SelectionTarget =
	| { readonly kind: 'handle'; readonly id: string; readonly vertexIndex: number }
	| { readonly kind: 'body'; readonly id: string }
	| null;

/**
 * The ONE answer to "what would a click here select" (design spec §6.1). Hover asks it to
 * predict, the click asks it to act, so the two cannot disagree. Priority: a vertex handle of
 * an already-selected record, then the topmost body containing the point, then nothing.
 * Candidates arrive bottom-first (the order `ZoneLayer` stacks them); the body scan walks them
 * top-first. Overlap cycling is not here yet, and this shape leaves room for it.
 */
export function resolveSelectionTarget(input: {
	readonly candidates: readonly SpatialObjectCandidate[];
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly handleToleranceWorld: number;
}): SelectionTarget {
	for (const id of input.selectedIds) {
		const selected = input.candidates.find((candidate) => candidate.id === id);
		if (selected === undefined) continue;
		for (const [vertexIndex, point] of selected.points.entries()) {
			if (distance(point, input.worldPoint) <= input.handleToleranceWorld) {
				return { kind: 'handle', id, vertexIndex };
			}
		}
	}
	for (let index = input.candidates.length - 1; index >= 0; index -= 1) {
		const candidate = input.candidates[index];
		const inside = contains({ points: candidate.points }, input.worldPoint);
		if (inside.ok && inside.value) return { kind: 'body', id: candidate.id };
	}
	return null;
}
