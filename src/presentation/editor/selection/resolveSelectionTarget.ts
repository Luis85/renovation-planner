import { contains, distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { SpatialObjectCandidate } from '../tools/select-tool';

export type SelectionTarget =
	| { readonly kind: 'handle'; readonly id: string; readonly vertexIndex: number }
	| { readonly kind: 'body'; readonly id: string }
	| null;

const priority = (candidate: SpatialObjectCandidate): number => candidate.kind === 'opening' ? 2 : candidate.kind === 'wall' ? 1 : 0;

function nearLine(candidate: SpatialObjectCandidate, point: Point, tolerance: number): boolean {
	const [a, b] = candidate.points;
	if (!a || !b) return false;
	const dx = b.x - a.x, dy = b.y - a.y;
	const ratio = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
	return Math.hypot(point.x - a.x - ratio * dx, point.y - a.y - ratio * dy) <= Math.max(tolerance, (candidate.width ?? 0) / 2);
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
	if (selected === undefined || selected.kind === 'opening') return null;
	const vertexIndex = selected.points.findIndex((point) => distance(point, input.worldPoint) <= input.handleToleranceWorld);
	return vertexIndex < 0 ? null : { kind: 'handle', id, vertexIndex };
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
 * vertex handle or a multi-selection badge, then the topmost containing body, then nothing.
 * Candidates arrive bottom-first (the order `ZoneLayer` stacks them); the body scan walks them
 * top-first. Alt bypasses handles and cycles bodies from the current selection, wrapping.
 */
export function resolveSelectionTarget(input: {
	readonly candidates: readonly SpatialObjectCandidate[];
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly handleToleranceWorld: number;
	/** Alt selects the next overlapping body, bypassing handles. */
	readonly cycle?: boolean;
	readonly badgeToleranceWorld?: number;
}): SelectionTarget {
	if (!input.cycle) {
		const decoration = input.selectedIds.length > 1 ? badgeAt(input) : handleAt(input);
		if (decoration !== null) return decoration;
	}
	const hits: string[] = [];
	const candidates = input.candidates.toSorted((a, b) => priority(a) - priority(b));
	for (let index = candidates.length - 1; index >= 0; index -= 1) {
		const candidate = candidates[index];
		const inside = candidate.kind ? { ok: true, value: nearLine(candidate, input.worldPoint, input.handleToleranceWorld) } : contains({ points: candidate.points }, input.worldPoint);
		if (inside.ok && inside.value) {
			if (!input.cycle) return { kind: 'body', id: candidate.id };
			hits.push(candidate.id);
		}
	}
	if (hits.length === 0) return null;
	const current = hits.findIndex((id) => input.selectedIds.includes(id));
	return { kind: 'body', id: hits[(current + 1) % hits.length] };
}
