import type { Point } from '../../../core/geometry/Point';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { contains } from '../../../core/geometry/operations';
import type { EntityId } from '../../../core/identity/EntityId';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';
import type { SpatialObjectCandidate } from '../tools/select-tool';
import { CLICK_EPSILON_PX } from '../handleMetrics';
import { curvedCandidateIntersection } from './curvedCandidateIntersection';
import type { SelectionInteractions } from './selectionInteractions';

function intersects(a: Point, b: Point, box: BoundingBox): boolean {
	let near = 0, far = 1;
	for (const axis of ['x', 'y'] as const) {
		const delta = b[axis] - a[axis];
		if (delta === 0) { if (a[axis] < box.min[axis] || a[axis] > box.max[axis]) return false; continue; }
		const first = (box.min[axis] - a[axis]) / delta, last = (box.max[axis] - a[axis]) / delta;
		near = Math.max(near, Math.min(first, last)); far = Math.min(far, Math.max(first, last));
		if (near > far) return false;
	}
	return true;
}
function hit(candidate: SpatialObjectCandidate, box: BoundingBox): boolean {
	if (candidate.bulges?.some(value => value !== 0)) return curvedCandidateIntersection(candidate, box);
	const points = candidate.points;
	if (!points.length) return false;
	const closed = !candidate.kind || candidate.kind === 'object';
	if (points.some(point => intersects(point, point, box))) return true;
	if (points.slice(1).some((point, index) => intersects(points[index], point, box))) return true;
	if (!closed) return false;
	const inside = contains({ points }, box.min);
	return intersects(points[points.length - 1], points[0], box) || (inside.ok && inside.value);
}

/** Empty-canvas drag changes selection only; cancellation restores its opening snapshot. */
export class MarqueeSelection {
	private draft: { start: Point; initial: readonly EntityId<string>[]; additive: boolean; deep: boolean } | null = null;
	get active(): boolean { return this.draft !== null; }
	start(context: EditorContext, event: EditorPointerEvent): void {
		this.draft = { start: event.worldPoint, initial: [...context.selection.selectedIds], additive: event.modifiers.shift, deep: event.modifiers.alt };
		if (!event.modifiers.shift) context.selection.clear();
	}
	move(context: EditorContext, event: EditorPointerEvent): void {
		if (!this.draft) return;
		const a = this.draft.start, b = event.worldPoint;
		context.renderState.marquee = { min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }, max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) } };
	}
	finish(context: EditorContext, event: EditorPointerEvent, candidates: readonly SpatialObjectCandidate[], expand?: SelectionInteractions['expandSelection']): void {
		const draft = this.draft;
		if (!draft || event.button !== 'primary') return;
		this.move(context, event);
		const box = context.renderState.marquee;
		if (box && Math.hypot(event.worldPoint.x - draft.start.x, event.worldPoint.y - draft.start.y) > CLICK_EPSILON_PX * context.viewport.worldPerScreenPixel()) {
			const retained = expand ? draft.initial.flatMap(id => expand(id, true)) : draft.initial.filter(id => candidates.some(candidate => candidate.id === id));
			const initial = draft.additive ? retained : [];
			const hits = candidates.filter(candidate => hit(candidate, box)).flatMap(candidate => expand?.(candidate.id, draft.deep) ?? [candidate.id]);
			context.selection.select([...new Set([...initial, ...hits])].map(id => id as EntityId<string>));
		}
		this.draft = null; context.renderState.marquee = null;
	}
	cancel(context: EditorContext): void {
		if (this.draft) context.selection.select(this.draft.initial);
		this.draft = null; context.renderState.marquee = null;
	}
}
