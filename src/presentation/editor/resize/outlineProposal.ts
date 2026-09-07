import type { Point } from '../../../core/geometry/Point';
import type { Polygon } from '../../../core/geometry/Polygon';
import { areaOutline } from '../add/areaOutline';
import { parseCoordinateMetres, type LengthRefusal } from '../shell/formatLength';
export type CoordinateEdits = readonly Partial<Record<'x' | 'y', string>>[];
/** Undefined means untouched; explicitly retyping the displayed value is still an edit. */
export function outlineProposal(points: readonly Point[], edits: CoordinateEdits, accepts = (value: readonly Point[]) => areaOutline(value).ok): { polygon: Polygon | null; errors: ReadonlyMap<string, LengthRefusal> } {
	const errors = new Map<string, LengthRefusal>();
	const next = points.map((point, index) => {
		const value = { ...point };
		for (const axis of ['x', 'y'] as const) {
			const text = edits[index]?.[axis];
			if (text === undefined) continue;
			const parsed = parseCoordinateMetres(text);
			if (parsed.ok) value[axis] = parsed.mm;
			else errors.set(index + '.' + axis, parsed.reason);
		}
		return value;
	});
	if (errors.size) return { polygon: null, errors };
	return { polygon: accepts(next) ? { points: next } : null, errors };
}
