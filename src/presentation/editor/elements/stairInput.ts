import { DEFAULT_STAIR, DEFAULT_STAIR_RUN, stairPlanGeometry, stairWithRun, type StairOptions } from '../../../domain/spatial/stairGeometry';
import type { Point } from '../../../core/geometry/Point';
import { formatMetres, parseMetres } from '../shell/formatLength';

export interface StairText { width: string; run: string; treads: string; direction: 'up' | 'down' }
export interface StairEdit { readonly name: string; readonly points: readonly Point[]; readonly stair: StairOptions }
export function stairText(points: readonly Point[], options: StairOptions = DEFAULT_STAIR): StairText {
	return { width: formatMetres(options.width), run: points.length === 2 ? formatMetres(Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)) : formatMetres(DEFAULT_STAIR_RUN), treads: String(options.treads), direction: options.direction };
}
export function parseStairInput(points: readonly Point[], text: StairText, original: StairOptions = DEFAULT_STAIR) {
	const width = parseMetres(text.width), run = parseMetres(text.run), treads = /^\d+$/.test(text.treads.trim()) ? Number(text.treads) : NaN;
	const baseline = stairText(points, original);
	const errors = new Set<keyof StairText>();
	if (!width.ok) errors.add('width');
	if (!run.ok) errors.add('run');
	if (!Number.isInteger(treads) || treads < 1 || treads > 200) errors.add('treads');
	if (text.direction !== 'up' && text.direction !== 'down') errors.add('direction');
	const options: StairOptions = { width: width.ok ? text.width === baseline.width ? original.width : width.mm : 0, treads, direction: text.direction };
	const updated = run.ok ? text.run === baseline.run ? points : stairWithRun(points, run.mm) : null;
	const geometry = updated && stairPlanGeometry(updated, options);
	return { errors, points: geometry ? updated : null, options };
}
