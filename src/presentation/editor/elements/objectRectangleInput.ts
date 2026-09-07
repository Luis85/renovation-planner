import type { Point } from '../../../core/geometry/Point';
import { parseCoordinateMetres, parseMetres, type LengthRefusal } from '../shell/formatLength';

export interface ObjectRectangleText { x: string; y: string; width: string; depth: string }
export type RectangleField = keyof ObjectRectangleText;
export function emptyObjectRectangle(): ObjectRectangleText { return { x: '0', y: '0', width: '', depth: '' }; }

/** A numeric proposal replaces the temporary outline only when explicitly applied. */
export function objectRectangleProposal(text: ObjectRectangleText): { points: Point[] | null; errors: Record<RectangleField, LengthRefusal | null> } {
	const x = parseCoordinateMetres(text.x), y = parseCoordinateMetres(text.y);
	const width = parseMetres(text.width), depth = parseMetres(text.depth);
	const errors = { x: x.ok ? null : x.reason, y: y.ok ? null : y.reason, width: width.ok ? null : width.reason, depth: depth.ok ? null : depth.reason };
	if (!x.ok || !y.ok || !width.ok || !depth.ok) return { points: null, errors };
	const farX = x.mm + width.mm, farY = y.mm + depth.mm;
	if (!Number.isSafeInteger(farX) || !Number.isSafeInteger(farY)) return { points: null, errors: { ...errors, x: Number.isSafeInteger(farX) ? null : 'too-large', y: Number.isSafeInteger(farY) ? null : 'too-large' } };
	return { points: [{ x: x.mm, y: y.mm }, { x: farX, y: y.mm }, { x: farX, y: farY }, { x: x.mm, y: farY }], errors };
}
