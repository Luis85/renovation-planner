import { boundingBoxOf, area } from '../../../core/geometry/operations';
import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import type { Point } from '../../../core/geometry/Point';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { formatMetres, parseMetres, type LengthRefusal } from '../shell/formatLength';

/** Exact axis alignment, four distinct boundary corners, implicit closure. No polygon repair. */
export function roomDimensions(points: readonly Point[]): BoundingBox | null {
	if (points.length !== 4) return null;
	for (let i = 0; i < points.length; i++) {
		const a = points[i], b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
		if ((a.x === b.x) === (a.y === b.y)) return null;
		if ((a.x === b.x) === (b.x === c.x)) return null;
	}
	const box = boundingBoxOf({ points });
	return box.ok ? box.value : null;
}

export type DimensionsText = { width: string; depth: string };

/**
 * The resized box from an anchor and two lengths. Numeric lengths skip the divide/multiply
 * round trip a scale factor would pay (2900 × (1 / 2900) is not 1). Lived in the transformer
 * scaffold's `normalize-transform.ts` until the polish pass deleted that file (E7); this is
 * its one surviving caller, so it lives here and is exported to nothing.
 */
function boundsFromDimensions(anchor: Point, width: number, height: number): BoundingBox {
	const farX = anchor.x + width;
	const farY = anchor.y + height;
	return {
		min: { x: Math.min(anchor.x, farX), y: Math.min(anchor.y, farY) },
		max: { x: Math.max(anchor.x, farX), y: Math.max(anchor.y, farY) },
	};
}

export function dimensionTexts(box: BoundingBox): DimensionsText {
	return { width: formatMetres(box.max.x - box.min.x), depth: formatMetres(box.max.y - box.min.y) };
}

/** Input events mark retyped display text as exact; untouched axes keep pointer precision. */
export function dimensionProposal(points: readonly Point[], box: BoundingBox, text: DimensionsText, edited: Partial<Record<keyof DimensionsText, boolean>> = {}) {
	const initial = dimensionTexts(box);
	const errors: Record<keyof DimensionsText, LengthRefusal | null> = { width: null, depth: null };
	const sizes = { width: box.max.x - box.min.x, depth: box.max.y - box.min.y };
	for (const axis of ['width', 'depth'] as const) {
		if (!edited[axis] && text[axis] === initial[axis]) continue;
		const parsed = parseMetres(text[axis]);
		if (parsed.ok) sizes[axis] = parsed.mm;
		else errors[axis] = parsed.reason;
	}
	if (errors.width !== null || errors.depth !== null) return { errors, polygon: null, areaMm2: null };
	const resized = boundsFromDimensions(box.min, sizes.width, sizes.depth);
	// Keep vertex order/winding as well as the top-left anchor. This is not bounding-box conversion.
	const polygon = createPolygon(points.map((point) => ({
		x: sizes.width === box.max.x - box.min.x || point.x === box.min.x ? point.x : resized.max.x,
		y: sizes.depth === box.max.y - box.min.y || point.y === box.min.y ? point.y : resized.max.y,
	})));
	if (!polygon.ok || roomDimensions(polygon.value.points) === null) return { errors, polygon: null, areaMm2: null };
	const measured = area(polygon.value);
	if (!measured.ok || !Number.isFinite(measured.value) || measured.value <= 0) return { errors, polygon: null, areaMm2: null };
	return { errors, polygon: polygon.value as Polygon | null, areaMm2: measured.value as number | null };
}
