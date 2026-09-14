import type { Point } from '../../../core/geometry/Point';
import { formatMetres, parseCoordinateMetres } from '../shell/formatLength';

export interface DimensionText { name: string; offset: string }
export interface DimensionEdit { readonly name: string; readonly points: readonly Point[]; readonly offset: number }

export function dimensionText(offset: number, name: string): DimensionText {
	return { name, offset: formatMetres(offset) };
}

/** What the dimension form proposes: a new offset for the unchanged points. A field still showing its stored value keeps the stored millimetres, never their rounded display. */
export function dimensionEdit(points: readonly Point[], stored: number, text: DimensionText): { edit: DimensionEdit | null; invalid: boolean } {
	const parsed = text.offset === formatMetres(stored) ? { ok: true as const, mm: stored } : parseCoordinateMetres(text.offset);
	const name = text.name.trim();
	return { edit: parsed.ok && name ? { name, points, offset: parsed.mm } : null, invalid: !parsed.ok };
}
