import type { Point } from '../../core/geometry/Point';

export interface StairOptions { readonly width: number; readonly treads: number; readonly direction: 'up' | 'down' }
export const DEFAULT_STAIR: StairOptions = { width: 900, treads: 12, direction: 'up' };
export const DEFAULT_STAIR_RUN = 3000;
export interface StairPlanGeometry {
	readonly outline: readonly Point[];
	readonly treads: readonly (readonly [Point, Point])[];
	readonly indicator: readonly [Point, Point];
	readonly run: number;
}

function validStairOptions(value: StairOptions): boolean {
	return Number.isFinite(value.width) && value.width >= 1 && value.width <= 1e6
		&& Number.isInteger(value.treads) && value.treads >= 1 && value.treads <= 200
		&& (value.direction === 'up' || value.direction === 'down');
}

/** The ordered centreline and width are the authority; outline/treads/indicator are projections. */
export function stairPlanGeometry(points: readonly Point[], options: StairOptions): StairPlanGeometry | null {
	if (points.length !== 2 || !validStairOptions(options)) return null;
	if (!points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= 1e9 && Math.abs(point.y) <= 1e9)) return null;
	const [start, end] = points, dx = end.x - start.x, dy = end.y - start.y, run = Math.hypot(dx, dy);
	if (run < 1 || run > 1e6) return null;
	const cross = { x: -dy / run * options.width / 2, y: dx / run * options.width / 2 };
	const at = (fraction: number, side = 0): Point => ({ x: start.x + dx * fraction + cross.x * side, y: start.y + dy * fraction + cross.y * side });
	const outline = [at(0, -1), at(1, -1), at(1, 1), at(0, 1)];
	if (!outline.every(point => Math.abs(point.x) <= 1e9 && Math.abs(point.y) <= 1e9)) return null;
	const treads = Array.from({ length: options.treads - 1 }, (_, index): readonly [Point, Point] => [at((index + 1) / options.treads, -1), at((index + 1) / options.treads, 1)]);
	const indicator: readonly [Point, Point] = options.direction === 'up' ? [at(0.16), at(0.84)] : [at(0.84), at(0.16)];
	return { outline, treads, indicator, run };
}

/** Framing, hit testing and group bounds can consume full geometry without storing a duplicate outline. */
export function spatialElementFootprint(element: { readonly kind: string; readonly points: readonly Point[]; readonly stair?: StairOptions }): readonly Point[] {
	if (element.kind !== 'stair') return element.points;
	return element.stair ? stairPlanGeometry(element.points, element.stair)?.outline ?? [] : [];
}

/** Exact run editing anchors the start and preserves the centreline's current bearing. */
export function stairWithRun(points: readonly Point[], run: number): readonly Point[] | null {
	if (points.length !== 2 || !Number.isFinite(run) || run < 1 || run > 1e6) return null;
	const [start, end] = points, length = Math.hypot(end.x - start.x, end.y - start.y);
	if (!Number.isFinite(length) || length === 0) return null;
	return [start, { x: start.x + (end.x - start.x) / length * run, y: start.y + (end.y - start.y) / length * run }];
}
